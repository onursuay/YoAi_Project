/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Official Ads Docs Refresh

   Resmi platform dokümanlarını aylık kontrol eder.
   Hash değişmişse snapshot alır, kritik kaynakları
   review_required olarak işaretler.

   Proposal engine'e veya approved knowledge items'a
   dokunmaz.
   ────────────────────────────────────────────────────────── */

import { createHash } from 'crypto'

// ── Types ─────────────────────────────────────────────────────────────────────

export type FetchStrategy = 'html' | 'markdown' | 'rss' | 'manual_review'
export type SourceStatus = 'active' | 'failed' | 'review_required' | 'deprecated'
export type SourceImportance = 'critical' | 'high' | 'medium' | 'low'

export interface OfficialAdsSource {
  id: string
  platform: 'google' | 'meta'
  source_type: string
  title: string
  url: string
  fetch_strategy: FetchStrategy
  content_hash: string | null
  status: SourceStatus
  importance: SourceImportance
  notes: string | null
}

export interface FetchResult {
  success: boolean
  rawText: string
  normalizedText: string
  contentHash: string
  error?: string
}

export interface SourceChangeResult {
  sourceId: string
  platform: string
  title: string
  url: string
  oldHash: string | null
  newHash: string
  status: SourceStatus
  diffSummary: string
}

export interface SourceFailResult {
  sourceId: string
  title: string
  url: string
  error: string
}

