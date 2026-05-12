/* ──────────────────────────────────────────────────────────
   Daily Active Campaign Intelligence — Faz: Günlük Tarama

   Her gün aktif Google/Meta kampanyalarını tarar, mevcut
   önerileri (yoai_pending_approvals) kampanya durumuna göre
   yeniden değerlendirir.

   Kararlar:
     keep_existing          → öneri geçerli, dokunma
     update_recommendation  → kampanyada değişim var, yenile
     mark_stale             → kampanya kapandı / çok eski
     needs_review           → belirsizlik var, insan kontrolü
     no_action              → kampanya yok, öneri genel

   Stale statüler → yoai_pending_approvals.status = 'expired'
   DB migration gerekmez; metadata.stale_reason ayrıntı taşır.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight } from './analysisTypes'
import type { PendingApprovalRecord } from './approvalStore'

/** Öneri en fazla bu kadar gün işlemsiz kalabilir. */
const PROPOSAL_MAX_AGE_DAYS = 30

/** Aktif sayılan kampanya statüs değerleri (platform bağımsız). */
const INACTIVE_STATUSES = new Set([
  'DELETED', 'REMOVED', 'ARCHIVED',
  'deleted', 'removed', 'archived',
])

// PAUSED kampanyalar için öneriyi hemen stale yapmıyoruz; "needs_review" dönüyor.
const PAUSED_STATUSES = new Set(['PAUSED', 'paused'])

export type CampaignEvalDecision =
  | 'keep_existing'
  | 'update_recommendation'
  | 'mark_stale'
  | 'needs_review'
  | 'no_action'

export type StaleReason =
  | 'campaign_inactive'
  | 'campaign_deleted'
  | 'landing_url_changed'
  | 'creative_changed'
  | 'objective_changed'
  | 'proposal_too_old'
  | 'superseded_by_newer'

export interface CampaignEvalResult {
  proposalId: string
  approvalId: string
  campaignId: string | null
  platform: string
  decision: CampaignEvalDecision
  staleReason?: StaleReason
  reason: string
}

export interface DailyIntelligenceScanSummary {
  scannedProposals: number
  markedStale: number
  kept: number
  toUpdate: number
  needsReview: number
  byPlatform: Record<string, { scanned: number; stale: number; kept: number; needsReview: number }>
}

export interface DailyIntelligenceScanResult {
  evaluations: CampaignEvalResult[]
  proposalsToMarkStale: Array<{ proposalId: string; approvalId: string; staleReason: StaleReason }>
  proposalsToMarkNeedsReview: Array<{ proposalId: string; approvalId: string; reason: string }>
  proposalsToKeep: string[]
  campaignsNeedingUpdate: string[]
  summary: DailyIntelligenceScanSummary
}

/* ── URL karşılaştırma yardımcıları ─────────────────────── */

function normalizeUrl(url: string | undefined | null): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    // UTM parametreleri çıkarılarak temel URL karşılaştırması yapılır
    u.searchParams.delete('utm_source')
    u.searchParams.delete('utm_medium')
    u.searchParams.delete('utm_campaign')
    u.searchParams.delete('utm_content')
    u.searchParams.delete('utm_term')
    return (u.origin + u.pathname).replace(/\/$/, '').toLowerCase()
  } catch {
    return url.replace(/\/$/, '').toLowerCase()
  }
}

type AnyRecord = Record<string, unknown>

function extractUrlsFromCampaign(campaign: DeepCampaignInsight): string[] {
  const urls: string[] = []
  if (Array.isArray(campaign.adsets)) {
    for (const adset of campaign.adsets) {
      if (Array.isArray(adset.ads)) {
        for (const ad of adset.ads) {
          const adAny = ad as unknown as AnyRecord
          const c = (adAny.creative as AnyRecord | undefined) ?? adAny
          if (typeof c.link_url === 'string') urls.push(c.link_url)
          if (typeof c.website_url === 'string') urls.push(c.website_url)
          if (typeof ad.linkUrl === 'string') urls.push(ad.linkUrl)
          const finalUrls = adAny.finalUrls
          if (Array.isArray(finalUrls)) urls.push(...(finalUrls as string[]))
          const final_urls = adAny.final_urls
          if (Array.isArray(final_urls)) urls.push(...(final_urls as string[]))
        }
      }
    }
  }
  const campaignAny = campaign as unknown as AnyRecord
  if (typeof campaignAny.finalUrl === 'string') urls.push(campaignAny.finalUrl)
  return [...new Set(urls.filter(Boolean))]
}

