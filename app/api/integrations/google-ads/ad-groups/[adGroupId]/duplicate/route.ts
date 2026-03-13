import { NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { postMutate } from '@/lib/google-ads/create-campaign'
import { normalizeError } from '@/lib/google-ads/errors'

/**
 * POST /api/integrations/google-ads/ad-groups/[adGroupId]/duplicate
 * Duplicates an ad group with all keywords and ads within the same campaign.
 * New ad group is created in PAUSED state.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ adGroupId: string }> }
) {
  const { adGroupId } = await params
  const id = String(adGroupId || '').replace(/-/g, '').trim()
  if (!id) {
    return NextResponse.json(
      { error: 'invalid_ad_group_id', message: 'adGroupId is required' },
      { status: 400 }
    )
  }

  try {
    const ctx = await getGoogleAdsContext()

    // 1. Fetch ad group details
    const [agRow] = await searchGAds<any>(ctx, `
      SELECT
        ad_group.name,
        ad_group.type,
        ad_group.cpc_bid_micros,
        ad_group.campaign
      FROM ad_group
      WHERE ad_group.id = ${id}
      LIMIT 1
    `)
    if (!agRow) {
      return NextResponse.json({ error: 'not_found', message: 'Ad group not found' }, { status: 404 })
    }

    // 2. Fetch keywords
    const keywords = await searchGAds<any>(ctx, `
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.cpc_bid_micros,
        ad_group_criterion.negative
      FROM ad_group_criterion
      WHERE ad_group.id = ${id}
        AND ad_group_criterion.type = 'KEYWORD'
        AND ad_group_criterion.status != 'REMOVED'
      LIMIT 500
    `)

    // 3. Fetch ads
    const ads = await searchGAds<any>(ctx, `
      SELECT
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group_ad.ad.responsive_search_ad.path1,
        ad_group_ad.ad.responsive_search_ad.path2,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.type
      FROM ad_group_ad
      WHERE ad_group.id = ${id}
        AND ad_group_ad.status != 'REMOVED'
      LIMIT 50
    `)

    // 4. Create new ad group in same campaign
    const ag = agRow.adGroup
    const agData = await postMutate(ctx, 'adGroups', [{
      create: {
        name: `${ag.name} (Kopya)`,
        campaign: ag.campaign,
        status: 'PAUSED',
        type: ag.type ?? 'SEARCH_STANDARD',
        ...(ag.cpcBidMicros && { cpcBidMicros: ag.cpcBidMicros }),
      },
    }])
    const newAgRn: string = agData.results[0].resourceName

    // 5. Copy keywords
    const positiveKws = keywords.filter((k: any) => !k.adGroupCriterion?.negative)
    const negativeKws = keywords.filter((k: any) => k.adGroupCriterion?.negative)

    if (positiveKws.length > 0) {
      await postMutate(ctx, 'adGroupCriteria', positiveKws.map((k: any) => ({
        create: {
          adGroup: newAgRn,
          status: 'ENABLED',
          keyword: {
            text: k.adGroupCriterion.keyword.text,
            matchType: k.adGroupCriterion.keyword.matchType,
          },
          ...(k.adGroupCriterion.cpcBidMicros && { cpcBidMicros: k.adGroupCriterion.cpcBidMicros }),
        },
      })))
    }

    if (negativeKws.length > 0) {
      await postMutate(ctx, 'adGroupCriteria', negativeKws.map((k: any) => ({
        create: {
          adGroup: newAgRn,
          negative: true,
          keyword: {
            text: k.adGroupCriterion.keyword.text,
            matchType: k.adGroupCriterion.keyword.matchType,
          },
        },
      })))
    }

    // 6. Copy ads
    for (const adRow of ads) {
      const ad = adRow.adGroupAd?.ad
      if (!ad) continue
      const rsa = ad.responsiveSearchAd
      if (rsa) {
        await postMutate(ctx, 'adGroupAds', [{
          create: {
            adGroup: newAgRn,
            status: 'ENABLED',
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
      }
    }

    return NextResponse.json({ ok: true, adGroupId: id, newAdGroupResourceName: newAgRn })
  } catch (e: unknown) {
    const { error, message, status: errStatus } = normalizeError(e, 'ad_group_duplicate_failed', 500)
    return NextResponse.json({ error, message }, { status: errStatus })
  }
}
