/* ──────────────────────────────────────────────────────────
   YoAi — Business Source Scanner

   Marka ve rakip kaynaklarını gerçek olarak tarar:
     • website_url, marketplace_url, google_business_profile_url
       → HTTP fetch + HTML extract (landingPageAnalyzer benzeri)
     • instagram_url, facebook_url, linkedin_url, youtube_url, tiktok_url
       → Sosyal scraper sağlayıcı varsa kullan; yoksa
         scan_status='failed', error_message='scraper_provider_missing'

   Fake data ÜRETİLMEZ. Tarama başarısız olursa kayıt failed olarak yazılır.

   Bu modül DB'ye yazmaz — yalnız ScanOutput döner. DB yazımını
   businessProfileStore.ts (API route) yapar.
   ────────────────────────────────────────────────────────── */

export type SourceType =
  | 'website'
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'google_business'
  | 'marketplace'
  | 'extra'

export interface SourceScanInput {
  source_type: SourceType
  source_url: string | null | undefined
}

export interface SourceScanOutput {
  source_type: SourceType
  source_url: string | null
  scan_status: 'completed' | 'failed' | 'skipped'
  raw_excerpt: string | null
  extracted_title: string | null
  extracted_description: string | null
  extracted_services: string[]
  extracted_products: string[]
  extracted_keywords: string[]
  extracted_audience: string | null
  extracted_locations: string[]
  extracted_ctas: string[]
  extracted_brand_tone: string | null
  extracted_offers: string[]
  extracted_social_proof: string | null
  confidence: number
  error_message: string | null
  scanned_at: string
}

const FETCH_TIMEOUT_MS = 8_000
const RAW_EXCERPT_CHARS = 1_500
const BODY_TEXT_CHARS = 4_000

/* ── HTML helpers ─────────────────────────────────────────── */

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return null
  const text = stripHtml(m[1]).slice(0, 200).trim()
  return text || null
}

function extractMetaDescription(html: string): string | null {
  const patterns = [
    /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["'](?:description|og:description)["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1].trim().slice(0, 320)
  }
  return null
}

function extractHeadings(html: string, max = 10): string[] {
  const results: string[] = []
  for (const tag of ['h1', 'h2', 'h3'] as const) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const text = stripHtml(m[1]).trim()
      if (text && text.length < 200) results.push(text.slice(0, 140))
      if (results.length >= max) return results
    }
  }
  return results
}

function extractBodyText(html: string): string {
  return stripHtml(html).slice(0, BODY_TEXT_CHARS)
}

/* ── Signal extraction ────────────────────────────────────── */

const SERVICE_HINTS = [
  'hizmet', 'hizmetler', 'çözüm', 'çözümler', 'paket', 'paketler', 'sunduğumuz',
  'ne yapıyoruz', 'kapsam', 'menü', 'tedavi', 'ders', 'eğitim', 'kurs', 'plan',
]
const PRODUCT_HINTS = [
  'ürün', 'ürünler', 'koleksiyon', 'kategori', 'sepete ekle', 'satın al',
  'shop', 'mağaza', 'fiyat', 'stok',
]
const CTA_HINTS = [
  'iletişime geç', 'bize ulaşın', 'hemen ara', 'whatsapp', 'randevu al', 'rezervasyon yap',
  'satın al', 'sepete ekle', 'kayıt ol', 'hemen başla', 'ücretsiz dene', 'teklif al',
  'bilgi al', 'demo iste',
]
const OFFER_HINTS = [
  'kampanya', 'indirim', 'fırsat', 'ücretsiz', 'sınırlı', 'taksit', 'erken kayıt',
  'erken rezervasyon', 'ilk sipariş', 'yenile',
]
const SOCIAL_PROOF_HINTS = [
  'yıllık', 'mutlu müşteri', 'referans', 'başarı', 'lider', 'ödüllü', 'sertifikalı',
  'iso ', 'akredite', 'lisanslı',
]

function extractKeywords(text: string, max = 18): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\sığüşöçİĞÜŞÖÇ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 5)
  const freq = new Map<string, number>()
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1)
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k)
}

