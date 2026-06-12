import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import {
  countPendingApprovals,
  listApprovals,
  type ApprovalStatus,
} from '@/lib/yoai/approvalStore'
import { getJudgeDecisionSummaryByCampaignIds } from '@/lib/yoai/modelDecisionStore'

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

interface DecisionBadge {
  finalDecision: string | null
  confidence: number
  riskLevel: string | null
  requiresHumanReview: boolean
  requiredHumanChecksCount: number
  status: string
}

/**
 * GET /api/yoai/approvals
 *   ?status=pending,hold       → status filter (csv)
 *   ?platform=Meta             → platform filter
 *   ?limit=50                  → max records
 *   ?count=1                   → only return pendingCount (no list)
 *
 * Response includes decision_badge per record (latest judge decision summary).
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
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

    // Enrich each record with latest judge decision badge (one batch query)
    const campaignIds = [
      ...new Set(
        records.map((r) => r.source_campaign_id).filter((id): id is string => !!id),
      ),
    ]
    const judgeDecisions =
      campaignIds.length > 0
        ? await getJudgeDecisionSummaryByCampaignIds(userId, campaignIds)
        : {}

    const enrichedRecords = records.map((r) => {
      const judgeRow = r.source_campaign_id
        ? judgeDecisions[r.source_campaign_id] ?? null
        : null
      if (!judgeRow) return { ...r, decision_badge: null }
      const outputJson = (judgeRow.output_json || {}) as Record<string, unknown>
      const badge: DecisionBadge = {
        finalDecision:
          typeof outputJson.finalDecision === 'string' ? outputJson.finalDecision : null,
        confidence: typeof judgeRow.confidence === 'number' ? judgeRow.confidence : 0,
        riskLevel: typeof judgeRow.risk_level === 'string' ? judgeRow.risk_level : null,
        requiresHumanReview: !!judgeRow.requires_human_review,
        requiredHumanChecksCount: Array.isArray(outputJson.requiredHumanChecks)
          ? outputJson.requiredHumanChecks.length
          : 0,
        status: typeof judgeRow.status === 'string' ? judgeRow.status : 'unknown',
      }
      return { ...r, decision_badge: badge }
    })

    const pendingCount = records.filter((r) => r.status === 'pending').length

    return NextResponse.json({
      ok: true,
      data: enrichedRecords,
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
