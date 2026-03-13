import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { normalizeError } from '@/lib/google-ads/errors'

/**
 * GET /api/integrations/google-ads/ads/[adId]/detail?adGroupId=xxx
 * Returns ad details including RSA headlines, descriptions, URLs, paths.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const { adId } = await params
  const id = String(adId || '').replace(/-/g, '').trim()
  if (!id) {
    return NextResponse.json({ error: 'invalid_ad_id', message: 'adId is required' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const adGroupId = searchParams.get('adGroupId') || ''

  try {
    const ctx = await getGoogleAdsContext()

    const query = `
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.ad.type,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group_ad.ad.responsive_search_ad.path1,
        ad_group_ad.ad.responsive_search_ad.path2,
        ad_group_ad.status,
        ad_group_ad.policy_summary.approval_status,
        ad_group.id,
        ad_group.name,
        campaign.id,
        campaign.name
      FROM ad_group_ad
      WHERE ad_group_ad.ad.id = ${id}
        ${adGroupId ? `AND ad_group.id = ${adGroupId}` : ''}
      LIMIT 1
    `.trim()

    const rows = await searchGAds<any>(ctx, query)
    const row = rows[0]
    if (!row) {
      return NextResponse.json({ error: 'not_found', message: 'Ad not found' }, { status: 404 })
    }

    const aga = row.adGroupAd ?? row.ad_group_ad
    const ad = aga?.ad
    const rsa = ad?.responsiveSearchAd ?? ad?.responsive_search_ad
    const ag = row.adGroup ?? row.ad_group
    const camp = row.campaign

    return NextResponse.json({
      ad: {
        id: ad?.id ?? id,
        name: ad?.name ?? '',
        type: ad?.type ?? 'UNKNOWN',
        status: aga?.status ?? 'UNKNOWN',
        approvalStatus: aga?.policySummary?.approvalStatus ?? aga?.policy_summary?.approval_status ?? 'UNKNOWN',
        finalUrls: ad?.finalUrls ?? ad?.final_urls ?? [],
        rsa: rsa ? {
          headlines: (rsa.headlines ?? []).map((h: any) => ({ text: h.text ?? '', pinnedField: h.pinnedField ?? h.pinned_field ?? null })),
          descriptions: (rsa.descriptions ?? []).map((d: any) => ({ text: d.text ?? '', pinnedField: d.pinnedField ?? d.pinned_field ?? null })),
          path1: rsa.path1 ?? rsa.path_1 ?? '',
          path2: rsa.path2 ?? rsa.path_2 ?? '',
        } : null,
      },
      adGroup: { id: ag?.id ?? adGroupId, name: ag?.name ?? '' },
      campaign: { id: camp?.id ?? '', name: camp?.name ?? '' },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { error, message, status } = normalizeError(e, 'ad_detail_failed', 500)
    return NextResponse.json({ error, message }, { status })
  }
}
