import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  approveImprovement,
  rejectImprovement,
  unrejectImprovement,
  markImprovementApplied,
  getImprovementRow,
  type HierLevel,
  type AdImprovementRow,
} from '@/lib/yoai/ai/hierarchicalStore'
import { improvementToProposal } from '@/lib/yoai/ai/improvementToProposal'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

const LEVELS: HierLevel[] = ['campaign', 'adset', 'ad']
const APPROVABLE = new Set(['pending', 'approved', 'applied'])

/** Yeni hiyerarşik ad satırını mevcut improvementToProposal köprüsüne uyarlar. */
function adRowToProposal(row: AdImprovementRow) {
  const compat = {
    id: row.id,
    source_platform: row.source_platform,
    source_ad_id: row.ad_id,
    source_ad_name: row.ad_name,
    source_campaign_id: row.campaign_id,
    source_campaign_name: null,
    improvement_payload: row.improvement_payload,
    confidence: row.confidence,
  }
  return improvementToProposal(compat as unknown as Parameters<typeof improvementToProposal>[0])
}

/**
 * POST /api/yoai/improvements/hierarchy/decision
 * Body: { level: 'campaign'|'adset'|'ad', id, action: 'approve'|'reject'|'unreject'|'applied', reason?, publishAuditId? }
 *
 * - approve (ad): kartı onaylar + ad_spec'ten yayın sihirbazı proposal'ı döner.
 * - approve (campaign/adset): kartı onaylar.
 * - reject: rejected_by_user (soft-delete). pending/approved/applied'dan reddedilebilir.
 * - unreject: "Geri Al" → pending.
 * - applied: yayın sonrası kartı applied işaretler (wizard onPublished).
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as {
      level?: string; id?: string; action?: string; reason?: string; publishAuditId?: string
    }
    const level = body.level as HierLevel
    const { id, action } = body
    if (!id || !LEVELS.includes(level)) {
      return NextResponse.json({ ok: false, error: 'Geçersiz level/id' }, { status: 400 })
    }

    if (action === 'approve') {
      await approveImprovement(level, userId, id) // pending→approved (idempotent değilse zaten approved kalır)
      if (level === 'ad') {
        const row = (await getImprovementRow('ad', userId, id)) as AdImprovementRow | null
        if (!row || !APPROVABLE.has(row.status)) {
          return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: 'Kart bulunamadı veya yayınlanamaz durumda.' }, { status: 404 })
        }
        const proposal = adRowToProposal(row)
        return NextResponse.json({ ok: true, data: { proposal, row } })
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'reject') {
      const ok = await rejectImprovement(level, userId, id, body.reason)
      return NextResponse.json({ ok })
    }
    if (action === 'unreject') {
      const ok = await unrejectImprovement(level, userId, id)
      return NextResponse.json({ ok })
    }
    if (action === 'applied') {
      await markImprovementApplied(level, id, body.publishAuditId ?? null)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Geçersiz action' }, { status: 400 })
  } catch (e) {
    console.error('[hierarchy decision] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
