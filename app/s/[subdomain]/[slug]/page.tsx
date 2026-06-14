import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublishedSiteBySubdomain } from '@/lib/website/store'
import SiteRenderer from '@/lib/website/render/SiteRenderer'

export const dynamic = 'force-dynamic'

export async function generateMetadata(
  { params }: { params: { subdomain: string; slug: string } },
): Promise<Metadata> {
  const site = await getPublishedSiteBySubdomain(params.subdomain)
  const page = site?.pages.find((p) => p.slug === params.slug)
  return {
    title: page?.seo?.title || site?.website.label || 'Site',
    description: page?.seo?.description,
  }
}

export default async function PublicSlugPage(
  { params }: { params: { subdomain: string; slug: string } },
) {
  const site = await getPublishedSiteBySubdomain(params.subdomain)
  if (!site) notFound()
  const page = site.pages.find((p) => p.slug === params.slug)
  if (!page) notFound()
  return <SiteRenderer page={page} theme={site.website.theme} />
}
