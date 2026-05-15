/**
 * Ön görüşme randevusu oluştur (kayıt sahibi tarafından).
 *
 * Akış:
 *  1) Oturumdaki signup'ı çöz, owner değilse devam et.
 *  2) Slot zaten dolu mu? — unique index zorlar ama kullanıcıya net hata için
 *     önceden de kontrol ederiz.
 *  3) `signup_premeeting_bookings` tablosuna kayıt ekle.
 *  4) `signups` üzerinde premeeting_status='scheduled' +
 *     approval_status='call_scheduled' güncelle.
 *  5) Owner bildirim maili (fire-and-forget).
 */
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveAccountState } from '@/lib/auth/accountApproval'
import { notifyOwnersOfSignupEvent } from '@/lib/notifications/ownerNotifier'

export const dynamic = 'force-dynamic'

interface ScheduleBody {
  scheduledAt?: string
}

export async function POST(request: Request) {
  let body: ScheduleBody = {}
  try {
    body = (await request.json()) as ScheduleBody
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const scheduledAt = body.scheduledAt
  if (!scheduledAt || typeof scheduledAt !== 'string') {
    return NextResponse.json({ ok: false, error: 'scheduled_at_required' }, { status: 400 })
  }

  const ts = Date.parse(scheduledAt)
  if (!Number.isFinite(ts)) {
    return NextResponse.json({ ok: false, error: 'scheduled_at_invalid' }, { status: 400 })
  }

  // 2 saatten daha erkene randevu vermesin
  if (ts < Date.now() + 2 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: false, error: 'too_soon' }, { status: 400 })
  }

  const state = await resolveAccountState()
  if (!state) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 })
  }

  // Slot çakışma kontrolü
  const normalizedIso = new Date(ts).toISOString()
  const { data: existing, error: existingErr } = await supabase
    .from('signup_premeeting_bookings')
    .select('id')
    .eq('scheduled_at', normalizedIso)
    .eq('status', 'scheduled')
    .maybeSingle()
  if (existingErr) {
    console.error('[premeeting/schedule] availability lookup failed:', existingErr.message)
  }
  if (existing) {
    return NextResponse.json({ ok: false, error: 'slot_taken' }, { status: 409 })
  }

  // Aynı signup için aktif bir randevu varsa iptal et (en son tercih kazansın)
  await supabase
    .from('signup_premeeting_bookings')
    .update({ status: 'cancelled' })
    .eq('signup_id', state.signupId)
    .eq('status', 'scheduled')

  const { error: insertErr } = await supabase.from('signup_premeeting_bookings').insert({
    signup_id: state.signupId,
    scheduled_at: normalizedIso,
    duration_minutes: 30,
    status: 'scheduled',
  })

  if (insertErr) {
    console.error('[premeeting/schedule] insert failed:', insertErr.message)
    // Unique index violation = slot kapma yarışı
    if (insertErr.message?.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ ok: false, error: 'slot_taken' }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 })
  }

  await supabase
    .from('signups')
    .update({
      premeeting_status: 'scheduled',
      premeeting_scheduled_at: normalizedIso,
      premeeting_requested_at: new Date().toISOString(),
      approval_status: 'call_scheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', state.signupId)

  // Owner bildirimi
  notifyOwnersOfSignupEvent('premeeting_scheduled', {
    id: state.signupId,
    name: state.name,
    email: state.email,
    createdAt: state.approvedAt || null,
    premeetingStatus: 'scheduled',
    premeetingScheduledAt: normalizedIso,
  }).catch((e) => {
    console.error('[premeeting/schedule] owner notify failed:', e instanceof Error ? e.message : 'unknown')
  })

  return NextResponse.json({ ok: true, scheduledAt: normalizedIso })
}
