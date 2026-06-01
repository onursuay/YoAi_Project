import type { MetadataRoute } from 'next'

const BASE_URL = 'https://yoai.yodijital.com'

/**
 * Public robots.txt. Previously /robots.txt fell through to the app shell and
 * returned a noindex HTML page, which gave crawlers (and Google OAuth
 * verification) an ambiguous signal. This serves a proper text/plain robots
 * file: public marketing/legal pages are crawlable, authenticated app surfaces
 * are disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/hesabim',
        '/abonelik',
        '/faturalarim',
        '/api/',
        '/meta-ads',
        '/google-ads',
        '/tiktok-ads',
        '/yoai',
        '/seo',
        '/strateji',
        '/optimizasyon',
        '/hedef-kitle',
        '/tasarim',
        '/raporlar',
        '/entegrasyon',
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
