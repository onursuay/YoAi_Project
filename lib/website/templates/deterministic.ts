import type { BusinessProfileRow, BusinessIntelligenceRow } from '@/lib/yoai/businessProfileStore'
import type { WebsitePageInput, SectionBlock, SiteType, PageRole } from '../types'

/**
 * Profil + intelligence verisinden DETERMİNİSTİK (AI'sız, kredisiz) bir sayfa modeli üretir.
 * Faz 1c bunun yerine Claude + stok görsel + çoklu-dil + yönlendirilmiş diyaloğu koyar.
 * Kural: uydurma iddia YOK — metin yalnız gerçek profil alanlarından gelir; alan boşsa nötr ifade.
 */

interface BrandSynthesisLike {
  brand_voice?: string | null
  value_proposition?: string | null
  messaging_pillars?: string[]
  differentiators?: string[]
  suggested_keywords?: string[]
  tone_guidance?: string | null
}

const clean = (s: string | null | undefined): string => (typeof s === 'string' ? s.trim() : '')
const firstSentence = (s: string): string => {
  const m = s.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : s).trim()
}

export interface BuildSiteInput {
  subdomain: string
  siteType: SiteType
  label: string
  profile: BusinessProfileRow | null
  intelligence: BusinessIntelligenceRow | null
  locale: string
}

function block(type: string, content: Record<string, unknown>, i: number): SectionBlock {
  return { id: `${type}-${i}`, type, content }
}

function deriveBrand(input: BuildSiteInput): string {
  return clean(input.profile?.company_name) || clean(input.label) || 'Markanız'
}

function socialLinks(p: BusinessProfileRow | null): { label: string; href: string }[] {
  if (!p) return []
  const out: { label: string; href: string }[] = []
  const add = (label: string, url: string | null) => {
    const u = clean(url)
    if (u) out.push({ label, href: u })
  }
  add('Web Sitesi', p.website_url)
  add('Instagram', p.instagram_url)
  add('Facebook', p.facebook_url)
  add('LinkedIn', p.linkedin_url)
  add('YouTube', p.youtube_url)
  add('TikTok', p.tiktok_url)
  return out
}

function heroContent(input: BuildSiteInput, ai: BrandSynthesisLike): Record<string, unknown> {
  const brand = deriveBrand(input)
  const title = clean(ai.value_proposition) || brand
  const summary =
    clean(input.profile?.business_description) ||
    clean(input.intelligence?.company_summary) ||
    clean(ai.brand_voice)
  const subtitle = summary ? firstSentence(summary) : ''
  return { title, subtitle, ctaLabel: 'İletişime Geçin', ctaHref: '#contact' }
}

function servicesContent(input: BuildSiteInput): Record<string, unknown> {
  const list = (input.profile?.most_profitable_services?.length
    ? input.profile.most_profitable_services
    : input.profile?.products_or_services) ?? []
  const items = list.map((s) => ({ title: clean(s), description: '' })).filter((x) => x.title).slice(0, 9)
  return { heading: 'Hizmetlerimiz', items }
}

function featuresContent(input: BuildSiteInput, ai: BrandSynthesisLike): Record<string, unknown> {
  const source =
    (ai.differentiators?.length && ai.differentiators) ||
    (ai.messaging_pillars?.length && ai.messaging_pillars) ||
    (input.intelligence?.recommended_content_angles?.length && input.intelligence.recommended_content_angles) ||
    []
  const items = (source as string[]).map((t) => ({ title: clean(t), description: '' })).filter((x) => x.title).slice(0, 4)
  return { heading: 'Neden Biz', items }
}

function aboutContent(input: BuildSiteInput): Record<string, unknown> {
  const body =
    clean(input.intelligence?.company_summary) ||
    clean(input.profile?.business_description) ||
    ''
  return { heading: 'Hakkımızda', body }
}

function contactContent(input: BuildSiteInput): Record<string, unknown> {
  const locations = (input.profile?.target_locations ?? []).map(clean).filter(Boolean)
  return {
    heading: 'İletişim',
    body: 'Bizimle iletişime geçin, size en kısa sürede dönüş yapalım.',
    locations,
    links: socialLinks(input.profile),
  }
}

function headerContent(brand: string, nav: { label: string; href: string }[]): Record<string, unknown> {
  return { brand, logoUrl: null, nav }
}

function footerContent(brand: string): Record<string, unknown> {
  return { brand, note: `© ${brand}` }
}

/** Verilen siteye göre sayfa modelini üretir (landing = tek sayfa; multipage = 4 sayfa). */
export function buildDeterministicSite(input: BuildSiteInput): WebsitePageInput[] {
  const ai = ((input.intelligence as unknown as { ai_synthesis?: BrandSynthesisLike } | null)?.ai_synthesis) ?? {}
  const brand = deriveBrand(input)
  const locale = input.locale
  const features = featuresContent(input, ai)
  const hasFeatures = (features.items as unknown[]).length > 0

  const page = (slug: string, pageRole: PageRole, sections: SectionBlock[], seoTitle: string): WebsitePageInput => ({
    locale,
    slug,
    pageRole,
    sections,
    seo: { title: seoTitle, description: clean(input.profile?.business_description) || brand },
    orderIndex: 0,
  })

  if (input.siteType === 'landing') {
    const anchorNav = [
      { label: 'Hizmetler', href: '#services' },
      { label: 'Hakkımızda', href: '#about' },
      { label: 'İletişim', href: '#contact' },
    ]
    const sections: SectionBlock[] = [
      block('header', headerContent(brand, anchorNav), 0),
      block('hero', heroContent(input, ai), 1),
      block('services', servicesContent(input), 2),
    ]
    if (hasFeatures) sections.push(block('features', features, 3))
    sections.push(block('about', aboutContent(input), 4))
    sections.push(block('contact', contactContent(input), 5))
    sections.push(block('footer', footerContent(brand), 6))
    return [page('home', 'home', sections, brand)]
  }

  // multipage — 4 sayfa, header path nav (path-tabanlı serving: /s/<subdomain>/<slug>)
  const base = `/s/${input.subdomain}`
  const pathNav = [
    { label: 'Ana Sayfa', href: base },
    { label: 'Hizmetler', href: `${base}/hizmetler` },
    { label: 'Hakkımızda', href: `${base}/hakkimizda` },
    { label: 'İletişim', href: `${base}/iletisim` },
  ]
  const header = block('header', headerContent(brand, pathNav), 0)
  const footer = (i: number) => block('footer', footerContent(brand), i)

  const homeSections: SectionBlock[] = [header, block('hero', heroContent(input, ai), 1), block('services', servicesContent(input), 2)]
  if (hasFeatures) homeSections.push(block('features', features, 3))
  homeSections.push(footer(4))

  return [
    page('home', 'home', homeSections, brand),
    page('hakkimizda', 'about', [header, block('about', aboutContent(input), 1), footer(2)], `Hakkımızda — ${brand}`),
    page('hizmetler', 'services', [header, block('services', servicesContent(input), 1), footer(2)], `Hizmetler — ${brand}`),
    page('iletisim', 'contact', [header, block('contact', contactContent(input), 1), footer(2)], `İletişim — ${brand}`),
  ]
}
