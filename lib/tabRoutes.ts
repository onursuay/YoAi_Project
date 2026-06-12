/**
 * Merkezi sekme-rota kayıt defteri.
 *
 * Sidebar modüllerinin İÇİNDEKİ sekmeler/alt-alanlar burada `slug ↔ id`
 * eşlemesiyle tek noktada tanımlanır. Her sekme gerçek bir alt-rota (path
 * segment) olarak URL'ye yansır — örn. `/hedef-kitle/meta/detayli-kitle`.
 *
 * i18n (locale-aware slug):
 * - Her sekmenin TR slug'ı (`slug`) ve opsiyonel EN slug'ı (`slugEn`) vardır.
 *   TR arayüzde Türkçe slug, EN arayüzde İngilizce slug üretilir.
 * - Modülün İLK slug'ı (örn. hedef-kitle ↔ target-audience) middleware/localePath
 *   ile çevrilir (bkz. lib/routes.ts). Alt-segmentler catch-all rotalarda
 *   yakalandığı için herhangi bir slug'ı taşıyabilir; `slugToTabId` hem TR hem EN
 *   slug'ı tanır (tolerant), böylece rota her iki dilde de çözülür.
 * - Sabit (literal) rota segmentleri (örn. google-ads detayındaki `kampanya`)
 *   dosya sistemiyle eşleştiği için ÇEVRİLMEZ; her iki dilde aynı kalır.
 * - Marka/özel ad slug'ları (meta, google, tiktok, kampanyalar) çevrilse de
 *   anlamlıdır; gerekli yerlerde slugEn verilir.
 */

import { SLUG_TR_TO_EN, SLUG_EN_TO_TR } from '@/lib/routes'

export type TabRouteKind = 'simple' | 'platform' | 'dynamic'

export interface TabDef {
  /** TR URL slug'ı. */
  slug: string
  /** EN URL slug'ı (verilmezse `slug` kullanılır). */
  slugEn?: string
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
      { slug: 'ai-kitle', slugEn: 'ai-audience', id: 'AI', labelKey: 'dashboard.hedefKitle.tabs.ai' },
      { slug: 'detayli-kitle', slugEn: 'detailed-audience', id: 'SAVED', labelKey: 'dashboard.hedefKitle.tabs.saved' },
      { slug: 'benzer-kitle', slugEn: 'lookalike', id: 'LOOKALIKE', labelKey: 'dashboard.hedefKitle.tabs.lookalike' },
      { slug: 'retargeting', slugEn: 'retargeting', id: 'CUSTOM', labelKey: 'dashboard.hedefKitle.tabs.custom' },
    ],
  },
  'meta-ads': {
    base: '/meta-ads',
    kind: 'simple',
    defaultTab: 'kampanyalar',
    tabs: [
      { slug: 'kampanyalar', slugEn: 'campaigns', id: 'kampanyalar' },
      { slug: 'reklam-setleri', slugEn: 'ad-sets', id: 'reklam-setleri' },
      { slug: 'reklamlar', slugEn: 'ads', id: 'reklamlar' },
    ],
  },
  'google-ads': {
    base: '/google-ads',
    kind: 'simple',
    defaultTab: 'kampanyalar',
    tabs: [
      { slug: 'kampanyalar', slugEn: 'campaigns', id: 'kampanyalar' },
      { slug: 'reklam-gruplari', slugEn: 'ad-groups', id: 'reklam-gruplari' },
      { slug: 'reklamlar', slugEn: 'ads', id: 'reklamlar' },
    ],
  },
  // Google Ads kampanya detayı — /google-ads/kampanya/[campaignId]/<tab>
  // ('kampanya' sabit rota segmenti; çevrilmez)
  'google-ads-detay': {
    base: '/google-ads/kampanya',
    kind: 'dynamic',
    defaultTab: 'overview',
    tabs: [
      { slug: 'genel-bakis', slugEn: 'overview', id: 'overview' },
      { slug: 'arama-terimleri', slugEn: 'search-terms', id: 'search-terms' },
      { slug: 'lokasyonlar', slugEn: 'locations', id: 'locations' },
      { slug: 'reklam-zamanlamasi', slugEn: 'ad-schedule', id: 'ad-schedule' },
      { slug: 'varis-sayfalari', slugEn: 'landing-pages', id: 'landing-pages' },
      { slug: 'ogeler', slugEn: 'assets', id: 'assets' },
    ],
  },
  'optimizasyon': {
    base: '/optimizasyon',
    kind: 'simple',
    defaultTab: 'meta',
    // TikTok "Yakında" — kasıtlı olarak registry'de YOK: /optimizasyon/tiktok
    // varsayılan 'meta'ya düşer (canlı TikTok endpoint'leri tetiklenmez). UI'da
    // devre dışı "Yakında" butonu kalır. TikTok yayına alınınca buraya eklenecek.
    tabs: [
      { slug: 'meta', id: 'meta' },
      { slug: 'google', id: 'google' },
    ],
  },
  'raporlar': {
    base: '/raporlar',
    kind: 'simple',
    defaultTab: 'meta_ads',
    tabs: [
      { slug: 'meta-reklam', slugEn: 'meta-ads', id: 'meta_ads' },
      { slug: 'google-reklam', slugEn: 'google-ads', id: 'google_ads' },
      { slug: 'analytics', id: 'google_analytics' },
      { slug: 'search-console', id: 'google_search_console' },
    ],
  },
  'seo-plus': {
    base: '/seo-plus',
    kind: 'simple',
    defaultTab: 'analysis',
    tabs: [
      { slug: 'analiz', slugEn: 'analysis', id: 'analysis' },
      { slug: 'gecmis', slugEn: 'history', id: 'history' },
      { slug: 'toplu-tarama', slugEn: 'bulk', id: 'bulk' },
      { slug: 'araclar', slugEn: 'tools', id: 'tools' },
      { slug: 'icerikler', slugEn: 'articles', id: 'articles' },
    ],
  },
  'tasarim': {
    base: '/tasarim',
    kind: 'simple',
    defaultTab: 'tasarim',
    tabs: [
      { slug: 'tasarim', slugEn: 'design', id: 'tasarim' },
      { slug: 'kutuphane', slugEn: 'library', id: 'kutuphane' },
    ],
  },
  'email-marketing': {
    base: '/email-marketing',
    kind: 'simple',
    defaultTab: 'contacts',
    tabs: [
      { slug: 'kisiler', slugEn: 'contacts', id: 'contacts' },
      { slug: 'kampanyalar', slugEn: 'campaigns', id: 'campaigns' },
      { slug: 'otomasyon', slugEn: 'automation', id: 'automation' },
    ],
  },
  'strateji': {
    base: '/strateji',
    kind: 'dynamic',
    defaultTab: 'wizard',
    tabs: [
      { slug: 'kesif', slugEn: 'discovery', id: 'wizard' },
      { slug: 'plan', id: 'plan' },
      { slug: 'gorevler', slugEn: 'tasks', id: 'tasks' },
      { slug: 'is-gecmisi', slugEn: 'jobs', id: 'jobs' },
    ],
  },
} satisfies Record<string, ModuleTabConfig>

