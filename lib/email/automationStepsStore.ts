import 'server-only'
import { supabase } from '@/lib/supabase/client'

export type StepConditionType = 'always' | 'if_opened' | 'if_not_opened' | 'if_clicked'

export interface StepCondition {
  type: StepConditionType
}

export interface StepRow {
  id: string
  automation_id: string
  step_order: number
  subject: string
  html: string
  delay_days: number
  condition: StepCondition
  created_at: string
}

export interface StepInput {
  step_order: number
  subject: string
  html: string
  delay_days: number
  condition: StepCondition
}

export async function listSteps(automationId: string): Promise<StepRow[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('email_automation_steps')
    .select('*')
    .eq('automation_id', automationId)
    .order('step_order', { ascending: true })
  return (data ?? []) as StepRow[]
}

export async function getStep(stepId: string): Promise<StepRow | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('email_automation_steps')
    .select('*')
    .eq('id', stepId)
    .maybeSingle()
  return data as StepRow | null
}

export async function getNextStep(automationId: string, currentOrder: number): Promise<StepRow | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('email_automation_steps')
    .select('*')
    .eq('automation_id', automationId)
    .eq('step_order', currentOrder + 1)
    .maybeSingle()
  return data as StepRow | null
}

export async function replaceSteps(automationId: string, steps: StepInput[]): Promise<void> {
  if (!supabase) return
  await supabase.from('email_automation_steps').delete().eq('automation_id', automationId)
  if (steps.length === 0) return
  const rows = steps.map((s) => ({ ...s, automation_id: automationId }))
  await supabase.from('email_automation_steps').insert(rows)
}
