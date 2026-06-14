/* ──────────────────────────────────────────────────────────
   Inngest Function: yoalgoritma/campaign-improvements.user (Faz 3)

   Hiyerarşik geliştirme kartları. Tek kullanıcı için:
     1. fetch      — aktif Meta + Google kampanya ağacı (campaign→adset→ad)
     2. reconcile  — lifecycle:
                     • karar verilmiş (approved/applied/rejected) kartı olan
                       kampanya DONDURULUR (regenerate yok, karar korunur)
                     • aktif + dondurulmamış kampanyanın pending alt-ağacı
                       superseded → yeniden üretilir (haftalık tazeleme)
                     • pasif kampanyanın pending alt-ağacı cancelled
     3. submit     — kampanya başına 1 Batch API isteği (a kararı)
     4. poll       — batch ended olana kadar bekle
     5. persist    — account_alerts + campaign→adset→ad (FK zinciri) yaz

   account_alerts SADECE platformun ilk kampanya isteğinde üretilir.
   Eski per-ad (ai_ad_improvements) + ai_suggestions akışları ETKİLENMEZ.
   ────────────────────────────────────────────────────────── */

import { inngest } from '../client'
import { getAnthropicClient, isAnthropicReady } from '@/lib/anthropic/client'
import { gatherUserScanInputs, writeHierRunStatus, type UserScanInputs } from '@/lib/yoai/ai/scanUser'
import { buildPerCampaignBatchRequestParams, parsePerCampaignBatchResult } from '@/lib/yoai/ai/perCampaignAgent'
import { officialKnowledgeBlock, type SystemBlock } from '@/lib/yoai/ai/docs/officialKnowledgeBlock'
import type { PerCampaignContext, AccountCampaignSummary } from '@/lib/yoai/ai/perCampaignPrompt'
import {
  listRecentCampaignImprovements,
  listRecentAdsetImprovements,
  listRecentAdImprovements,
  supersedePendingCampaignSubtree,
  cancelPendingCampaignSubtree,
  supersedePendingAccountAlerts,
  insertAccountAlert,
  insertCampaignImprovement,
  insertAdsetImprovement,
  insertAdImprovement,
} from '@/lib/yoai/ai/hierarchicalStore'
import { translateEnum } from '@/lib/yoai/translations'
import type { AiPlatform } from '@/lib/yoai/ai/types'
import type { DeepCampaignInsight } from '@/lib/yoai/analysisTypes'
import type { YoaiScope } from '@/lib/yoai/businessScope'
import { buildBusinessKey, normalizeMetaAccountId, normalizeGoogleCustomerId } from '@/lib/yoai/businessKey'

const POLL_INTERVAL = '60s'
const MAX_POLLS = 1440 // ~24h (Anthropic batch SLA)

interface ActiveCampaign {
  platform: 'meta' | 'google'
  aiPlatform: AiPlatform
  accountId: string
  campaign: DeepCampaignInsight
  key: string
}

function flattenActiveCampaigns(scanInputs: UserScanInputs): ActiveCampaign[] {
  const out: ActiveCampaign[] = []
  for (const data of [scanInputs.meta, scanInputs.google]) {
    if (!data.connected) continue
    const platform: 'meta' | 'google' = data.platform === 'Meta' ? 'meta' : 'google'
    for (const c of data.campaigns) {
      if (!c.id) continue
      out.push({
        platform,
        aiPlatform: data.platform,
        accountId: data.accountId ?? '',
        campaign: c,
        key: `${platform}:${c.id}`,
      })
    }
  }
  return out
}

