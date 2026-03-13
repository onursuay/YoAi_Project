import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext, searchGAds, GOOGLE_ADS_BASE, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { buildErrorResponse } from '@/lib/google-ads/errors'
import { num, microsToUnits, getDefaultDateRange } from '@/lib/google-ads/helpers'

/* ── GAQL Queries ── */

function buildAssetsQuery(adGroupId: string): string {
  return `
  SELECT
    ad_group.id,
    asset.id,
    asset.name,
    asset.type,
    asset.text_asset.text,
    asset.sitelink_asset.link_text,
    asset.sitelink_asset.description1,
    asset.sitelink_asset.description2,
    asset.final_urls,
    asset.callout_asset.callout_text,
    asset.structured_snippet_asset.header,
    asset.structured_snippet_asset.values,
    asset.image_asset.full_size.url,
    asset.image_asset.mime_type,
    asset.call_asset.country_code,
    asset.call_asset.phone_number,
    asset.lead_form_asset.business_name,
    asset.lead_form_asset.call_to_action_type,
    asset.lead_form_asset.headline,
    asset.lead_form_asset.description,
    ad_group_asset.field_type,
    ad_group_asset.status,
    ad_group_asset.resource_name,
    ad_group_asset.source
  FROM ad_group_asset
  WHERE ad_group.id = ${adGroupId}
    AND ad_group_asset.status != 'REMOVED'
  `.trim()
}

