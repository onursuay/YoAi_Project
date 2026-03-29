import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/competitors/meta-ad-library?q=keyword&country=TR
   Proxies Meta Ad Library API.
   ──────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const country = searchParams.get('country') || 'TR'

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
    const ads = (data.data || []).map((ad: any) => ({
      id: ad.id,
      pageName: ad.page_name || '',
      pageId: ad.page_id || '',
      adCreativeBody: ad.ad_creative_bodies?.[0] || '',
      adCreativeLinkTitle: ad.ad_creative_link_titles?.[0] || '',
      adCreativeDescription: ad.ad_creative_link_descriptions?.[0] || '',
      adStartDate: ad.ad_delivery_start_time || '',
      adEndDate: ad.ad_delivery_stop_time || '',
      platforms: ad.publisher_platforms || [],
      isActive: !ad.ad_delivery_stop_time,
    }))

    return NextResponse.json({ ok: true, data: ads })
  } catch (error) {
    console.error('[Meta Ad Library] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
