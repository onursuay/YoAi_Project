/* YoAi — Firecrawl akıllı seçki orkestrasyonu.
   map → kilit sayfa seç → her sayfayı scrape → birleşik temiz markdown.
   Hiçbir sayfa taranamazsa null döner (çağıran HTTP fetch'e düşer). */
import { firecrawlMap, firecrawlScrape } from './client'
import { selectKeyPages } from './pageSelector'
import type { FirecrawlPage, MapLink, SiteScrapeResult } from './types'

const DEFAULT_MAX_PAGES = 6
const OVERALL_BUDGET_MS = 45_000 // Vercel 60sn limitine güvenli pay
const COMBINED_MARKDOWN_CAP = 16_000

function maxPages(): number {
  const raw = Number(process.env.FIRECRAWL_MAX_PAGES)
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 12) : DEFAULT_MAX_PAGES
}

export async function scrapeSite(
  rootUrl: string,
  deadline: number = Date.now() + OVERALL_BUDGET_MS,
): Promise<SiteScrapeResult | null> {
  let links: MapLink[]
  try {
    links = await firecrawlMap(rootUrl)
  } catch {
    links = []
  }

  const pages = selectKeyPages(rootUrl, links, maxPages())

  const collected: string[] = []
  let title: string | null = null
  let description: string | null = null
  let pagesScanned = 0
  let truncated = false

  for (const pageUrl of pages) {
    if (Date.now() >= deadline) {
      truncated = true
      break
    }
    let page: FirecrawlPage | null
    try {
      page = await firecrawlScrape(pageUrl)
    } catch {
      page = null
    }
    if (!page) continue
    pagesScanned++
    if (title === null && page.title) title = page.title
    if (description === null && page.description) description = page.description
    if (page.markdown) collected.push(page.markdown)
  }

  if (pagesScanned === 0) return null

  return {
    markdown: collected.join('\n\n---\n\n').slice(0, COMBINED_MARKDOWN_CAP),
    title,
    description,
    pagesScanned,
    truncated,
  }
}
