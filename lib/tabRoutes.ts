/**
 * Merkezi sekme-rota kayıt defteri.
 *
 * Sidebar modüllerinin İÇİNDEKİ sekmeler/alt-alanlar burada `slug ↔ id`
 * eşlemesiyle tek noktada tanımlanır. Her sekme gerçek bir alt-rota (path
 * segment) olarak URL'ye yansır — örn. `/hedef-kitle/meta/detayli-kitle`.
 *
 * Önemli i18n notu: middleware (bkz. middleware.ts / lib/routes.ts) yalnızca
 * yolun İLK slug'ını çevirir (`/en/target-audience/...` → `/hedef-kitle/...`).
 * Bu yüzden alt-segment slug'ları **locale-agnostic** (TR=EN ortak) tutulur;
 * `meta`, `kampanyalar`, `detayli-kitle` her iki dilde de aynıdır.
 */

import { SLUG_EN_TO_TR } from '@/lib/routes'

export type TabRouteKind = 'simple' | 'platform' | 'dynamic'

export interface TabDef {
  /** URL'de görünen segment (locale-agnostic). */
  slug: string
  /** Bileşen içi tab kimliği (mevcut state değerleriyle birebir). */
  id: string
  /** Opsiyonel i18n etiket anahtarı. */
  labelKey?: string
}

export interface ModuleTabConfig {
  /** TR taban yolu, örn. '/hedef-kitle'. */
  base: string
  kind: TabRouteKind
  /** Varsayılan tab id (segment yoksa bu kullanılır). */
  defaultTab: string
  tabs: TabDef[]
  /** kind === 'platform' için platform segmentleri. */
  platforms?: string[]
  defaultPlatform?: string
}

export const TAB_ROUTES = {
  'hedef-kitle': {
    base: '/hedef-kitle',
    kind: 'platform',
    platforms: ['meta', 'google'],
    defaultPlatform: 'meta',
    defaultTab: 'SAVED',
    tabs: [
      { slug: 'ai-kitle', id: 'AI', labelKey: 'dashboard.hedefKitle.tabs.ai' },
      { slug: 'detayli-kitle', id: 'SAVED', labelKey: 'dashboard.hedefKitle.tabs.saved' },
      { slug: 'benzer-kitle', id: 'LOOKALIKE', labelKey: 'dashboard.hedefKitle.tabs.lookalike' },
      { slug: 'retargeting', id: 'CUSTOM', labelKey: 'dashboard.hedefKitle.tabs.custom' },
    ],
  },
  'meta-ads': {
    base: '/meta-ads',
    kind: 'simple',
    defaultTab: 'kampanyalar',
    tabs: [
      { slug: 'kampanyalar', id: 'kampanyalar' },
      { slug: 'reklam-setleri', id: 'reklam-setleri' },
      { slug: 'reklamlar', id: 'reklamlar' },
    ],
  },
  'google-ads': {
    base: '/google-ads',
    kind: 'simple',
    defaultTab: 'kampanyalar',
    tabs: [
      { slug: 'kampanyalar', id: 'kampanyalar' },
      { slug: 'reklam-gruplari', id: 'reklam-gruplari' },
      { slug: 'reklamlar', id: 'reklamlar' },
    ],
  },
  // Google Ads kampanya detayı — /google-ads/kampanya/[campaignId]/<tab>
  'google-ads-detay': {
    base: '/google-ads/kampanya',
    kind: 'dynamic',
    defaultTab: 'overview',
    tabs: [
      { slug: 'overview', id: 'overview' },
      { slug: 'search-terms', id: 'search-terms' },
      { slug: 'locations', id: 'locations' },
      { slug: 'ad-schedule', id: 'ad-schedule' },
      { slug: 'landing-pages', id: 'landing-pages' },
      { slug: 'assets', id: 'assets' },
    ],
  },
  'raporlar': {
    base: '/raporlar',
    kind: 'simple',
    defaultTab: 'meta_ads',
    tabs: [
      { slug: 'meta-ads', id: 'meta_ads' },
      { slug: 'google-ads', id: 'google_ads' },
      { slug: 'google-analytics', id: 'google_analytics' },
      { slug: 'search-console', id: 'google_search_console' },
    ],
  },
  'seo': {
    base: '/seo',
    kind: 'simple',
    defaultTab: 'analysis',
    tabs: [
      { slug: 'analysis', id: 'analysis' },
      { slug: 'history', id: 'history' },
      { slug: 'bulk', id: 'bulk' },
      { slug: 'tools', id: 'tools' },
      { slug: 'articles', id: 'articles' },
    ],
  },
  'tasarim': {
    base: '/tasarim',
    kind: 'simple',
    defaultTab: 'tasarim',
    tabs: [
      { slug: 'tasarim', id: 'tasarim' },
      { slug: 'kutuphane', id: 'kutuphane' },
    ],
  },
  'strateji': {
    base: '/strateji',
    kind: 'dynamic',
    defaultTab: 'wizard',
    tabs: [
      { slug: 'wizard', id: 'wizard' },
      { slug: 'plan', id: 'plan' },
      { slug: 'tasks', id: 'tasks' },
      { slug: 'jobs', id: 'jobs' },
    ],
  },
} satisfies Record<string, ModuleTabConfig>

