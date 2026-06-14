import 'server-only'
import { claudeJson, isClaudeReady } from '@/lib/anthropic/text'
import { pickStockImage, isStockReady } from '../stock'
import { labelsFor, type SiteLabels } from '../templates/deterministic'
import type { WebsitePageInput, SectionBlock, SiteType, PageRole } from '../types'
import type { BusinessProfileRow, BusinessIntelligenceRow } from '@/lib/yoai/businessProfileStore'

/**
 * Faz 1c — AI üretim motoru. Claude SABİT bir içerik şemasını doldurur (yapıyı uydurmaz);
 * header/footer/nav güvenli şekilde DETERMİNİSTİK monte edilir; görseller stoktan bağlanır.
 * Bu sayede nav href'leri güvenli (XSS yok), dil tutarlı, yapı öngörülebilir kalır.
 */

interface BrandSynthesisLike {
  brand_voice?: string | null
  value_proposition?: string | null
  messaging_pillars?: string[]
  differentiators?: string[]
  suggested_keywords?: string[]
  tone_guidance?: string | null
}

interface AiContent {
  hero?: { title?: string; subtitle?: string; ctaLabel?: string; imageQuery?: string }
  services?: { heading?: string; items?: { title?: string; description?: string }[] }
  features?: { heading?: string; items?: { title?: string; description?: string }[] }
  about?: { heading?: string; body?: string; imageQuery?: string }
  contact?: { heading?: string; body?: string }
}

export interface GenerateInput {
  subdomain: string
  siteType: SiteType
  label: string
  profile: BusinessProfileRow | null
  intelligence: BusinessIntelligenceRow | null
  locale: string
  instructions?: string
}

export function isWebsiteAiReady(): boolean {
  return isClaudeReady()
}

const clean = (s: string | null | undefined): string => (typeof s === 'string' ? s.trim() : '')

