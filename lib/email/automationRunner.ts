import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { buildDispatch, buildHtml } from './sender'
import { unsubscribeUrl } from './unsubscribe'
import { listEnabledAutomations, type AutomationRow, type AutomationTrigger } from './automationStore'
import { listSteps } from './automationStepsStore'
import { enqueueSteps } from './dripQueue'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yoai.yodijital.com'

/** email_contacts'te bu e-posta opt-out işaretliyse true (KVKK). Kayıt yoksa false. */
export async function isOptedOut(userId: string, email: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase
    .from('email_contacts')
    .select('opt_out')
    .eq('user_id', userId)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  return Boolean(data?.opt_out)
}

/** Eşleşen otomasyonların her birini tek alıcıya gönderir; her gönderim email_sends'e yazılır. */
async function sendToContact(userId: string, email: string, automations: AutomationRow[]): Promise<void> {
  if (!email || !automations.length) return
  if (await isOptedOut(userId, email)) return
  const built = await buildDispatch(userId)
  if (!built) return
  const { dispatch } = built

  const rows: Record<string, unknown>[] = []
  for (const a of automations) {
    const html = buildHtml(a.html, unsubscribeUrl(APP_URL, 'automation', email))
    const id = await dispatch(email, a.subject || '(konusuz)', html)
    rows.push({
      campaign_id: null,
      automation_id: a.id,
      user_id: userId,
      email,
      resend_id: id,
      status: id ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
    })
  }
  if (supabase && rows.length) {
    const { error } = await supabase.from('email_sends').insert(rows)
    if (error) console.error('[AutomationRunner] SEND_LOG_FAIL', error.message)
  }
}

/** CRM lead'i bir aşamaya girince — eşleşen crm_stage_enter otomasyonları. */
export async function runStageAutomations(
  userId: string,
  lead: { email: string | null; full_name?: string | null },
  stage: string,
): Promise<void> {
  if (!lead.email) return
  const all = await listEnabledAutomations(userId)
  const matching = all.filter(
    (a) => (a.trigger as AutomationTrigger).type === 'crm_stage_enter' &&
            (a.trigger as { type: string; stage: string }).stage === stage,
  )
  if (matching.length === 0) return
  for (const automation of matching) {
    const steps = await listSteps(automation.id)
    if (steps.length > 0) {
      await enqueueSteps(userId, automation.id, steps, { email: lead.email, contactId: null })
    } else {
      await sendToContact(userId, lead.email, [automation])
    }
  }
}

/** Yeni kişi eklenince (tekil manuel) — eşleşen contact_added otomasyonları. */
export async function runContactAddedAutomations(
  userId: string,
  contact: { email: string },
): Promise<void> {
  const all = await listEnabledAutomations(userId)
  const matching = all.filter((a) => (a.trigger as AutomationTrigger).type === 'contact_added')
  if (matching.length === 0) return
  for (const automation of matching) {
    const steps = await listSteps(automation.id)
    if (steps.length > 0) {
      await enqueueSteps(userId, automation.id, steps, { email: contact.email, contactId: null })
    } else {
      await sendToContact(userId, contact.email, [automation])
    }
  }
}
