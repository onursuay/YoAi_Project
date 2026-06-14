import type { BusinessProfileRow, BusinessIntelligenceRow } from '@/lib/yoai/businessProfileStore'
import type { WebsitePageInput, SectionBlock, SiteType, PageRole } from '../types'

/**
 * Profil + intelligence verisinden DETERMİNİSTİK (AI'sız, kredisiz) bir sayfa modeli üretir.
 * Faz 1c bunun yerine Claude + stok görsel + yönlendirilmiş diyaloğu koyar.
 * Kurallar:
 *  - Uydurma iddia YOK — metin yalnız gerçek profil alanlarından; alan boşsa nötr ifade.
 *  - Site içeriği site diline göre (TR/EN) — sabit etiketler aşağıdaki sözlükten gelir.
 */

interface BrandSynthesisLike {
  brand_voice?: string | null
  value_proposition?: string | null
  messaging_pillars?: string[]
  differentiators?: string[]
  suggested_keywords?: string[]
  tone_guidance?: string | null
}

export interface SiteLabels {
  contactCta: string
  services: string
  whyUs: string
  about: string
  contact: string
  contactBody: string
  web: string
  navHome: string
  navServices: string
  navAbout: string
  navContact: string
}

const LABELS: Record<string, SiteLabels> = {
  tr: {
    contactCta: 'İletişime Geçin',
    services: 'Hizmetlerimiz',
    whyUs: 'Neden Biz',
    about: 'Hakkımızda',
    contact: 'İletişim',
    contactBody: 'Bizimle iletişime geçin, size en kısa sürede dönüş yapalım.',
    web: 'Web Sitesi',
    navHome: 'Ana Sayfa',
    navServices: 'Hizmetler',
    navAbout: 'Hakkımızda',
    navContact: 'İletişim',
  },
  en: {
    contactCta: 'Get in Touch',
    services: 'Our Services',
    whyUs: 'Why Us',
    about: 'About',
    contact: 'Contact',
    contactBody: 'Get in touch and we will get back to you shortly.',
    web: 'Website',
    navHome: 'Home',
    navServices: 'Services',
    navAbout: 'About',
    navContact: 'Contact',
  },
}

export const labelsFor = (locale: string): SiteLabels => LABELS[locale] ?? LABELS.tr

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

function socialLinks(p: BusinessProfileRow | null, L: SiteLabels): { label: string; href: string }[] {
  if (!p) return []
  const out: { label: string; href: string }[] = []
  const add = (label: string, url: string | null) => {
    const u = clean(url)
    if (u) out.push({ label, href: u })
  }
  add(L.web, p.website_url)
  add('Instagram', p.instagram_url)
  add('Facebook', p.facebook_url)
  add('LinkedIn', p.linkedin_url)
  add('YouTube', p.youtube_url)
  add('TikTok', p.tiktok_url)
  return out
}

function heroContent(input: BuildSiteInput, ai: BrandSynthesisLike, L: SiteLabels): Record<string, unknown> {
  const brand = deriveBrand(input)
  const title = clean(ai.value_proposition) || brand
  const summary =
    clean(input.profile?.business_description) ||
    clean(input.intelligence?.company_summary) ||
    clean(ai.brand_voice)
  const subtitle = summary ? firstSentence(summary) : ''
  return { title, subtitle, ctaLabel: L.contactCta, ctaHref: '#contact' }
}

function servicesContent(input: BuildSiteInput, L: SiteLabels): Record<string, unknown> {
  const list = (input.profile?.most_profitable_services?.length
    ? input.profile.most_profitable_services
    : input.profile?.products_or_services) ?? []
  const items = list.map((s) => ({ title: clean(s), description: '' })).filter((x) => x.title).slice(0, 9)
  return { heading: L.services, items }
}

function featuresContent(input: BuildSiteInput, ai: BrandSynthesisLike, L: SiteLabels): Record<string, unknown> {
  const source =
    (ai.differentiators?.length && ai.differentiators) ||
    (ai.messaging_pillars?.length && ai.messaging_pillars) ||
    (input.intelligence?.recommended_content_angles?.length && input.intelligence.recommended_content_angles) ||
    []
  const items = (source as string[]).map((t) => ({ title: clean(t), description: '' })).filter((x) => x.title).slice(0, 4)
  return { heading: L.whyUs, items }
}

function aboutContent(input: BuildSiteInput, L: SiteLabels): Record<string, unknown> {
  const body =
    clean(input.intelligence?.company_summary) ||
    clean(input.profile?.business_description) ||
    ''
  return { heading: L.about, body }
}

function contactContent(input: BuildSiteInput, L: SiteLabels): Record<string, unknown> {
  const locations = (input.profile?.target_locations ?? []).map(clean).filter(Boolean)
  return {
    heading: L.contact,
    body: L.contactBody,
    locations,
    links: socialLinks(input.profile, L),
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
  const L = labelsFor(input.locale)
  const brand = deriveBrand(input)
  const locale = input.locale
  const features = featuresContent(input, ai, L)
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
      { label: L.navServices, href: '#services' },
      { label: L.navAbout, href: '#about' },
      { label: L.navContact, href: '#contact' },
    ]
    const sections: SectionBlock[] = [
      block('header', headerContent(brand, anchorNav), 0),
      block('hero', heroContent(input, ai, L), 1),
      block('services', servicesContent(input, L), 2),
    ]
    if (hasFeatures) sections.push(block('features', features, 3))
    sections.push(block('about', aboutContent(input, L), 4))
    sections.push(block('contact', contactContent(input, L), 5))
    sections.push(block('footer', footerContent(brand), 6))
    return [page('home', 'home', sections, brand)]
  }

  // multipage — 4 sayfa, header path nav (path-tabanlı serving: /s/<subdomain>/<slug>)
  const base = `/s/${input.subdomain}`
  const pathNav = [
    { label: L.navHome, href: base },
    { label: L.navServices, href: `${base}/hizmetler` },
    { label: L.navAbout, href: `${base}/hakkimizda` },
    { label: L.navContact, href: `${base}/iletisim` },
  ]
  const header = block('header', headerContent(brand, pathNav), 0)
  const footer = (i: number) => block('footer', footerContent(brand), i)

  const homeSections: SectionBlock[] = [header, block('hero', heroContent(input, ai, L), 1), block('services', servicesContent(input, L), 2)]
  if (hasFeatures) homeSections.push(block('features', features, 3))
  homeSections.push(footer(4))

  return [
    page('home', 'home', homeSections, brand),
    page('hakkimizda', 'about', [header, block('about', aboutContent(input, L), 1), footer(2)], `${L.about} — ${brand}`),
    page('hizmetler', 'services', [header, block('services', servicesContent(input, L), 1), footer(2)], `${L.services} — ${brand}`),
    page('iletisim', 'contact', [header, block('contact', contactContent(input, L), 1), footer(2)], `${L.contact} — ${brand}`),
  ]
}