function buildPrompt(input: GenerateInput, ai: BrandSynthesisLike): { system: string; user: string } {
  const p = input.profile
  const intel = input.intelligence
  const langName = input.locale === 'en' ? 'English' : 'Türkçe'

  const facts: string[] = []
  const add = (k: string, v: string | null | undefined | string[]) => {
    const val = Array.isArray(v) ? v.filter(Boolean).join(', ') : clean(v as string)
    if (val) facts.push(`${k}: ${val}`)
  }
  add('Firma', p?.company_name)
  add('Sektör', [p?.sector_main, p?.sector_sub].filter(Boolean).join(' / '))
  add('Uzmanlık', p?.specialization)
  add('Açıklama', p?.business_description)
  add('Ürün/Hizmetler', p?.products_or_services)
  add('Öne çıkan hizmetler', p?.most_profitable_services)
  add('Hedef kitle', p?.target_audience)
  add('Lokasyonlar', p?.target_locations)
  add('Marka tonu', p?.brand_tone)
  add('Anahtar kelimeler', p?.keywords)
  add('Değer önerisi', ai.value_proposition)
  add('Marka sesi', ai.brand_voice)
  add('Mesaj sütunları', ai.messaging_pillars)
  add('Farklılaştırıcılar', ai.differentiators)
  add('Şirket özeti', intel?.company_summary)
  if (p?.forbidden_claims?.length) facts.push(`YASAK iddialar (asla kullanma): ${p.forbidden_claims.join(', ')}`)

  const trRule =
    input.locale === 'en'
      ? 'Write all content in fluent, natural English.'
      : 'Tüm içeriği akıcı, dilbilgisi ve imla açısından KUSURSUZ Türkçe yaz (ç, ğ, ı, İ, ö, ş, ü eksiksiz; ASCII eşdeğer YASAK; kesme işareti doğru).'

  const system = [
    'Sen kıdemli bir web içerik editörü ve marka metni yazarısın.',
    'Verilen işletme gerçeklerinden, dönüşüm odaklı, markaya uygun bir web sitesi metni üret.',
    'KURALLAR:',
    `- ${trRule}`,
    '- UYDURMA YOK: yalnız verilen gerçeklere dayan. Bilmediğin somut iddiayı (ödül, yıl, müşteri sayısı, garanti) UYDURMA.',
    '- Marka tonuna uy; abartılı/klişe pazarlama dilinden kaçın.',
    '- imageQuery alanları İNGİLİZCE, kısa ve görsel arama için uygun olsun (örn. "modern dental clinic interior").',
    '- Yalnız istenen JSON şemasını döndür; ek açıklama, markdown veya kod bloğu YOK.',
  ].join('\n')

  const user = [
    `Dil: ${langName}`,
    `Site tipi: ${input.siteType === 'landing' ? 'Tek sayfa (landing)' : 'Çok sayfalı'}`,
    '',
    'İŞLETME GERÇEKLERİ:',
    facts.length ? facts.join('\n') : '(sınırlı veri — nötr, dürüst ve genel geçer bir metin üret)',
    '',
    input.instructions ? `KULLANICI DÜZELTMELERİ (önceliklidir):\n${input.instructions}\n` : '',
    'Aşağıdaki JSON şemasını doldur (boş bırakabileceğin alanları boş string yap, items dizilerini gerçek hizmet/farklılıklarla doldur):',
    `{
  "hero": { "title": string, "subtitle": string, "ctaLabel": string, "imageQuery": string },
  "services": { "heading": string, "items": [{ "title": string, "description": string }] },
  "features": { "heading": string, "items": [{ "title": string, "description": string }] },
  "about": { "heading": string, "body": string, "imageQuery": string },
  "contact": { "heading": string, "body": string }
}`,
  ].join('\n')

  return { system, user }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const items = (v: unknown): { title: string; description: string }[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => ({ title: str((x as Record<string, unknown>)?.title), description: str((x as Record<string, unknown>)?.description) }))
    .filter((x) => x.title)
    .slice(0, 9)

function navFor(input: GenerateInput, L: SiteLabels) {
  if (input.siteType === 'landing') {
    return [
      { label: L.navServices, href: '#services' },
      { label: L.navAbout, href: '#about' },
      { label: L.navContact, href: '#contact' },
    ]
  }
  const base = `/s/${input.subdomain}`
  return [
    { label: L.navHome, href: base },
    { label: L.navServices, href: `${base}/hizmetler` },
    { label: L.navAbout, href: `${base}/hakkimizda` },
    { label: L.navContact, href: `${base}/iletisim` },
  ]
}

const block = (type: string, content: Record<string, unknown>, i: number): SectionBlock => ({ id: `${type}-${i}`, type, content })

/** Bir imageQuery için stok görsel bağla (stok hazır değilse atla). */
async function resolveImage(query: string): Promise<string | null> {
  const q = str(query)
  if (!q || !isStockReady()) return null
  const img = await pickStockImage(q)
  return img?.url ?? null
}

/**
 * AI ile site sayfa modelini üretir. Claude hazır değilse null döner (çağıran deterministik'e düşebilir).
 */
export async function generateSitePages(input: GenerateInput): Promise<WebsitePageInput[] | null> {
  if (!isClaudeReady()) return null
  const ai = ((input.intelligence as unknown as { ai_synthesis?: BrandSynthesisLike } | null)?.ai_synthesis) ?? {}
  const L = labelsFor(input.locale)
  const brand = clean(input.profile?.company_name) || clean(input.label) || (input.locale === 'en' ? 'Your Brand' : 'Markanız')

  const { system, user } = buildPrompt(input, ai)
  const content = await claudeJson<AiContent>({ system, user, maxTokens: 3000, temperature: 0.6, timeoutMs: 60_000 })
  if (!content) return null

  // Görselleri paralel çöz
  const [heroImg, aboutImg] = await Promise.all([
    resolveImage(content.hero?.imageQuery ?? ''),
    resolveImage(content.about?.imageQuery ?? ''),
  ])

  const heroBlock = (i: number) =>
    block('hero', {
      title: str(content.hero?.title) || brand,
      subtitle: str(content.hero?.subtitle),
      ctaLabel: str(content.hero?.ctaLabel) || L.contactCta,
      ctaHref: input.siteType === 'landing' ? '#contact' : `/s/${input.subdomain}/iletisim`,
      imageUrl: heroImg ?? '',
    }, i)
  const servicesBlock = (i: number) =>
    block('services', { heading: str(content.services?.heading) || L.services, items: items(content.services?.items) }, i)
  const featuresItems = items(content.features?.items).slice(0, 4)
  const featuresBlock = (i: number) =>
    block('features', { heading: str(content.features?.heading) || L.whyUs, items: featuresItems }, i)
  const aboutBlock = (i: number) =>
    block('about', { heading: str(content.about?.heading) || L.about, body: str(content.about?.body), imageUrl: aboutImg ?? '' }, i)
  const contactBlock = (i: number) =>
    block('contact', {
      heading: str(content.contact?.heading) || L.contact,
      body: str(content.contact?.body) || L.contactBody,
      locations: (input.profile?.target_locations ?? []).map(clean).filter(Boolean),
      links: [],
    }, i)

  const header = block('header', { brand, logoUrl: null, nav: navFor(input, L) }, 0)
  const footer = (i: number) => block('footer', { brand, note: `© ${brand}` }, i)
  const hasFeatures = featuresItems.length > 0
  const desc = str(content.hero?.subtitle) || brand

  const page = (slug: string, role: PageRole, sections: SectionBlock[], seoTitle: string): WebsitePageInput => ({
    locale: input.locale,
    slug,
    pageRole: role,
    sections,
    seo: { title: seoTitle, description: desc },
    orderIndex: 0,
  })

  if (input.siteType === 'landing') {
    const sections = [header, heroBlock(1), servicesBlock(2)]
    if (hasFeatures) sections.push(featuresBlock(3))
    sections.push(aboutBlock(4), contactBlock(5), footer(6))
    return [page('home', 'home', sections, brand)]
  }

  const homeSections = [header, heroBlock(1), servicesBlock(2)]
  if (hasFeatures) homeSections.push(featuresBlock(3))
  homeSections.push(footer(4))
  return [
    page('home', 'home', homeSections, brand),
    page('hakkimizda', 'about', [header, aboutBlock(1), footer(2)], `${L.about} — ${brand}`),
    page('hizmetler', 'services', [header, servicesBlock(1), footer(2)], `${L.services} — ${brand}`),
    page('iletisim', 'contact', [header, contactBlock(1), footer(2)], `${L.contact} — ${brand}`),
  ]
}
