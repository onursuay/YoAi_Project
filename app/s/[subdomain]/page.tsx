import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublishedSiteBySubdomain } from '@/lib/website/store'
import SiteRenderer from '@/lib/website/render/SiteRenderer'

export const dynamic = 'force-dynamic'

function pickLocale(locales: string[], defaultLocale: string, lang?: string): string {
  return lang && locales.includes(lang) ? lang : defaultLocale
}

export async function generateMetadata(
  { params, searchParams }: { params: { subdomain: string }; searchParams: { lang?: string } },
): Promise<Metadata> {
  const site = await getPublishedSiteBySubdomain(params.subdomain)
  if (!site) return { title: 'Site' }
  const locale = pickLocale(site.website.locales, site.website.defaultLocale, searchParams?.lang)
  const home =
    site.pages.find((p) => p.locale === locale && p.slug === 'home') ??
    site.pages.find((p) => p.slug === 'home')
  return { title: home?.seo?.title || site.website.label, description: home?.seo?.description }
}

export default async function PublicHomePage(
  { params, searchParams }: { params: { subdomain: string }; searchParams: { lang?: string } },
) {
  const site = await getPublishedSiteBySubdomain(params.subdomain)
  if (!site) notFound()
  const locale = pickLocale(site.website.locales, site.website.defaultLocale, searchParams?.lang)
  const home =
    site.pages.find((p) => p.locale === locale && p.slug === 'home') ??
    site.pages.find((p) => p.slug === 'home') ??
    site.pages[0]
  if (!home) notFound()
  return <SiteRenderer page={home} theme={site.website.theme} />
}
