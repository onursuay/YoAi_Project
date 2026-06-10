import 'server-only'
import * as cheerio from 'cheerio'
import type { BusinessAnalysis, DetectedAction, RecommendedEvent, SiteScanResult } from './types'
import { STANDARD_EVENTS, type StandardEventKey } from './constants'
import { claudeJson, isClaudeReady } from '@/lib/anthropic/text'

/**
 * Scans a website with Firecrawl v2 (https://api.firecrawl.dev) to detect
 * conversion-worthy actions (purchase / add-to-cart / search / lead forms /
 * sign-up / video) and map them to the STANDARD_EVENTS catalog.
 *
 * Strategy:
 *   1. /v2/crawl with a bounded page limit → discover up to ~20 pages of the
 *      site, returning each page's HTML + links.
 *   2. For every crawled page, run deterministic HTML heuristics to detect
 *      actions and tally them into recommended events.
 *
 * Real Firecrawl calls only. If FIRECRAWL_API_KEY is missing this throws — we
 * never fabricate a scan result.
 */

const FIRECRAWL_BASE = 'https://api.firecrawl.dev'
const MAX_PAGES = 20
// Firecrawl crawl is async; poll its status until done (or until we hit the cap).
const CRAWL_POLL_INTERVAL_MS = 2500
const CRAWL_MAX_POLLS = 20 // ~50s ceiling — stays under serverless limits

interface FirecrawlPage {
  html?: string
  rawHtml?: string
  markdown?: string
  links?: string[]
  metadata?: { sourceURL?: string; url?: string; statusCode?: number }
}

interface CrawlStartResponse {
  success?: boolean
  id?: string
  url?: string
  error?: string
}