export type ModuleKey = keyof typeof TAB_ROUTES

export function getModuleConfig(module: string): ModuleTabConfig | undefined {
  return (TAB_ROUTES as Record<string, ModuleTabConfig>)[module]
}

/** Tab id → URL slug (locale'e göre TR/EN). Bilinmeyen id'de varsayılan sekme slug'ına düşer. */
export function tabIdToSlug(module: string, id: string, locale: string = 'tr'): string {
  const cfg = getModuleConfig(module)
  if (!cfg) return id
  const tab = cfg.tabs.find((t) => t.id === id) ?? cfg.tabs.find((t) => t.id === cfg.defaultTab)
  if (!tab) return id
  return locale === 'en' ? (tab.slugEn ?? tab.slug) : tab.slug
}

/** URL slug → tab id. Hem TR hem EN slug'ı tanır; eksik/bilinmeyen slug'da varsayılana düşer. */
export function slugToTabId(module: string, slug: string | undefined): string {
  const cfg = getModuleConfig(module)
  if (!cfg) return slug ?? ''
  if (!slug) return cfg.defaultTab
  return cfg.tabs.find((t) => t.slug === slug || t.slugEn === slug)?.id ?? cfg.defaultTab
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
  /** Hedef locale ('tr' | 'en'); slug seçimini ve /en önekini belirler. */
  locale?: string
}

/** Modül + tab id → locale'e uygun TAM yol (örn. /hedef-kitle/meta/detayli-kitle veya /en/target-audience/meta/detailed-audience). */
export function buildTabPath(module: string, tabId: string, opts: BuildTabPathOpts = {}): string {
  const { platform, id, locale = 'tr' } = opts
  const cfg = getModuleConfig(module)
  if (!cfg) return '/'
  const en = locale === 'en'
  const tabSlug = tabIdToSlug(module, tabId, locale)
  // Taban yolunu locale'e göre yerelleştir: yalnız İLK segment çevrilir,
  // sonraki literal segmentler (örn. 'kampanya') aynen kalır.
  const baseSegs = cfg.base.replace(/^\/+/, '').split('/')
  if (en) baseSegs[0] = SLUG_TR_TO_EN[baseSegs[0]] || baseSegs[0]
  const base = baseSegs.join('/')
  const prefix = en ? '/en/' : '/'
  let path: string
  if (cfg.kind === 'platform') {
    const pf = platform ?? cfg.defaultPlatform ?? cfg.platforms?.[0] ?? 'meta'
    path = `${prefix}${base}/${pf}/${tabSlug}`
  } else if (cfg.kind === 'dynamic') {
    path = `${prefix}${base}/${id ?? ''}/${tabSlug}`
  } else {
    path = `${prefix}${base}/${tabSlug}`
  }
  return path.replace(/\/{2,}/g, '/')
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
    const tabId = slugToTabId('google-ads-detay', segments[3])
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
