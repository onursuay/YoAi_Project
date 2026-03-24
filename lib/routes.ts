export const ROUTES = {
  DASHBOARD: '/dashboard',
  GOOGLE_ADS: '/google-ads',
  META_ADS: '/meta-ads',
  OPTIMIZATION: '/optimizasyon',
  STRATEGY: '/strateji',
  MY_ACCOUNT: '/hesabim',
  SUBSCRIPTION: '/abonelik',
  INVOICES: '/faturalarim',
} as const

/** TR slug → EN slug mapping (all translatable paths) */
export const SLUG_TR_TO_EN: Record<string, string> = {
  'strateji': 'strategy',
  'optimizasyon': 'optimization',
  'hedef-kitle': 'target-audience',
  'tasarim': 'design',
  'raporlar': 'reports',
  'entegrasyon': 'integration',
  'gizlilik-politikasi': 'privacy-policy',
  'cerez-politikasi': 'cookie-policy',
  'kullanim-kosullari': 'terms-of-service',
  'veri-silme': 'data-deletion',
}

/** EN slug → TR slug (reverse, for language switcher path mapping) */
export const SLUG_EN_TO_TR: Record<string, string> = {
  'strategy': 'strateji',
  'optimization': 'optimizasyon',
  'target-audience': 'hedef-kitle',
  'design': 'tasarim',
  'reports': 'raporlar',
  'integration': 'entegrasyon',
  'terms-of-service': 'kullanim-kosullari',
  'privacy-policy': 'gizlilik-politikasi',
  'cookie-policy': 'cerez-politikasi',
  'data-deletion': 'veri-silme',
}

/** Convert a TR href to locale-aware path */
export function localePath(trHref: string, locale: string): string {
  if (locale !== 'en' || !trHref || trHref === '#') return trHref
  const segments = trHref.split('/')
  if (segments.length < 2 || !segments[1]) return '/en' + trHref
  const trSlug = segments[1]
  const enSlug = SLUG_TR_TO_EN[trSlug] || trSlug
  segments[1] = enSlug
  return '/en' + segments.join('/')
}

/** Map current pathname to its equivalent in the target locale */
export function mapPathToLocale(pathname: string, targetLocale: string): string {
  if (targetLocale === 'en') {
    // TR path → EN path: /strateji → /en/strategy
    const segments = pathname.split('/')
    if (segments.length < 2 || !segments[1]) return '/en/'
    const trSlug = segments[1]
    const enSlug = SLUG_TR_TO_EN[trSlug] || trSlug
    segments[1] = enSlug
    return '/en' + segments.join('/')
  } else {
    // EN path → TR path: /en/strategy → /strateji
    if (!pathname.startsWith('/en')) return pathname
    const rest = pathname.slice(3) // strip '/en'
    if (!rest || rest === '/') return '/'
    const segments = rest.split('/')
    if (segments.length < 2 || !segments[1]) return '/'
    const enSlug = segments[1]
    const trSlug = SLUG_EN_TO_TR[enSlug] || enSlug
    segments[1] = trSlug
    return segments.join('/')
  }
}