function findHints(text: string, hints: string[], max = 6): string[] {
  const lower = text.toLowerCase()
  const out = new Set<string>()
  for (const h of hints) {
    const idx = lower.indexOf(h)
    if (idx >= 0) {
      // Take a small window around the hint
      const window = text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + 80)).trim()
      if (window) out.add(window.slice(0, 120))
      if (out.size >= max) break
    }
  }
  return Array.from(out)
}

function detectBrandTone(text: string): string | null {
  const lower = text.toLowerCase()
  if (/(kanka|reyiz|coşkulu|enerji)/.test(lower)) return 'samimi/heyecanlı'
  if (/(profesyonel|kurumsal|yaklaşım|standart)/.test(lower)) return 'profesyonel/kurumsal'
  if (/(uzman|akademik|bilimsel|kanıtlanmış)/.test(lower)) return 'uzman/teknik'
  if (/(sıcak|samimi|aile|sevgi)/.test(lower)) return 'sıcak/aile dostu'
  if (/(lüks|premium|özel seçkin|exclusive)/.test(lower)) return 'lüks/premium'
  return null
}

const TURKISH_CITIES_LOWER = [
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya', 'gaziantep',
  'mersin', 'kayseri', 'eskişehir', 'diyarbakır', 'trabzon', 'samsun', 'malatya',
  'kocaeli', 'gebze', 'denizli', 'şanlıurfa', 'hatay', 'mardin', 'van', 'sakarya',
  'erzurum', 'tekirdağ', 'ordu', 'rize', 'çorum', 'aydın', 'muğla',
]

function extractLocations(text: string, max = 6): string[] {
  const lower = text.toLowerCase()
  const found = new Set<string>()
  for (const city of TURKISH_CITIES_LOWER) {
    if (lower.includes(city)) {
      found.add(city.charAt(0).toLocaleUpperCase('tr-TR') + city.slice(1))
      if (found.size >= max) break
    }
  }
  return Array.from(found)
}

/* ── Confidence ───────────────────────────────────────────── */

function computeConfidence(parts: {
  hasTitle: boolean
  hasDescription: boolean
  bodyChars: number
  ctaCount: number
  keywordCount: number
}): number {
  let conf = 20
  if (parts.hasTitle) conf += 20
  if (parts.hasDescription) conf += 15
  if (parts.bodyChars > 800) conf += 15
  if (parts.bodyChars > 2000) conf += 10
  if (parts.ctaCount > 0) conf += 10
  if (parts.keywordCount > 5) conf += 10
  return Math.min(100, conf)
}

/* ── HTTP scanner (website / marketplace / google_business) ── */

async function scanHttp(input: SourceScanInput): Promise<SourceScanOutput> {
  const now = new Date().toISOString()
  const url = (input.source_url || '').trim()
  if (!url) {
    return {
      source_type: input.source_type,
      source_url: null,
      scan_status: 'skipped',
      raw_excerpt: null,
      extracted_title: null,
      extracted_description: null,
      extracted_services: [],
      extracted_products: [],
      extracted_keywords: [],
      extracted_audience: null,
      extracted_locations: [],
      extracted_ctas: [],
      extracted_brand_tone: null,
      extracted_offers: [],
      extracted_social_proof: null,
      confidence: 0,
      error_message: 'no_url',
      scanned_at: now,
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; YoAi-BusinessScanner/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return failed(input, now, `http_${res.status}`)
    }

    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      return failed(input, now, `unsupported_content_type:${ct.split(';')[0]}`)
    }

    const html = await res.text()
    const title = extractTitle(html)
    const description = extractMetaDescription(html)
    const headings = extractHeadings(html)
    const body = extractBodyText(html)
    const corpus = [title, description, headings.join(' '), body].filter(Boolean).join(' ').slice(0, BODY_TEXT_CHARS)

    const keywords = extractKeywords(corpus)
    const services = findHints(corpus, SERVICE_HINTS, 5)
    const products = findHints(corpus, PRODUCT_HINTS, 5)
    const ctas = findHints(corpus, CTA_HINTS, 5)
    const offers = findHints(corpus, OFFER_HINTS, 5)
    const proof = findHints(corpus, SOCIAL_PROOF_HINTS, 1)[0] || null
    const tone = detectBrandTone(corpus)
    const locations = extractLocations(corpus)

    const confidence = computeConfidence({
      hasTitle: !!title,
      hasDescription: !!description,
      bodyChars: body.length,
      ctaCount: ctas.length,
      keywordCount: keywords.length,
    })

    return {
      source_type: input.source_type,
      source_url: url,
      scan_status: 'completed',
      raw_excerpt: body.slice(0, RAW_EXCERPT_CHARS),
      extracted_title: title,
      extracted_description: description,
      extracted_services: services,
      extracted_products: products,
      extracted_keywords: keywords,
      extracted_audience: null,
      extracted_locations: locations,
      extracted_ctas: ctas,
      extracted_brand_tone: tone,
      extracted_offers: offers,
      extracted_social_proof: proof,
      confidence,
      error_message: null,
      scanned_at: now,
    }
  } catch (e) {
    clearTimeout(timeout)
    const msg = e instanceof Error ? e.message : 'unknown_error'
    return failed(input, now, msg.includes('aborted') ? 'timeout' : msg.slice(0, 200))
  }
}

