import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { buildErrorResponse } from '@/lib/google-ads/errors'
import { num, microsToUnits, getDefaultDateRange } from '@/lib/google-ads/helpers'

/* ── GAQL Queries ── */

function buildAssetsQuery(campaignId: string): string {
  return `
  SELECT
    campaign.id,
    asset.id,
    asset.name,
    asset.type,
    asset.text_asset.text,
    asset.sitelink_asset.description1,
    asset.sitelink_asset.description2,
    asset.sitelink_asset.link_text,
    asset.final_urls,
    asset.callout_asset.callout_text,
    asset.structured_snippet_asset.header,
    asset.structured_snippet_asset.values,
    asset.image_asset.full_size.url,
    asset.image_asset.mime_type,
    asset.call_asset.country_code,
    asset.call_asset.phone_number,
    asset.promotion_asset.promotion_target,
    asset.promotion_asset.percent_off,
    asset.promotion_asset.money_amount_off.amount_micros,
    asset.promotion_asset.money_amount_off.currency_code,
    asset.price_asset.type,
    asset.price_asset.price_offerings,
    asset.lead_form_asset.business_name,
    asset.lead_form_asset.call_to_action_type,
    asset.lead_form_asset.headline,
    asset.lead_form_asset.description,
    campaign_asset.field_type,
    campaign_asset.status,
    campaign_asset.resource_name,
    campaign_asset.source
  FROM campaign_asset
  WHERE campaign.id = ${campaignId}
    AND campaign_asset.status != 'REMOVED'
  `.trim()
}

function buildMetricsQuery(campaignId: string, from: string, to: string): string {
  return `
  SELECT
    asset.id,
    segments.date,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.ctr,
    metrics.average_cpc
  FROM campaign_asset
  WHERE campaign.id = ${campaignId}
    AND campaign_asset.status != 'REMOVED'
    AND segments.date BETWEEN '${from}' AND '${to}'
  `.trim()
}

/* ── Types ── */

export interface CampaignAsset {
  id: string
  name: string
  type: string
  fieldType: string
  status: string
  resourceName: string
  source: string
  text?: string
  sitelink?: { linkText: string; description1: string; description2: string; finalUrls: string[] }
  callout?: string
  structuredSnippet?: { header: string; values: string[] }
  image?: { url: string; mimeType: string }
  call?: { countryCode: string; phoneNumber: string }
  promotion?: { target: string; percentOff?: number; moneyOff?: string }
  price?: { type: string; offerings: any[] }
  leadForm?: { businessName: string; callToAction: string; headline: string; description: string }
  businessName?: string
  logoUrl?: string
  // Performance metrics
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
}

/* ── GET — List assets with performance metrics ── */

