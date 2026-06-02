import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

interface ResendWebhookEvent {
  type: string
  data: {
    email_id: string
    to?: string[]
    bounce?: { type: 'hard' | 'soft' }
  }
}

export async function POST(req: Request) {
  const signingSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!signingSecret) return NextResponse.json({ ok: false }, { status: 401 })

  // Resend uses svix to sign webhook payloads — verify via svix headers, not URL params
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const rawBody = await req.text()
  let body: ResendWebhookEvent
  try {
    const wh = new Webhook(signingSecret)
    body = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookEvent
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const { type, data } = body
  const emailId = data?.email_id
  if (!emailId || !supabase) return NextResponse.json({ ok: true })

  try {
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
      if (!send.email) return NextResponse.json({ ok: true })
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
  } catch (err) {
    console.error('[resend-webhook] supabase error', err)
  }

  return NextResponse.json({ ok: true })
}