function buildMetricsQuery(adGroupId: string, from: string, to: string): string {
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
  FROM ad_group_asset
  WHERE ad_group.id = ${adGroupId}
    AND ad_group_asset.status != 'REMOVED'
    AND segments.date BETWEEN '${from}' AND '${to}'
  `.trim()
}

/* ── GET — List assets with performance metrics ── */

export async function GET(req: NextRequest, { params }: { params: Promise<{ adGroupId: string }> }) {
  try {
    const { adGroupId } = await params
    const ctx = await getGoogleAdsContext()
    const { searchParams } = new URL(req.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const { from, to } = fromParam && toParam
      ? { from: fromParam, to: toParam }
      : getDefaultDateRange()

    const [detailRows, metricsRows] = await Promise.all([
      searchGAds<any>(ctx, buildAssetsQuery(adGroupId)),
      searchGAds<any>(ctx, buildMetricsQuery(adGroupId, from, to)).catch(() => [] as any[]),
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

    const assets = detailRows.map((row: any) => {
      const a = row.asset ?? row
      const aga = row.adGroupAsset ?? row.ad_group_asset ?? {}
      const type = a.type ?? ''
      const id = String(a.id ?? '')
      const met = metricsMap.get(id)

      const base: any = {
        id,
        name: a.name ?? '',
        type,
        fieldType: aga.fieldType ?? aga.field_type ?? '',
        status: aga.status ?? '',
        resourceName: aga.resourceName ?? aga.resource_name ?? '',
        source: aga.source ?? '',
        impressions: met?.impressions ?? 0,
        clicks: met?.clicks ?? 0,
        cost: microsToUnits(met?.costMicros ?? 0),
        conversions: met?.conversions ?? 0,
        ctr: met && met.count > 0 ? (met.ctrSum / met.count) * 100 : 0,
        cpc: met && met.count > 0 ? microsToUnits(met.cpcSum / met.count) : 0,
      }

      if (type === 'SITELINK') {
        const sl = a.sitelinkAsset ?? a.sitelink_asset ?? {}
        base.sitelink = { linkText: sl.linkText ?? sl.link_text ?? '', description1: sl.description1 ?? '', description2: sl.description2 ?? '', finalUrls: Array.isArray(a.finalUrls ?? a.final_urls) ? (a.finalUrls ?? a.final_urls) : [] }
      } else if (type === 'CALLOUT') {
        const co = a.calloutAsset ?? a.callout_asset ?? {}
        base.callout = co.calloutText ?? co.callout_text ?? ''
      } else if (type === 'STRUCTURED_SNIPPET') {
        const ss = a.structuredSnippetAsset ?? a.structured_snippet_asset ?? {}
        base.structuredSnippet = { header: ss.header ?? '', values: Array.isArray(ss.values) ? ss.values : [] }
      } else if (type === 'IMAGE') {
        const img = a.imageAsset ?? a.image_asset ?? {}
        const fullSize = img.fullSize ?? img.full_size ?? {}
        base.image = { url: fullSize.url ?? '', mimeType: img.mimeType ?? img.mime_type ?? '' }
      } else if (type === 'CALL') {
        const cl = a.callAsset ?? a.call_asset ?? {}
        base.call = { countryCode: cl.countryCode ?? cl.country_code ?? '', phoneNumber: cl.phoneNumber ?? cl.phone_number ?? '' }
      } else if (type === 'PROMOTION') {
        const pr = a.promotionAsset ?? a.promotion_asset ?? {}
        const moneyOff = pr.moneyAmountOff ?? pr.money_amount_off
        base.promotion = { target: pr.promotionTarget ?? pr.promotion_target ?? '', percentOff: pr.percentOff ?? pr.percent_off ?? undefined, moneyOff: moneyOff ? `${Number(moneyOff.amountMicros ?? moneyOff.amount_micros ?? 0) / 1_000_000} ${moneyOff.currencyCode ?? moneyOff.currency_code ?? ''}` : undefined }
      } else if (type === 'PRICE') {
        const pc = a.priceAsset ?? a.price_asset ?? {}
        base.price = { type: pc.type ?? '', offerings: Array.isArray(pc.priceOfferings ?? pc.price_offerings) ? (pc.priceOfferings ?? pc.price_offerings) : [] }
      } else if (type === 'LEAD_FORM') {
        const lf = a.leadFormAsset ?? a.lead_form_asset ?? {}
        base.leadForm = { businessName: lf.businessName ?? lf.business_name ?? '', callToAction: lf.callToActionType ?? lf.call_to_action_type ?? '', headline: lf.headline ?? '', description: lf.description ?? '' }
      } else {
        const ta = a.textAsset ?? a.text_asset ?? {}
        if (ta.text) base.text = ta.text
      }

      return base
    })

    return NextResponse.json({ assets, dateRange: { from, to } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const { body, status } = buildErrorResponse(e, 'ad_group_assets_failed', 'AdGroupAssets')
    return NextResponse.json(body, { status })
  }
}

/* ── POST — Create asset and link to ad group ── */

export async function POST(req: NextRequest, { params }: { params: Promise<{ adGroupId: string }> }) {
  try {
    const { adGroupId } = await params
    const ctx = await getGoogleAdsContext()
    const body = await req.json()
    const { type, fieldType } = body

    let assetPayload: Record<string, any> = {}
    if (type === 'SITELINK') {
      assetPayload = { type: 'SITELINK', sitelinkAsset: { linkText: body.linkText, description1: body.description1 || '', description2: body.description2 || '' }, finalUrls: body.finalUrl ? [body.finalUrl] : [] }
    } else if (type === 'CALLOUT') {
      assetPayload = { type: 'CALLOUT', calloutAsset: { calloutText: body.calloutText } }
    } else if (type === 'STRUCTURED_SNIPPET') {
      assetPayload = { type: 'STRUCTURED_SNIPPET', structuredSnippetAsset: { header: body.header, values: body.values } }
    } else {
      return NextResponse.json({ error: `Unsupported asset type: ${type}` }, { status: 400 })
    }

    const createRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/assets:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({ operations: [{ create: assetPayload }] }),
    })
    const createData = await createRes.json()
    if (!createRes.ok) throw new Error(createData?.error?.message ?? JSON.stringify(createData))

    const assetResourceName = createData.results?.[0]?.resourceName
    if (!assetResourceName) throw new Error('Asset resource name not returned')

    const adGroupResourceName = `customers/${ctx.customerId}/adGroups/${adGroupId}`
    const linkRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupAssets:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({ operations: [{ create: { asset: assetResourceName, adGroup: adGroupResourceName, fieldType: fieldType || type } }] }),
    })
    const linkData = await linkRes.json()
    if (!linkRes.ok) throw new Error(linkData?.error?.message ?? JSON.stringify(linkData))

    return NextResponse.json({ success: true, assetResourceName })
  } catch (e: unknown) {
    const { body: errBody, status } = buildErrorResponse(e, 'ad_group_asset_create_failed', 'AdGroupAssetCreate')
    return NextResponse.json(errBody, { status })
  }
}

/* ── PATCH — Update ad_group_asset status ── */

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const body = await req.json()
    const { resourceNames, status: newStatus } = body
    if (!resourceNames?.length || !newStatus) return NextResponse.json({ error: 'resourceNames and status required' }, { status: 400 })

    const operations = resourceNames.map((rn: string) => ({ update: { resourceName: rn, status: newStatus }, updateMask: 'status' }))
    const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupAssets:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({ operations }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error?.message ?? JSON.stringify(data))

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const { body: errBody, status } = buildErrorResponse(e, 'ad_group_asset_status_failed', 'AdGroupAssetStatus')
    return NextResponse.json(errBody, { status })
  }
}

/* ── DELETE — Remove (unlink) asset from ad group ── */

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ adGroupId: string }> }) {
  try {
    const { adGroupId } = await params
    const ctx = await getGoogleAdsContext()
    const body = await req.json()
    const { assetId, resourceNames } = body

    let rnsToRemove: string[] = []
    if (resourceNames?.length) {
      rnsToRemove = resourceNames
    } else if (assetId) {
      const query = `SELECT ad_group_asset.resource_name FROM ad_group_asset WHERE ad_group.id = ${adGroupId} AND asset.id = ${assetId} LIMIT 1`.trim()
      const rows = await searchGAds<any>(ctx, query)
      if (rows.length === 0) return NextResponse.json({ error: 'Ad group asset link not found' }, { status: 404 })
      const rn = rows[0].adGroupAsset?.resourceName ?? rows[0].ad_group_asset?.resource_name
      if (rn) rnsToRemove.push(rn)
    } else {
      return NextResponse.json({ error: 'assetId or resourceNames required' }, { status: 400 })
    }

    const removeRes = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/adGroupAssets:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({ operations: rnsToRemove.map(rn => ({ remove: rn })) }),
    })
    const removeData = await removeRes.json()
    if (!removeRes.ok) throw new Error(removeData?.error?.message ?? JSON.stringify(removeData))

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const { body: errBody, status } = buildErrorResponse(e, 'ad_group_asset_remove_failed', 'AdGroupAssetRemove')
    return NextResponse.json(errBody, { status })
  }
}
