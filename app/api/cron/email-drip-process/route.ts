import { NextResponse } from 'next/server'
import { getDueItems, markItemSent, markItemFailed } from '@/lib/email/dripQueue'
import { supabase } from '@/lib/supabase/client'
import { buildDispatch, buildHtml } from '@/lib/email/sender'
import { unsubscribeUrl } from '@/lib/email/unsubscribe'
import { isOptedOut } from '@/lib/email/automationRunner'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yoai.yodijital.com'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const items = await getDueItems(50)
  let sent = 0
  let failed = 0

  for (const item of items) {
    try {
      if (await isOptedOut(item.user_id, item.email)) {
        await markItemFailed(item.id)
        failed++
        continue
      }

      if (!supabase) { await markItemFailed(item.id); failed++; continue }

      const { data: step } = await supabase
        .from('email_automation_steps')
        .select('subject, html')
        .eq('id', item.step_id)
        .maybeSingle()

      if (!step) { await markItemFailed(item.id); failed++; continue }

      const built = await buildDispatch(item.user_id)
      if (!built) { await markItemFailed(item.id); failed++; continue }

      const html = buildHtml(
        step.html,
        unsubscribeUrl(APP_URL, 'automation', item.email),
      )

      const resendId = await built.dispatch(item.email, step.subject || '(konusuz)', html)

      await supabase.from('email_sends').insert({
        automation_id: item.automation_id,
        user_id: item.user_id,
        contact_id: item.contact_id,
        email: item.email,
        resend_id: resendId,
        status: resendId ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
      })

      await markItemSent(item.id)
      sent++
    } catch (err) {
      console.error('[DripProcess] ITEM_FAIL', item.id, err)
      await markItemFailed(item.id)
      failed++
    }
  }

  return NextResponse.json({ ok: true, sent, failed, total: items.length })
}
