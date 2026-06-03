import 'server-only'
import { supabase } from '@/lib/supabase/client'

export type BriefScanStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed'

export interface SiteContentBriefRow {
  id: string
  user_id: string
  site_connection_id: string
  scan_status: BriefScanStatus
  company_name: string | null
  sector: string | null
  brand_tone: string | null
  target_audience: string | null
  products_or_services: string[]
  categories: string[]
  keyword_themes: string[]
  content_angles: string[]
  audience_pains: string[]
  summary_text: string | null
  last_error: string | null
  scanned_at: string | null
  created_at: string
  updated_at: string
}

export type BriefPatch = Partial<Omit<SiteContentBriefRow, 'id' | 'user_id' | 'site_connection_id' | 'created_at' | 'updated_at'>>

/** Site bağlantısına ait brief (yoksa null). */
export async function getBriefByConnection(siteConnectionId: string): Promise<SiteContentBriefRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('site_content_briefs')
    .select('*')
    .eq('site_connection_id', siteConnectionId)
    .maybeSingle()
  if (error || !data) return null
  return data as SiteContentBriefRow
}

/** find-then-write (constraint-agnostik): site başına tek brief upsert. */
export async function upsertBrief(
  userId: string,
  siteConnectionId: string,
  patch: BriefPatch
): Promise<SiteContentBriefRow | null> {
  if (!supabase) return null
  const now = new Date().toISOString()
  const existing = await getBriefByConnection(siteConnectionId)
  const payload: Record<string, unknown> = { ...patch, updated_at: now }

  if (existing) {
    const { data, error } = await supabase
      .from('site_content_briefs')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error || !data) { console.error('[BriefStore] UPDATE_FAIL', error?.message); return null }
    return data as SiteContentBriefRow
  }

  payload.user_id = userId
  payload.site_connection_id = siteConnectionId
  payload.created_at = now
  const { data, error } = await supabase.from('site_content_briefs').insert(payload).select().single()
  if (error || !data) { console.error('[BriefStore] INSERT_FAIL', error?.message); return null }
  return data as SiteContentBriefRow
}

/** Bayatlamış (scanned_at < cutoff) VEYA pending/failed brief'ler — aylık tazeleme için. */
export async function listStaleBriefs(cutoffIso: string): Promise<SiteContentBriefRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('site_content_briefs')
    .select('*')
    .or(`scanned_at.is.null,scanned_at.lt.${cutoffIso},scan_status.eq.failed`)
  if (error) { console.error('[BriefStore] LIST_STALE_FAIL', error.message); return [] }
  return (data ?? []) as SiteContentBriefRow[]
}
