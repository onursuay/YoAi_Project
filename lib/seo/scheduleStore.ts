import 'server-only'
import { supabase } from '@/lib/supabase/client'

/**
 * article_schedules tablosu için erişim katmanı.
 *
 * Zamanlama, kullanıcının YEREL saatine (publish_time + timezone) göre
 * tanımlanır. Saatlik cron (app/api/cron/seo-article-run) timezone
 * eşleştirmesini yapıp due olanları Inngest'e fan-out eder.
 */

export type ScheduleFrequency = 'daily' | 'weekdays' | 'weekly'
export type ScheduleStatus = 'success' | 'skipped_credits' | 'skipped_no_site' | 'error'

export interface ArticleScheduleRow {
  id: string
  user_id: string
  site_connection_id: string | null
  enabled: boolean
  frequency: ScheduleFrequency
  publish_time: string            // "HH:MM" yerel
  timezone: string                // IANA
  weekday: number | null
  tone: string
  word_count: number
  keyword_pool: string[]
  auto_publish: boolean
  generate_image: boolean
  last_run_at: string | null
  last_run_date: string | null
  next_run_at: string | null
  last_status: ScheduleStatus | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface UpsertScheduleInput {
  id?: string
  siteConnectionId?: string | null
  enabled?: boolean
  frequency?: ScheduleFrequency
  publishTime?: string
  timezone?: string
  weekday?: number | null
  tone?: string
  wordCount?: number
  keywordPool?: string[]
  autoPublish?: boolean
  generateImage?: boolean
}

export async function listSchedules(userId: string): Promise<ArticleScheduleRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('article_schedules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[ScheduleStore] LIST_FAIL', error.message)
    return []
  }
  return (data ?? []) as ArticleScheduleRow[]
}

export async function getSchedule(id: string, userId?: string): Promise<ArticleScheduleRow | null> {
  if (!supabase) return null
  let q = supabase.from('article_schedules').select('*').eq('id', id)
  if (userId) q = q.eq('user_id', userId)
  const { data, error } = await q.maybeSingle()
  if (error || !data) return null
  return data as ArticleScheduleRow
}

/** Cron için: enabled olan tüm zamanlamalar (tüm kullanıcılar). Service-role. */
export async function listEnabledSchedules(): Promise<ArticleScheduleRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('article_schedules')
    .select('*')
    .eq('enabled', true)
  if (error) {
    console.error('[ScheduleStore] LIST_ENABLED_FAIL', error.message)
    return []
  }
  return (data ?? []) as ArticleScheduleRow[]
}

export async function upsertSchedule(userId: string, input: UpsertScheduleInput): Promise<ArticleScheduleRow | null> {
  if (!supabase) return null
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = { user_id: userId, updated_at: now }

  if (input.siteConnectionId !== undefined) payload.site_connection_id = input.siteConnectionId
  if (input.enabled !== undefined) payload.enabled = input.enabled
  if (input.frequency !== undefined) payload.frequency = input.frequency
  if (input.publishTime !== undefined) payload.publish_time = input.publishTime
  if (input.timezone !== undefined) payload.timezone = input.timezone
  if (input.weekday !== undefined) payload.weekday = input.weekday
  if (input.tone !== undefined) payload.tone = input.tone
  if (input.wordCount !== undefined) payload.word_count = input.wordCount
  if (input.keywordPool !== undefined) payload.keyword_pool = input.keywordPool
  if (input.autoPublish !== undefined) payload.auto_publish = input.autoPublish
  if (input.generateImage !== undefined) payload.generate_image = input.generateImage

  if (input.id) {
    const { data, error } = await supabase
      .from('article_schedules')
      .update(payload)
      .eq('id', input.id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error || !data) {
      console.error('[ScheduleStore] UPDATE_FAIL', error?.message)
      return null
    }
    return data as ArticleScheduleRow
  }

  payload.created_at = now
  const { data, error } = await supabase.from('article_schedules').insert(payload).select().single()
  if (error || !data) {
    console.error('[ScheduleStore] INSERT_FAIL', error?.message)
    return null
  }
  return data as ArticleScheduleRow
}

export async function deleteSchedule(id: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('article_schedules').delete().eq('id', id).eq('user_id', userId)
  if (error) {
    console.error('[ScheduleStore] DELETE_FAIL', error.message)
    return false
  }
  return true
}

export async function markScheduleRun(
  id: string,
  patch: { lastRunAt?: string; lastRunDate?: string; nextRunAt?: string | null; lastStatus?: ScheduleStatus; lastError?: string | null }
): Promise<void> {
  if (!supabase) return
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.lastRunAt !== undefined) updates.last_run_at = patch.lastRunAt
  if (patch.lastRunDate !== undefined) updates.last_run_date = patch.lastRunDate
  if (patch.nextRunAt !== undefined) updates.next_run_at = patch.nextRunAt
  if (patch.lastStatus !== undefined) updates.last_status = patch.lastStatus
  if (patch.lastError !== undefined) updates.last_error = patch.lastError
  await supabase.from('article_schedules').update(updates).eq('id', id)
}