interface CrawlStatusResponse {
  success?: boolean
  status?: 'scraping' | 'completed' | 'failed' | 'cancelled'
  total?: number
  completed?: number
  data?: FirecrawlPage[]
  next?: string
  error?: string
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Best page URL for an action source label. */
function pageUrl(page: FirecrawlPage, fallback: string): string {
  return page.metadata?.sourceURL || page.metadata?.url || fallback
}

// ─── 3. Parti eklenti / widget tespiti ───────────────────────────────────────
// Live chat, rezervasyon motoru, e-ticaret platformları gibi bilinen widget'ları
// script src / inline HTML üzerinden tespit eder. Widget bulununca o eklentinin
// SAĞLADIĞI event'ler kanıt havuzuna eklenir (örn. JivoChat → WhatsApp/telefon/
// e-posta/lead; HotelRunner → purchase/checkout). Claude'a da eklenti listesi
// kanıt olarak verilir → "site search yok ama WhatsApp widget var" gibi
// durumlar isabetli yakalanır.
interface KnownPlugin {
  name: string
  pattern: RegExp
  events: StandardEventKey[]
  description: string
}

const KNOWN_PLUGINS: KnownPlugin[] = [
  // ── Canlı sohbet / iletişim widget'ları ──
  {
    name: 'JivoChat',
    pattern: /jivochat\.com|jivosite\.com|node\.jivosite/i,
    events: ['contact_whatsapp', 'contact_phone', 'contact_email', 'lead'],
    description: 'JivoChat çok kanallı sohbet eklentisi (WhatsApp, telefon, e-posta, form üzerinden iletişim)',
  },
  { name: 'Tawk.to', pattern: /tawk\.to/i, events: ['lead'], description: 'Tawk.to canlı sohbet' },
  { name: 'Drift', pattern: /drift\.com\/embed/i, events: ['lead'], description: 'Drift canlı sohbet' },
  { name: 'Intercom', pattern: /widget\.intercom\.io|intercomcdn/i, events: ['lead'], description: 'Intercom mesajlaşma' },
  { name: 'Crisp', pattern: /client\.crisp\.chat/i, events: ['lead'], description: 'Crisp canlı sohbet' },
  { name: 'LiveChat', pattern: /cdn\.livechatinc\.com/i, events: ['lead'], description: 'LiveChat canlı sohbet' },
  { name: 'Zendesk Chat', pattern: /zopim\.com|zdassets\.com\/ekr/i, events: ['lead'], description: 'Zendesk canlı sohbet' },
  { name: 'Tidio', pattern: /code\.tidio\.co/i, events: ['lead'], description: 'Tidio canlı sohbet' },
  {
    name: 'HubSpot Chat',
    pattern: /js\.hs-scripts\.com|js\.hsforms\.net|hubspot\.com\/messages/i,
    events: ['lead'],
    description: 'HubSpot canlı sohbet / form',
  },
  {
    name: 'Facebook Messenger Customer Chat',
    pattern: /fb-customer-chat|customerchat\.js/i,
    events: ['contact_messenger', 'lead'],
    description: 'Facebook Messenger Customer Chat',
  },
  {
    name: 'WhatsApp Chat Widget',
    pattern: /wa-widget|whatsapp-chat-widget|wp-whatsapp/i,
    events: ['contact_whatsapp'],
    description: 'WhatsApp sohbet widget\'ı',
  },
  // ── Rezervasyon / sipariş motorları ──
  {
    name: 'HotelRunner',
    pattern: /hotelrunner\.com/i,
    events: ['reservation', 'begin_checkout', 'add_payment_info', 'purchase'],
    description: 'HotelRunner rezervasyon motoru (otel/konaklama; rezervasyon + online ödeme)',
  },
  {
    name: 'Booking.com Widget',
    pattern: /booking\.com\/widget/i,
    events: ['reservation', 'begin_checkout'],
    description: 'Booking.com rezervasyon widget\'ı',
  },
  {
    name: 'OpenTable',
    pattern: /opentable\.com\/widget/i,
    events: ['reservation', 'lead'],
    description: 'OpenTable restoran rezervasyon widget\'ı',
  },
  {
    name: 'Calendly',
    pattern: /calendly\.com\/embed|assets\.calendly\.com/i,
    events: ['reservation', 'lead'],
    description: 'Calendly randevu/toplantı planlayıcı (randevu = rezervasyon)',
  },
  // ── Randevu platformları (2. parti — temsili; uzun kuyruk AI + genel kural ile) ──
  { name: 'Setmore', pattern: /setmore\.com/i, events: ['reservation'], description: 'Setmore randevu sistemi' },
  { name: 'SimplyBook.me', pattern: /simplybook\.(me|it)/i, events: ['reservation'], description: 'SimplyBook randevu sistemi' },
  { name: 'Acuity Scheduling', pattern: /acuityscheduling\.com|squarespace-scheduling/i, events: ['reservation'], description: 'Acuity Scheduling randevu' },
  { name: 'Fresha', pattern: /fresha\.com/i, events: ['reservation'], description: 'Fresha randevu/booking (kuaför/güzellik)' },
  { name: 'Booksy', pattern: /booksy\.com/i, events: ['reservation'], description: 'Booksy randevu sistemi' },
  { name: 'Mindbody', pattern: /mindbodyonline\.com|mindbody\.io/i, events: ['reservation'], description: 'Mindbody rezervasyon/randevu (spor/wellness)' },
  { name: 'Reservio', pattern: /reservio\.com/i, events: ['reservation'], description: 'Reservio randevu sistemi' },
  { name: 'YouCanBook.me', pattern: /youcanbook\.me/i, events: ['reservation'], description: 'YouCanBook.me randevu' },
  { name: 'Cal.com', pattern: /\bcal\.com\/|app\.cal\.com/i, events: ['reservation'], description: 'Cal.com randevu planlayıcı' },
  { name: 'Bookeo', pattern: /bookeo\.com/i, events: ['reservation'], description: 'Bookeo rezervasyon sistemi' },
  { name: 'Amelia Booking', pattern: /ameliabooking|wpamelia/i, events: ['reservation'], description: 'Amelia (WordPress randevu eklentisi)' },
  { name: 'Bookly', pattern: /booklyplugin|bookly-/i, events: ['reservation'], description: 'Bookly (WordPress randevu eklentisi)' },
  { name: 'Timify', pattern: /timify\.com/i, events: ['reservation'], description: 'Timify randevu sistemi' },
  // ── Restoran rezervasyon platformları ──
  { name: 'TheFork', pattern: /thefork\.com|lafourchette/i, events: ['reservation', 'lead'], description: 'TheFork restoran rezervasyonu' },
  { name: 'Resy', pattern: /resy\.com/i, events: ['reservation'], description: 'Resy restoran rezervasyonu' },
  { name: 'SevenRooms', pattern: /sevenrooms\.com/i, events: ['reservation'], description: 'SevenRooms restoran rezervasyonu' },
  { name: 'Quandoo', pattern: /quandoo\./i, events: ['reservation'], description: 'Quandoo restoran rezervasyonu' },
  // ── Otel/konaklama rezervasyon motorları (booking engines) ──
  { name: 'SiteMinder', pattern: /siteminder\.com|thebookingbutton/i, events: ['reservation', 'begin_checkout', 'purchase'], description: 'SiteMinder otel rezervasyon motoru' },
  { name: 'SynXis', pattern: /synxis\.com/i, events: ['reservation', 'begin_checkout', 'purchase'], description: 'SynXis (Sabre) otel rezervasyon motoru' },
  { name: 'Cloudbeds', pattern: /cloudbeds\.com|hotels\.cloudbeds/i, events: ['reservation', 'begin_checkout', 'purchase'], description: 'Cloudbeds otel rezervasyon motoru' },
  { name: 'TravelClick', pattern: /travelclick\.com|ibe\.travelclick/i, events: ['reservation', 'begin_checkout', 'purchase'], description: 'TravelClick (Amadeus) otel motoru' },
  { name: 'Lodgify', pattern: /lodgify\.com/i, events: ['reservation', 'begin_checkout', 'purchase'], description: 'Lodgify konaklama rezervasyon motoru' },
  { name: 'Smoobu', pattern: /smoobu\.com/i, events: ['reservation', 'begin_checkout'], description: 'Smoobu konaklama rezervasyonu' },
  { name: 'Beds24', pattern: /beds24\.com/i, events: ['reservation', 'begin_checkout'], description: 'Beds24 rezervasyon motoru' },
  // ── Türkiye otel rezervasyon motorları ──
  { name: 'Elektra Web', pattern: /elektraweb\.com|elektraweb/i, events: ['reservation', 'begin_checkout', 'purchase'], description: 'Elektra Web otel rezervasyon motoru (TR)' },
  { name: 'Sejour', pattern: /sejour\.com\.tr/i, events: ['reservation', 'begin_checkout'], description: 'Sejour otel rezervasyon motoru (TR)' },
  { name: 'Odamax', pattern: /odamax\.com/i, events: ['reservation', 'begin_checkout'], description: 'Odamax otel rezervasyon motoru (TR)' },
  { name: 'Hotech', pattern: /hotech\.systems/i, events: ['reservation', 'begin_checkout'], description: 'Hotech otel sistemleri (TR)' },
  // ── E-ticaret platformları ──
  {
    name: 'Shopify',
    pattern: /cdn\.shopify\.com|shopify\.com\/shop/i,
    events: ['purchase', 'add_to_cart', 'begin_checkout', 'add_payment_info'],
    description: 'Shopify e-ticaret altyapısı',
  },
  {
    name: 'WooCommerce',
    pattern: /woocommerce|wc-ajax|wc-cart-fragments/i,
    events: ['purchase', 'add_to_cart', 'begin_checkout', 'add_payment_info'],
    description: 'WooCommerce e-ticaret (WordPress eklentisi)',
  },
  {
    name: 'İdeasoft',
    pattern: /ideasoft\.com\.tr|ideacdn\.net/i,
    events: ['purchase', 'add_to_cart', 'begin_checkout', 'add_payment_info'],
    description: 'İdeaSoft e-ticaret platformu',
  },
  {
    name: 'Ticimax',
    pattern: /ticimax\.com\.tr|ticimax\.com/i,
    events: ['purchase', 'add_to_cart', 'begin_checkout', 'add_payment_info'],
    description: 'Ticimax e-ticaret platformu',
  },
  // ── Form eklentileri ──
  {
    name: 'Contact Form 7',
    pattern: /contact-form-7|wpcf7-form/i,
    events: ['lead'],
    description: 'Contact Form 7 (WordPress iletişim formu)',
  },
  {
    name: 'WPForms',
    pattern: /wpforms-confirmation|wpforms\.com/i,
    events: ['lead'],
    description: 'WPForms (WordPress form eklentisi)',
  },
]

function detectPlugins(html: string): KnownPlugin[] {
  const found: KnownPlugin[] = []
  for (const plugin of KNOWN_PLUGINS) {
    if (plugin.pattern.test(html)) found.push(plugin)
  }
  return found
}

// ─── Detection heuristics ─────────────────────────────────────────────────────
// Each rule inspects normalized page HTML (lowercased) and emits zero or more
// DetectedAction entries. Confidence reflects how unambiguous the signal is.

interface Rule {
  event: StandardEventKey
  via: string
  confidence: number
  /** Returns true if the (lowercased) html exhibits the signal. */
  test: (html: string) => boolean
}

// CTA / button text patterns. Cover EN + TR e-commerce vocabulary since the
// product serves Turkish merchants.
const RULES: Rule[] = [
  // Purchase — strongest commerce intent.
  {
    event: 'purchase',
    via: 'cta',
    confidence: 0.9,
    test: (h) =>
      /(?:complete\s+(?:purchase|order)|place\s+order|buy\s+now|pay\s+now|confirm\s+(?:order|payment))/.test(h) ||
      /(sat[ıi]n\s+al|hemen\s+al|sipari[sş]i?\s+(?:tamamla|onayla)|[öo]demeyi?\s+tamamla|sipari[sş]\s+ver)/.test(h),
  },
  // Begin checkout.
  {
    event: 'begin_checkout',
    via: 'checkout',
    confidence: 0.85,
    test: (h) =>
      /(?:proceed\s+to\s+checkout|go\s+to\s+checkout|checkout|secure\s+checkout)/.test(h) ||
      /(?:[öo]demeye\s+ge[cç]|sepeti\s+onayla|kasa(?:ya)?\s+(?:git|ge[cç])|al[ıi][sş]veri[sş]i\s+tamamla)/.test(h) ||
      /href=["'][^"']*\/(checkout|cart\/checkout|odeme|sepet\/odeme)/.test(h),
  },
  // Add payment info — payment form/fields.
  {
    event: 'add_payment_info',
    via: 'form',
    confidence: 0.7,
    test: (h) =>
      /(?:card\s*number|cardnumber|cc-number|credit\s*card|payment\s*(?:method|details|information))/.test(h) ||
      /(?:kart\s*numaras[ıi]|kredi\s*kart[ıi]|[öo]deme\s*bilgileri|[öo]deme\s*y[öo]ntemi)/.test(h) ||
      /autocomplete=["']cc-(?:number|exp|csc)["']/.test(h),
  },
  // Add to cart.
  {
    event: 'add_to_cart',
    via: 'cta',
    confidence: 0.85,
    test: (h) =>
      /(?:add\s+to\s+(?:cart|bag|basket)|add-to-cart|addtocart|data-add-to-cart)/.test(h) ||
      /(?:sepete\s+ekle|sepete\s+at|sepete-ekle)/.test(h),
  },
  // Lead — contact / quote / demo forms.
  {
    event: 'lead',
    via: 'form',
    confidence: 0.75,
    test: (h) =>
      /(?:contact\s+(?:us|form)|get\s+a\s+quote|request\s+(?:a\s+)?(?:quote|demo|callback)|free\s+(?:quote|consultation))/.test(h) ||
      /(?:teklif\s+al|bize\s+ula[sş][ıi]n|[ıi]leti[sş]im\s+formu|geri\s+aranma|[uü]cretsiz\s+(?:teklif|dan[ıi][sş]ma)|ba[sş]vuru\s+formu)/.test(h) ||
      /(?:type=["']tel["'])/.test(h),
  },
  // Sign up / register.
  {
    event: 'sign_up',
    via: 'form',
    confidence: 0.8,
    test: (h) =>
      /(?:sign\s*up|sign-up|signup|create\s+(?:an\s+)?account|register(?:\s+now)?|join\s+(?:us|now))/.test(h) ||
      /(?:[üu]ye\s+ol|kay[ıi]t\s+ol|hesap\s+olu[sş]tur|yeni\s+[üu]yelik)/.test(h),
  },
  // Rezervasyon / randevu — booking/appointment intent (otel, klinik, restoran,
  // hizmet/danışmanlık randevusu). Meta 'Schedule' event'ine map'lenir.
  // GENEL içerik taramasıyla yakalanır: sitenin KENDİ özel formu, tarih seçici,
  // CTA metni veya HERHANGİ bir 2. parti randevu/booking sistemi — tanıdık eklenti
  // ŞART DEĞİL (uzun kuyruk ayrıca Claude AI analiziyle yakalanır).
  {
    event: 'reservation',
    via: 'cta',
    confidence: 0.85,
    test: (h) =>
      // EN — booking/appointment CTA'ları
      /(?:book\s+(?:now|online|today|your\s+(?:stay|room|table|appointment|visit|spot)|a\s+(?:room|table|stay|appointment|visit|tour|consultation|class|session))|make\s+(?:an?\s+)?(?:reservation|booking|appointment)|reserve\s+(?:now|today|your\s+(?:spot|seat|table|room|stay)|a\s+(?:room|table|seat|spot))|schedule\s+(?:an?\s+)?(?:visit|appointment|consultation|call|tour|viewing|demo|meeting)|request\s+(?:an?\s+)?(?:booking|appointment|reservation)|check\s+availability|book\s+an\s+appointment)/.test(h) ||
      // TR — randevu/rezervasyon CTA'ları
      /(?:rezervasyon\s+(?:yap|olu[sş]tur|talebi|iste|formu)|(?:oda|masa|online|otel|u[cç]ak|tur|villa)\s+rezervasyon|m[üu]sait(?:lik)?\s+(?:sorgula|kontrol|durumu)|randevu\s+(?:al|olu[sş]tur|talebi?|iste|sistemi|formu)|online\s+randevu|hemen\s+(?:rezervasyon|randevu)|g[öo]r[üu][sş]me\s+(?:planla|ayarla|talebi)|yer\s+ay[ıi]rt|masa\s+(?:ay[ıi]rt|rezerve)|konaklama\s+tarih)/.test(h) ||
      // URL hedefleri (sayfa/buton)
      /href=["'][^"']*\/(rezervasyon|reservation|booking|book|randevu|appointment|reserve|musaitlik|availability|book-?now|book-?a)/.test(h) ||
      // Yapısal booking widget sinyalleri — tarih aralığı / giriş-çıkış alanları
      // (özel rezervasyon formları ve otel motorlarının ortak imzası).
      /(?:name|id|class)=["'][^"']*(?:check[\s_-]?in|check[\s_-]?out|checkin|checkout|arrival|departure|date-?range|daterange|giris[_-]?tarih|cikis[_-]?tarih|rezervasyon|randevu|booking|datepicker[^"']*book)/.test(h) ||
      /(?:giri[sş]\s+tarihi|[cç][ıi]k[ıi][sş]\s+tarihi|geli[sş]\s+tarihi|ayr[ıi]l[ıi][sş]\s+tarihi|check[\s-]?in\s+date|check[\s-]?out\s+date|arrival\s+date|departure\s+date)/.test(h),
  },
  // Video player presence.
  {
    event: 'video_play',
    via: 'video',
    confidence: 0.6,
    test: (h) =>
      /(?:<video[\s>]|youtube\.com\/embed|player\.vimeo\.com|wistia|<iframe[^>]+(?:youtube|vimeo))/.test(h),
  },
  // ── İletişim kanalları ──────────────────────────────────────────────────────
  // Bu hedefler sitenin kendi kodunda VEYA chat/click-to-chat eklentilerinin
  // enjekte ettiği link/butonlarda bulunur. Tıklanabilir öğelerin hedef+metni de
  // haystack'e katıldığı için eklenti butonları da yakalanır.
  // WhatsApp — wa.me / api.whatsapp.com / whatsapp:// (kesin sinyal, yüksek güven).
  {
    event: 'contact_whatsapp',
    via: 'chat',
    confidence: 0.9,
    test: (h) =>
      /(?:wa\.me\/|wa\.link\/|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send|whatsapp:\/\/send)/.test(h),
  },
  // Messenger — m.me / messenger.com/t / fb-messenger://
  {
    event: 'contact_messenger',
    via: 'chat',
    confidence: 0.85,
    test: (h) => /(?:m\.me\/|messenger\.com\/t\/|fb-messenger:\/\/)/.test(h),
  },
  // Instagram DM — ig.me / instagram.com/direct
  {
    event: 'contact_instagram',
    via: 'chat',
    confidence: 0.8,
    test: (h) => /(?:ig\.me\/m\/|ig\.me\/|instagram\.com\/direct)/.test(h),
  },
  // Telefon — tel: / callto: (footer'da yaygın → daha düşük güven).
  {
    event: 'contact_phone',
    via: 'call',
    confidence: 0.65,
    test: (h) => /(?:href=["']tel:|["'`]tel:\+?\d|callto:\+?\d)/.test(h),
  },
  // E-posta — mailto: (footer'da yaygın → daha düşük güven).
  {
    event: 'contact_email',
    via: 'email',
    confidence: 0.6,
    test: (h) => /mailto:[^"'\s]+@/.test(h),
  },
]

function detectOnPage(rawHtml: string, source: string): DetectedAction[] {
  const html = rawHtml.toLowerCase()
  const actions: DetectedAction[] = []
  const seen = new Set<string>()
  for (const rule of RULES) {
    if (rule.test(html)) {
      const dedupeKey = `${rule.event}|${rule.via}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      actions.push({ event: rule.event, source, via: rule.via, confidence: rule.confidence })
    }
  }
  return actions
}

// ─── Tıklanabilir öğe çıkarma (gerçek DOM) ───────────────────────────────────
// Render edilmiş HTML'den TÜM tıklanabilir öğeleri (a, button, [onclick],
// [data-href]) çıkarır — sitenin KENDİ kodu + chat/click-to-chat EKLENTİLERİNİN
// enjekte ettiği butonlar dahil. Kullanıcının F12 console script'inin sunucu eşdeğeri:
//   document.querySelectorAll('a, button, [onclick], [data-href]')
export interface ClickableElement {
  tag: string
  text: string
  target: string
}

function extractClickables(rawHtml: string): ClickableElement[] {
  let $: ReturnType<typeof cheerio.load>
  try {
    $ = cheerio.load(rawHtml)
  } catch {
    return []
  }
  const out: ClickableElement[] = []
  $('a, button, [onclick], [data-href]').each((_i, el) => {
    const $el = $(el)
    const node = el as { tagName?: string; name?: string }
    const tag = String(node.tagName ?? node.name ?? '').toLowerCase()
    const text = $el.text().replace(/\s+/g, ' ').trim().slice(0, 80)
    const target = ($el.attr('href') || $el.attr('onclick') || $el.attr('data-href') || '').slice(0, 300)
    if (text || target) out.push({ tag, text, target })
  })
  return out
}

// ─── Page summary (Claude için sayfa özeti) ──────────────────────────────────
interface PageSummary {
  url: string
  title: string
  description: string
  textExcerpt: string
}

function summarizePage(page: FirecrawlPage, fallbackUrl: string): PageSummary {
  const html = page.rawHtml || page.html || ''
  const url = pageUrl(page, fallbackUrl)
  let title = ''
  let description = ''
  let textExcerpt = ''
  try {
    const $ = cheerio.load(html)
    title =
      $('title').first().text().trim().slice(0, 200) ||
      $('h1').first().text().trim().slice(0, 200)
    description =
      $('meta[name="description"]').attr('content')?.trim().slice(0, 250) ||
      $('meta[property="og:description"]').attr('content')?.trim().slice(0, 250) ||
      ''
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
    textExcerpt = bodyText.slice(0, 600)
  } catch {
    /* best-effort */
  }
  if (page.markdown && page.markdown.length > textExcerpt.length) {
    textExcerpt = page.markdown.replace(/\s+/g, ' ').trim().slice(0, 600)
  }
  return { url, title, description, textExcerpt }
}

// ─── AI analizi (Claude birincil) ────────────────────────────────────────────
// Claude'a sitenin sayfa içerikleri + tıklanabilir öğeler + deterministik
// algılanan event'ler verilir. Claude işletme türünü belirler ve KANIT-TEMELLİ
// öneriler üretir (reason zorunlu). Kanıtsız event önermez (örn. site search
// yoksa view_search_results önerme). ANTHROPIC_API_KEY yoksa null → çağıran
// deterministik fallback'e düşer.
interface AnalyzeArgs {
  siteUrl: string
  pageSummaries: PageSummary[]
  clickables: ClickableElement[]
  detectedEvents: StandardEventKey[]
  detectedPlugins: KnownPlugin[]
}

interface AnalyzeResult {
  businessAnalysis: BusinessAnalysis
  recommended: RecommendedEvent[]
}

// Shared prompt builder: hem Claude hem OpenAI aynı kuralları ve aynı kanıt
// havuzunu görsün ki cevaplar tutarlı olsun.
function buildAnalysisPrompt(args: AnalyzeArgs): { system: string; user: string; validKeys: string[] } {
  // Tıklanabilir öğeleri dedup + ilk 60.
  const seen = new Set<string>()
  const sample: ClickableElement[] = []
  for (const c of args.clickables) {
    const k = `${c.text}|${c.target}`.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    sample.push(c)
    if (sample.length >= 60) break
  }

  const validKeys = STANDARD_EVENTS.map((e) => e.key)
  const eventsMenu = STANDARD_EVENTS.map(
    (e) => `- ${e.key}: GA4=${e.ga4Event} / Meta=${e.metaEvent}`,
  ).join('\n')

  const pagesText = args.pageSummaries
    .slice(0, 5)
    .map(
      (p) =>
        `URL: ${p.url}\nBaşlık: ${p.title}\nMeta: ${p.description}\nİçerik: ${p.textExcerpt}`,
    )
    .join('\n---\n')

  const clickList = sample
    .map((c, i) => `${i + 1}. <${c.tag}> "${c.text}" -> ${c.target}`)
    .join('\n')

  const pluginsText = args.detectedPlugins.length
    ? args.detectedPlugins.map((p) => `- ${p.name}: ${p.description}`).join('\n')
    : '(tespit edilmedi)'

  const system =
    "Sen profesyonel bir dijital pazarlama analistisin. Sana bir web sitesinin sayfa " +
    "içerikleri, tıklanabilir öğeleri, kullandığı 3. parti widget/eklentiler ve " +
    "algılanan aksiyonları verilecek. Hedef: GA4/Meta ölçümleme için izlenmesi GERÇEKTEN " +
    "anlamlı event'leri seç ve her seçimi kanıta dayandır.\n\n" +
    'KESİN KURALLAR:\n' +
    '1) Yalnız sana verilen event anahtar listesinden seç (geçersiz anahtar üretme).\n' +
    "2) businessType: TR olarak somut bir ifade (örn. 'İnşaat firması', 'Hizmet sitesi', " +
    "'E-ticaret', 'Otel/Konaklama', 'Restoran', 'B2B SaaS', 'Yerel hizmet sağlayıcı'). Tek satır.\n" +
    '3) businessSummary: 1-2 cümle TR özet — site ne yapıyor, kimlere hitap ediyor.\n' +
    "4) KANITSIZ event ÖNERME. Site arama (input[type=search]) yoksa view_search_results " +
    'önerme. Sepet/checkout yoksa add_to_cart/begin_checkout/add_payment_info önerme. ' +
    'wa.me/m.me/ig.me/tel: yoksa ilgili iletişim event\'ini önerme.\n' +
    "5) Eklenti tespiti güçlü kanıttır — örn. 'JivoChat varsa' WhatsApp/telefon/e-posta " +
    "üzerinden iletişim event'leri MUHTEMELEN mevcuttur; 'HotelRunner/Booking/OpenTable/Calendly " +
    "varsa' rezervasyon/randevu vardır; 'WooCommerce varsa' sepet/checkout/satın alma. " +
    'Bu sinyalleri reason\'a yansıt.\n' +
    "6) REZERVASYON/RANDEVU TESPİTİ (ÖNEMLİ): Site içeriğinde randevu/rezervasyon " +
    "mekanizması varsa 'reservation' (Meta Schedule) öner — TANIDIK bir eklenti/widget " +
    "OLMASA BİLE. Bu kararı sitenin GERÇEK içeriğinden ve butonlarından ver. Sinyaller: " +
    "'Randevu Al/Oluştur', 'Rezervasyon Yap', 'Müsaitlik Sorgula', 'Online Randevu', " +
    "'Book Now/Make an Appointment', tarih seçici veya giriş-çıkış (check-in/check-out) " +
    "alanları, /rezervasyon /randevu /booking sayfaları, sitenin KENDİ ÖZEL rezervasyon " +
    "formu ya da HERHANGİ bir 2. parti randevu/booking sistemi. Otel, klinik, güzellik/" +
    "kuaför, restoran, danışmanlık, kiralama gibi işlerde bu güçlü bir dönüşüm sinyalidir. " +
    "Sitede online ÖDEME de varsa (ödeme formu/checkout) AYRICA 'purchase' öner — ikisi " +
    "birlikte olabilir. Yalnız fiziksel ürün satan e-ticarette rezervasyon önerme.\n" +
    "7) 'video_play' DÜŞÜK DEĞERLİDİR — yalnız sitede gömülü video VARLIĞI dönüşüm değildir. " +
    "İşin merkezinde video yoksa (ör. video kurs/yayın platformu) ÖNERME.\n" +
    "8) Her öneriye reason: gerçek kanıt TR cümle (örn. 'HotelRunner rezervasyon motoru entegre', " +
    "'Footer'da wa.me linki var', 'Rezervasyon Yap butonu /rezervasyon adresine yönlendiriyor').\n" +
    '9) Maksimum 6 öneri; confidence 0-1 arası gerçekçi.'

  const user =
    `Site: ${args.siteUrl}\n` +
    `Taranan sayfa sayısı: ${args.pageSummaries.length}\n\n` +
    `Sayfa içerikleri:\n${pagesText}\n\n` +
    `Tıklanabilir öğeler (örnek):\n${clickList}\n\n` +
    `Tespit edilen 3. parti eklenti / widget'lar:\n${pluginsText}\n\n` +
    `Deterministik kuralların algıladığı event'ler: ${args.detectedEvents.join(', ') || '(yok)'}\n\n` +
    `Geçerli event listesi:\n${eventsMenu}\n\n` +
    'JSON döndür: {"businessType":"...","businessSummary":"...","recommended":' +
    '[{"event":"lead","confidence":0.85,"reason":"..."}]}'

  return { system, user, validKeys }
}

/** Claude/OpenAI'dan dönen ham JSON'u AnalyzeResult'a normalize eder; geçersizse null. */
function parseAnalysisResult(
  raw: {
    businessType?: string
    businessSummary?: string
    recommended?: { event?: string; confidence?: number; reason?: string }[]
  } | null,
  validKeys: string[],
): AnalyzeResult | null {
  if (!raw || !raw.businessType || !Array.isArray(raw.recommended)) return null

  const recommended: RecommendedEvent[] = []
  const seenEvents = new Set<string>()
  for (const r of raw.recommended) {
    if (typeof r?.event !== 'string') continue
    if (!validKeys.includes(r.event)) continue
    if (seenEvents.has(r.event)) continue
    seenEvents.add(r.event)
    const confidence = Math.max(0, Math.min(1, Number(r.confidence) || 0.7))
    recommended.push({
      event: r.event as StandardEventKey,
      hits: 1,
      confidence: Number(confidence.toFixed(2)),
      reason: (r.reason || '').toString().trim().slice(0, 300) || undefined,
    })
  }

  return {
    businessAnalysis: {
      type: raw.businessType.trim().slice(0, 100),
      summary: (raw.businessSummary || '').toString().trim().slice(0, 400),
    },
    recommended,
  }
}

/** Birincil: Claude. Anahtar yoksa/hatalıysa null. */
async function claudeAnalyzeSite(args: AnalyzeArgs): Promise<AnalyzeResult | null> {
  if (!isClaudeReady()) return null
  const { system, user, validKeys } = buildAnalysisPrompt(args)
  const raw = await claudeJson<{
    businessType: string
    businessSummary: string
    recommended: { event: string; confidence: number; reason: string }[]
  }>({ system, user, maxTokens: 1500, temperature: 0, timeoutMs: 45000 })
  return parseAnalysisResult(raw, validKeys)
}

/**
 * Yedek: OpenAI (ChatGPT). Claude yetersiz kaldığında devreye girer.
 * OPENAI_API_KEY yoksa veya hata olursa null → çağıran deterministik fallback'e düşer.
 */
async function openaiAnalyzeSite(args: AnalyzeArgs): Promise<AnalyzeResult | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const { system, user, validKeys } = buildAnalysisPrompt(args)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL_SITE_SCAN || 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[openai:site-scan] error', res.status, errText.slice(0, 200))
      return null
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data?.choices?.[0]?.message?.content
    if (!content) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return null
    }
    return parseAnalysisResult(
      parsed as Parameters<typeof parseAnalysisResult>[0],
      validKeys,
    )
  } catch (e) {
    console.error(
      '[openai:site-scan] exception',
      e instanceof Error ? e.message : String(e),
    )
    return null
  }
}

/**
 * AI orkestratörü: Önce Claude'a sor. Claude erişilemez/yetersiz kalırsa
 * (anahtar yok, hata, boş öneri) ChatGPT'ye düş. İkisi de boş dönerse null →
 * çağıran (scanSite) deterministik buildRecommended fallback'ine geçer.
 */
async function aiAnalyzeSite(args: AnalyzeArgs): Promise<AnalyzeResult | null> {
  const claudeResult = await claudeAnalyzeSite(args)
  if (claudeResult && claudeResult.recommended.length > 0) return claudeResult
  const openaiResult = await openaiAnalyzeSite(args)
  return openaiResult
}

/** Build deduped recommendedEvents from the full detectedActions list. */
function buildRecommended(actions: DetectedAction[]): RecommendedEvent[] {
  const byEvent = new Map<StandardEventKey, { hits: number; maxConfidence: number }>()
  for (const a of actions) {
    // video_play düşük değerli pasif sinyal — otomatik ÖNERME (manuel seçilebilir).
    if (a.event === 'video_play') continue
    const cur = byEvent.get(a.event)
    if (cur) {
      cur.hits += 1
      cur.maxConfidence = Math.max(cur.maxConfidence, a.confidence)
    } else {
      byEvent.set(a.event, { hits: 1, maxConfidence: a.confidence })
    }
  }
  const recommended: RecommendedEvent[] = []
  for (const [event, { hits, maxConfidence }] of byEvent) {
    // More hits → higher confidence, capped at the rule's own ceiling.
    const confidence = Math.min(1, maxConfidence + Math.min(0.1, (hits - 1) * 0.02))
    recommended.push({ event, hits, confidence: Number(confidence.toFixed(2)) })
  }
  // Sort by hits desc, then confidence desc for a stable, useful order.
  recommended.sort((a, b) => b.hits - a.hits || b.confidence - a.confidence)
  return recommended
}

function normalizeSiteUrl(siteUrl: string): string {
  const trimmed = (siteUrl || '').trim()
  if (!trimmed) throw new Error('marketing_setup_scan_no_url')
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export async function scanSite(siteUrl: string): Promise<SiteScanResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not configured — cannot scan site.')
  }

  const url = normalizeSiteUrl(siteUrl)

  // ── 1. Kick off a bounded crawl ──────────────────────────────────────────
  const startRes = await fetch(`${FIRECRAWL_BASE}/v2/crawl`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      url,
      limit: MAX_PAGES,
      crawlEntireDomain: false,
      scrapeOptions: {
        // rawHtml gives us the full markup needed for heuristic detection;
        // links lets us account for checkout/cart routes referenced via href.
        formats: ['rawHtml', 'links'],
        onlyMainContent: false,
        // Chat / click-to-chat (WhatsApp, telefon, Instagram DM) eklenti butonları
        // client-side JS ile enjekte edilir; render bitmeden HTML alınırsa wa.me/tel
        // linkleri rawHtml+links'te HİÇ görünmez. Render için bekle (eklenti tespiti şart).
        waitFor: 3500,
      },
    }),
  })

  if (!startRes.ok) {
    const body = await startRes.text().catch(() => '')
    throw new Error(`Firecrawl crawl start failed (${startRes.status}): ${body.slice(0, 300)}`)
  }

  const startJson = (await startRes.json()) as CrawlStartResponse
  if (!startJson.id) {
    throw new Error(`Firecrawl crawl start returned no job id: ${startJson.error ?? 'unknown error'}`)
  }
  const jobId = startJson.id

  // ── 2. Poll the crawl until it completes (or we hit the cap) ──────────────
  const pages: FirecrawlPage[] = []
  let truncated = false
  let finalStatus: CrawlStatusResponse['status'] = 'scraping'

  for (let i = 0; i < CRAWL_MAX_POLLS; i++) {
    await sleep(CRAWL_POLL_INTERVAL_MS)
    const statusRes = await fetch(`${FIRECRAWL_BASE}/v2/crawl/${jobId}`, {
      method: 'GET',
      headers: authHeaders(apiKey),
    })
    if (!statusRes.ok) {
      const body = await statusRes.text().catch(() => '')
      throw new Error(`Firecrawl crawl status failed (${statusRes.status}): ${body.slice(0, 300)}`)
    }
    const statusJson = (await statusRes.json()) as CrawlStatusResponse
    finalStatus = statusJson.status

    if (Array.isArray(statusJson.data)) {
      // Collect newly returned pages (the status endpoint returns accumulated data).
      pages.length = 0
      pages.push(...statusJson.data)
    }

    if (statusJson.status === 'completed') break
    if (statusJson.status === 'failed' || statusJson.status === 'cancelled') {
      throw new Error(`Firecrawl crawl ${statusJson.status}: ${statusJson.error ?? 'no detail'}`)
    }
    if (pages.length >= MAX_PAGES) {
      truncated = true
      break
    }
    if (i === CRAWL_MAX_POLLS - 1) {
      truncated = true // ran out of polling budget; use what we have
    }
  }

  // Fallback: if a crawl yielded zero pages (e.g. JS-only landing), scrape the
  // single entry URL directly so we still return real signal for one page.
  if (pages.length === 0) {
    const scrapeRes = await fetch(`${FIRECRAWL_BASE}/v2/scrape`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ url, formats: ['rawHtml', 'links'], onlyMainContent: false, waitFor: 3500 }),
    })
    if (scrapeRes.ok) {
      const scrapeJson = (await scrapeRes.json()) as { success?: boolean; data?: FirecrawlPage }
      if (scrapeJson.data) pages.push(scrapeJson.data)
    }
    if (pages.length === 0) {
      throw new Error(
        `Firecrawl returned no pages for ${url} (crawl status: ${finalStatus ?? 'unknown'}).`,
      )
    }
  }

