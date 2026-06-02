import { NextResponse } from 'next/server'
import {
  getDueItems, markItemSent, markItemFailed, markItemSkipped,
  setEmailSendId, enqueueNextStep, evaluateCondition,
} from '@/lib/email/dripQueue'
import { getStep, getNextStep } from '@/lib/email/automationStepsStore'
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
  let skipped = 0

  for (const item of items) {
    try {
      // 1. Adım içeriğini al
      const currentStep = await getStep(item.step_id)
      if (!currentStep) { await markItemFailed(item.id); failed++; continue }

      // 2. Koşul değerlendirme
      const conditionMet = await evaluateCondition(item, currentStep.condition ?? { type: 'always' })
      if (!conditionMet) {
        await markItemSkipped(item.id)
        skipped++
        continue
      }

      // 3. Opt-out kontrolü
      if (await isOptedOut(item.user_id, item.email)) {
        await markItemFailed(item.id); failed++; continue
      }

      if (!supabase) { await markItemFailed(item.id); failed++; continue }

      // 4. Gönderim
      const built = await buildDispatch(item.user_id)
      if (!built) { await markItemFailed(item.id); failed++; continue }

      const html = buildHtml(
        currentStep.html,
        unsubscribeUrl(APP_URL, 'automation', item.email),
      )
      const resendId = await built.dispatch(item.email, currentStep.subject || '(konusuz)', html)

      // 5. email_sends'e kaydet → ID'yi al
      let emailSendId: string | null = null
      const { data: sendRow } = await supabase
        .from('email_sends')
        .insert({
          automation_id: item.automation_id,
          user_id: item.user_id,
          contact_id: item.contact_id,
          email: item.email,
          resend_id: resendId,
          status: resendId ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      emailSendId = sendRow?.id ?? null

      // 6. Queue item'ı sent olarak işaretle + email_send_id yaz
      await markItemSent(item.id)
      if (emailSendId) await setEmailSendId(item.id, emailSendId)
      sent++

      // 7. Bir sonraki adımı kuyruğa ekle (koşul zamanı gelince değerlendirilecek)
      const nextStep = await getNextStep(item.automation_id, currentStep.step_order)
      if (nextStep) {
        await enqueueNextStep(item.id, nextStep, {
          userId: item.user_id,
          automationId: item.automation_id,
          email: item.email,
          contactId: item.contact_id,
        })
      }
    } catch (err) {
      console.error('[DripProcess] ITEM_FAIL', item.id, err)
      await markItemFailed(item.id)
      failed++
    }
  }

  return NextResponse.json({ ok: true, sent, failed, skipped, total: items.length })
}
