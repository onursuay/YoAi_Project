import 'server-only'
import { supabase } from '@/lib/supabase/client'
import type { StepRow } from './automationStepsStore'

export interface QueueItem {
  id: string
  automation_id: string
  step_id: string
  user_id: string
  contact_id: string | null
  email: string
  scheduled_at: string
  status: string
  parent_queue_id: string | null
  email_send_id: string | null
}

/** Tetikleyicide yalnız ilk adımı (step_order=0) kuyruğa ekler. */
export async function enqueueFirstStep(
  userId: string,
  automationId: string,
  firstStep: StepRow,
  contact: { email: string; contactId?: string | null },
): Promise<void> {
  if (!supabase) return
  await supabase.from('email_drip_queue').insert({
    automation_id: automationId,
    step_id: firstStep.id,
    user_id: userId,
    contact_id: contact.contactId ?? null,
    email: contact.email,
    scheduled_at: new Date().toISOString(),
    status: 'pending',
    parent_queue_id: null,
    email_send_id: null,
  })
}

/** Mevcut adım gönderildikten sonra bir sonraki adımı kuyruğa ekler. */
export async function enqueueNextStep(
  parentQueueId: string,
  nextStep: StepRow,
  current: { userId: string; automationId: string; email: string; contactId: string | null },
): Promise<void> {
  if (!supabase) return
  const scheduledAt = new Date(Date.now() + nextStep.delay_days * 86_400_000).toISOString()
  await supabase.from('email_drip_queue').insert({
    automation_id: current.automationId,
    step_id: nextStep.id,
    user_id: current.userId,
    contact_id: current.contactId,
    email: current.email,
    scheduled_at: scheduledAt,
    status: 'pending',
    parent_queue_id: parentQueueId,
    email_send_id: null,
  })
}

/** Gönderim sonrası queue öğesine email_send_id yazar. */
export async function setEmailSendId(queueItemId: string, emailSendId: string): Promise<void> {
  if (!supabase) return
  await supabase
    .from('email_drip_queue')
    .update({ email_send_id: emailSendId })
    .eq('id', queueItemId)
}

/**
 * Adımın koşulunu değerlendirir.
 * 'always' → true
 * 'if_opened' / 'if_not_opened' / 'if_clicked' → parent'ın email_events'ini kontrol eder
 */
export async function evaluateCondition(item: QueueItem, condition: { type: string }): Promise<boolean> {
  if (condition.type === 'always') return true
  if (!supabase || !item.parent_queue_id) return false

  const { data: parent } = await supabase
    .from('email_drip_queue')
    .select('email_send_id')
    .eq('id', item.parent_queue_id)
    .maybeSingle()

  if (!parent?.email_send_id) return false

  const { data: events } = await supabase
    .from('email_events')
    .select('type')
    .eq('send_id', parent.email_send_id)

  const eventTypes = new Set((events ?? []).map((e: { type: string }) => e.type))

  if (condition.type === 'if_opened') return eventTypes.has('opened')
  if (condition.type === 'if_not_opened') return !eventTypes.has('opened')
  if (condition.type === 'if_clicked') return eventTypes.has('clicked')

  return false
}

export async function getDueItems(limit = 100): Promise<QueueItem[]> {
  if (!supabase) return []
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('email_drip_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit)
  return (data ?? []) as QueueItem[]
}

export async function markItemSent(itemId: string): Promise<void> {
  if (!supabase) return
  await supabase
    .from('email_drip_queue')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', itemId)
}

export async function markItemFailed(itemId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('email_drip_queue').update({ status: 'failed' }).eq('id', itemId)
}

export async function markItemSkipped(itemId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('email_drip_queue').update({ status: 'skipped' }).eq('id', itemId)
}