  const cappedPages = pages.slice(0, MAX_PAGES)
  if (pages.length > MAX_PAGES) truncated = true

  // ── 3. Detect actions on each page ────────────────────────────────────────
  // Her sayfa için: (a) gerçek DOM'dan tıklanabilir öğeleri çıkar (site kodu +
  // eklenti butonları), (b) markup + linkler + tıklanabilir hedef/metinler üzerinde
  // deterministik kuralları çalıştır.
  const detectedActions: DetectedAction[] = []
  const allClickables: ClickableElement[] = []
  for (const page of cappedPages) {
    const html = page.rawHtml || page.html || ''
    const clickables = extractClickables(html)
    allClickables.push(...clickables)
    const linkBlob = Array.isArray(page.links) ? page.links.join(' ') : ''
    // Tıklanabilir öğelerin hedef+metni de haystack'e katılır → eklenti-enjekte
    // WhatsApp/telefon/DM butonları (wa.me, tel:, m.me, ig.me, mailto:) yakalanır.
    const clickBlob = clickables.map((c) => `${c.target} ${c.text}`).join(' ')
    const haystack = `${html} ${linkBlob} ${clickBlob}`
    if (!haystack.trim()) continue
    detectedActions.push(...detectOnPage(haystack, pageUrl(page, url)))
  }

