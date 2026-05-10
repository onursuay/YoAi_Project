import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveMetaContext } from '@/lib/meta/context'
import {
  normalizeMetaAdLibraryAd,
  upsertCompetitorAds,
  type NormalizedCompetitorAd,
} from '@/lib/yoai/competitorAdStore'
import {
  generateCompetitorInsightFromAds,
  upsertCompetitorInsight,
} from '@/lib/yoai/competitorInsightStore'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/competitors/meta-ad-library?q=keyword&country=TR
   Proxies Meta Ad Library API.
   Faz 2: Dönüş alanları geriye dönük uyumludur (data: [...]).
   Yeni eklemeler:
     - persisted: { inserted, updated, skipped, insightId }
       (yalnızca DB persistence çalıştıysa)
   ──────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const country = searchParams.get('country') || 'TR'
    const campaignTypeContext = searchParams.get('campaign_type_context')

    if (!query) {
      return NextResponse.json({ ok: false, error: 'Arama sorgusu (q) gereklidir' }, { status: 400 })
    }

    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'Meta bağlantısı bulunamadı' }, { status: 401 })
    }

    // Call Meta Ad Library API
    const params = new URLSearchParams({
      access_token: ctx.userAccessToken,
      search_terms: query,
      ad_reached_countries: `["${country}"]`,
      ad_active_status: 'ACTIVE',
      fields: 'id,page_name,page_id,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_descriptions,ad_delivery_start_time,ad_delivery_stop_time,publisher_platforms',
      limit: '25',
    })

    const res = await fetch(`https://graph.facebook.com/v21.0/ads_archive?${params.toString()}`)

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      console.error('[Meta Ad Library] Error:', res.status, errorData)
      return NextResponse.json({
        ok: false,
        error: errorData?.error?.message || `Meta Ad Library API hatası (${res.status})`,
      }, { status: res.status === 401 ? 401 : 502 })
    }

    const data = await res.json()
    const rawAds: Record<string, unknown>[] = Array.isArray(data?.data) ? data.data : []

    // Mevcut UI ile aynı camelCase shape — geriye dönük uyumlu.
    const ads = rawAds.map((ad) => ({
      id: ad.id,
      pageName: (ad as { page_name?: string }).page_name || '',
      pageId: (ad as { page_id?: string }).page_id || '',
      adCreativeBody: (ad as { ad_creative_bodies?: string[] }).ad_creative_bodies?.[0] || '',
      adCreativeLinkTitle: (ad as { ad_creative_link_titles?: string[] }).ad_creative_link_titles?.[0] || '',
      adCreativeDescription: (ad as { ad_creative_link_descriptions?: string[] }).ad_creative_link_descriptions?.[0] || '',
      adStartDate: (ad as { ad_delivery_start_time?: string }).ad_delivery_start_time || '',
      adEndDate: (ad as { ad_delivery_stop_time?: string }).ad_delivery_stop_time || '',
      platforms: (ad as { publisher_platforms?: string[] }).publisher_platforms || [],
      isActive: !(ad as { ad_delivery_stop_time?: string }).ad_delivery_stop_time,
    }))

    // ── Faz 2: Best-effort persistence ──
    let persisted: {
      inserted: number
      updated: number
      skipped: number
      insightId: string | null
      errors: string[]
    } | null = null

    try {
      const cookieStore = await cookies()
      const userId = cookieStore.get('session_id')?.value
      if (userId && rawAds.length > 0) {
        const adContext = {
          platform: 'meta',
          source: 'meta_ad_library',
          query_keyword: query,
          campaign_type_context: campaignTypeContext,
        }
        const normalized: NormalizedCompetitorAd[] = rawAds.map((raw) => normalizeMetaAdLibraryAd(raw, adContext))
        const upsertResult = await upsertCompetitorAds(userId, normalized)

        const snapshot = generateCompetitorInsightFromAds(normalized, {
          platform: 'meta',
          source: 'meta_ad_library',
          campaign_type_context: campaignTypeContext,
          query_keyword: query,
        })
        const insightRow = snapshot.ads_count > 0
          ? await upsertCompetitorInsight(userId, snapshot)
          : null

        persisted = {
          inserted: upsertResult.inserted,
          updated: upsertResult.updated,
          skipped: upsertResult.skipped,
          insightId: insightRow?.id ?? null,
          errors: upsertResult.errors,
        }
      }
    } catch (persistErr) {
      console.warn('[Meta Ad Library] persistence failed (non-fatal):', persistErr)
    }

    return NextResponse.json({ ok: true, data: ads, ...(persisted ? { persisted } : {}) })
  } catch (error) {
    console.error('[Meta Ad Library] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
