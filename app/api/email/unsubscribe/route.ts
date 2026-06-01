import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { verifyUnsubscribe } from '@/lib/email/unsubscribe'

export const dynamic = 'force-dynamic'

/**
 * POST /api/email/unsubscribe { c, e, s } — public. İmza doğrulanır, kişi
 * opt-out edilir (email_contacts + crm_leads), event yazılır. Auth GEREKMEZ.
 */
export async function POST(request: Request) {
  let body: { c?: string; e?: string; s?: string }
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 }) }
  const c = String(body.c || '')
  const e = String(body.e || '').trim().toLowerCase()
  const s = String(body.s || '')
  if (!c || !e || !s || !verifyUnsubscribe(c, e, s)) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })

  let userId: string
  let sendId: string | null = null
  if (c === 'automation') {
    const { data: send } = await supabase
      .from('email_sends')
      .select('id, user_id')
      .eq('email', e)
      .not('automation_id', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!send) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
    userId = (send as { user_id: string }).user_id
    sendId = (send as { id: string }).id
  } else {
    const { data: camp } = await supabase.from('email_campaigns').select('user_id').eq('id', c).maybeSingle()
    if (!camp) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
    userId = (camp as { user_id: string }).user_id
    const { data: send } = await supabase.from('email_sends').select('id').eq('campaign_id', c).eq('email', e).maybeSingle()
    sendId = (send as { id: string } | null)?.id ?? null
  }
  const now = new Date().toISOString()

  await supabase.from('email_contacts').update({ opt_out: true, opt_out_at: now }).eq('user_id', userId).eq('email', e)
  await supabase.from('crm_leads').update({ email_opt_out: true }).eq('user_id', userId).eq('email', e)

  await supabase.from('email_events').insert({ send_id: sendId, user_id: userId, type: 'unsubscribed', at: now })

  return NextResponse.json({ ok: true })
}