  // ── 3.5 Eklenti / widget tespiti — site genelinde dedup ──────────────────
  // JivoChat, Tawk, HotelRunner, Shopify, WooCommerce, vs. tespit edilirse o
  // eklentinin sağladığı event'ler kanıt havuzuna eklenir; aynı zamanda Claude'a
  // eklenti listesi verilir (3. parti widget'larla gelen event'leri ıskalamasın).
  const detectedPluginsMap = new Map<string, KnownPlugin>()
  for (const page of cappedPages) {
    const html = page.rawHtml || page.html || ''
    for (const plugin of detectPlugins(html)) {
      if (!detectedPluginsMap.has(plugin.name)) detectedPluginsMap.set(plugin.name, plugin)
    }
  }
  const detectedPlugins = Array.from(detectedPluginsMap.values())
  for (const plugin of detectedPlugins) {
    for (const event of plugin.events) {
      if (!detectedActions.some((a) => a.event === event && a.via === 'plugin')) {
        detectedActions.push({
          event,
          source: `plugin:${plugin.name}`,
          via: 'plugin',
          confidence: 0.85,
        })
      }
    }
  }

  // ── 4. Claude: işletme analizi + kanıt-temelli ÖNERİLER (birincil) ─────────
  // Deterministik tespit "kanıt havuzu" olarak kalır; Claude işletme türünü
  // belirleyip nihai recommendedEvents'i reason'larla üretir. Claude erişilemezse
  // (ANTHROPIC_API_KEY yok / API hatası) deterministik buildRecommended fallback.
  const pageSummaries = cappedPages.map((p) => summarizePage(p, url))
  const detectedSet = new Set(detectedActions.map((a) => a.event))

  let recommendedEvents: RecommendedEvent[]
  let businessAnalysis: BusinessAnalysis | undefined
  try {
    const ai = await aiAnalyzeSite({
      siteUrl: url,
      pageSummaries,
      clickables: allClickables,
      detectedEvents: Array.from(detectedSet),
      detectedPlugins,
    })
    if (ai && ai.recommended.length > 0) {
      recommendedEvents = ai.recommended
      businessAnalysis = ai.businessAnalysis
    } else {
      recommendedEvents = buildRecommended(detectedActions)
    }
  } catch {
    recommendedEvents = buildRecommended(detectedActions)
  }

  if (truncated) {
    console.log('MARKETING_SETUP_SCAN_TRUNCATED', {
      url,
      pagesScanned: cappedPages.length,
      cap: MAX_PAGES,
    })
  }

  return {
    siteUrl: url,
    pagesScanned: cappedPages.length,
    detectedActions,
    recommendedEvents,
    businessAnalysis,
    scannedAt: new Date().toISOString(),
    truncated,
  }
}
