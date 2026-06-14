import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublishedSiteBySubdomain } from '@/lib/website/store'
import SiteRenderer from '@/lib/website/render/SiteRenderer'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { subdomain: string } }): Promise<Metadata> {
  const site = await getPublishedSiteBySubdomain(params.subdomain)
  const home = site?.pages.find((p) => p.slug === 'home') ?? site?.pages[0]
  return {
    title: home?.seo?.title || site?.website.label || 'Site',
    description: home?.seo?.description,
  }
}

export default async function PublicHomePage({ params }: { params: { subdomain: string } }) {
  const site = await getPublishedSiteBySubdomain(params.subdomain)
  if (!site) notFound()
  const home = site.pages.find((p) => p.slug === 'home') ?? site.pages[0]
  if (!home) notFound()
  return <SiteRenderer page={home} theme={site.website.theme} />
}
