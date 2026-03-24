import { NextRequest, NextResponse } from 'next/server'

/**
 * EN slug → TR filesystem slug (app routes only).
 * Legal pages (privacy-policy, terms, etc.) are NOT here because
 * they have their own filesystem routes under /privacy-policy, /terms, etc.
 */
const EN_TO_TR: Record<string, string> = {
  'strategy': 'strateji',
  'optimization': 'optimizasyon',
  'target-audience': 'hedef-kitle',
  'design': 'tasarim',
  'reports': 'raporlar',
  'integration': 'entegrasyon',
  'terms-of-service': 'terms',
}

/** TR slug → EN slug (for redirect when locale=en on TR URL) */
const TR_TO_EN: Record<string, string> = {
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

/** All app slugs that need /en/ prefix when locale=en (includes same-slug routes) */
const APP_SLUGS = new Set([
  ...Object.keys(TR_TO_EN),
  'meta-ads', 'google-ads', 'yoai', 'seo', 'dashboard',
  'hesabim', 'abonelik', 'faturalarim',
])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Handle /en prefix: rewrite to TR filesystem route + set locale
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const rest = pathname.slice(3) || '/' // strip '/en'

    let rewritePath = rest
    if (rest !== '/') {
      const segments = rest.split('/')
      if (segments.length >= 2 && segments[1]) {
        const enSlug = segments[1]
        const trSlug = EN_TO_TR[enSlug] || enSlug
        segments[1] = trSlug
        rewritePath = segments.join('/')
      }
    }

    // Set locale on request (for SSR) and response (for browser)
    request.cookies.set('NEXT_LOCALE', 'en')
    const url = request.nextUrl.clone()
    url.pathname = rewritePath
    const response = NextResponse.rewrite(url)
    response.cookies.set('NEXT_LOCALE', 'en', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  }

  // 2. If locale=en but user is on a non-/en/ URL → redirect to /en/ equivalent
  const locale = request.cookies.get('NEXT_LOCALE')?.value
  if (locale === 'en') {
    // Homepage: / → /en
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/en'
      return NextResponse.redirect(url)
    }
    // App routes: /strateji → /en/strategy, /meta-ads → /en/meta-ads
    const firstSlug = pathname.split('/')[1]
    if (firstSlug && APP_SLUGS.has(firstSlug)) {
      const enSlug = TR_TO_EN[firstSlug] || firstSlug
      const rest = pathname.slice(firstSlug.length + 1)
      const url = request.nextUrl.clone()
      url.pathname = `/en/${enSlug}${rest}`
      return NextResponse.redirect(url)
    }
  }

  // 3. Default: ensure NEXT_LOCALE cookie exists
  const response = NextResponse.next()
  if (!request.cookies.get('NEXT_LOCALE')) {
    response.cookies.set('NEXT_LOCALE', locale || 'tr', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
