import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { ensureUniqueSubdomain } from './subdomain'
import {
  rowToWebsite,
  rowToPage,
  type Website,
  type WebsiteRow,
  type WebsiteDraftInput,
  type WebsitePatchInput,
  type ThemeTokens,
  type WebsitePage,
  type WebsitePageRow,
  type WebsitePageInput,
  type WebsiteSnapshot,
  type VersionReason,
  type PublishedSite,
} from './types'

function requireClient() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return supabase
}

const DEFAULT_THEME: ThemeTokens = { primaryColor: null }

/** Kullanıcının tüm sitelerini (yeni → eski) döner. */
export async function listWebsites(userId: string): Promise<Website[]> {
  const db = requireClient()
  const { data, error } = await db
    .from('websites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as WebsiteRow[]).map(rowToWebsite)
}

/** Tek siteyi döner (sahiplik kontrolü: user_id eşleşmesi). */
export async function getWebsite(userId: string, id: string): Promise<Website | null> {
  const db = requireClient()
  const { data, error } = await db
    .from('websites')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? rowToWebsite(data as WebsiteRow) : null
}

/** Yeni taslak site oluşturur (status='draft'). Üretim/kredi bu adımda DEĞİL — Faz 1c. */
export async function createWebsite(userId: string, input: WebsiteDraftInput): Promise<Website> {
  const db = requireClient()
  const label = input.label?.trim() || 'Yeni Web Sitesi'
  const subdomain = await ensureUniqueSubdomain(label)
  const defaultLocale = input.defaultLocale || 'tr'
  const locales = input.locales?.length ? input.locales : [defaultLocale]
  const theme: ThemeTokens = { ...DEFAULT_THEME, ...(input.theme ?? {}) }

  const { data, error } = await db
    .from('websites')
    .insert({
      user_id: userId,
      label,
      subdomain,
      site_type: input.siteType ?? 'multipage',
      default_locale: defaultLocale,
      locales,
      category: input.category ?? null,
      status: 'draft',
      theme,
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToWebsite(data as WebsiteRow)
}

/** Siteyi günceller (yalnız sahibinin kaydında). */
export async function updateWebsite(
  userId: string,
  id: string,
  patch: WebsitePatchInput,
): Promise<Website | null> {
  const db = requireClient()
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.label !== undefined) row.label = patch.label.trim()
  if (patch.siteType !== undefined) row.site_type = patch.siteType
  if (patch.category !== undefined) row.category = patch.category
  if (patch.defaultLocale !== undefined) row.default_locale = patch.defaultLocale
  if (patch.locales !== undefined) row.locales = patch.locales
  if (patch.theme !== undefined) row.theme = patch.theme
  if (patch.status !== undefined) row.status = patch.status

  const { data, error } = await db
    .from('websites')
    .update(row)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data ? rowToWebsite(data as WebsiteRow) : null
}

/** Siteyi siler (cascade: pages + versions). Silinen satır 0 ise false. */
export async function deleteWebsite(userId: string, id: string): Promise<boolean> {
  const db = requireClient()
  const { data, error } = await db
    .from('websites')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
    .select('id')
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}

// ─── Sayfalar ───────────────────────────────────────────────────────

/** Sahibinin bir sitesinin sayfalarını döner (önizleme/düzenleme için). */
export async function getPages(userId: string, websiteId: string): Promise<WebsitePage[]> {
  const db = requireClient()
  const site = await getWebsite(userId, websiteId)
  if (!site) return []
  const { data, error } = await db
    .from('website_pages')
    .select('*')
    .eq('website_id', websiteId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return (data as WebsitePageRow[]).map(rowToPage)
}

/**
 * Bir sitenin tüm sayfalarını verilen yenileriyle değiştirir (sil + ekle).
 * Builder ve ileride AI üretimi/revizyon buradan yazar. Sahiplik getWebsite ile doğrulanır.
 */
export async function replacePages(
  userId: string,
  websiteId: string,
  pages: WebsitePageInput[],
): Promise<WebsitePage[]> {
  const db = requireClient()
  const site = await getWebsite(userId, websiteId)
  if (!site) throw new Error('WEBSITE_NOT_FOUND')

  const { error: delErr } = await db.from('website_pages').delete().eq('website_id', websiteId)
  if (delErr) throw delErr

  if (pages.length === 0) return []
  const rows = pages.map((p, i) => ({
    website_id: websiteId,
    locale: p.locale,
    slug: p.slug,
    page_role: p.pageRole,
    sections: p.sections,
    seo: p.seo ?? {},
    order_index: p.orderIndex ?? i,
  }))
  const { data, error } = await db.from('website_pages').insert(rows).select('*')
  if (error) throw error
  return (data as WebsitePageRow[]).map(rowToPage)
}

// ─── Sürümler + Yayın ───────────────────────────────────────────────

/** Anlık görüntüyü bir sürüm olarak kaydeder (geçmiş/rollback). Versiyon id'sini döner. */
export async function createVersion(
  websiteId: string,
  snapshot: WebsiteSnapshot,
  reason: VersionReason,
  creditCharged = 0,
): Promise<string> {
  const db = requireClient()
  const { data, error } = await db
    .from('website_versions')
    .insert({ website_id: websiteId, snapshot, reason, credit_charged: creditCharged })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

/** Siteyi yayınlar: status='published' + published_version_id = en yeni sürüm. */
export async function publishWebsite(userId: string, id: string): Promise<Website | null> {
  const db = requireClient()
  const site = await getWebsite(userId, id)
  if (!site) return null
  const { data: ver } = await db
    .from('website_versions')
    .select('id')
    .eq('website_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const publishedVersionId = (ver as { id: string } | null)?.id ?? site.publishedVersionId
  const { data, error } = await db
    .from('websites')
    .update({ status: 'published', published_version_id: publishedVersionId, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data ? rowToWebsite(data as WebsiteRow) : null
}

/** Siteyi yayından kaldırır (status='unpublished'). */
export async function unpublishWebsite(userId: string, id: string): Promise<Website | null> {
  return updateWebsite(userId, id, { status: 'unpublished' })
}

/**
 * PUBLIC: alt alan adına göre YAYINLANMIŞ siteyi + sayfalarını döner.
 * Sahiplik gerektirmez; yalnız status='published' siteleri görünür.
 */
export async function getPublishedSiteBySubdomain(subdomain: string): Promise<PublishedSite | null> {
  const db = requireClient()
  const { data: siteRow, error } = await db
    .from('websites')
    .select('*')
    .eq('subdomain', subdomain)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  if (!siteRow) return null
  const website = rowToWebsite(siteRow as WebsiteRow)
  const { data: pageRows, error: pErr } = await db
    .from('website_pages')
    .select('*')
    .eq('website_id', website.id)
    .order('order_index', { ascending: true })
  if (pErr) throw pErr
  return { website, pages: (pageRows as WebsitePageRow[]).map(rowToPage) }
}
