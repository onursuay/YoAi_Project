/**
 * Report cache helpers. Shared across all providers.
 */

import { supabase } from '@/lib/supabase/client'
import { REPORT_CACHE_TTL_MS } from './constants'

export async function getCachedReport(
  userId: string,
  provider: string,
  reportType: string,
  dateFrom: string,
  dateTo: string
): Promise<Record<string, unknown> | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('report_cache')
    .select('payload, fetched_at')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('report_type', reportType)
    .eq('date_from', dateFrom)
    .eq('date_to', dateTo)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const age = Date.now() - new Date(data.fetched_at).getTime()
  if (age > REPORT_CACHE_TTL_MS) return null

  return data.payload as Record<string, unknown>
}

export async function setCachedReport(
  userId: string,
  provider: string,
  reportType: string,
  dateFrom: string,
  dateTo: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!supabase) return

  // Delete old cache for same key
  await supabase
    .from('report_cache')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('report_type', reportType)
    .eq('date_from', dateFrom)
    .eq('date_to', dateTo)

  await supabase.from('report_cache').insert({
    user_id: userId,
    provider,
    report_type: reportType,
    date_from: dateFrom,
    date_to: dateTo,
    payload,
    fetched_at: new Date().toISOString(),
  })
}
