import { NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { postMutate } from '@/lib/google-ads/create-campaign'
import { normalizeError } from '@/lib/google-ads/errors'

/**
 * POST /api/integrations/google-ads/ads/[adId]/duplicate
 * Body: { adGroupId: string }
 * Duplicates an ad within the same ad group. New ad is created in PAUSED state.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ adId: string }> }
) {
  const { adId } = await params
  const id = String(adId || '').replace(/-/g, '').trim()
  if (!id) {
    return NextResponse.json(
      { error: 'invalid_ad_id', message: 'adId is required' },
      { status: 400 }
    )
  }

  let body: { adGroupId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'JSON body with adGroupId (string) required' },
      { status: 400 }
    )
  }

  const adGroupId = String(body.adGroupId || '').trim()
  if (!adGroupId) {
    return NextResponse.json(
      { error: 'missing_ad_group_id', message: 'adGroupId is required' },
      { status: 400 }
    )
  }

  try {
    const ctx = await getGoogleAdsContext()

    // 1. Fetch ad details
    const [adRow] = await searchGAds<any>(ctx, `
      SELECT
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group_ad.ad.responsive_search_ad.path1,
        ad_group_ad.ad.responsive_search_ad.path2,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.type,
        ad_group.resource_name
      FROM ad_group_ad
      WHERE ad_group_ad.ad.id = ${id}
        AND ad_group.id = ${adGroupId}
      LIMIT 1
    `)
    if (!adRow) {
      return NextResponse.json({ error: 'not_found', message: 'Ad not found' }, { status: 404 })
    }

    const ad = adRow.adGroupAd?.ad
    if (!ad) {
      return NextResponse.json({ error: 'not_found', message: 'Ad data not found' }, { status: 404 })
    }

    const adGroupRn = adRow.adGroup?.resourceName
    if (!adGroupRn) {
      return NextResponse.json({ error: 'not_found', message: 'Ad group resource name not found' }, { status: 404 })
    }

    // 2. Create new ad in same ad group
    const rsa = ad.responsiveSearchAd
    if (!rsa) {
      return NextResponse.json(
        { error: 'unsupported_ad_type', message: 'Only responsive search ads can be duplicated' },
        { status: 400 }
      )
    }

    const newAdData = await postMutate(ctx, 'adGroupAds', [{
      create: {
        adGroup: adGroupRn,
        status: 'PAUSED',
        ad: {
          finalUrls: ad.finalUrls ?? [],
          responsiveSearchAd: {
            headlines: rsa.headlines ?? [],
            descriptions: rsa.descriptions ?? [],
            ...(rsa.path1 && { path1: rsa.path1 }),
            ...(rsa.path2 && { path2: rsa.path2 }),
          },
        },
      },
    }])

    return NextResponse.json({
      ok: true,
      adId: id,
      adGroupId,
      newAdResourceName: newAdData.results[0].resourceName,
    })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'ad_duplicate_failed', 500)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
