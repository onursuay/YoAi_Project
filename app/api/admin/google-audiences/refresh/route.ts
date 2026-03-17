/**
 * Admin-only: Refresh Google Ads audience dataset and write to Edge Config.
 * Fetches from Google Ads API, builds Turkish index, updates Edge Config.
 * No OpenAI in this path — uses static translations only.
 *
 * Protection: x-admin-secret header must match process.env.ADMIN_SECRET
 * - ADMIN_SECRET missing => 503 { ok: false, code: "admin_secret_missing" }
 * - Header mismatch => 401 { ok: false, code: "unauthorized" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContextForAdmin } from '@/lib/googleAdsAuth'
import { browseAllAudiences } from '@/lib/google-ads/audience-segments'
import { buildAudienceDataset } from '@/lib/audience/buildAudienceDataset'
import { setAudienceDataset } from '@/lib/audience/edgeConfigStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** GET: minimal JSON for route diagnosis (confirms /api/admin/google-audiences/refresh is reachable) */
export async function GET() {
  return NextResponse.json({ ok: true, route: 'refresh' })
}

export async function POST(req: NextRequest) {
  const start = Date.now()
  console.log('[AUDIENCE_REFRESH_START]')

  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || adminSecret.trim() === '') {
    const elapsed = Date.now() - start
    console.error('[AUDIENCE_REFRESH_FAIL] ADMIN_SECRET not configured')
    return NextResponse.json(
      { ok: false, code: 'admin_secret_missing', elapsedMs: elapsed },
      { status: 503 }
    )
  }

  const headerSecret = req.headers.get('x-admin-secret')
  if (headerSecret !== adminSecret) {
    const elapsed = Date.now() - start
    console.error('[AUDIENCE_REFRESH_FAIL] unauthorized (header mismatch)')
    return NextResponse.json(
      { ok: false, code: 'unauthorized', elapsedMs: elapsed },
      { status: 401 }
    )
  }

  try {
    const ctx = await getGoogleAdsContextForAdmin()
    const raw = await browseAllAudiences(ctx)
    const dataset = buildAudienceDataset(raw, 'tr')

    const result = await setAudienceDataset(dataset)
    if (!result.ok) {
      const elapsed = Date.now() - start
      const is404 = result.error?.includes('404')
      return NextResponse.json(
        {
          ok: false,
          code: 'edge_config_write_failed',
          error: result.error,
          hint: is404
            ? 'Edge Config not found. If scoped to a Team: set VERCEL_TEAM_ID in Vercel env (Team Settings → General → Team ID). Also verify AUDIENCE_EDGE_CONFIG_ID and VERCEL_API_TOKEN.'
            : undefined,
          elapsedMs: elapsed,
        },
        { status: 500 }
      )
    }

    const elapsed = Date.now() - start
    const rawSize = JSON.stringify(dataset).length

    return NextResponse.json({
      ok: true,
      version: dataset.version,
      updatedAt: dataset.updatedAt,
      stats: {
        totalNodes: dataset.stats.totalNodes,
        totalSearchTerms: dataset.stats.totalSearchTerms,
      },
      payloadSizes: {
        rawBytes: rawSize,
        storedBytes: result.storedBytes ?? rawSize,
      },
      elapsedMs: elapsed,
      storage: 'edge-config',
    })
  } catch (e: unknown) {
    const elapsed = Date.now() - start
    const err = e as Error & { code?: string; status?: number }
    const msg = err?.message ?? String(e)

    let code = 'refresh_failed'
    if (msg.includes('Google Ads bağlı değil') || msg.includes('not connected')) {
      code = 'google_ads_not_connected'
    } else if (msg.includes('hesabı seçilmedi') || msg.includes('account')) {
      code = 'google_ads_account_missing'
    } else if (err?.code === 'google_ads_not_connected') {
      code = 'google_ads_not_connected'
    } else if (err?.code === 'google_ads_account_missing') {
      code = 'google_ads_account_missing'
    }

    console.error('[AUDIENCE_REFRESH_FAIL]', code, msg)
    return NextResponse.json(
      {
        ok: false,
        code,
        error: msg,
        hint:
          code === 'google_ads_not_connected'
            ? 'Set GOOGLE_ADS_REFRESH_TOKEN and GOOGLE_ADS_CUSTOMER_ID env vars, or ensure at least one active connection exists in DB (connect via UI first).'
            : code === 'google_ads_account_missing'
              ? 'Set GOOGLE_ADS_CUSTOMER_ID env var, or connect and select account in UI to persist to DB.'
              : undefined,
        elapsedMs: elapsed,
      },
      { status: err?.status ?? 500 }
    )
  }
}
