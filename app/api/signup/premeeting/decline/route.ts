/**
 * Kullanıcı ön görüşme planlamak istemediğini bildirdi.
 *
 * `signups` tablosunda:
 *   premeeting_status = 'declined'
 *   premeeting_declined_at = now()
 *   approval_status = 'call_declined'
 *
 * Owner manuel takip için bildirim alır.
 */
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveAccountState } from '@/lib/auth/accountApproval'
import { notifyOwnersOfSignupEvent } from '@/lib/notifications/ownerNotifier'

export const dynamic = 'force-dynamic'

export async function POST() {
  const state = await resolveAccountState()
  if (!state) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 })
  }

  const declinedAt = new Date().toISOString()
  const { error } = await supabase
    .from('signups')
    .update({
      premeeting_status: 'declined',
      premeeting_declined_at: declinedAt,
      premeeting_requested_at: declinedAt,
      approval_status: 'call_declined',
      updated_at: declinedAt,
    })
    .eq('id', state.signupId)

  if (error) {
    console.error('[premeeting/decline] update failed:', error.message)
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 })
  }

  notifyOwnersOfSignupEvent('premeeting_declined', {
    id: state.signupId,
    name: state.name,
    email: state.email,
    createdAt: declinedAt,
    premeetingStatus: 'declined',
    premeetingScheduledAt: null,
  }).catch((e) => {
    console.error('[premeeting/decline] owner notify failed:', e instanceof Error ? e.message : 'unknown')
  })

  return NextResponse.json({ ok: true })
}