export type ModuleKey = keyof typeof TAB_ROUTES

export function getModuleConfig(module: string): ModuleTabConfig | undefined {
  return (TAB_ROUTES as Record<string, ModuleTabConfig>)[module]
}

/** Tab id → URL slug. Bilinmeyen id'de varsayılan sekme slug'ına düşer. */
export function tabIdToSlug(module: string, id: string): string {
  const cfg = getModuleConfig(module)
  if (!cfg) return id
  const match = cfg.tabs.find((t) => t.id === id)
  if (match) return match.slug
  const def = cfg.tabs.find((t) => t.id === cfg.defaultTab)
  return def?.slug ?? id
}

/** URL slug → tab id. Eksik/bilinmeyen slug'da varsayılan sekmeye düşer. */
export function slugToTabId(module: string, slug: string | undefined): string {
  const cfg = getModuleConfig(module)
  if (!cfg) return slug ?? ''
  if (!slug) return cfg.defaultTab
  return cfg.tabs.find((t) => t.slug === slug)?.id ?? cfg.defaultTab
}

export function isPlatformSlug(module: string, slug: string | undefined): boolean {
  const cfg = getModuleConfig(module)
  return Boolean(cfg?.platforms && slug && cfg.platforms.includes(slug))
}

export interface BuildTabPathOpts {
  /** kind === 'platform' modülleri için platform segmenti. */
  platform?: string
  /** kind === 'dynamic' modülleri için id segmenti (strateji [id], kampanya detayı). */
  id?: string
}

/** Modül + tab id → TR taban yolu (locale uygulaması çağırana aittir). */
export function buildTabPath(module: string, tabId: string, opts: BuildTabPathOpts = {}): string {
  const cfg = getModuleConfig(module)
  if (!cfg) return '/'
  const slug = tabIdToSlug(module, tabId)
  if (cfg.kind === 'platform') {
    const platform = opts.platform ?? cfg.defaultPlatform ?? cfg.platforms?.[0] ?? 'meta'
    return `${cfg.base}/${platform}/${slug}`
  }
  if (cfg.kind === 'dynamic') {
    return `${cfg.base}/${opts.id ?? ''}/${slug}`.replace(/\/{2,}/g, '/')
  }
  return `${cfg.base}/${slug}`
}

export interface ParsedTab {
  module: ModuleKey
  base: string
  tabId: string
  tabSlug: string
  platform?: string
  id?: string
}

/**
 * Gerçek tarayıcı yolunu (/en öneki olabilir) modül + sekme bilgisine çevirir.
 * İzleme katmanı (RouteTracker) için kullanılır.
 */
export function parseTabPath(pathname: string): ParsedTab | null {
  if (!pathname) return null
  let path = pathname
  if (path === '/en' || path.startsWith('/en/')) {
    path = path.slice(3) || '/'
  }
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return null
  const firstTr = SLUG_EN_TO_TR[segments[0]] || segments[0]

  // Google Ads kampanya detayı özel durumu: /google-ads/kampanya/<id>/<tab>
  if (firstTr === 'google-ads' && segments[1] === 'kampanya') {
    const cfg = getModuleConfig('google-ads-detay')!
    const id = segments[2]
    const tabSlug = segments[3]
    const tabId = slugToTabId('google-ads-detay', tabSlug)
    return { module: 'google-ads-detay', base: cfg.base, tabId, tabSlug: tabIdToSlug('google-ads-detay', tabId), id }
  }

  const cfg = getModuleConfig(firstTr)
  if (!cfg) return null
  const rest = segments.slice(1)

  if (cfg.kind === 'platform') {
    const platform = rest[0] && cfg.platforms?.includes(rest[0]) ? rest[0] : cfg.defaultPlatform
    const tabId = slugToTabId(firstTr, rest[1])
    return { module: firstTr as ModuleKey, base: cfg.base, tabId, tabSlug: tabIdToSlug(firstTr, tabId), platform }
  }
  if (cfg.kind === 'dynamic') {
    const id = rest[0]
    const tabId = slugToTabId(firstTr, rest[1])
    return { module: firstTr as ModuleKey, base: cfg.base, tabId, tabSlug: tabIdToSlug(firstTr, tabId), id }
  }
  const tabId = slugToTabId(firstTr, rest[0])
  return { module: firstTr as ModuleKey, base: cfg.base, tabId, tabSlug: tabIdToSlug(firstTr, tabId) }
}
