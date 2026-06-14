/* ──────────────────────────────────────────────────────────
   Meta Deep Fetcher — hierarchical campaign+adset+ad data
   Uses existing optimization engine for scoring & analysis.
   ────────────────────────────────────────────────────────── */

import { resolveMetaContext } from '@/lib/meta/context'
import { readUserId } from '@/lib/auth/userCookie'
import { metaGraphFetch } from '@/lib/metaGraph'
import { normalizeInsights } from '@/lib/meta/optimization/insightsNormalizer'
import { runRuleEngine, type RuleContext } from '@/lib/meta/optimization/ruleEngine'
import { scoreCampaign } from '@/lib/meta/optimization/scoring'
import { resolveKpiTemplate } from '@/lib/meta/optimization/kpiRegistry'
import type { CampaignTriple, OptimizationAdset } from '@/lib/meta/optimization/types'
import type { DeepCampaignInsight, AdsetInsight, AdInsight, StandardMetrics, AdsetTargetingSummary } from './analysisTypes'
import { computeCreativeHash } from './creativeHash'
import { countMetaConversions } from './metaConversions'

const MAX_CAMPAIGNS = 15

/* ── Helpers ── */
function toStdMetrics(n: ReturnType<typeof normalizeInsights>): StandardMetrics {
  // Çift-sayım korumalı + geniş kapsam (satın alma/lead/kayıt/abonelik/iletişim/mesajlaşma)
  const conversions = countMetaConversions(n.actions)
  return {
    spend: n.spend,
    impressions: n.impressions,
    clicks: n.clicks,
    ctr: n.ctr,
    cpc: n.cpc,
    conversions,
    roas: n.websitePurchaseRoas > 0 ? n.websitePurchaseRoas : null,
    reach: n.reach,
    frequency: n.frequency,
    cpm: n.cpm,
  }
}

function resolveTriple(campaign: any, adsets: any[]): CampaignTriple {
  const objective = campaign.objective || 'OUTCOME_TRAFFIC'
  const firstAdset = adsets[0]
  return {
    objective,
    optimizationGoal: firstAdset?.optimization_goal || 'LINK_CLICKS',
    destination: firstAdset?.destination_type || 'WEBSITE',
  }
}

function scoreToRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 75) return 'low'
  if (score >= 50) return 'medium'
  if (score >= 25) return 'high'
  return 'critical'
}

/* ── Aktiflik filtresi ──
   "Sadece AKTİF reklamlar" kuralı: aktif kampanyanın içindeki PAUSED/silinmiş
   ad set ve reklamlar analiz DIŞI kalır. Meta effective_status değerleri:
   ACTIVE, PAUSED, ADSET_PAUSED, CAMPAIGN_PAUSED, DELETED, ARCHIVED, ... */
function isMetaActive(effectiveStatus?: string, status?: string): boolean {
  const s = (effectiveStatus || status || '').toUpperCase()
  return s === 'ACTIVE'
}

const GENDER_LABEL: Record<number, string> = { 1: 'male', 2: 'female' }

/* ── Hedefleme özeti ──
   Ad set targeting objesini insan-okur özete çevirir (lokasyon/yaş/cinsiyet/ilgi/
   yayın yeri/dil). Veri yoksa undefined döner → AI bu alanda VARSAYIM YAPMAMALI. */
