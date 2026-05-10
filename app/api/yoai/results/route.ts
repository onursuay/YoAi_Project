import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  listRecommendationResults,
  recordBeforeSnapshot,
  recordAfterSnapshot,
  type CreateResultPayload,
  type RecordAfterSnapshotPayload,
} from '@/lib/yoai/resultTrackingStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/* ────────────────────────────────────────────────────────────
   GET  /api/yoai/results
     ?outcome=improved|declined|no_change|pending|insufficient_data
     ?status=before_recorded|applied|after_recorded|skipped
     ?sourceCampaignId=xxx
     ?limit=50

   POST /api/yoai/results
     body: { action: 'before', payload: CreateResultPayload }
         | { action: 'after',  resultId: string, payload: RecordAfterSnapshotPayload }
   ──────────────────────────────────────────────────────────── */

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_id')?.value
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const outcome = url.searchParams.get('outcome') ?? undefined
  const status = url.searchParams.get('status') ?? undefined
  const sourceCampaignId = url.searchParams.get('sourceCampaignId') ?? undefined
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

  const results = await listRecommendationResults(userId, {
    outcome: outcome as never,
    status: status as never,
    sourceCampaignId,
    limit: isNaN(limit) ? 50 : Math.min(limit, 100),
  })

  return NextResponse.json({ ok: true, data: results, total: results.length })
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_id')?.value
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const action = body?.action as string | undefined

    if (action === 'before') {
      const payload = body?.payload as CreateResultPayload | undefined
      if (!payload?.proposalId || !payload?.beforeSnapshot) {
        return NextResponse.json(
          { ok: false, error: 'proposalId ve beforeSnapshot zorunlu.' },
          { status: 400 },
        )
      }
      const result = await recordBeforeSnapshot(userId, payload)
      return NextResponse.json({ ok: true, data: result })
    }

    if (action === 'after') {
      const resultId = body?.resultId as string | undefined
      const payload = body?.payload as RecordAfterSnapshotPayload | undefined
      if (!resultId || !payload?.afterSnapshot) {
        return NextResponse.json(
          { ok: false, error: 'resultId ve afterSnapshot zorunlu.' },
          { status: 400 },
        )
      }
      const result = await recordAfterSnapshot(userId, resultId, payload)
      return NextResponse.json({ ok: true, data: result })
    }

    return NextResponse.json(
      { ok: false, error: 'action "before" veya "after" olmalı.' },
      { status: 400 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
