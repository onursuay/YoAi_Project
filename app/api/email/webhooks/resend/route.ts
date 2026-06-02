import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')
  if (!process.env.RESEND_WEBHOOK_SECRET || secret !== process.env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let body: { type: string; data: { email_id: string; to: string[]; bounce?: { type: string } } }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }

  const { type, data } = body
  const emailId = data?.email_id
  if (!emailId || !supabase) return NextResponse.json({ ok: true })

  const { data: send } = await supabase
    .from('email_sends')
    .select('id, user_id, email, contact_id')
    .eq('resend_id', emailId)
    .maybeSingle()

  if (!send) return NextResponse.json({ ok: true })

  const isHardBounce = type === 'email.bounced' && data.bounce?.type === 'hard'
  const isComplaint = type === 'email.complained'
  const isDelivered = type === 'email.delivered'

  const eventType = isHardBounce ? 'bounced' : isComplaint ? 'complained' : isDelivered ? 'delivered' : type.replace('email.', '')
  await supabase.from('email_events').insert({
    send_id: send.id,
    user_id: send.user_id,
    type: eventType,
    at: new Date().toISOString(),
    meta: data.bounce ? { bounce_type: data.bounce.type } : {},
  })

  if (isHardBounce || isComplaint) {
    await supabase.from('email_sends').update({ status: isComplaint ? 'complained' : 'bounced' }).eq('id', send.id)
  } else if (isDelivered) {
    await supabase.from('email_sends').update({ status: 'delivered' }).eq('id', send.id)
  }

  if (isHardBounce || isComplaint) {
    const email = send.email.trim().toLowerCase()
    await supabase
      .from('email_contacts')
      .update({ opt_out: true, opt_out_at: new Date().toISOString() })
      .eq('user_id', send.user_id)
      .eq('email', email)

    await supabase
      .from('crm_leads')
      .update({ email_opt_out: true })
      .eq('user_id', send.user_id)
      .eq('email', email)
  }

  return NextResponse.json({ ok: true })
}