export async function GET(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const ctx = await getGoogleAdsContext()
    const { searchParams } = new URL(req.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const { from, to } = fromParam && toParam
      ? { from: fromParam, to: toParam }
      : getDefaultDateRange()

    // Fetch asset details and metrics in parallel
    const [detailRows, metricsRows] = await Promise.all([
      searchGAds<any>(ctx, buildAssetsQuery(params.campaignId)),
      searchGAds<any>(ctx, buildMetricsQuery(params.campaignId, from, to)).catch(() => [] as any[]),
    ])

    // Aggregate metrics by asset.id
    const metricsMap = new Map<string, { impressions: number; clicks: number; costMicros: number; conversions: number; ctrSum: number; cpcSum: number; count: number }>()
    for (const row of metricsRows) {
      const a = row.asset ?? {}
      const id = String(a.id ?? '')
      const m = row.metrics ?? {}
      const existing = metricsMap.get(id) || { impressions: 0, clicks: 0, costMicros: 0, conversions: 0, ctrSum: 0, cpcSum: 0, count: 0 }
      existing.impressions += num(m.impressions)
      existing.clicks += num(m.clicks)
      existing.costMicros += num(m.costMicros ?? m.cost_micros)
      existing.conversions += num(m.conversions)
      existing.ctrSum += num(m.ctr)
      existing.cpcSum += num(m.averageCpc ?? m.average_cpc)
      existing.count++
      metricsMap.set(id, existing)
    }

    const assets: CampaignAsset[] = detailRows.map((row: any) => {
      const a = row.asset ?? row
      const ca = row.campaignAsset ?? row.campaign_asset ?? {}
      const type = a.type ?? a.asset?.type ?? ''
      const id = String(a.id ?? '')

      // Metrics for this asset
      const met = metricsMap.get(id)
      const impressions = met?.impressions ?? 0
      const clicks = met?.clicks ?? 0
      const cost = microsToUnits(met?.costMicros ?? 0)
      const conversions = met?.conversions ?? 0
      const ctr = met && met.count > 0 ? (met.ctrSum / met.count) * 100 : 0
      const cpc = met && met.count > 0 ? microsToUnits(met.cpcSum / met.count) : 0

      // Source: ADVERTISER, AUTOMATICALLY_CREATED, etc.
      const rawSource = ca.source ?? ''

      const base: CampaignAsset = {
        id,
        name: a.name ?? '',
        type,
        fieldType: ca.fieldType ?? ca.field_type ?? '',
        status: ca.status ?? '',
        resourceName: ca.resourceName ?? ca.resource_name ?? '',
        source: rawSource,
        impressions, clicks, cost, conversions, ctr, cpc,
      }

      if (type === 'SITELINK') {
        const sl = a.sitelinkAsset ?? a.sitelink_asset ?? {}
        base.sitelink = {
          linkText: sl.linkText ?? sl.link_text ?? '',
          description1: sl.description1 ?? '',
          description2: sl.description2 ?? '',
          finalUrls: Array.isArray(a.finalUrls ?? a.final_urls) ? (a.finalUrls ?? a.final_urls) : [],
        }
      } else if (type === 'CALLOUT') {
        const co = a.calloutAsset ?? a.callout_asset ?? {}
        base.callout = co.calloutText ?? co.callout_text ?? ''
      } else if (type === 'STRUCTURED_SNIPPET') {
        const ss = a.structuredSnippetAsset ?? a.structured_snippet_asset ?? {}
        base.structuredSnippet = {
          header: ss.header ?? '',
          values: Array.isArray(ss.values) ? ss.values : [],
        }
      } else if (type === 'IMAGE') {
        const img = a.imageAsset ?? a.image_asset ?? {}
        const fullSize = img.fullSize ?? img.full_size ?? {}
        base.image = {
          url: fullSize.url ?? '',
          mimeType: img.mimeType ?? img.mime_type ?? '',
        }
      } else if (type === 'CALL') {
        const cl = a.callAsset ?? a.call_asset ?? {}
        base.call = {
          countryCode: cl.countryCode ?? cl.country_code ?? '',
          phoneNumber: cl.phoneNumber ?? cl.phone_number ?? '',
        }
      } else if (type === 'PROMOTION') {
        const pr = a.promotionAsset ?? a.promotion_asset ?? {}
        const moneyOff = pr.moneyAmountOff ?? pr.money_amount_off
        base.promotion = {
          target: pr.promotionTarget ?? pr.promotion_target ?? '',
          percentOff: pr.percentOff ?? pr.percent_off ?? undefined,
          moneyOff: moneyOff ? `${Number(moneyOff.amountMicros ?? moneyOff.amount_micros ?? 0) / 1_000_000} ${moneyOff.currencyCode ?? moneyOff.currency_code ?? ''}` : undefined,
        }
      } else if (type === 'PRICE') {
        const pc = a.priceAsset ?? a.price_asset ?? {}
        base.price = {
          type: pc.type ?? '',
          offerings: Array.isArray(pc.priceOfferings ?? pc.price_offerings) ? (pc.priceOfferings ?? pc.price_offerings) : [],
        }
      } else if (type === 'LEAD_FORM') {
        const lf = a.leadFormAsset ?? a.lead_form_asset ?? {}
        base.leadForm = {
          businessName: lf.businessName ?? lf.business_name ?? '',
          callToAction: lf.callToActionType ?? lf.call_to_action_type ?? '',
          headline: lf.headline ?? '',
          description: lf.description ?? '',
        }
      } else if (type === 'BUSINESS_NAME') {
        const bn = a.businessNameAsset ?? a.business_name_asset ?? {}
        base.businessName = bn.businessName ?? bn.business_name ?? ''
      } else if (type === 'LOGO') {
        const logo = a.logoAsset ?? a.logo_asset ?? {}
        base.logoUrl = logo.autoGeneratedImageUrl ?? logo.auto_generated_image_url ?? ''
      } else {
        const ta = a.textAsset ?? a.text_asset ?? {}
        if (ta.text) base.text = ta.text
      }

      return base
    })

    return NextResponse.json({ assets, dateRange: { from, to } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'assets_failed', 'CampaignAssets')
    return NextResponse.json(body, { status })
  }
}

/* ── POST — Create a new asset and link it to the campaign ── */

export async function POST(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const ctx = await getGoogleAdsContext()
    const body = await req.json()
    const { type, fieldType } = body

    let assetPayload: Record<string, any> = {}
    if (type === 'SITELINK') {
      assetPayload = {
        type: 'SITELINK',
        sitelinkAsset: {
          linkText: body.linkText,
          description1: body.description1 || '',
          description2: body.description2 || '',
        },
        finalUrls: body.finalUrl ? [body.finalUrl] : [],
      }
    } else if (type === 'CALLOUT') {
      assetPayload = {
        type: 'CALLOUT',
        calloutAsset: { calloutText: body.calloutText },
      }
    } else if (type === 'STRUCTURED_SNIPPET') {
      assetPayload = {
        type: 'STRUCTURED_SNIPPET',
        structuredSnippetAsset: { header: body.header, values: body.values },
      }
    } else {
      return NextResponse.json({ error: `Unsupported asset type: ${type}` }, { status: 400 })
    }

    // Step 1: Create the asset
    const createRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/assets:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({ operations: [{ create: assetPayload }] }),
    })
    const createData = await createRes.json()
    if (!createRes.ok) {
      throw new Error(createData?.error?.message ?? JSON.stringify(createData))
    }
    const assetResourceName = createData.results?.[0]?.resourceName
    if (!assetResourceName) throw new Error('Asset resource name not returned')

    // Step 2: Link asset to campaign
    const campaignResourceName = `customers/${ctx.customerId}/campaigns/${params.campaignId}`
    const linkRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignAssets:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({
        operations: [{
          create: {
            asset: assetResourceName,
            campaign: campaignResourceName,
            fieldType: fieldType || type,
          },
        }],
      }),
    })
    const linkData = await linkRes.json()
    if (!linkRes.ok) {
      throw new Error(linkData?.error?.message ?? JSON.stringify(linkData))
    }

    return NextResponse.json({ success: true, assetResourceName })
  } catch (e: unknown) {
    const { body: errBody, status } = buildErrorResponse(e, 'asset_create_failed', 'AssetCreate')
    return NextResponse.json(errBody, { status })
  }
}

