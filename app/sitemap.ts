import type { MetadataRoute } from 'next'

const BASE_URL = 'https://yoai.yodijital.com'

/** Public, crawlable pages (marketing + legal). App/dashboard routes excluded. */
const PUBLIC_PATHS = [
  '',
  '/en',
  '/privacy-policy',
  '/en/privacy-policy',
  '/gizlilik-politikasi',
  '/terms',
  '/en/terms-of-service',
  '/kullanim-kosullari',
  '/cookie-policy',
  '/cerez-politikasi',
  '/data-deletion',
  '/veri-silme',
]

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${BASE_URL}${path}`,
    changeFrequency: 'monthly' as const,
    priority: path === '' || path === '/en' ? 1 : 0.6,
  }))
}