export interface RefreshResult {
  checkedSources: number
  changedSources: number
  failedSources: number
  reviewRequiredCount: number
  changed: SourceChangeResult[]
  failed: SourceFailResult[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000
const MAX_RAW_TEXT_LENGTH = 100_000
const MAX_NORMALIZED_TEXT_LENGTH = 50_000

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function hashOfficialAdsContent(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export function normalizeOfficialAdsContent(
  raw: string,
  strategy: FetchStrategy | string,
): string {
  let text = raw.slice(0, MAX_RAW_TEXT_LENGTH)

  if (strategy === 'html') {
    text = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
  } else if (strategy === 'rss') {
    const items: string[] = []
    const titleMatches = text.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)
    const descMatches = text.matchAll(/<description[^>]*>([\s\S]*?)<\/description>/gi)
    for (const m of titleMatches) items.push(m[1].trim())
    for (const m of descMatches) items.push(m[1].replace(/<[^>]+>/g, ' ').trim())
    text = items.join('\n')
  } else if (strategy === 'manual_review') {
    return '[manual_review — no fetch performed]'
  }
  // markdown: minimal cleanup (just whitespace)

  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_NORMALIZED_TEXT_LENGTH)

  return text
}

export function summarizeOfficialAdsDiff(oldText: string, newText: string): string {
  const oldWords = oldText.trim().split(/\s+/).filter(Boolean).length
  const newWords = newText.trim().split(/\s+/).filter(Boolean).length
  const delta = newWords - oldWords

  let diffPos = 0
  const minLen = Math.min(oldText.length, newText.length)
  while (diffPos < minLen && oldText[diffPos] === newText[diffPos]) diffPos++

  const snippet = newText
    .slice(Math.max(0, diffPos - 10), diffPos + 100)
    .replace(/\s+/g, ' ')
    .trim()

  const parts = [`Kelime: ${oldWords} → ${newWords} (${delta >= 0 ? '+' : ''}${delta})`]
  if (snippet) parts.push(`İlk değişiklik: "${snippet.slice(0, 120)}"`)
  if (oldText.length !== newText.length) {
    parts.push(`Karakter: ${oldText.length} → ${newText.length}`)
  }

  return parts.join(' | ')
}

export function classifyOfficialAdsChange(
  source: Pick<OfficialAdsSource, 'importance'>,
): SourceStatus {
  return source.importance === 'critical' || source.importance === 'high'
    ? 'review_required'
    : 'active'
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchOfficialAdsSource(source: OfficialAdsSource): Promise<FetchResult> {
  if (source.fetch_strategy === 'manual_review') {
    const normalized = '[manual_review — no fetch performed]'
    return {
      success: true,
      rawText: normalized,
      normalizedText: normalized,
      contentHash: hashOfficialAdsContent(normalized),
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'YoAi-Docs-Refresh/1.0 (automated)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
      },
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        success: false,
        rawText: '',
        normalizedText: '',
        contentHash: '',
        error: `HTTP ${response.status} ${response.statusText}`,
      }
    }

    const rawText = (await response.text()).slice(0, MAX_RAW_TEXT_LENGTH)
    const normalizedText = normalizeOfficialAdsContent(rawText, source.fetch_strategy)
    const contentHash = hashOfficialAdsContent(normalizedText)

    return { success: true, rawText, normalizedText, contentHash }
  } catch (err) {
    clearTimeout(timeoutId)
    const error =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Timeout (${FETCH_TIMEOUT_MS}ms)`
          : err.message
        : String(err)
    return { success: false, rawText: '', normalizedText: '', contentHash: '', error }
  }
}

// ── Main refresh ──────────────────────────────────────────────────────────────

export async function runOfficialAdsDocsRefresh(
  // Accept supabase client as parameter for testability
  supabase: any,
): Promise<RefreshResult> {
  const result: RefreshResult = {
    checkedSources: 0,
    changedSources: 0,
    failedSources: 0,
    reviewRequiredCount: 0,
    changed: [],
    failed: [],
  }

  const { data: sources, error: sourcesError } = await supabase
    .from('official_ads_sources')
    .select(
      'id, platform, source_type, title, url, fetch_strategy, content_hash, status, importance, notes',
    )
    .in('status', ['active', 'review_required'])

  if (sourcesError || !sources) {
    throw new Error(
      `official_ads_sources okuma hatası: ${sourcesError?.message ?? 'veri yok'}`,
    )
  }

  const now = new Date().toISOString()

  for (const source of sources as OfficialAdsSource[]) {
    result.checkedSources++

    const fetchResult = await fetchOfficialAdsSource(source)

    if (!fetchResult.success) {
      await supabase
        .from('official_ads_sources')
        .update({ status: 'failed', last_checked_at: now, updated_at: now })
        .eq('id', source.id)
        .catch(() => {})

      result.failedSources++
      result.failed.push({
        sourceId: source.id,
        title: source.title,
        url: source.url,
        error: fetchResult.error ?? 'unknown',
      })
      continue
    }

    const hashChanged = source.content_hash !== fetchResult.contentHash

    if (!hashChanged) {
      await supabase
        .from('official_ads_sources')
        .update({ last_checked_at: now, updated_at: now })
        .eq('id', source.id)
        .catch(() => {})
      continue
    }

    // Fetch previous snapshot text for diff if available
    let oldText = `[prev_hash: ${source.content_hash ?? 'none'}]`
    try {
      const { data: prevSnap } = await supabase
        .from('official_ads_doc_snapshots')
        .select('normalized_text')
        .eq('source_id', source.id)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single()
      if (prevSnap?.normalized_text) oldText = prevSnap.normalized_text
    } catch {}

    const diffSummary = summarizeOfficialAdsDiff(oldText, fetchResult.normalizedText)

    await supabase
      .from('official_ads_doc_snapshots')
      .insert({
        source_id: source.id,
        fetched_at: now,
        content_hash: fetchResult.contentHash,
        raw_text: fetchResult.rawText,
        normalized_text: fetchResult.normalizedText,
        diff_summary: diffSummary,
        parser_status: 'success',
        created_at: now,
      })
      .catch(() => {})

    const newStatus = classifyOfficialAdsChange(source)

    await supabase
      .from('official_ads_sources')
      .update({
        content_hash: fetchResult.contentHash,
        last_checked_at: now,
        last_changed_at: now,
        status: newStatus,
        updated_at: now,
      })
      .eq('id', source.id)
      .catch(() => {})

    result.changedSources++
    if (newStatus === 'review_required') result.reviewRequiredCount++

    result.changed.push({
      sourceId: source.id,
      platform: source.platform,
      title: source.title,
      url: source.url,
      oldHash: source.content_hash,
      newHash: fetchResult.contentHash,
      status: newStatus,
      diffSummary,
    })
  }

  return result
}
