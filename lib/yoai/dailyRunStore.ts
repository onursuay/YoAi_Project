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
  account_scope?: string | null // hangi (Meta+Google) seçim için üretildi — per-account
  created_at?: string
  updated_at?: string
}

/**
 * Aktif seçim imzası: çalışmanın hangi (Meta hesabı + Google müşterisi) için
 * üretildiğini temsil eder. command-center, bu imza aktif seçimle eşleşmezse
 * çalışmayı göstermez (yeni hesaba geçince yeniden analiz). Google dash'siz normalize.
 */
export function buildAccountScope(
  metaAccountId: string | null | undefined,
  googleCustomerId: string | null | undefined,
): string {
  const m = (metaAccountId || '').trim() || '-'
  const g = (googleCustomerId || '').replace(/-/g, '').trim() || '-'
  return `m:${m}|g:${g}`
}

/**
 * Kullanıcının DB'deki seçili Meta + Google hesabından aktif seçim imzasını üretir.
 * cookie'siz (cron/inngest) ve cookie'li (route) bağlamlar aynı sonucu verir çünkü
 * seçim DB + cookie birlikte güncellenir.
 */
export async function resolveAccountScopeForUser(userId: string): Promise<string> {
  if (!supabase) return buildAccountScope(null, null)
  const [meta, google] = await Promise.all([
    supabase.from('meta_connections').select('selected_ad_account_id').eq('user_id', userId).maybeSingle(),
    supabase.from('google_ads_connections').select('google_ads_customer_id').eq('user_id', userId).maybeSingle(),
  ])
  return buildAccountScope(meta.data?.selected_ad_account_id ?? null, google.data?.google_ads_customer_id ?? null)
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

  // Per-account: tamamlanan + command_center_data taşıyan çalışmaya aktif seçim
  // imzası damgala. Cron, POST ve inngest yazıcılarının HEPSİ buradan geçer → tek nokta.
  let accountScope = run.account_scope ?? null
  if (accountScope == null && run.status === 'completed' && run.command_center_data != null) {
    accountScope = await resolveAccountScopeForUser(run.user_id)
  }

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

    // Only update fields that are provided (non-null) to avoid overwriting
    const updatePayload: Record<string, any> = {
      status: run.status,
      error_message: run.error_message || null,
      updated_at: now,
    }
    if (run.command_center_data != null) updatePayload.command_center_data = run.command_center_data
    if (run.ad_proposals_data != null) updatePayload.ad_proposals_data = run.ad_proposals_data
    if (accountScope != null) updatePayload.account_scope = accountScope

    const { data, error } = await supabase
      .from('yoai_daily_runs')
      .update(updatePayload)
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
      account_scope: accountScope,
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
    .select('id, updated_at')
    .eq('user_id', userId)
    .eq('run_date', today)
    .eq('status', 'running')
    .limit(1)
    .single()

  if (!data) return false

  // A run stuck in 'running' for >3 hours means it timed out — allow retry
  const updatedAt = new Date((data as any).updated_at || 0)
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
  if (updatedAt < threeHoursAgo) return false

  return true
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