function failed(input: SourceScanInput, now: string, error: string): SourceScanOutput {
  return {
    source_type: input.source_type,
    source_url: input.source_url || null,
    scan_status: 'failed',
    raw_excerpt: null,
    extracted_title: null,
    extracted_description: null,
    extracted_services: [],
    extracted_products: [],
    extracted_keywords: [],
    extracted_audience: null,
    extracted_locations: [],
    extracted_ctas: [],
    extracted_brand_tone: null,
    extracted_offers: [],
    extracted_social_proof: null,
    confidence: 0,
    error_message: error,
    scanned_at: now,
  }
}

/* ── Social scanner — provider-aware ───────────────────────── */

const SOCIAL_TYPES: SourceType[] = ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok']

async function scanSocial(input: SourceScanInput): Promise<SourceScanOutput> {
  const now = new Date().toISOString()
  const url = (input.source_url || '').trim()
  if (!url) {
    return failed(input, now, 'no_url')
  }

  // Sosyal scraper sağlayıcı kontrolü — APIFY token varsa Apify üzerinden,
  // yoksa fail. Sahte veri üretmiyoruz.
  const apifyToken = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN
  if (!apifyToken) {
    return failed(input, now, 'scraper_provider_missing')
  }

  // Apify entegrasyonu çok platform-spesifik (her ağ için ayrı actor).
  // Mevcut sürümde sosyal scraper yok — provider eksik kabul edilir.
  // Buraya ileride apifyCompetitorProvider benzeri bir helper bağlanacak.
  return failed(input, now, 'social_scraper_not_implemented')
}

/* ── Public API ───────────────────────────────────────────── */

export async function scanBusinessSource(input: SourceScanInput): Promise<SourceScanOutput> {
  const url = (input.source_url || '').trim()
  if (!url) {
    return {
      source_type: input.source_type,
      source_url: null,
      scan_status: 'skipped',
      raw_excerpt: null,
      extracted_title: null,
      extracted_description: null,
      extracted_services: [],
      extracted_products: [],
      extracted_keywords: [],
      extracted_audience: null,
      extracted_locations: [],
      extracted_ctas: [],
      extracted_brand_tone: null,
      extracted_offers: [],
      extracted_social_proof: null,
      confidence: 0,
      error_message: 'no_url',
      scanned_at: new Date().toISOString(),
    }
  }
  if (SOCIAL_TYPES.includes(input.source_type)) {
    return scanSocial(input)
  }
  // website / marketplace / google_business / extra → HTTP
  return scanHttp(input)
}

export async function scanBusinessSources(inputs: SourceScanInput[]): Promise<SourceScanOutput[]> {
  if (!inputs.length) return []
  const tasks = inputs.map((i) =>
    scanBusinessSource(i).catch((e) => failed(i, new Date().toISOString(), e instanceof Error ? e.message : 'task_error')),
  )
  return Promise.all(tasks)
}
