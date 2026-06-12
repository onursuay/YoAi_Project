import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { runFullCompetitorAnalysis } from '@/lib/yoai/competitorAnalyzer'
import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'
import { normalizeCampaignType } from '@/lib/yoai/campaignTypeIntelligence'
import {
  buildCompetitorAdFingerprint,
  upsertCompetitorAds,
  type NormalizedCompetitorAd,
} from '@/lib/yoai/competitorAdStore'
import {
  generateCompetitorInsightFromAds,
  upsertCompetitorInsight,
} from '@/lib/yoai/competitorInsightStore'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/competitors/analyze
   Full competitor analysis pipeline:
   1. Fetch user campaigns
   2. Analyze user ad content
   3. Search Meta Ad Library for competitors
   4. Compare and identify gaps

   Faz 2 (additive):
   - Bulunan rakip reklamlar yoai_competitor_ads tablosuna upsert.
   - Deterministik içgörü yoai_competitor_insights'a yazılır.
   - UI response shape'i değişmez; sadece persisted alanı eklenir.
   ──────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Fetch campaigns
    const [metaResult, googleResult] = await Promise.all([
      fetchMetaDeep().catch(() => ({ campaigns: [], errors: [] })),
      fetchGoogleDeep().catch(() => ({ campaigns: [], errors: [] })),
    ])
    const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]

    if (allCampaigns.length === 0) {
      return NextResponse.json({ ok: true, data: { userProfile: null, competitorAds: [], comparison: null, errors: ['Kampanya bulunamadı'] } })
    }

    const result = await runFullCompetitorAnalysis(allCampaigns, cookieHeader, baseUrl)

    // ── Faz 2: Best-effort persistence ──
    // analyze() çağrısı meta-ad-library route'una HTTP ile gidiyor; o route
    // zaten persist ediyor. Yine de burada persisted snapshot bilgisi UI'ya
    // dönsün diye runFullCompetitorAnalysis sonucundaki competitorAds'i
    // doğrudan da upsert ediyoruz (idempotent — fingerprint dedupe eder).
    let persisted: {
      inserted: number
      updated: number
      skipped: number
      insightId: string | null
      campaignTypeContext: string | null
      queryKeyword: string | null
      errors: string[]
    } | null = null

    try {
      const cookieStore = await cookies()
      const userId = readUserId(cookieStore)
      if (userId && result.competitorAds.length > 0) {
        // Hangi campaign type baskın? → İlk Meta kampanyasının normalize tipi.
        let campaignTypeContext: string | null = null
        const firstMeta = allCampaigns.find((c) => c.platform === 'Meta')
        if (firstMeta) {
          try {
            campaignTypeContext = normalizeCampaignType(firstMeta).campaignType
          } catch {
            campaignTypeContext = null
          }
        }

        const queryKeyword = result.userProfile?.keywords?.slice(0, 3).join(' ') || null

        const normalized: NormalizedCompetitorAd[] = result.competitorAds.map((ad) => {
          const fingerprint = buildCompetitorAdFingerprint({
            source: 'meta_ad_library',
            source_ad_id: ad.id,
            advertiser_page_name: ad.pageName,
            ad_body: ad.body,
            ad_title: ad.title,
            ad_description: ad.description,
          })
          return {
            platform: 'meta',
            source: 'meta_ad_library',
            source_ad_id: ad.id || null,
            source_page_id: ad.pageId || null,
            ad_fingerprint: fingerprint,
            advertiser_name: ad.pageName || null,
            advertiser_page_name: ad.pageName || null,
            advertiser_domain: null,
            query_keyword: queryKeyword,
            industry_keyword: null,
            campaign_type_context: campaignTypeContext,
            ad_body: ad.body || null,
            ad_title: ad.title || null,
            ad_description: ad.description || null,
            call_to_action: null,
            destination_url: null,
            publisher_platforms: ad.platforms || [],
            ad_delivery_start_time: ad.startDate
              ? new Date(ad.startDate).toISOString()
              : null,
            ad_delivery_stop_time: null,
            creative_assets: [],
            raw_payload: null,
            extracted_signals: {},
            is_active: ad.isActive ?? true,
          }
        })

        const upsertResult = await upsertCompetitorAds(userId, normalized)

        const snapshot = generateCompetitorInsightFromAds(normalized, {
          platform: 'meta',
          source: 'meta_ad_library',
          campaign_type_context: campaignTypeContext,
          query_keyword: queryKeyword,
        })
        const insightRow = snapshot.ads_count > 0
          ? await upsertCompetitorInsight(userId, snapshot)
          : null

        persisted = {
          inserted: upsertResult.inserted,
          updated: upsertResult.updated,
          skipped: upsertResult.skipped,
          insightId: insightRow?.id ?? null,
          campaignTypeContext,
          queryKeyword,
          errors: upsertResult.errors,
        }
      }
    } catch (persistErr) {
      console.warn('[Competitor Analyze] persistence failed (non-fatal):', persistErr)
    }

    return NextResponse.json({ ok: true, data: result, ...(persisted ? { persisted } : {}) })
  } catch (error) {
    console.error('[Competitor Analyze] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