/* ── PATCH — Update campaign_asset status (pause/enable) ── */

export async function PATCH(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const ctx = await getGoogleAdsContext()
    const body = await req.json()
    const { resourceNames, status: newStatus } = body

    if (!resourceNames?.length || !newStatus) {
      return NextResponse.json({ error: 'resourceNames and status required' }, { status: 400 })
    }
    if (!['ENABLED', 'PAUSED', 'REMOVED'].includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid status. Must be ENABLED, PAUSED, or REMOVED.' }, { status: 400 })
    }

    const operations = resourceNames.map((rn: string) => ({
      update: { resourceName: rn, status: newStatus },
      updateMask: 'status',
    }))

    const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignAssets:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({ operations }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error?.message ?? JSON.stringify(data))
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const { body: errBody, status } = buildErrorResponse(e, 'asset_status_update_failed', 'AssetStatusUpdate')
    return NextResponse.json(errBody, { status })
  }
}

/* ── DELETE — Remove (unlink) an asset from the campaign ── */

export async function DELETE(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const ctx = await getGoogleAdsContext()
    const body = await req.json()
    const { assetId, resourceNames } = body

    // Support both single assetId and bulk resourceNames
    let rnsToRemove: string[] = []

    if (resourceNames?.length) {
      rnsToRemove = resourceNames
    } else if (assetId) {
      // Find the campaign_asset resource name by asset ID
      const query = `
        SELECT campaign_asset.resource_name
        FROM campaign_asset
        WHERE campaign.id = ${params.campaignId}
          AND asset.id = ${assetId}
        LIMIT 1
      `.trim()
      const rows = await searchGAds<any>(ctx, query)
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Campaign asset link not found' }, { status: 404 })
      }
      const rn = rows[0].campaignAsset?.resourceName ?? rows[0].campaign_asset?.resource_name
      if (rn) rnsToRemove.push(rn)
    } else {
      return NextResponse.json({ error: 'assetId or resourceNames required' }, { status: 400 })
    }

    if (rnsToRemove.length === 0) {
      return NextResponse.json({ error: 'No resource names to remove' }, { status: 400 })
    }

    const removeRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/campaignAssets:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({
        operations: rnsToRemove.map(rn => ({ remove: rn })),
      }),
    })
    const removeData = await removeRes.json()
    if (!removeRes.ok) {
      throw new Error(removeData?.error?.message ?? JSON.stringify(removeData))
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const { body: errBody, status } = buildErrorResponse(e, 'asset_remove_failed', 'AssetRemove')
    return NextResponse.json(errBody, { status })
  }
}