function parseMetaTargeting(t: any): AdsetTargetingSummary | undefined {
  if (!t || typeof t !== 'object') return undefined
  const summary: AdsetTargetingSummary = { fetched: true }

  // Lokasyon: ülke kodları + bölge/şehir adları
  const geo = t.geo_locations || {}
  const locations: string[] = []
  if (Array.isArray(geo.countries)) locations.push(...geo.countries)
  if (Array.isArray(geo.regions)) locations.push(...geo.regions.map((r: any) => r?.name).filter(Boolean))
  if (Array.isArray(geo.cities)) locations.push(...geo.cities.map((c: any) => c?.name).filter(Boolean))
  if (locations.length) summary.locations = Array.from(new Set(locations))

  // Yaş aralığı
  if (t.age_min != null) summary.ageMin = Number(t.age_min)
  if (t.age_max != null) summary.ageMax = Number(t.age_max)

  // Cinsiyet (boş veya her ikisi = all)
  if (Array.isArray(t.genders) && t.genders.length) {
    const g = t.genders.map((n: number) => GENDER_LABEL[n]).filter(Boolean)
    summary.genders = g.length === 1 ? g : ['all']
  } else {
    summary.genders = ['all']
  }

  // İlgi alanı / detaylı hedefleme (flexible_spec içindeki adlar — id değil)
  const interests: string[] = []
  if (Array.isArray(t.flexible_spec)) {
    for (const spec of t.flexible_spec) {
      for (const key of ['interests', 'behaviors', 'life_events', 'industries']) {
        if (Array.isArray(spec?.[key])) interests.push(...spec[key].map((i: any) => i?.name).filter(Boolean))
      }
    }
  }
  if (interests.length) summary.interests = Array.from(new Set(interests))

  // Yayın yerleri (publisher_platforms yoksa otomatik/Advantage+)
  if (Array.isArray(t.publisher_platforms) && t.publisher_platforms.length) {
    const map: Record<string, string> = {
      facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger', audience_network: 'Audience Network',
    }
    summary.placements = t.publisher_platforms.map((p: string) => map[p] || p)
  } else {
    summary.placements = ['Otomatik Yayın Yerleri']
  }

  // Dil (locales): Meta numerik kod döndürür — isim uydurmadan yalnız varlığını bildir
  if (Array.isArray(t.locales) && t.locales.length) {
    summary.languages = ['Özel dil hedeflemesi seçili']
  }

  return summary
}

/* ── Main Fetch ──
   override (YoAlgoritma işletme scope'u): hangi Meta hesabının çekileceğini
   açıkça belirler. adAccountId === null → bu işletmenin Meta'sı yok, hiç çekme
   (disconnected). adAccountId string → token aynı kalır, yalnız hesap değişir. */