function extractCreativeFingerprint(campaign: DeepCampaignInsight): string {
  const texts: string[] = []
  if (Array.isArray(campaign.adsets)) {
    for (const adset of campaign.adsets) {
      if (Array.isArray(adset.ads)) {
        for (const ad of adset.ads) {
          const adAny = ad as unknown as AnyRecord
          const c = (adAny.creative as AnyRecord | undefined) ?? adAny
          const body = c.body ?? ad.creativeBody
          const title = c.title ?? ad.creativeTitle
          if (typeof body === 'string') texts.push(body.substring(0, 50))
          if (typeof title === 'string') texts.push(title.substring(0, 30))
          const headlines = adAny.headlines
          if (Array.isArray(headlines)) {
            headlines.slice(0, 3).forEach((h: unknown) => {
              const text = typeof h === 'string' ? h : (h as AnyRecord)?.text
              if (typeof text === 'string') texts.push(text.substring(0, 30))
            })
          }
        }
      }
    }
  }
  return texts.join('|').toLowerCase()
}

/* ── Ana tarama fonksiyonu ───────────────────────────────── */

/**
 * Aktif kampanyalar ile mevcut önerileri karşılaştırır.
 * Sonuç: hangi öneriler stale, hangisi güncellenmeli, hangisi geçerli.
 */
