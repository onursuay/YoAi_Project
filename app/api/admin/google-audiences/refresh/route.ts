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
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
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
    const ctx = await getGoogleAdsContext()
    const raw = await browseAllAudiences(ctx)
    const dataset = buildAudienceDataset(raw, 'tr')

    const result = await setAudienceDataset(dataset)
    if (!result.ok) {
      const elapsed = Date.now() - start
      return NextResponse.json(
        {
          ok: false,
          code: 'edge_config_write_failed',
          error: result.error,
          elapsedMs: elapsed,
        },
        { status: 500 }
      )
    }

    const elapsed = Date.now() - start
    const payloadSizeBytes = JSON.stringify(dataset).length

    return NextResponse.json({
      ok: true,
      version: dataset.version,
      updatedAt: dataset.updatedAt,
      stats: {
        totalNodes: dataset.stats.totalNodes,
        totalSearchTerms: dataset.stats.totalSearchTerms,
      },
      payloadSizeBytes,
      elapsedMs: elapsed,
      storage: 'edge-config',
    })
  } catch (e: unknown) {
    const elapsed = Date.now() - start
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[AUDIENCE_REFRESH_FAIL]', msg)
    return NextResponse.json(
      {
        ok: false,
        code: 'refresh_failed',
        error: msg,
        elapsedMs: elapsed,
      },
      { status: (e as { status?: number })?.status ?? 500 }
    )
  }
}