function sanitizeCustomId(platform: string, campaignId: string): string {
  return `c_${platform}_${campaignId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
}

export const yoalgoritmaPerCampaignImprovements = inngest.createFunction(
  {
    id: 'yoalgoritma-per-campaign-improvements',
    name: 'YoAlgoritma — Hiyerarşik Geliştirme Kartları',
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: 'yoalgoritma/campaign-improvements.user' }],
  },
  async ({ event, step, logger }) => {
    const userId = String(event.data?.userId ?? '')
    if (!userId) throw new Error('userId zorunlu')
    // Çoklu işletme (Faz 1): cron fan-out scope'u event.data'ya gömer (headless,
    // cookie yok). scope yoksa/scoped=false → mevcut birleşik davranış (sıfır regresyon).
    const scope = (event.data?.scope ?? undefined) as YoaiScope | undefined
    const scoped = scope?.scoped === true
    const accountSig = scoped ? `${scope!.metaId ?? '-'}|${scope!.googleCustomerId ?? '-'}` : 'all'

    // R2 (KART KAYBI KORUMASI): ANTHROPIC_API_KEY yoksa supersede/reconcile'dan ÖNCE çık.
    // Aksi halde eski pending kartlar superseded edilip yeni üretim API key'siz patlardı → tüm kart kaybı, iz yok.
    if (!isAnthropicReady()) {
      logger.error(`[campaign-improvements] ${userId}: ANTHROPIC_API_KEY yok — atlandı (supersede YOK, kart kaybı yok)`)
      await writeHierRunStatus({ userId, accountSig, status: 'failed', note: 'ANTHROPIC_API_KEY missing' })
      return { userId, generated: 0, reason: 'no-api-key' }
    }
    // R1 (SESSİZLİĞİ KIR): koşu başladı — başarısızlıkta bu satır 'running'da kalır (sağlık bekçisi stale-running yakalar).
    await step.run('run-status-running', async () => { await writeHierRunStatus({ userId, accountSig, status: 'running' }); return { ok: true } })

    // 0) Rakip cache'ini bu çalıştırma için tazele — gatherUserScanInputs okumadan ÖNCE.
    //    Flag (YOALGORITMA_SCRAPE_COMPETITORS) kapalıysa anında no-op; açıksa beyan edilen
    //    rakipler scrape edilir. Böylece scan.user ile yarış olmadan rakip bloğu prompt'a girer.
    await step.run('scrape-competitors', async () => {
      try {
        const { scrapeDeclaredCompetitors } = await import('@/lib/yoai/ai/competitorScanStep')
        return await scrapeDeclaredCompetitors(userId)
      } catch (e) {
        logger.warn(`[campaign-improvements] ${userId}: competitor scrape soft-fail: ${e instanceof Error ? e.message : e}`)
        return { enabled: false, reason: 'error', attempted: 0, scraped: 0, cachedSkipped: 0, errors: 1 }
      }
    })

    // 1) Fetch aktif kampanya ağacı + bağlam (scope varsa yalnız o işletmenin hesabı/profili)
    const scanInputs = await step.run('fetch-user-data', async () => gatherUserScanInputs(userId, scope))
    const allCampaigns = flattenActiveCampaigns(scanInputs)

    if (allCampaigns.length === 0) {
      await writeHierRunStatus({ userId, accountSig, status: 'completed', note: 'no-active-campaigns' })
      return { userId, generated: 0, reason: 'no-active-campaigns' }
    }

    // R5: ÇEKİM BAŞARISIZ olan platformları "şüpheli" işaretle. Bu platformların pending
    // kartlarını reconcile İPTAL ETMEZ (cancel terminal!) — geçici bir API hatasını
    // "kampanya pasif" sanıp tüm kartları silmek felaket olurdu. Cancel sağlıklı taramaya ertelenir.
    const suspectPlatforms = new Set<'meta' | 'google'>()
    for (const p of ['meta', 'google'] as const) {
      const d = p === 'meta' ? scanInputs.meta : scanInputs.google
      if (d.fetchError || !d.connected || d.errors.length > 0) suspectPlatforms.add(p)
    }
    if (suspectPlatforms.size) {
      logger.warn(`[campaign-improvements] ${userId}: şüpheli (çekim hatalı) platformlar — cancel atlanıyor: ${[...suspectPlatforms].join(',')}`)
    }

    // 2) Reconcile (lifecycle): freeze-on-decision, else weekly refresh
    const plan = await step.run('reconcile-lifecycle', async () => {
      const [recentCamp, recentAdset, recentAd] = await Promise.all([
        listRecentCampaignImprovements(userId, 300),
        listRecentAdsetImprovements(userId, 1000),
        listRecentAdImprovements(userId, 1000),
      ])
      const decided = new Set(['approved', 'applied', 'rejected_by_user'])
      const frozen = new Set<string>()
      const seenCampaignKeys = new Set<string>()
      const note = (platform: string | null, campaignId: string | null, status: string) => {
        if (!platform || !campaignId) return
        const key = `${platform}:${campaignId}`
        seenCampaignKeys.add(key)
        if (decided.has(status)) frozen.add(key)
      }
      for (const r of recentCamp) note(r.source_platform, r.campaign_id, r.status)
      for (const r of recentAdset) note(r.source_platform, r.campaign_id, r.status)
      for (const r of recentAd) note(r.source_platform, r.campaign_id, r.status)

      const activeKeys = new Set(allCampaigns.map((c) => c.key))

      // pasif kampanyaların pending alt-ağacını iptal et
      let cancelled = 0, cancelSkippedSuspect = 0
      for (const key of seenCampaignKeys) {
        if (activeKeys.has(key) || frozen.has(key)) continue
        const idx = key.indexOf(':')
        const platform = key.slice(0, idx) as 'meta' | 'google'
        const campaignId = key.slice(idx + 1)
        // R5: çekimi başarısız platformda İPTAL ETME (geçici hatayı pasiflik sanma)
        if (suspectPlatforms.has(platform)) { cancelSkippedSuspect++; continue }
        await cancelPendingCampaignSubtree(userId, platform, campaignId, 'Otomatik iptal: kampanya aktif değil')
        cancelled++
      }
      if (cancelSkippedSuspect) logger.warn(`[campaign-improvements] ${userId}: ${cancelSkippedSuspect} kart iptali ATLANDI (şüpheli platform — sağlıklı taramaya ertelendi)`)

      // R4 (ATOMİKLİK): üretilecekler aktif + dondurulmamış. Pending alt-ağaç supersede'i
      // BURADA YAPILMAZ — batch başarısız olursa (errored/SLA) eski kartları silip yerine
      // yeni koymadan bırakırdık = KART KAYBI. supersede artık yeni kart ELDE EDİLDİKTEN
      // sonra persist adımında kampanya-kampanya yapılır. Burada yalnız planlıyoruz.
      const generateKeys: string[] = []
      const supersedeKeys: string[] = []
      for (const c of allCampaigns) {
        if (frozen.has(c.key)) continue // karar verilmiş kampanya — dokunma
        if (seenCampaignKeys.has(c.key)) supersedeKeys.push(c.key)
        generateKeys.push(c.key)
      }
      return { cancelled, supersedeKeys, generateKeys }
    })

    const toGenerate = allCampaigns.filter((c) => plan.generateKeys.includes(c.key))
    logger.info(`[campaign-improvements] ${userId}: aktif=${allCampaigns.length} üretilecek=${toGenerate.length} iptal=${plan.cancelled} supersedePlanned=${plan.supersedeKeys.length}`)

    if (toGenerate.length === 0) {
      await writeHierRunStatus({ userId, accountSig, status: 'completed', note: 'all-frozen (karar verilmiş kampanyalar)' })
      return { userId, generated: 0, cancelled: plan.cancelled, superseded: 0, reason: 'all-frozen' }
    }

    // NOT (R4): Eski hesap uyarılarının supersede'i de batch başarısından SONRAYA taşındı
    // ('supersede-account-alerts' adımı retrieve-batch'ten sonra, yalnız başarılı-uyarılı
    // platformlar için çalışır). Böylece batch patlarsa eski uyarılar da kaybolmaz.

    // 3) Kampanya başına 1 batch request; ilk-per-platform → account_alerts üret
    const summaryByPlatform: Record<'meta' | 'google', AccountCampaignSummary[]> = { meta: [], google: [] }
    for (const c of allCampaigns) {
      summaryByPlatform[c.platform].push({
        name: c.campaign.campaignName,
        objective_label: translateEnum(c.campaign.objective || c.campaign.channelType, 'tr', c.platform),
        daily_budget: c.campaign.dailyBudget,
        spend: c.campaign.metrics.spend,
        conversions: c.campaign.metrics.conversions,
      })
    }

    // 2b) Deterministik yapısal sinyaller (doctrine fit + StructuralIssue) — kural motoru.
    //     type_mismatch ve yapısal öneriler artık saf LLM yargısı değil; bu sinyaller prompt'a girer.
    //     Fallback-güvenli (doctrine tablosu yoksa hardcoded'a düşer); hata → boş, akış kırılmaz.
    const structuralByCampaign = await step.run('structural-signals', async () => {
      const map: Record<string, string> = {}
      try {
        const { getDoctrineMap } = await import('@/lib/yoai/platformDoctrineStore')
        const { normalizeCampaignType, buildCampaignTypeContext } = await import('@/lib/yoai/campaignTypeIntelligence')
        const { runStructuralAnalysis } = await import('@/lib/yoai/platformKnowledge')
        const doctrineMap = await getDoctrineMap()
        const insights = allCampaigns.map((c) => c.campaign)
        const structural = runStructuralAnalysis(insights)
        const issuesByCampaign = new Map<string, typeof structural.issues>()
        for (const iss of structural.issues) {
          if (!issuesByCampaign.has(iss.campaignId)) issuesByCampaign.set(iss.campaignId, [])
          issuesByCampaign.get(iss.campaignId)!.push(iss)
        }
        for (const insight of insights) {
          const normalized = normalizeCampaignType(insight)
          const doctrine = doctrineMap[normalized.campaignType] || null
          const typeCtx = buildCampaignTypeContext(insight, doctrine)
          const lines: string[] = []
          if (typeCtx.promptSummary) lines.push(typeCtx.promptSummary)
          const issues = issuesByCampaign.get(insight.id) ?? []
          if (issues.length) {
            lines.push('Tespit edilen yapısal sorunlar:')
            for (const iss of issues) {
              lines.push(`- [${iss.severity}] ${iss.title}: mevcut "${iss.currentValue}" → önerilen "${iss.recommendedValue}". ${iss.reasoning}`)
            }
          }
          if (lines.length) map[insight.id] = lines.join('\n')
        }
      } catch (e) {
        logger.warn(`[campaign-improvements] structural signals skipped: ${e instanceof Error ? e.message : e}`)
      }
      return map
    })

    const customToCampaign = new Map<string, ActiveCampaign>()
    const firstPerPlatform = new Set<'meta' | 'google'>()
    // Hangi isteğin account_alerts taşıdığı (ilk-per-platform) — persist + supersede için.
    const alertRequestIds = new Set<string>()
    const batchRequests: Array<{ custom_id: string; params: ReturnType<typeof buildPerCampaignBatchRequestParams> }> = []
    // Onaylı resmi bilgi bloğu (alt-proje B) — platform başına bir kez fetch (empty-safe)
    const kbCache = new Map<'Meta' | 'Google', SystemBlock | null>()
    const getKb = async (p: 'Meta' | 'Google'): Promise<SystemBlock[] | undefined> => {
      if (!kbCache.has(p)) kbCache.set(p, await officialKnowledgeBlock(p))
      const b = kbCache.get(p)
      return b ? [b] : undefined
    }
    for (const c of toGenerate) {
      const customId = sanitizeCustomId(c.platform, c.campaign.id)
      if (customToCampaign.has(customId)) continue
      customToCampaign.set(customId, c)
      const includeAccountAlerts = !firstPerPlatform.has(c.platform)
      if (includeAccountAlerts) { firstPerPlatform.add(c.platform); alertRequestIds.add(customId) }
      const ctx: PerCampaignContext = {
        platform: c.aiPlatform,
        accountId: c.accountId,
        campaign: c.campaign,
        industry: scanInputs.industry,
        includeAccountAlerts,
        accountCampaignsSummary: includeAccountAlerts ? summaryByPlatform[c.platform] : undefined,
        structuralSignals: structuralByCampaign[c.campaign.id],
      }
      const competitorContext = c.aiPlatform === 'Meta' ? scanInputs.competitorContext.meta : scanInputs.competitorContext.google
      const extraBlocks = await getKb(c.aiPlatform)
      batchRequests.push({
        custom_id: customId,
        params: buildPerCampaignBatchRequestParams({ ctx, businessContext: scanInputs.businessContext, competitorContext }, extraBlocks),
      })
    }

    // 4) Submit batch
    const batch = await step.run('submit-batch', async () => {
      const client = getAnthropicClient()
      const b = await client.messages.batches.create({ requests: batchRequests as any })
      return { id: b.id }
    })
    logger.info(`[campaign-improvements] ${userId}: batch submitted id=${batch.id} requests=${batchRequests.length}`)

    // 5) Poll until ended
    let ended = false
    for (let i = 0; i < MAX_POLLS; i++) {
      await step.sleep(`wait-poll-${i}`, POLL_INTERVAL)
      const status = await step.run(`poll-${i}`, async () => {
        const client = getAnthropicClient()
        const b = await client.messages.batches.retrieve(batch.id)
        return b.processing_status
      })
      if (status === 'ended') { ended = true; break }
    }
    if (!ended) {
      await writeHierRunStatus({ userId, accountSig, status: 'failed', note: `Batch ${batch.id} 24h içinde tamamlanmadı (SLA)` })
      throw new Error(`Batch ${batch.id} 24h içinde tamamlanmadı`)
    }

    // 6a) Retrieve + parse — TEK adımda batch sonuçlarını materyalize et (stream tek seferlik).
    //     Sadece okuma/parse; DB yazımı YOK → bu adım tekrar ederse yan etki olmaz.
    const batchData = await step.run('retrieve-batch', async () => {
      const client = getAnthropicClient()
      const stream = await client.messages.batches.results(batch.id)
      const items: Array<{ custom_id: string; model: string; result: any; hasAlerts: boolean }> = []
      let failed = 0
      const alertPlatforms = new Set<'meta' | 'google'>()
      for await (const r of stream) {
        const c = customToCampaign.get(r.custom_id)
        if (!c) continue
        // Sıra 1b: errored/expired/canceled AYIR + Anthropic hata detayını logla (sessizce yutma).
        if (r.result?.type !== 'succeeded') {
          failed++
          const errType = (r.result as any)?.error?.error?.type ?? r.result?.type ?? 'unknown'
          const errMsg = (r.result as any)?.error?.error?.message ?? ''
          if (r.result?.type === 'errored') logger.error(`[campaign-improvements] batch ERRORED custom_id=${r.custom_id} campaign=${c.campaign.id} type=${errType} ${errMsg}`)
          else logger.warn(`[campaign-improvements] batch ${r.result?.type} custom_id=${r.custom_id} campaign=${c.campaign.id}`)
          continue
        }
        const model = batchRequests.find((b) => b.custom_id === r.custom_id)?.params.model ?? 'unknown'
        const { result } = parsePerCampaignBatchResult(r.result.message as any, model, 0, c.campaign.id)
        const hasAlerts = alertRequestIds.has(r.custom_id)
        if (hasAlerts) alertPlatforms.add(c.platform) // istek başarılı + uyarı taşıyor → eski uyarılar artık supersede edilebilir
        items.push({ custom_id: r.custom_id, model, result, hasAlerts })
      }
      return { items, failed, alertPlatforms: [...alertPlatforms] }
    })

    // 6b) R4: Eski hesap uyarılarını ŞİMDİ supersede et — yalnız batch BAŞARILI olan ve uyarı
    //     üreten platformlar için. Batch patlasaydı bu adıma hiç gelinmezdi → eski uyarılar sağlam.
    await step.run('supersede-account-alerts', async () => {
      const platforms = batchData.alertPlatforms as Array<'meta' | 'google'>
      if (platforms.length === 0) return { superseded: [] as string[] }
      if (scoped) {
        for (const p of platforms) {
          const acc = p === 'meta' ? normalizeMetaAccountId(scope!.metaId) : normalizeGoogleCustomerId(scope!.googleCustomerId)
          if (acc) await supersedePendingAccountAlerts(userId, acc)
        }
      } else {
        // legacy (scope kapalı): platform ayrımı yok → tek sefer tüm pending uyarıları supersede.
        await supersedePendingAccountAlerts(userId)
      }
      return { superseded: platforms }
    })

    // 6c) Persist — KAMPANYA BAŞINA ayrı Inngest step. Bir kampanya başarıyla yazıldıysa
    //     retry'de o step memoize edilir → tekrar yazılmaz (duplike yok, omddq'da unique index
    //     garanti olmasa bile). supersede (eski pending alt-ağaç) ARTIK burada, yeni kart
    //     yazılmadan hemen önce yapılır (batch öncesi değil) — kart kaybı imkânsız.
    const supersedeSet = new Set(plan.supersedeKeys)
    type PersistCounts = { alertCount: number; campaignCount: number; adsetCount: number; adCount: number; alreadyStrong: number; parseFailed: number }
    const persistOutcomes: PersistCounts[] = []
    for (const item of batchData.items) {
      const c = customToCampaign.get(item.custom_id)
      if (!c) continue
      const outcome = await step.run(`persist-${item.custom_id}`, async (): Promise<PersistCounts> => {
        const result = item.result
        const model = item.model
        const counts: PersistCounts = { alertCount: 0, campaignCount: 0, adsetCount: 0, adCount: 0, alreadyStrong: 0, parseFailed: 0 }

        // account_alerts (yalnız ilk-per-platform isteğinden; eskiler 6b'de supersede edildi).
        if (item.hasAlerts && Array.isArray(result.account_alerts)) {
          const alertAccountId = c.platform === 'meta'
            ? normalizeMetaAccountId(scope?.metaId)
            : normalizeGoogleCustomerId(scope?.googleCustomerId)
          const alertBusinessKey = buildBusinessKey(scope?.metaId, scope?.googleCustomerId)
          for (const al of result.account_alerts) {
            const res = await insertAccountAlert({
              user_id: userId,
              source_platform: c.platform,
              account_id: alertAccountId,
              business_key: alertBusinessKey,
              alert_type: al.alert_type,
              severity: al.severity,
              title: al.title,
              body: al.body,
              recommended_action: al.recommended_action,
              confidence: al.confidence,
              model,
              run_id: null,
            })
            if (res.ok) counts.alertCount++
          }
        }

        // campaign improvement — null ise (truncation/bozuk JSON) kampanya kartsız kalır:
        // Sıra 6c: sessizce atlanmıyor, parseFailed sayılıp loglanıyor (run-status 'partial'e yansır).
        const ci = result.campaign_improvement
        if (!ci) {
          counts.parseFailed++
          logger.error(`[campaign-improvements] campaign_improvement ÜRETİLEMEDİ custom_id=${item.custom_id} campaign=${c.campaign.id} — JSON kesik/bozuk olabilir (kart yok).`)
          return counts
        }

        // R4: Yeni kart ELDE — ŞİMDİ eski pending alt-ağacı supersede et (insert'ten ÖNCE,
        // yeni kayıtlar pending kalsın). Batch öncesi yapılsaydı patlamada kart kaybı olurdu.
        if (supersedeSet.has(c.key)) {
          await supersedePendingCampaignSubtree(userId, c.platform, c.campaign.id)
        }

        const { id: campImpId } = await insertCampaignImprovement({
          user_id: userId,
          source_platform: c.platform,
          campaign_id: c.campaign.id,
          campaign_name: c.campaign.campaignName,
          source_campaign_status_snapshot: c.campaign.effectiveStatus || c.campaign.status,
          current_objective: c.campaign.objective || c.campaign.channelType || null,
          type_mismatch: ci.type_mismatch,
          reasoning: ci.reasoning,
          improvement_payload: {
            suggestions: ci.suggestions,
            type_mismatch_alert: ci.type_mismatch_alert,
            current_objective_label: ci.current_objective_label,
            recommended_objective_label: ci.recommended_objective_label,
          },
          confidence: ci.confidence,
          publish_mode: 'manual_publish',
          model,
        })
        if (!campImpId) return counts
        counts.campaignCount++

        // ad → adset eşlemesi (AI ad_id döner; ağaçtan adset'i buluruz)
        const adToAdset = new Map<string, string>()
        const adsetMetaById = new Map(c.campaign.adsets.map((as) => [as.id, as]))
        for (const as of c.campaign.adsets) for (const ad of as.ads) adToAdset.set(ad.id, as.id)

        // adset improvements
        const adsetImpIdByAdsetId = new Map<string, string>()
        for (const ai of result.adset_improvements) {
          const asMeta = adsetMetaById.get(ai.adset_id)
          const { id } = await insertAdsetImprovement({
            user_id: userId,
            campaign_improvement_id: campImpId,
            source_platform: c.platform,
            campaign_id: c.campaign.id,
            adset_id: ai.adset_id,
            adset_name: asMeta?.name ?? null,
            source_adset_status_snapshot: asMeta?.status ?? null,
            reasoning: ai.reasoning,
            improvement_payload: { suggestions: ai.suggestions },
            confidence: ai.confidence,
            publish_mode: 'manual_publish',
            model,
          })
          if (id) { adsetImpIdByAdsetId.set(ai.adset_id, id); counts.adsetCount++ }
        }

        // ad improvements (improve + ad_spec olanlar)
        for (const adi of result.ad_improvements) {
          if (adi.keep_or_improve !== 'improve' || !adi.ad_spec) { counts.alreadyStrong++; continue }
          const adsetId = adToAdset.get(adi.ad_id)
          let adsetImpId = adsetId ? adsetImpIdByAdsetId.get(adsetId) : undefined
          // AI bu ad set için öneri vermediyse, FK için minimal bir adset kartı oluştur
          if (!adsetImpId && adsetId) {
            const asMeta = adsetMetaById.get(adsetId)
            const { id } = await insertAdsetImprovement({
              user_id: userId,
              campaign_improvement_id: campImpId,
              source_platform: c.platform,
              campaign_id: c.campaign.id,
              adset_id: adsetId,
              adset_name: asMeta?.name ?? null,
              source_adset_status_snapshot: asMeta?.status ?? null,
              reasoning: '',
              improvement_payload: { suggestions: [] },
              confidence: 0,
              publish_mode: 'manual_publish',
              model,
            })
            if (id) { adsetImpId = id; adsetImpIdByAdsetId.set(adsetId, id); counts.adsetCount++ }
          }
          if (!adsetImpId) continue // parent yoksa bağlanamaz

          let adMeta: DeepCampaignInsight['adsets'][number]['ads'][number] | undefined
          for (const as of c.campaign.adsets) {
            const f = as.ads.find((a) => a.id === adi.ad_id)
            if (f) { adMeta = f; break }
          }
          const res = await insertAdImprovement({
            user_id: userId,
            adset_improvement_id: adsetImpId,
            source_platform: c.platform,
            campaign_id: c.campaign.id,
            adset_id: adsetId ?? null,
            ad_id: adi.ad_id,
            ad_name: adMeta?.name ?? null,
            source_ad_status_snapshot: adMeta?.status ?? null,
            source_creative_hash: adMeta?.creativeHash ?? null,
            reasoning: adi.reasoning,
            improvement_payload: {
              ad_spec: adi.ad_spec,
              reasoning: adi.reasoning,
              competitor_comparison: adi.competitor_comparison,
              compliance_notes: adi.compliance_notes,
              confidence: adi.confidence,
            },
            confidence: adi.confidence,
            publish_mode: c.platform === 'meta' ? 'auto' : 'manual_publish',
            model,
          })
          if (res.ok) counts.adCount++
        }
        return counts
      })
      persistOutcomes.push(outcome)
    }

    const persisted = persistOutcomes.reduce<PersistCounts>((a, o) => ({
      alertCount: a.alertCount + o.alertCount,
      campaignCount: a.campaignCount + o.campaignCount,
      adsetCount: a.adsetCount + o.adsetCount,
      adCount: a.adCount + o.adCount,
      alreadyStrong: a.alreadyStrong + o.alreadyStrong,
      parseFailed: a.parseFailed + o.parseFailed,
    }), { alertCount: 0, campaignCount: 0, adsetCount: 0, adCount: 0, alreadyStrong: 0, parseFailed: 0 })
    const failedCount = batchData.failed

    // R1: KOŞU DURUMU — hiç kart üretilmediyse 'failed', kısmen üretildiyse 'partial', sorunsuzsa 'completed'.
    const hadProblems = failedCount > 0 || persisted.parseFailed > 0
    const runStatus = persisted.campaignCount === 0
      ? 'failed'
      : hadProblems ? 'partial' : 'completed'
    await writeHierRunStatus({
      userId, accountSig, status: runStatus,
      note: `üretildi=${persisted.campaignCount}/${toGenerate.length} batchFail=${failedCount} parseFail=${persisted.parseFailed}`,
    })

    return {
      userId,
      batchId: batch.id,
      runStatus,
      accountAlerts: persisted.alertCount,
      campaigns: persisted.campaignCount,
      adsets: persisted.adsetCount,
      ads: persisted.adCount,
      alreadyStrong: persisted.alreadyStrong,
      failed: failedCount,
      parseFailed: persisted.parseFailed,
      cancelled: plan.cancelled,
      superseded: supersedeSet.size,
    }
  },
)
