// Web Site Yöneticisi — alan tipleri (domain) + DB row tipleri + mapper'lar.

export type SiteType = 'landing' | 'multipage'
export type WebsiteStatus = 'draft' | 'published' | 'unpublished'
export type VersionReason = 'initial' | 'revision' | 'rollback'
export type PageRole =
  | 'home' | 'about' | 'services' | 'products' | 'contact' | 'blog' | 'faq' | 'gallery' | 'custom'

export interface ThemeTokens {
  primaryColor: string | null
  secondaryColor?: string | null
  fontHeading?: string | null
  fontBody?: string | null
  logoUrl?: string | null
}

export interface SectionBlock {
  id: string
  type: string // 'hero' | 'features' | 'about' | 'cta' | 'contact' | ... (Faz 1b'de genişler)
  content: Record<string, unknown>
}

export interface PageSeo {
  title?: string
  description?: string
}

export interface Website {
  id: string
  userId: string
  label: string
  subdomain: string
  siteType: SiteType
  defaultLocale: string
  locales: string[]
  category: string | null
  status: WebsiteStatus
  theme: ThemeTokens
  publishedVersionId: string | null
  createdAt: string
  updatedAt: string
}

export interface WebsitePage {
  id: string
  websiteId: string
  locale: string
  slug: string
  pageRole: PageRole
  sections: SectionBlock[]
  seo: PageSeo
  orderIndex: number
}

export interface WebsiteSnapshot {
  website: Pick<Website, 'label' | 'siteType' | 'defaultLocale' | 'locales' | 'category' | 'theme'>
  pages: WebsitePage[]
}

export interface WebsiteVersion {
  id: string
  websiteId: string
  snapshot: WebsiteSnapshot
  reason: VersionReason
  creditCharged: number
  createdAt: string
}

/** Yeni taslak site oluştururken kabul edilen alanlar. */
export interface WebsiteDraftInput {
  label: string
  siteType?: SiteType
  category?: string | null
  defaultLocale?: string
  locales?: string[]
  theme?: Partial<ThemeTokens>
}

/** PATCH ile güncellenebilen alanlar. */
export interface WebsitePatchInput {
  label?: string
  siteType?: SiteType
  category?: string | null
  defaultLocale?: string
  locales?: string[]
  theme?: Partial<ThemeTokens>
  status?: WebsiteStatus
}

/** Sayfa yazarken kabul edilen alanlar (builder + ileride AI üretimi). */
export interface WebsitePageInput {
  locale: string
  slug: string
  pageRole: PageRole
  sections: SectionBlock[]
  seo?: PageSeo
  orderIndex?: number
}

/** Public render için: yayınlanmış site + sayfaları. */
export interface PublishedSite {
  website: Website
  pages: WebsitePage[]
}

// --- DB row tipleri (snake_case) + mapper ---

export interface WebsiteRow {
  id: string
  user_id: string
  label: string
  subdomain: string
  site_type: SiteType
  default_locale: string
  locales: string[]
  category: string | null
  status: WebsiteStatus
  theme: ThemeTokens | null
  published_version_id: string | null
  created_at: string
  updated_at: string
}

export function rowToWebsite(r: WebsiteRow): Website {
  return {
    id: r.id,
    userId: r.user_id,
    label: r.label,
    subdomain: r.subdomain,
    siteType: r.site_type,
    defaultLocale: r.default_locale,
    locales: r.locales ?? [r.default_locale],
    category: r.category,
    status: r.status,
    theme: r.theme ?? { primaryColor: null },
    publishedVersionId: r.published_version_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export interface WebsitePageRow {
  id: string
  website_id: string
  locale: string
  slug: string
  page_role: PageRole
  sections: SectionBlock[] | null
  seo: PageSeo | null
  order_index: number
}

export function rowToPage(r: WebsitePageRow): WebsitePage {
  return {
    id: r.id,
    websiteId: r.website_id,
    locale: r.locale,
    slug: r.slug,
    pageRole: r.page_role,
    sections: r.sections ?? [],
    seo: r.seo ?? {},
    orderIndex: r.order_index,
  }
}
