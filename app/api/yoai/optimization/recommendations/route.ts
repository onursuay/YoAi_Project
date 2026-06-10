import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { requireOptimizationAccess } from '@/lib/meta/optimization/serverGuard'
import {
  recordBeforeSnapshot,
  listRecommendationResults,
  type MetricSnapshot,
} from '@/lib/yoai/resultTrackingStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PersistPayload {
  campaignId?: string
  campaignName?: string
  /** Aktif/seçili reklam hesabı (Meta act_xxxxx / Google müşteri kimliği) — hesap-scope için metadata'ya yazılır. */
  accountId?: string
  /** Platform — meta (default) | google | tiktok. by_account kırılımı platform bazlı. */
  platform?: string
  currency?: string
  timestamp?: number
  problemTags?: unknown[]
  recommendations?: Array<{
    id?: string
    problemTag?: string
    risk?: string
    category?: string
    confidence?: number
    evidence?: Array<{ metric: string; value: number }>
  }>
  aiGenerated?: boolean
  aiRequested?: boolean
  aiFallbackUsed?: boolean
}

/**
 * Build a flat metric snapshot from the recommendations' evidence rows.
 *
 * We don't pull live insights here — that already happened upstream during
 * the score/scan flow. The evidence carries the same values, so reusing
 * them keeps this endpoint cheap and side-effect-free against Meta.
 */
function snapshotFromRecommendations(
  recs: PersistPayload['recommendations'] = [],
): MetricSnapshot {
  const snap: MetricSnapshot = {}
  for (const rec of recs) {
    for (const ev of rec.evidence ?? []) {
      if (!ev?.metric) continue
      if (typeof ev.value !== 'number' || !Number.isFinite(ev.value)) continue
      if (snap[ev.metric] == null) snap[ev.metric] = ev.value
    }
  }
  return snap
}

export async function POST(request: Request) {
  // Same gate as the scan itself — no need to allow persistence for users
  // who couldn't have produced a scan in the first place.
  const gate = await requireOptimizationAccess()
  if (!gate.ok) return gate.response

  let body: PersistPayload
  try {
    body = (await request.json()) as PersistPayload
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400 },
    )
  }

  if (!body.campaignId || !Array.isArray(body.recommendations)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_payload' },
      { status: 400 },
    )
  }

  const proposalId = `magicscan_${body.campaignId}_${body.timestamp ?? Date.now()}`

  // Platform: meta (default, geriye dönük uyumlu) | google | tiktok. Bilinmeyen değer → meta.
  const platform =
    body.platform === 'google' || body.platform === 'tiktok' ? body.platform : 'meta'

  const row = await recordBeforeSnapshot(gate.user.id, {
    proposalId,
    sourceCampaignId: body.campaignId,
    accountId: body.accountId ?? null,
    platform,
    recommendationType: 'optimization',
    proposalSnapshot: {
      campaignName: body.campaignName ?? null,
      currency: body.currency ?? null,
      timestamp: body.timestamp ?? Date.now(),
      problemTagCount: Array.isArray(body.problemTags) ? body.problemTags.length : 0,
      recommendationCount: body.recommendations.length,
      aiGenerated: Boolean(body.aiGenerated),
      aiRequested: Boolean(body.aiRequested),
      aiFallbackUsed: Boolean(body.aiFallbackUsed),
      recommendations: body.recommendations.map(r => ({
        id: r.id,
        problemTag: r.problemTag,
        risk: r.risk,
        category: r.category,
        confidence: r.confidence,
      })),
    },
    beforeSnapshot: snapshotFromRecommendations(body.recommendations),
    afterWindowDays: 14,
  })

  // `recordBeforeSnapshot` returns null when supabase isn't configured or the
  // table is missing — both are treated as audit loss, not user error.
  return NextResponse.json({ ok: true, id: row?.id ?? null })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'unauthenticated' },
      { status: 401 },
    )
  }

  const rows = await listRecommendationResults(user.id, { limit: 50 })
  return NextResponse.json({ ok: true, data: rows })
}
