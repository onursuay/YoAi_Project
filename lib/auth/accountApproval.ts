/**
 * Manuel onay akışı — server-side oturum & onay durumu yardımcıları.
 *
 * Kayıt sonrası kullanıcı `signups.approval_status='pending'` ile başlar.
 * Email doğrulanmış olsa (`status='active'`) bile, kullanıcı `approval_status`
 * 'approved' olmadan iç panellere erişemez. Gözetim Merkezi'nde owner manuel
 * onay verir.
 *
 * Owner allowlist'i (`SUPER_ADMIN_EMAILS`) bu akıştan muaftır: owner her zaman
 * onaylı sayılır.
 */
import 'server-only'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'
import { isSuperAdminEmail } from '@/lib/admin/superAdmin'

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'call_scheduled'
  | 'call_declined'
  | 'needs_call'
  | 'blocked'
  | 'manual_review'

export type PreMeetingStatus = 'pending' | 'scheduled' | 'declined'

export interface AccountState {
  signupId: string
  email: string | null
  name: string | null
  status: string | null
  approvalStatus: ApprovalStatus
  premeetingStatus: PreMeetingStatus
  premeetingScheduledAt: string | null
  premeetingDeclinedAt: string | null
  approvalNote: string | null
  approvedAt: string | null
  rejectedAt: string | null
  isOwner: boolean
}

export const APPROVAL_TERMINAL_OK: ApprovalStatus[] = ['approved']

/**
 * Mevcut oturumdaki kullanıcı `signups` kaydını döner.
 * Cookie yoksa veya kayıt bulunamazsa null.
 */
export async function resolveAccountState(): Promise<AccountState | null> {
  try {
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId || !supabase) return null

    const { data, error } = await supabase
      .from('signups')
      .select(
        'id, email, name, status, approval_status, approval_note, premeeting_status, premeeting_scheduled_at, premeeting_declined_at, approved_at, rejected_at',
      )
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null

    const email = (data.email as string | null) ?? null
    return {
      signupId: data.id as string,
      email,
      name: (data.name as string | null) ?? null,
      status: (data.status as string | null) ?? null,
      approvalStatus: ((data.approval_status as ApprovalStatus | null) ?? 'pending') as ApprovalStatus,
      premeetingStatus:
        ((data.premeeting_status as PreMeetingStatus | null) ?? 'pending') as PreMeetingStatus,
      premeetingScheduledAt: (data.premeeting_scheduled_at as string | null) ?? null,
      premeetingDeclinedAt: (data.premeeting_declined_at as string | null) ?? null,
      approvalNote: (data.approval_note as string | null) ?? null,
      approvedAt: (data.approved_at as string | null) ?? null,
      rejectedAt: (data.rejected_at as string | null) ?? null,
      isOwner: isSuperAdminEmail(email),
    }
  } catch {
    return null
  }
}

/**
 * Iç panellere erişim hakkı var mı?
 * Owner allowlist'i otomatik olarak true döndürür.
 * blocked ve manual_review kullanıcılar erişemez.
 */
export function isAccountApprovedForPanel(state: AccountState | null): boolean {
  if (!state) return false
  if (state.isOwner) return true
  if (state.approvalStatus === 'blocked' || state.approvalStatus === 'manual_review') return false
  return state.approvalStatus === 'approved'
}

/**
 * Kullanıcı engellendi mi?
 */
export function isAccountBlocked(state: AccountState | null): boolean {
  if (!state) return false
  if (state.isOwner) return false
  return state.approvalStatus === 'blocked'
}

/**
 * Kullanıcı manuel inceleme bekliyor mu?
 */
export function isAccountManualReview(state: AccountState | null): boolean {
  if (!state) return false
  if (state.isOwner) return false
  return state.approvalStatus === 'manual_review'
}
