/**
 * Mevcut oturumdaki kullanıcının manuel onay durumunu döner.
 *
 * Client tarafı (AccountApprovalGuard, /basvuru-durumu) bu endpoint'i
 * polling/refresh için kullanır. Yetki yoksa 401 döner; iç paneller bunu
 * "redirect to login" sinyali olarak alır.
 *
 * Owner allowlist'i otomatik olarak approved sayılır.
 */
import { NextResponse } from 'next/server'
import { resolveAccountState } from '@/lib/auth/accountApproval'

export const dynamic = 'force-dynamic'

export async function GET() {
  const state = await resolveAccountState()
  if (!state) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    isOwner: state.isOwner,
    email: state.email,
    name: state.name,
    status: state.status,
    approvalStatus: state.isOwner ? 'approved' : state.approvalStatus,
    premeetingStatus: state.premeetingStatus,
    premeetingScheduledAt: state.premeetingScheduledAt,
    premeetingDeclinedAt: state.premeetingDeclinedAt,
    approvedAt: state.approvedAt,
    rejectedAt: state.rejectedAt,
    approvalNote: state.approvalNote,
  })
}
