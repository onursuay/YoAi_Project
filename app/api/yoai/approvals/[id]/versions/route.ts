import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import {
  listApprovalVersions,
  createApprovalVersion,
  getLatestApprovalVersion,
  getApprovalById,
  type VersionSource,
} from '@/lib/yoai/approvalStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * GET /api/yoai/approvals/[id]/versions
 * Bir approval kaydının tüm versiyonlarını döner (en yeniden eskiye).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli.' }, { status: 401 })
    }
    const versions = await listApprovalVersions(userId, id)
    return NextResponse.json({ ok: true, data: versions, total: versions.length })
  } catch (error) {
    console.error('[Approvals.Versions.GET] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}

const VALID_SOURCES: VersionSource[] = ['original', 'edited', 'regenerated', 'manual']

/**
 * POST /api/yoai/approvals/[id]/versions
 * Yeni bir versiyon kaydı oluşturur.
 * source='original' için idempotent: zaten varsa mevcut kaydı döner.
 *
 * Body:
 *   source: VersionSource
 *   proposalId: string
 *   proposalSnapshot: unknown
 *   editedPayload?: unknown
 *   changeSummary?: string
 *   createdBy?: string
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const source = body?.source as VersionSource | undefined
    const proposalId = typeof body?.proposalId === 'string' ? body.proposalId : ''

    if (!source || !VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { ok: false, code: 'INVALID_SOURCE', message: `source şunlardan biri olmalı: ${VALID_SOURCES.join(', ')}` },
        { status: 400 },
      )
    }
    if (!proposalId) {
      return NextResponse.json(
        { ok: false, code: 'MISSING_PROPOSAL_ID', message: 'proposalId gerekli.' },
        { status: 400 },
      )
    }

    // Kullanıcının bu approval'a sahip olduğunu doğrula
    const approval = await getApprovalById(userId, id)
    if (!approval) {
      return NextResponse.json(
        { ok: false, code: 'NOT_FOUND', message: 'Approval kaydı bulunamadı.' },
        { status: 404 },
      )
    }

    // source='original' → idempotent: ilk versiyon zaten varsa mevcut döner
    if (source === 'original') {
      const existing = await getLatestApprovalVersion(userId, id)
      if (existing && existing.source === 'original') {
        return NextResponse.json({ ok: true, data: existing, created: false })
      }
    }

    const version = await createApprovalVersion(userId, id, {
      source,
      proposalId,
      proposalSnapshot: body?.proposalSnapshot ?? approval.proposal_snapshot,
      editedPayload: body?.editedPayload,
      changeSummary: typeof body?.changeSummary === 'string' ? body.changeSummary : undefined,
      createdBy: typeof body?.createdBy === 'string' ? body.createdBy : 'user',
    })

    if (!version) {
      return NextResponse.json(
        { ok: false, code: 'CREATE_FAILED', message: 'Versiyon oluşturulamadı.' },
        { status: 422 },
      )
    }

    return NextResponse.json({ ok: true, data: version, created: true })
  } catch (error) {
    console.error('[Approvals.Versions.POST] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
