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
  target_categories: string[]
  schedule_mode: 'daily' | 'weekly_days' | 'monthly_days' | null
  days_of_week: number[]
  days_of_month: number[]
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
  targetCategories?: string[]
  scheduleMode?: 'daily' | 'weekly_days' | 'monthly_days'
  daysOfWeek?: number[]
  daysOfMonth?: number[]
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
  if (input.targetCategories !== undefined) payload.target_categories = input.targetCategories
  if (input.scheduleMode !== undefined) payload.schedule_mode = input.scheduleMode
  if (input.daysOfWeek !== undefined) payload.days_of_week = input.daysOfWeek
  if (input.daysOfMonth !== undefined) payload.days_of_month = input.daysOfMonth
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

/**
 * Atomik "claim": bu schedule'ı bugünün üretimi için kilitler. Eşzamanlı ikinci
 * bir cron invocation'ı (veya gecikmeli event) aynı makaleyi İKİNCİ kez üretemesin
 * diye, üretime başlamadan ÖNCE çağrılır.
 *
 * `last_run_date`'i tek atomik UPDATE ile bugüne çeker — yalnız henüz bugün için
 * claim edilmemişse (null VEYA farklı gün). Postgres satır kilidi sayesinde iki
 * eşzamanlı çağrıdan yalnız BİRİ satırı günceller → yalnız o `true` alır.
 * `last_status`/`last_error` sıfırlanır (yeni denemenin başlangıcı).
 *
 * @returns claim bu çağrı tarafından alındıysa true; başkası aldıysa false.
 */
export async function claimScheduleRun(id: string, localDate: string): Promise<boolean> {
  if (!supabase) return false
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('article_schedules')
    .update({ last_run_date: localDate, last_run_at: now, last_status: null, last_error: null, updated_at: now })
    .eq('id', id)
    .or(`last_run_date.is.null,last_run_date.neq.${localDate}`)
    .select('id')
  if (error) {
    console.error('[ScheduleStore] CLAIM_FAIL', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

/**
 * Claim'i geri al — üretim sırasında HATA fırlarsa (AI/yayın), aynı gün bir
 * sonraki saatlik cron'un yeniden deneyebilmesi için `last_run_date` null'a çekilir.
 * Yalnız sonuç henüz işaretlenmemişse (last_status null) ve claim hâlâ bizimse
 * (last_run_date == localDate) uygulanır — başarı/skip işaretlenmiş kaydı bozmaz.
 */
export async function releaseScheduleClaim(id: string, localDate: string): Promise<void> {
  if (!supabase) return
  await supabase
    .from('article_schedules')
    .update({ last_run_date: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('last_run_date', localDate)
    .is('last_status', null)
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
