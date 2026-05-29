import 'server-only'
import type { DetectedAction, RecommendedEvent, SiteScanResult } from './types'
import type { StandardEventKey } from './constants'

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
  // Search — forms and result pages.
  {
    event: 'view_search_results',
    via: 'search',
    confidence: 0.65,
    test: (h) =>
      /(?:type=["']search["']|role=["']search["']|name=["'](?:q|s|query|search|arama|ara)["'])/.test(h) ||
      /(?:search\s+results|aranan\s+sonu[cç]lar|arama\s+sonu[cç]lar)/.test(h) ||
      /(?:placeholder=["'][^"']*(?:search|ara|arama)[^"']*["'])/.test(h),
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
  // Video player presence.
  {
    event: 'video_play',
    via: 'video',
    confidence: 0.6,
    test: (h) =>
      /(?:<video[\s>]|youtube\.com\/embed|player\.vimeo\.com|wistia|<iframe[^>]+(?:youtube|vimeo))/.test(h),
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

/** Build deduped recommendedEvents from the full detectedActions list. */
function buildRecommended(actions: DetectedAction[]): RecommendedEvent[] {
  const byEvent = new Map<StandardEventKey, { hits: number; maxConfidence: number }>()
  for (const a of actions) {
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
      body: JSON.stringify({ url, formats: ['rawHtml', 'links'], onlyMainContent: false }),
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
  const detectedActions: DetectedAction[] = []
  for (const page of cappedPages) {
    const html = page.rawHtml || page.html || ''
    const linkBlob = Array.isArray(page.links) ? page.links.join(' ') : ''
    // Combine markup + discovered links so href-only checkout routes still hit.
    const haystack = `${html} ${linkBlob}`
    if (!haystack.trim()) continue
    detectedActions.push(...detectOnPage(haystack, pageUrl(page, url)))
  }

  if (truncated) {
    console.log('MARKETING_SETUP_SCAN_TRUNCATED', {
      url,
      pagesScanned: cappedPages.length,
      cap: MAX_PAGES,
    })
  }

  const recommendedEvents = buildRecommended(detectedActions)

  return {
    siteUrl: url,
    pagesScanned: cappedPages.length,
    detectedActions,
    recommendedEvents,
    scannedAt: new Date().toISOString(),
    truncated,
  }
}
