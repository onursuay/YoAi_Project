/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Competitor Scan Step (A4)

   İki sorumluluk:
   1) READ (her zaman açık, ücretsiz): cache'lenmiş rakip reklam
      verisini (yoai_competitor_insights + yoai_competitor_ads)
      Claude payload'ına gidecek "Rakip Reklam Analizi" bloğuna çevirir.
   2) WRITE (varsayılan AÇIK — 2026-06-14 kullanıcı kararı): kullanıcının
      BEYAN ETTİĞİ rakipler için Apify scrape tetikler. 7 günlük per-competitor
      cache, max 3 rakip cost cap, soft-fail.

   Write yolu varsayılan ÇALIŞIR; yalnız YOALGORITMA_SCRAPE_COMPETITORS=false
   ile açıkça kapatılabilir. Apify token yoksa veya rakip beyanı yoksa zaten
   güvenli no-op döner (gereksiz maliyet/crash yok).

   supabase'e dayanan store'lar dinamik import edilir (pure builder
   competitorBrief.ts test edilebilir kalsın diye).
   ────────────────────────────────────────────────────────── */

import { buildCompetitorAdsBrief } from './competitorBrief'
import type { AiPlatform } from './types'

const SCRAPE_FLAG = 'YOALGORITMA_SCRAPE_COMPETITORS'
const MAX_COMPETITORS = 3
const MAX_ADS_PER_COMPETITOR = 10
const CACHE_FRESH_DAYS = 7

/* ── READ: cache'li rakip verisini payload bloğuna çevir ── */

export async function loadCompetitorBrief(
  userId: string,
  platform: AiPlatform,
): Promise<string | null> {
  try {
    const platformKey = platform === 'Meta' ? 'meta' : 'google'
    const { getLatestCompetitorInsight } = await import('@/lib/yoai/competitorInsightStore')
    const { getRecentCompetitorAds } = await import('@/lib/yoai/competitorAdStore')
    const [insightRow, ads] = await Promise.all([
      getLatestCompetitorInsight(userId, { platform: platformKey }),
      getRecentCompetitorAds(userId, { platform: platformKey, lookbackDays: 30, limit: 12, active_only: true }),
    ])

    const insight = insightRow
      ? {
          ads_count: insightRow.ads_count,
          active_advertisers_count: insightRow.active_advertisers_count,
          top_hooks: insightRow.top_hooks ?? [],
          top_ctas: insightRow.top_ctas ?? [],
          top_value_props: insightRow.top_value_props ?? [],
          offer_patterns: insightRow.offer_patterns ?? [],
          common_phrases: insightRow.common_phrases ?? [],
          competitor_summary: insightRow.competitor_summary ?? null,
          confidence: insightRow.confidence ?? 0,
          generated_at: insightRow.generated_at ?? null,
        }
      : null

    const sampleAds = ads.map((a) => {
      const sig = (a.extracted_signals ?? {}) as Record<string, unknown>
      return {
        advertiser_name: a.advertiser_name,
        ad_title: a.ad_title,
        ad_body: a.ad_body,
        call_to_action: a.call_to_action,
        is_active: a.is_active,
        text_available: typeof sig.text_available === 'boolean' ? (sig.text_available as boolean) : undefined,
      }
    })

    return buildCompetitorAdsBrief({ platform, insight, sampleAds })
  } catch (e) {
    console.warn('[A4][loadCompetitorBrief] failed:', e instanceof Error ? e.message : e)
    return null
  }
}

/* ── WRITE: beyan edilen rakipleri scrape et (flag + cache + cap) ── */

export interface CompetitorScrapeSummary {
  enabled: boolean
  reason?: string
  attempted: number
  scraped: number
  cachedSkipped: number
  errors: number
}

export async function scrapeDeclaredCompetitors(userId: string): Promise<CompetitorScrapeSummary> {
  // Varsayılan AÇIK (2026-06-14 kullanıcı kararı) — yalnız açıkça =false ise kapanır.
  // Apify token / rakip beyanı yoksa aşağıda güvenli no-op döner.
  if (process.env[SCRAPE_FLAG] === 'false') {
    return { enabled: false, reason: 'flag_off', attempted: 0, scraped: 0, cachedSkipped: 0, errors: 0 }
  }

  const { isApifyEnabled } = await import('@/lib/yoai/apifyCompetitorProvider')
  if (!isApifyEnabled()) {
    return { enabled: true, reason: 'no_apify_token', attempted: 0, scraped: 0, cachedSkipped: 0, errors: 0 }
  }

  const { getBusinessContextForUser } = await import('@/lib/yoai/businessContextStore')
  const ctx = await getBusinessContextForUser(userId)
  const competitors = ctx.competitors.slice(0, MAX_COMPETITORS)
  if (competitors.length === 0) {
    return { enabled: true, reason: 'no_declared_competitors', attempted: 0, scraped: 0, cachedSkipped: 0, errors: 0 }
  }

  const region = 'TR'
  const { getLatestCompetitorInsight } = await import('@/lib/yoai/competitorInsightStore')
  const { runCompetitorScanForUser } = await import('@/lib/yoai/competitorScanner')
  const freshSince = Date.now() - CACHE_FRESH_DAYS * 86_400_000

  let scraped = 0
  let cachedSkipped = 0
  let errors = 0

  // Rakipler paralel — wall-time'ı tek scrape süresine yakın tut (Vercel budget).
  const results = await Promise.allSettled(
    competitors.map(async (comp) => {
      const name = comp.competitor_name?.trim()
      if (!name) return 'skip'
      // Per-competitor 7 günlük cache — aynı rakibi sık scrape etme.
      const cached = await getLatestCompetitorInsight(userId, { query_keyword: name })
      if (cached?.generated_at && new Date(cached.generated_at).getTime() > freshSince) {
        return 'cached'
      }
      await runCompetitorScanForUser(userId, {
        keyword: name,
        region,
        maxRecords: MAX_ADS_PER_COMPETITOR,
      })
      return 'scraped'
    }),
  )

  for (const r of results) {
    if (r.status === 'rejected') {
      errors++
      console.warn('[A4][scrapeDeclaredCompetitors] competitor failed:', r.reason)
    } else if (r.value === 'cached') cachedSkipped++
    else if (r.value === 'scraped') scraped++
  }

  return { enabled: true, attempted: competitors.length, scraped, cachedSkipped, errors }
}
