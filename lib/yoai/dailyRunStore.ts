/* ──────────────────────────────────────────────────────────
   YoAi Daily Run Store
   Persists daily analysis results to Supabase.
   Table: yoai_daily_runs
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface DailyRun {
  id?: string
  user_id: string
  run_date: string           // YYYY-MM-DD in Europe/Istanbul
  status: RunStatus
  command_center_data: any    // DeepAnalysisResult
  ad_proposals_data: any      // { proposals, summary, fitAnalyses }
  error_message?: string | null
  created_at?: string
  updated_at?: string
}

/* ── Timezone helper ── */
export function getTurkeyDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }) // YYYY-MM-DD
}

export function getTurkeyHour(): number {
  return parseInt(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul', hour: 'numeric', hour12: false }), 10)
}

/* ── Read: Get latest completed run for user ── */
export async function getLatestCompletedRun(userId: string): Promise<DailyRun | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('yoai_daily_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('run_date', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as DailyRun
}

/* ── Read: Get today's run for user ── */
export async function getTodayRun(userId: string): Promise<DailyRun | null> {
  if (!supabase) return null

  const today = getTurkeyDate()
  const { data, error } = await supabase
    .from('yoai_daily_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('run_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as DailyRun
}

/* ── Read: Get best available run (today completed → latest completed) ── */
export async function getBestAvailableRun(userId: string): Promise<DailyRun | null> {
  if (!supabase) return null

  // 1. Try today's completed run
  const today = getTurkeyDate()
  const { data: todayRun } = await supabase
    .from('yoai_daily_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('run_date', today)
    .eq('status', 'completed')
    .limit(1)
    .single()

  if (todayRun) return todayRun as DailyRun

  // 2. Fallback to latest completed run
  return getLatestCompletedRun(userId)
}

/* ── Write: Create or update a run ── */
export async function upsertDailyRun(run: DailyRun): Promise<DailyRun | null> {
  if (!supabase) return null

  const now = new Date().toISOString()

  // Check if run exists for this user + date
  const { data: existing } = await supabase
    .from('yoai_daily_runs')
    .select('id, status')
    .eq('user_id', run.user_id)
    .eq('run_date', run.run_date)
    .limit(1)
    .single()

  if (existing) {
    // Don't overwrite a completed run with a new running one
    if (existing.status === 'completed' && run.status === 'running') return existing as DailyRun
    // Don't create duplicate running
    if (existing.status === 'running' && run.status === 'running') return existing as DailyRun

    const { data, error } = await supabase
      .from('yoai_daily_runs')
      .update({
        status: run.status,
        command_center_data: run.command_center_data,
        ad_proposals_data: run.ad_proposals_data,
        error_message: run.error_message || null,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) { console.error('[DailyRunStore] Update error:', error); return null }
    return data as DailyRun
  }

  // Insert new
  const { data, error } = await supabase
    .from('yoai_daily_runs')
    .insert({
      user_id: run.user_id,
      run_date: run.run_date,
      status: run.status,
      command_center_data: run.command_center_data,
      ad_proposals_data: run.ad_proposals_data,
      error_message: run.error_message || null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (error) { console.error('[DailyRunStore] Insert error:', error); return null }
  return data as DailyRun
}

/* ── Check: Is there a running run right now? ── */
export async function isRunning(userId: string): Promise<boolean> {
  if (!supabase) return false

  const today = getTurkeyDate()
  const { data } = await supabase
    .from('yoai_daily_runs')
    .select('id')
    .eq('user_id', userId)
    .eq('run_date', today)
    .eq('status', 'running')
    .limit(1)
    .single()

  return !!data
}

/* ── Check: Has today's run been completed? ── */
export async function isTodayCompleted(userId: string): Promise<boolean> {
  if (!supabase) return false

  const today = getTurkeyDate()
  const { data } = await supabase
    .from('yoai_daily_runs')
    .select('id')
    .eq('user_id', userId)
    .eq('run_date', today)
    .eq('status', 'completed')
    .limit(1)
    .single()

  return !!data
}