export async function fetchMetaDeep(
  userId?: string,
  override?: { adAccountId: string | null },
): Promise<{ campaigns: DeepCampaignInsight[]; errors: string[]; connected: boolean; fetchError?: boolean }> {
  const errors: string[] = []
  const campaigns: DeepCampaignInsight[] = []
  // R5: fetchError=true → çekim BAŞARISIZ (auth/5xx/exception). reconcile bunu 'kampanya pasif'
  // ile karıştırıp pending kartları SİLMEMELİ. Gerçekten boş (0 aktif kampanya) ise false kalır.
  let fetchError = false

  // İşletmede Meta hesabı yoksa hiç bağlanma (örn. yalnız-Google işletmesi).
  if (override && override.adAccountId === null) {
    return { campaigns, errors: [], connected: false }
  }

  // 1) Try cookie-based context first (works in browser)
  let ctx = await resolveMetaContext()

  // 2) Cookie-based failed — try DB lookup (cron context)
  if (!ctx && userId) {
    try {
      const { getMetaConnection } = await import('@/lib/metaConnectionStore')
      const dbConn = await getMetaConnection(userId)
      if (dbConn?.accessToken && dbConn.selectedAdAccountId) {
        const accountId = dbConn.selectedAdAccountId.startsWith('act_')
          ? dbConn.selectedAdAccountId
          : `act_${dbConn.selectedAdAccountId}`
        ctx = {
          client: null as any,
          accountId,
          fingerprintLast4: dbConn.accessToken.slice(-4),
          userAccessToken: dbConn.accessToken,
          source: 'db' as const,
          userId: userId ?? '',
        }
      }
    } catch (e) {
      console.error('[MetaDeepFetcher] DB fallback error:', e)
    }
  }

  // 3) DB lookups failed — cookie fallback (Entegrasyon sayfası bununla çalışıyor,
  //    DB ile cookie ayrışabildiği için YoAlgoritma tarafı da aynı kaynağa bakıyor)
  if (!ctx) {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const cookieToken = cookieStore.get('meta_access_token')?.value
      const cookieExpiresAt = cookieStore.get('meta_access_expires_at')?.value
      const cookieAdAccountId = cookieStore.get('meta_selected_ad_account_id')?.value
      const stillValid = cookieToken && (!cookieExpiresAt || Date.now() < parseInt(cookieExpiresAt, 10))
      if (stillValid && cookieAdAccountId) {
        const accountId = cookieAdAccountId.startsWith('act_') ? cookieAdAccountId : `act_${cookieAdAccountId}`
        const cookieUserId = readUserId(cookieStore) ?? ''
        ctx = {
          client: null as any,
          accountId,
          fingerprintLast4: cookieToken!.slice(-4),
          userAccessToken: cookieToken!,
          source: 'cookie' as any,
          userId: cookieUserId,
        }
      }
    } catch (e) {
      console.error('[MetaDeepFetcher] Cookie fallback error:', e)
    }
  }

  if (!ctx) {
    return { campaigns, errors: ['Meta bağlantısı bulunamadı'], connected: false, fetchError: true }
  }

  // İşletme scope'u: token korunur, yalnız hangi reklam hesabının çekileceği değişir.
  if (override?.adAccountId) {
    const overrideId = override.adAccountId.startsWith('act_') ? override.adAccountId : `act_${override.adAccountId}`
    ctx = { ...ctx, accountId: overrideId }
  }

  try {
    // 1. Fetch campaigns with inline adset + ad insights (nested expansion)
    const insightsFields = 'spend,impressions,clicks,ctr,cpc,reach,frequency,cpm,actions,action_values,cost_per_action_type,purchase_roas,quality_ranking,engagement_rate_ranking,conversion_rate_ranking'
    // creative{body,title,link_url,call_to_action_type,object_story_spec} — gerçek metin + CTA
    const adFields = `id,name,status,effective_status,creative{body,title,link_url,call_to_action_type,object_story_spec},insights.date_preset(last_7d){${insightsFields}}`
    // targeting{...}: lokasyon/yaş/cinsiyet/ilgi/yayın yeri/dil — derin hedefleme analizi için
    const targetingFields = 'geo_locations,age_min,age_max,genders,locales,publisher_platforms,facebook_positions,instagram_positions,flexible_spec,targeting_automation'
    const adsetFields = `id,name,status,effective_status,optimization_goal,destination_type,daily_budget,lifetime_budget,targeting{${targetingFields}},insights.date_preset(last_7d){${insightsFields}},ads.limit(20){${adFields}}`
    const campaignFields = `id,name,status,effective_status,objective,bid_strategy,daily_budget,lifetime_budget,insights.date_preset(last_7d){${insightsFields}},adsets.limit(30){${adsetFields}}`

    // R6 (PARİTE — SPEND TOP-15): Graph /campaigns edge harcamaya göre SIRALAMA desteklemez;
    // limit=15 yalnız "ilk 15"i (genelde kayıt sırası) verir → çok kampanyalı hesapta en yüksek
    // harcamalı kampanyalar atlanabilir. Önce ucuz bir sıralama isteğiyle (id+spend) gerçek top-15
    // ID'leri seç; >15 aktif kampanya varsa heavy nested veriyi ?ids= ile yalnız onlar için çek.
    // ≤15 aktif kampanyada (yaygın, hâlihazırda çalışan durum) ESKİ YOL aynen korunur (sıfır regresyon).
    let topCampaignIds: string[] | null = null
    try {
      const rankResp = await metaGraphFetch(`/${ctx.accountId}/campaigns`, ctx.userAccessToken, {
        params: { fields: 'id,insights.date_preset(last_7d){spend}', effective_status: '["ACTIVE"]', limit: '100' },
      })
      if (rankResp.ok) {
        const rankData = await rankResp.json().catch(() => ({ data: [] }))
        const ranked = (rankData.data || [])
          .map((c: any) => ({ id: String(c?.id ?? ''), spend: Number(c?.insights?.data?.[0]?.spend ?? 0) }))
          .filter((c: { id: string }) => c.id)
        if (ranked.length > MAX_CAMPAIGNS) {
          ranked.sort((a: { spend: number }, b: { spend: number }) => b.spend - a.spend)
          topCampaignIds = ranked.slice(0, MAX_CAMPAIGNS).map((c: { id: string }) => c.id)
          console.warn(`[MetaDeepFetcher] ${ranked.length} aktif kampanya — en yüksek harcamalı ${MAX_CAMPAIGNS} seçildi (spend-sıralı parite).`)
        }
      }
    } catch (e) {
      console.warn('[MetaDeepFetcher] spend sıralaması atlandı, ilk-15 yoluna düşülüyor:', e instanceof Error ? e.message : e)
    }

    let rawCampaigns: any[]
    if (topCampaignIds && topCampaignIds.length) {
      // ?ids= kök çağrısı: yalnız seçilen top-15 kampanya, heavy nested alanlarla.
      const resp = await metaGraphFetch('/', ctx.userAccessToken, {
        params: { ids: topCampaignIds.join(','), fields: campaignFields },
      })
      if (!resp.ok) {
        errors.push('Meta kampanya verisi alınamadı')
        return { campaigns, errors, connected: true, fetchError: true }
      }
      const data = await resp.json().catch(() => ({}))
      // ?ids= yanıtı { "<id>": {...campaign} } biçiminde anahtarlı obje döner.
      rawCampaigns = Object.values(data as Record<string, any>).filter((v) => v && typeof v === 'object' && (v as any).id)
    } else {
      // ≤15 aktif kampanya: MEVCUT YOL (değişmedi).
      const params: Record<string, string> = {
        fields: campaignFields,
        limit: String(MAX_CAMPAIGNS),
        effective_status: '["ACTIVE"]',
      }
      const response = await metaGraphFetch(
        `/${ctx.accountId}/campaigns`,
        ctx.userAccessToken,
        { params },
      )
      if (!response.ok) {
        errors.push('Meta kampanya verisi alınamadı')
        return { campaigns, errors, connected: true, fetchError: true }
      }
      const data = await response.json().catch(() => ({ data: [] }))
      rawCampaigns = data.data || []
      // Sessiz truncation'ı görünür kıl (cap kasıtlı maliyet kontrolü; her kampanya 1 AI Batch isteği).
      if (data?.paging?.next || rawCampaigns.length >= MAX_CAMPAIGNS) {
        console.warn(`[MetaDeepFetcher] Kısmi tarama: ${MAX_CAMPAIGNS} aktif kampanya analiz edildi; hesapta daha fazlası olabilir (cap=maliyet kontrolü).`)
      }
    }

    // 2. Process each campaign
    for (const raw of rawCampaigns) {
      // Sadece AKTİF ad set'ler: aktif kampanya içindeki PAUSED ad set'leri ele
      const rawAdsets = (raw.adsets?.data || []).filter((as: any) => isMetaActive(as.effective_status, as.status))
      const campaignInsightRaw = raw.insights?.data?.[0]
      const normalizedCampaignInsights = normalizeInsights(campaignInsightRaw)
      const triple = resolveTriple(raw, rawAdsets)
      const kpiTemplate = resolveKpiTemplate(triple)

      // Build OptimizationAdset[] for rule engine
      const optAdsets: OptimizationAdset[] = rawAdsets.map((as: any) => {
        const asInsightRaw = as.insights?.data?.[0]
        return {
          id: as.id,
          name: as.name || 'Unnamed',
          status: as.status || 'UNKNOWN',
          optimizationGoal: as.optimization_goal || '',
          destinationType: as.destination_type || '',
          dailyBudget: as.daily_budget != null ? parseFloat(as.daily_budget) / 100 : null,
          lifetimeBudget: as.lifetime_budget != null ? parseFloat(as.lifetime_budget) / 100 : null,
          insights: normalizeInsights(asInsightRaw),
        }
      })

      // Run rule engine
      const dailyBudget = raw.daily_budget != null ? parseFloat(raw.daily_budget) / 100 : null
      const lifetimeBudget = raw.lifetime_budget != null ? parseFloat(raw.lifetime_budget) / 100 : null

      const ruleCtx: RuleContext = {
        insights: normalizedCampaignInsights,
        template: kpiTemplate,
        triple,
        adsets: optAdsets,
        dailyBudget,
        lifetimeBudget,
        campaignStatus: raw.effective_status || raw.status,
        currency: 'TRY',
      }

      const problemTags = runRuleEngine(ruleCtx)
      const scoreResult = scoreCampaign(normalizedCampaignInsights, kpiTemplate)
      const score = scoreResult.score

      // Build adset insights with ad-level data
      const adsetInsights: AdsetInsight[] = rawAdsets.map((as: any) => {
        const asInsightRaw = as.insights?.data?.[0]
        const asNorm = normalizeInsights(asInsightRaw)
        // Sadece AKTİF reklamlar: aktif ad set içindeki PAUSED reklamları ele
        const rawAds = (as.ads?.data || []).filter((ad: any) => isMetaActive(ad.effective_status, ad.status))

        const adInsights: AdInsight[] = rawAds.map((ad: any) => {
          const adInsightRaw = ad.insights?.data?.[0]
          const adNorm = normalizeInsights(adInsightRaw)
          // Creative: body, title, CTA (gerçek reklam metni ve buton tipi)
          const creative = ad.creative || {}
          const oss = creative.object_story_spec || {}
          // object_story_spec daha nested creative body verebilir
          const ossBody = oss.link_data?.message || oss.video_data?.message || oss.photo_data?.message || oss.template_data?.message || ''
          const ossTitle = oss.link_data?.name || oss.video_data?.title || oss.template_data?.name || ''
          const ossCTA = oss.link_data?.call_to_action?.type || oss.video_data?.call_to_action?.type || ''
          const ossLink = oss.link_data?.link || oss.template_data?.link || ''
          return {
            id: ad.id,
            name: ad.name || 'Unnamed Ad',
            status: ad.effective_status || ad.status || 'UNKNOWN',
            platform: 'Meta' as const,
            metrics: toStdMetrics(adNorm),
            qualityRanking: adNorm.qualityRanking || undefined,
            engagementRateRanking: adNorm.engagementRateRanking || undefined,
            conversionRateRanking: adNorm.conversionRateRanking || undefined,
            creativeBody: (creative.body || ossBody || '').trim() || undefined,
            creativeTitle: (creative.title || ossTitle || '').trim() || undefined,
            callToActionType: (creative.call_to_action_type || ossCTA || '').trim() || undefined,
            linkUrl: (creative.link_url || ossLink || '').trim() || undefined,
            // Per-ad improvement: creative değişimi tespiti (refresh policy)
            creativeHash: computeCreativeHash([
              (creative.body || ossBody || '').trim(),
              (creative.title || ossTitle || '').trim(),
              (creative.call_to_action_type || ossCTA || '').trim(),
              (creative.link_url || ossLink || '').trim(),
            ]) || undefined,
          }
        })

        return {
          id: as.id,
          name: as.name || 'Unnamed Adset',
          status: as.status || 'UNKNOWN',
          platform: 'Meta' as const,
          optimizationGoal: as.optimization_goal || '',
          destinationType: as.destination_type || '',
          dailyBudget: as.daily_budget != null ? parseFloat(as.daily_budget) / 100 : null,
          lifetimeBudget: as.lifetime_budget != null ? parseFloat(as.lifetime_budget) / 100 : null,
          metrics: toStdMetrics(asNorm),
          targeting: parseMetaTargeting(as.targeting),
          ads: adInsights,
        }
      })

      campaigns.push({
        id: raw.id,
        platform: 'Meta',
        campaignName: raw.name || 'Unnamed Campaign',
        status: raw.status || 'UNKNOWN',
        effectiveStatus: raw.effective_status,
        objective: raw.objective || '',
        biddingStrategy: raw.bid_strategy || undefined,
        triple,
        normalizedInsights: normalizedCampaignInsights,
        scoreResult,
        metrics: toStdMetrics(normalizedCampaignInsights),
        problemTags,
        score,
        riskLevel: scoreToRisk(score),
        adsets: adsetInsights,
        dailyBudget,
        lifetimeBudget,
        currency: 'TRY',
      })
    }
  } catch (e) {
    console.error('[MetaDeepFetcher] Error:', e)
    errors.push('Meta veri çekme hatası')
    fetchError = true
  }

  // Sort by spend descending
  campaigns.sort((a, b) => b.metrics.spend - a.metrics.spend)

  return { campaigns, errors, connected: true, fetchError }
}
