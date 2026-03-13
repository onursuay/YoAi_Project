import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { normalizeError } from '@/lib/google-ads/errors'

/**
 * GET /api/integrations/google-ads/ad-groups/[adGroupId]/detail
 * Returns ad group details + keywords.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ adGroupId: string }> }
) {
  const { adGroupId } = await params
  const id = String(adGroupId || '').replace(/-/g, '').trim()
  if (!id) {
    return NextResponse.json({ error: 'invalid_id', message: 'adGroupId is required' }, { status: 400 })
  }

  try {
    const ctx = await getGoogleAdsContext()

    const [agRows, kwRows] = await Promise.all([
      searchGAds<any>(ctx, `
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          ad_group.type,
          ad_group.cpc_bid_micros,
          campaign.id,
          campaign.name
        FROM ad_group
        WHERE ad_group.id = ${id}
        LIMIT 1
      `),
      searchGAds<any>(ctx, `
        SELECT
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.negative,
          ad_group_criterion.status
        FROM ad_group_criterion
        WHERE ad_group.id = ${id}
          AND ad_group_criterion.type = 'KEYWORD'
          AND ad_group_criterion.status != 'REMOVED'
        LIMIT 500
      `).catch(() => []),
    ])

    const row = agRows[0]
    if (!row) {
      return NextResponse.json({ error: 'not_found', message: 'Ad group not found' }, { status: 404 })
    }

    const ag = row.adGroup ?? row.ad_group
    const camp = row.campaign
    const bidRaw = ag?.cpcBidMicros ?? ag?.cpc_bid_micros
    const cpcBidMicros = bidRaw != null ? Number(bidRaw) : null

    const keywords = kwRows.map((r: any) => {
      const kw = r.adGroupCriterion ?? r.ad_group_criterion
      const keyword = kw?.keyword
      return {
        text: keyword?.text ?? '',
        matchType: keyword?.matchType ?? keyword?.match_type ?? '',
        negative: kw?.negative ?? false,
      }
    })

    return NextResponse.json({
      adGroup: {
        id: ag?.id ?? id,
        name: ag?.name ?? '',
        status: ag?.status ?? 'UNKNOWN',
        type: ag?.type ?? 'UNKNOWN',
        cpcBid: cpcBidMicros != null ? cpcBidMicros / 1_000_000 : null,
      },
      campaign: { id: camp?.id ?? '', name: camp?.name ?? '' },
      keywords,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { error, message, status } = normalizeError(e, 'ad_group_detail_failed', 500)
    return NextResponse.json({ error, message }, { status })
  }
}
