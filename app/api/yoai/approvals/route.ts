import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  countPendingApprovals,
  listApprovals,
  type ApprovalStatus,
} from '@/lib/yoai/approvalStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const VALID_STATUSES: ApprovalStatus[] = [
  'pending',
  'approved',
  'rejected',
  'hold',
  'editing',
  'published',
  'failed',
  'expired',
]

function parseStatusParam(raw: string | null): ApprovalStatus | ApprovalStatus[] | undefined {
  if (!raw) return undefined
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const valid = parts.filter((p): p is ApprovalStatus =>
    (VALID_STATUSES as string[]).includes(p),
  )
  if (valid.length === 0) return undefined
  return valid.length === 1 ? valid[0] : valid
}

/**
 * GET /api/yoai/approvals
 *   ?status=pending,hold       → status filter (csv)
 *   ?platform=Meta             → platform filter
 *   ?limit=50                  → max records
 *   ?count=1                   → only return pendingCount (no list)
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_id')?.value
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli.' }, { status: 401 })
    }

    const url = new URL(request.url)
    const wantCount = url.searchParams.get('count') === '1'
    const statusFilter = parseStatusParam(url.searchParams.get('status'))
    const platform = url.searchParams.get('platform') || undefined
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw ? Number(limitRaw) : undefined

    if (wantCount) {
      const pendingCount = await countPendingApprovals(userId)
      return NextResponse.json({ ok: true, pendingCount })
    }

    const records = await listApprovals(userId, {
      status: statusFilter,
      platform,
      limit: limit && Number.isFinite(limit) ? limit : undefined,
    })

    const pendingCount = records.filter((r) => r.status === 'pending').length

    return NextResponse.json({
      ok: true,
      data: records,
      total: records.length,
      pendingCount,
    })
  } catch (error) {
    console.error('[Approvals.GET] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