export function runDailyActiveCampaignIntelligence(
  activeCampaigns: DeepCampaignInsight[],
  existingApprovals: PendingApprovalRecord[],
): DailyIntelligenceScanResult {
  const evaluations: CampaignEvalResult[] = []
  const proposalsToMarkStale: Array<{ proposalId: string; approvalId: string; staleReason: StaleReason }> = []
  const proposalsToMarkNeedsReview: Array<{ proposalId: string; approvalId: string; reason: string }> = []
  const proposalsToKeep: string[] = []
  const campaignsNeedingUpdate: string[] = []
  const byPlatform: Record<string, { scanned: number; stale: number; kept: number; needsReview: number }> = {}

  // Aktif kampanya haritası: id → campaign
  const activeCampaignMap = new Map<string, DeepCampaignInsight>()
  for (const c of activeCampaigns) {
    if (c.id) activeCampaignMap.set(String(c.id), c)
  }

  // URL ve creative parmak izi haritaları
  const campaignUrlMap = new Map<string, string[]>()
  const campaignCreativeMap = new Map<string, string>()
  for (const c of activeCampaigns) {
    if (!c.id) continue
    const cid = String(c.id)
    campaignUrlMap.set(cid, extractUrlsFromCampaign(c).map(normalizeUrl))
    campaignCreativeMap.set(cid, extractCreativeFingerprint(c))
  }

  const now = new Date()

  // Sadece işlem bekleyen önerileri değerlendir (terminal statüler hariç)
  const actionableStatuses = new Set(['pending', 'hold', 'editing'])
  const actionableApprovals = existingApprovals.filter(a => actionableStatuses.has(a.status))

  for (const approval of actionableApprovals) {
    const platform = approval.platform || 'unknown'
    if (!byPlatform[platform]) byPlatform[platform] = { scanned: 0, stale: 0, kept: 0, needsReview: 0 }
    byPlatform[platform].scanned++

    const sourceCampaignId = approval.source_campaign_id
    const proposalId = approval.proposal_id
    const approvalId = approval.id
    const snapshot = (approval.proposal_snapshot ?? {}) as Record<string, unknown>

    // ── Kontrol 1: Kaynak kampanya aktif listede var mı? ──
    if (sourceCampaignId) {
      const liveCampaign = activeCampaignMap.get(sourceCampaignId)

      if (!liveCampaign) {
        // Kampanya artık aktif listede yok → silinmiş
        const eval_: CampaignEvalResult = {
          proposalId, approvalId, campaignId: sourceCampaignId, platform,
          decision: 'mark_stale', staleReason: 'campaign_deleted',
          reason: `Kampanya (${sourceCampaignId}) aktif kampanyalar arasında bulunamadı.`,
        }
        evaluations.push(eval_)
        proposalsToMarkStale.push({ proposalId, approvalId, staleReason: 'campaign_deleted' })
        byPlatform[platform].stale++
        continue
      }

      // ── Kontrol 2: Kampanya statüsü aktif mi? ──
      const campStatus = String(liveCampaign.status || '').toUpperCase()
      const effectiveStatus = String(liveCampaign.effectiveStatus || '').toUpperCase()

      if (INACTIVE_STATUSES.has(campStatus) || INACTIVE_STATUSES.has(effectiveStatus)) {
        evaluations.push({
          proposalId, approvalId, campaignId: sourceCampaignId, platform,
          decision: 'mark_stale', staleReason: 'campaign_inactive',
          reason: `Kampanya durumu '${campStatus}' — artık aktif değil.`,
        })
        proposalsToMarkStale.push({ proposalId, approvalId, staleReason: 'campaign_inactive' })
        byPlatform[platform].stale++
        continue
      }

      // Duraklatılmış kampanya → needs_review (kullanıcı kararı)
      if (PAUSED_STATUSES.has(campStatus)) {
        evaluations.push({
          proposalId, approvalId, campaignId: sourceCampaignId, platform,
          decision: 'needs_review',
          reason: `Kampanya duraklatılmış (PAUSED) — öneri geçerliliği belirsiz.`,
        })
        proposalsToMarkNeedsReview.push({ proposalId, approvalId, reason: 'Kampanya duraklatılmış.' })
        byPlatform[platform].needsReview++
        continue
      }

      // ── Kontrol 3: Landing URL değişmiş mi? ──
      const snapshotUrl = normalizeUrl(
        (snapshot.destinationUrl as string | undefined) ||
        (snapshot.finalUrl as string | undefined) ||
        ((snapshot.adContent as Record<string, unknown> | undefined)?.final_url as string | undefined)
      )
      const liveUrls = campaignUrlMap.get(sourceCampaignId) || []

      if (snapshotUrl && liveUrls.length > 0) {
        const urlMatch = liveUrls.some(u =>
          u === snapshotUrl ||
          u.startsWith(snapshotUrl) ||
          snapshotUrl.startsWith(u)
        )
        if (!urlMatch) {
          evaluations.push({
            proposalId, approvalId, campaignId: sourceCampaignId, platform,
            decision: 'update_recommendation',
            reason: 'Landing URL değişmiş — öneri yenilenmeli.',
          })
          if (!campaignsNeedingUpdate.includes(sourceCampaignId)) {
            campaignsNeedingUpdate.push(sourceCampaignId)
          }
          proposalsToMarkStale.push({ proposalId, approvalId, staleReason: 'landing_url_changed' })
          byPlatform[platform].stale++
          continue
        }
      }

      // ── Kontrol 4: Kreatif içerik büyük ölçüde değişmiş mi? ──
      const snapshotCreative = [
        (snapshot.adContent as Record<string, unknown> | undefined)?.primaryText,
        (snapshot.adContent as Record<string, unknown> | undefined)?.headline,
        snapshot.campaignName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .substring(0, 100)

      const liveCreative = campaignCreativeMap.get(sourceCampaignId) || ''

      if (snapshotCreative.length > 20 && liveCreative.length > 20) {
        const snapshotWords = new Set(
          snapshotCreative.split(/\s+/).filter(w => w.length > 3)
        )
        const liveWords = liveCreative.split(/\s+/).filter(w => w.length > 3)
        const overlap = liveWords.filter(w => snapshotWords.has(w)).length
        const overlapRatio = snapshotWords.size > 0 ? overlap / snapshotWords.size : 1.0

        if (overlapRatio < 0.2 && liveWords.length >= 3) {
          evaluations.push({
            proposalId, approvalId, campaignId: sourceCampaignId, platform,
            decision: 'update_recommendation',
            reason: 'Kreatif içerik büyük ölçüde değişmiş — öneri yenilenmeli.',
          })
          if (!campaignsNeedingUpdate.includes(sourceCampaignId)) {
            campaignsNeedingUpdate.push(sourceCampaignId)
          }
          proposalsToMarkStale.push({ proposalId, approvalId, staleReason: 'creative_changed' })
          byPlatform[platform].stale++
          continue
        }
      }

      // ── Kontrol 5: Kampanya hedefi değişmiş mi? ──
      const snapshotObjective = (snapshot.campaignObjective as string | undefined) || ''
      const liveObjective = String(liveCampaign.objective || '')
      if (
        snapshotObjective &&
        liveObjective &&
        snapshotObjective.toUpperCase() !== liveObjective.toUpperCase()
      ) {
        evaluations.push({
          proposalId, approvalId, campaignId: sourceCampaignId, platform,
          decision: 'mark_stale', staleReason: 'objective_changed',
          reason: `Kampanya hedefi değişmiş: '${snapshotObjective}' → '${liveObjective}'.`,
        })
        proposalsToMarkStale.push({ proposalId, approvalId, staleReason: 'objective_changed' })
        byPlatform[platform].stale++
        continue
      }
    }

    // ── Kontrol 6: Öneri çok eski mi? ──
    const createdAt = approval.created_at ? new Date(approval.created_at) : null
    if (createdAt && !isNaN(createdAt.getTime())) {
      const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      if (ageDays > PROPOSAL_MAX_AGE_DAYS) {
        evaluations.push({
          proposalId, approvalId, campaignId: sourceCampaignId, platform,
          decision: 'mark_stale', staleReason: 'proposal_too_old',
          reason: `Öneri ${Math.floor(ageDays)} gün işlem görmeden bekledi.`,
        })
        proposalsToMarkStale.push({ proposalId, approvalId, staleReason: 'proposal_too_old' })
        byPlatform[platform].stale++
        continue
      }
    }

    // ── Tüm kontroller geçildi → geçerli ──
    evaluations.push({
      proposalId, approvalId, campaignId: sourceCampaignId, platform,
      decision: 'keep_existing',
      reason: sourceCampaignId
        ? 'Kampanya aktif ve öneri güncel.'
        : 'Genel öneri — kampanya bağımsız, geçerli.',
    })
    proposalsToKeep.push(proposalId)
    byPlatform[platform].kept++
  }

  return {
    evaluations,
    proposalsToMarkStale,
    proposalsToMarkNeedsReview,
    proposalsToKeep,
    campaignsNeedingUpdate,
    summary: {
      scannedProposals: actionableApprovals.length,
      markedStale: proposalsToMarkStale.length,
      kept: proposalsToKeep.length,
      toUpdate: campaignsNeedingUpdate.length,
      needsReview: proposalsToMarkNeedsReview.length,
      byPlatform,
    },
  }
}

/* ── Cleanup: stale önerileri DB'de expired'a çek ───────── */

/**
 * Stale olarak işaretlenecek önerilerin statüsünü 'expired' yapar.
 * Metadata'ya stale_reason ve stale_marked_at eklenir.
 * Terminal statüdeki kayıtlar atlanır (protected: published, rejected vs.).
 * DB migration gerekmez; 'expired' zaten mevcut statü.
 */
export async function applyStaleCleanup(
  userId: string,
  toMarkStale: Array<{ proposalId: string; approvalId: string; staleReason: StaleReason }>,
): Promise<number> {
  if (toMarkStale.length === 0) return 0
  const { supabase } = await import('@/lib/supabase/client')
  if (!supabase) return 0

  const actionableStatuses = ['pending', 'hold', 'editing']
  const now = new Date().toISOString()
  let marked = 0

  // 20'lik batch'ler ile işle
  for (let i = 0; i < toMarkStale.length; i += 20) {
    const batch = toMarkStale.slice(i, i + 20)
    const approvalIds = batch.map(b => b.approvalId)
    const reasonMap = new Map(batch.map(b => [b.approvalId, b.staleReason]))

    const { data: current, error: selErr } = await supabase
      .from('yoai_pending_approvals')
      .select('id, status, metadata')
      .in('id', approvalIds)
      .eq('user_id', userId)

    if (selErr || !current) continue

    for (const record of current) {
      if (!actionableStatuses.includes(record.status)) continue

      const staleReason = reasonMap.get(record.id)
      const mergedMetadata = {
        ...((record.metadata as Record<string, unknown>) || {}),
        stale_reason: staleReason,
        stale_marked_at: now,
      }

      const { error: updErr } = await supabase
        .from('yoai_pending_approvals')
        .update({
          status: 'expired',
          status_reason: `Otomatik: ${staleReason ?? 'stale'}`,
          metadata: mergedMetadata,
          updated_at: now,
        })
        .eq('id', record.id)
        .eq('user_id', userId)

      if (!updErr) marked++
      else console.warn('[DailyIntelligence] stale update error:', updErr)
    }
  }

  return marked
}

/* ── Mevcut approval'ları yükle ──────────────────────────── */

/**
 * Kullanıcının işlemde olan (pending/hold/editing) approval'larını yükler.
 * Tablo yoksa boş dizi döner (graceful degradation).
 */
export async function loadActionableApprovals(
  userId: string,
): Promise<PendingApprovalRecord[]> {
  const { supabase } = await import('@/lib/supabase/client')
  if (!supabase) return []

  const { data, error } = await supabase
    .from('yoai_pending_approvals')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'hold', 'editing'])
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42P01' || /relation .* does not exist/i.test(error.message || '')) {
      console.warn('[DailyIntelligence] yoai_pending_approvals tablosu yok — graceful skip.')
      return []
    }
    console.error('[DailyIntelligence] loadActionableApprovals error:', error)
    return []
  }
  return (data || []) as PendingApprovalRecord[]
}
