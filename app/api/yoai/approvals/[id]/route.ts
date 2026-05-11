import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  getApprovalById,
  updateApprovalStatus,
  ALLOWED_USER_TRANSITIONS,
  listApprovalVersions,
  type ApprovalStatus,
} from '@/lib/yoai/approvalStore'
import { listModelDecisionsForApproval } from '@/lib/yoai/modelDecisionStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const USER_PATCHABLE_STATUSES: ApprovalStatus[] = ['pending', 'rejected', 'hold', 'editing']

/**
 * GET /api/yoai/approvals/[id]
 * Tek bir approval kaydının detayını döner.
 * Ayrıca:
 *   decisionRows: kaynak kampanya için Multi-AI decision kayıtları
 *   versionCount: yoai_approval_versions satır sayısı
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli.' }, { status: 401 })
    }
    const record = await getApprovalById(userId, id)
    if (!record) {
      return NextResponse.json(
        { ok: false, code: 'NOT_FOUND', message: 'Approval kaydı bulunamadı.' },
        { status: 404 },
      )
    }

    // Decision rows + version count concurrent (non-blocking — empty on error)
    const [decisionRows, versions] = await Promise.all([
      record.source_campaign_id
        ? listModelDecisionsForApproval(userId, {
            sourceCampaignId: record.source_campaign_id,
            limit: 20,
          })
        : Promise.resolve([]),
      listApprovalVersions(userId, id),
    ])

    return NextResponse.json({
      ok: true,
      data: record,
      decisionRows,
      versionCount: versions.length,
    })
  } catch (error) {
    console.error('[Approvals.GET[id]] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/yoai/approvals/[id]
 * Body: {
 *   status: 'rejected' | 'hold' | 'pending' | 'editing',
 *   rejection_reason?: string,
 *   hold_reason?: string,
 *   status_reason?: string,
 *   edited_payload?: unknown,
 *   metadata?: Record<string, unknown>,   // rejection_category / hold_category burada
 * }
 *
 * approved/published/failed/expired bu endpoint üzerinden YAZILAMAZ.
 * Geçerli geçişler ALLOWED_USER_TRANSITIONS tablosuyla doğrulanır.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const nextStatus = body?.status as ApprovalStatus | undefined

    if (!nextStatus || !USER_PATCHABLE_STATUSES.includes(nextStatus)) {
      return NextResponse.json(
        {
          ok: false,
          code: 'INVALID_STATUS',
          message: `'status' alanı şunlardan biri olmalı: ${USER_PATCHABLE_STATUSES.join(', ')}`,
        },
        { status: 400 },
      )
    }

    const result = await updateApprovalStatus(userId, id, nextStatus, {
      rejection_reason:
        typeof body.rejection_reason === 'string' ? body.rejection_reason : undefined,
      hold_reason: typeof body.hold_reason === 'string' ? body.hold_reason : undefined,
      status_reason:
        typeof body.status_reason === 'string' ? body.status_reason : undefined,
      edited_payload: body.edited_payload,
      metadata:
        body.metadata && typeof body.metadata === 'object'
          ? (body.metadata as Record<string, unknown>)
          : undefined,
    })

    if (!result.ok) {
      const httpStatus =
        result.code === 'NOT_FOUND'
          ? 404
          : result.code === 'INVALID_TRANSITION'
            ? 409
            : result.code === 'TABLE_MISSING'
              ? 503
              : 422
      return NextResponse.json(
        {
          ok: false,
          code: result.code,
          message: result.message,
          allowedTransitions: ALLOWED_USER_TRANSITIONS,
        },
        { status: httpStatus },
      )
    }

    return NextResponse.json({ ok: true, data: result.record })
  } catch (error) {
    console.error('[Approvals.PATCH[id]] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
