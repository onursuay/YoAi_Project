import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'
import { toMetaMinorUnits } from '@/lib/meta/currency'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

function normalizeLocArray(arr: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return arr.map((loc) =>
    String(loc.distance_unit ?? '').toLowerCase() === 'mile'
      ? { ...loc, distance_unit: 'kilometer' }
      : loc
  )
}

/** Meta API: geo_locations custom_locations/cities distance_unit "mile" -> "kilometer" (subcode 1487057 önlemi) */
function normalizeTargetingForMeta(targeting: Record<string, unknown> | null | undefined): Record<string, unknown> | null | undefined {
  if (!targeting || typeof targeting !== 'object') return targeting
  const geo = targeting.geo_locations as Record<string, unknown> | undefined
  if (!geo) return targeting
  const updatedGeo: Record<string, unknown> = { ...geo }
  if (Array.isArray(geo.custom_locations)) {
    updatedGeo.custom_locations = normalizeLocArray(geo.custom_locations as Array<Record<string, unknown>>)
  }
  if (Array.isArray(geo.cities)) {
    updatedGeo.cities = normalizeLocArray(geo.cities as Array<Record<string, unknown>>)
  }
  return { ...targeting, geo_locations: updatedGeo }
}

export async function POST(request: Request) {
  try {
    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      adsetId,
      name,
      dailyBudget,
      lifetimeBudget,
      targeting,
      startTime,
      endTime,
      optimizationGoal,
    } = body

    if (DEBUG) console.log('[AdSet Update] Incoming:', JSON.stringify(body, null, 2))

    if (!adsetId) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'adsetId zorunlu' },
        { status: 400 }
      )
    }

    // Fetch account currency for minor unit factor
    const accountRes = await metaClient.client.get<{ currency?: string }>(`/${metaClient.accountId}`, { fields: 'currency' })
    const accountCurrency = accountRes.ok && typeof accountRes.data?.currency === 'string' ? accountRes.data.currency : 'USD'

    const buildFormData = (includeBudget: boolean) => {
      const fd = new URLSearchParams()

      if (name !== undefined && name !== null) {
        const trimmed = String(name).trim()
        if (trimmed.length > 0) fd.append('name', trimmed)
      }

      if (includeBudget) {
        if (dailyBudget !== undefined && dailyBudget !== null) {
          const val = Number(dailyBudget)
          if (val > 0) fd.append('daily_budget', toMetaMinorUnits(val, accountCurrency))
        }
        if (lifetimeBudget !== undefined && lifetimeBudget !== null) {
          const val = Number(lifetimeBudget)
          if (val > 0) fd.append('lifetime_budget', toMetaMinorUnits(val, accountCurrency))
        }
      }

      if (targeting !== undefined && targeting !== null) {
        const normalized = normalizeTargetingForMeta(targeting as Record<string, unknown>) ?? targeting
        // Whitelist: only send known writable targeting fields to Meta
        const WRITABLE_FIELDS = new Set([
          'age_min', 'age_max', 'genders', 'geo_locations', 'excluded_geo_locations',
          'locales', 'flexible_spec', 'exclusions',
          'custom_audiences', 'excluded_custom_audiences',
          'device_platforms', 'user_os', 'user_device',
          'publisher_platforms', 'facebook_positions', 'instagram_positions',
          'messenger_positions', 'audience_network_positions',
          'wireless_carrier', 'education_statuses', 'relationship_statuses',
          'interested_in', 'life_events', 'politics', 'income',
          'net_worth', 'home_type', 'home_ownership', 'home_value',
          'ethnic_affinity', 'generation', 'household_composition',
          'family_statuses', 'targeting_optimization_types',
        ])
        const cleanTargeting: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(normalized as Record<string, unknown>)) {
          if (WRITABLE_FIELDS.has(key) && val !== undefined && val !== null) {
            cleanTargeting[key] = val
          }
        }
        fd.append('targeting', JSON.stringify(cleanTargeting))
        if (DEBUG) console.log(JSON.stringify({ meta_outbound_adset_targeting: cleanTargeting }))
      }
      // start_time: yalnızca henüz başlamamış adset'lerde gönderilebilir.
      // Aktif/başlamış adset'e start_time göndermek subcode 1487057 hatasına yol açar.
      // Bu nedenle update'de start_time hiçbir zaman gönderilmez.
      if (endTime !== undefined && endTime !== null) {
        fd.append('end_time', endTime)
      }
      if (optimizationGoal !== undefined && optimizationGoal !== null) {
        fd.append('optimization_goal', optimizationGoal)
      }

      return fd
    }

    let formData = buildFormData(true)

    if (formData.toString().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'En az bir alan güncellenmelidir' },
        { status: 400 }
      )
    }

    if (DEBUG) {
      const debugParams: Record<string, string> = {}
      formData.forEach((value, key) => { debugParams[key] = value })
      console.log('[AdSet Update] Sending to Meta:', JSON.stringify(debugParams, null, 2))
    }

    let result = await metaClient.client.postForm(`/${adsetId}`, formData)

    // CBO hatası: subcode 1885364 = kampanya bütçe optimizasyonu aktif, bütçe olmadan tekrar dene
    if (!result.ok && result.error?.subcode === 1885364) {
      if (DEBUG) console.log('[AdSet Update] CBO detected, retrying without budget...')
      formData = buildFormData(false)

      if (formData.toString().length === 0) {
        return NextResponse.json({
          ok: false,
          error: 'cbo_budget_conflict',
          message: 'Bu kampanyada CBO aktif. Adset bütçesi kampanya seviyesinden yönetilir.',
        }, { status: 400 })
      }

      result = await metaClient.client.postForm(`/${adsetId}`, formData)
    }

    if (!result.ok) {
      if (DEBUG) console.error('[AdSet Update] Meta API Error:', JSON.stringify(result.error, null, 2))
      const statusCode = result.error?.code === 429 ? 429
        : result.error?.code === 403 ? 403
        : result.error?.code === 400 ? 400
        : 422

      return NextResponse.json(
        {
          ok: false,
          error: 'meta_api_error',
          message: result.error?.message || 'Reklam seti güncellenemedi',
          code: result.error?.code,
          subcode: result.error?.subcode,
          fbtrace_id: result.error?.fbtrace_id,
        },
        { status: statusCode }
      )
    }

    return NextResponse.json({
      ok: true,
      adsetId,
      data: result.data,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    if (DEBUG) console.error('AdSet update error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'server_error',
        message: 'Sunucu hatası',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
