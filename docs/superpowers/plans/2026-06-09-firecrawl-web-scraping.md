# Firecrawl Web Tarama Entegrasyonu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marka ve rakip web sitelerini Firecrawl ile derin (JS-render, çok sayfa) tarayıp, mevcut istihbarat hattını daha zengin içerikle beslemek; Firecrawl yoksa mevcut HTTP fetch'e sorunsuz düşmek.

**Architecture:** Yeni bağımsız `lib/firecrawl/` katmanı Firecrawl REST v2 API'sini kapsüller (`map` → kilit sayfa seçimi → `scrape` → birleşik markdown). `lib/yoai/businessSourceScanner.ts`'de yalnızca "içerik getirme" adımı değişir; mevcut sinyal-çıkarım fonksiyonları (`extractKeywords`, `findHints`, `extractLocations`, `detectBrandTone`) ortak bir `analyzeContent` yardımcısına taşınıp her iki içerik kaynağında (HTTP/Firecrawl) aynen çalışır. Default-off flag ile sıfır regresyon.

**Tech Stack:** TypeScript, Next.js, Firecrawl REST v2 (`https://api.firecrawl.dev/v2`), node `fetch`, `assert` + `tsx` test harness'i (`npx tsx`).

**Kapsam dışı (DOKUNULMAZ):** `socialSourceScanner.ts` (sosyal → Apify), `apifyCompetitorProvider.ts` (rakip reklamları → Apify), Meta/Google entegrasyonu, DB şeması/migration.

---

## File Structure

| Dosya | Sorumluluk |
|-------|------------|
| `lib/firecrawl/types.ts` (yeni) | Firecrawl tip tanımları (`FirecrawlPage`, `MapLink`, `SiteScrapeResult`) |
| `lib/firecrawl/client.ts` (yeni) | `isFirecrawlReady()`, `firecrawlMap()`, `firecrawlScrape()` — REST v2 sarmalayıcı |
| `lib/firecrawl/pageSelector.ts` (yeni) | `selectKeyPages()` — map çıktısından kilit sayfa seçimi (deterministik) |
| `lib/firecrawl/scrapeSite.ts` (yeni) | `scrapeSite()` — map → seç → scrape → birleşik markdown orkestrasyonu |
| `lib/yoai/businessSourceScanner.ts` (değiştir) | `analyzeContent()` ortak yardımcısı + Firecrawl yolu + dispatcher (fallback) |
| `src/tests/firecrawlClient.test.ts` (yeni) | `isFirecrawlReady` + map/scrape parse + hata sınıflandırma testleri |
| `src/tests/firecrawlPageSelector.test.ts` (yeni) | Sayfa seçim önceliği / dedup / max / boş liste testleri |
| `src/tests/firecrawlScrapeSite.test.ts` (yeni) | Orkestrasyon: birleştirme, all-fail→null, deadline kesintisi |
| `src/tests/businessSourceScannerFirecrawl.test.ts` (yeni) | Regresyon (flag-off) + Firecrawl yolu + fallback testleri |
| `.env.example` (değiştir) | Yeni env değişkenleri dokümante |
| `docs/CHANGELOG.md` (değiştir) | Değişiklik günlüğü |

---

## Task 1: Firecrawl tipleri + REST v2 client

**Files:**
- Create: `lib/firecrawl/types.ts`
- Create: `lib/firecrawl/client.ts`
- Test: `src/tests/firecrawlClient.test.ts`

- [ ] **Step 1: Tip tanımlarını yaz**

`lib/firecrawl/types.ts`:

```ts
/* YoAi — Firecrawl tip tanımları */

/** map endpoint'inden dönen tek bir bağlantı */
export interface MapLink {
  url: string
  title?: string | null
  description?: string | null
}

/** scrape endpoint'inden dönen tek bir sayfa (normalize edilmiş) */
export interface FirecrawlPage {
  url: string
  title: string | null
  description: string | null
  markdown: string
}

/** scrapeSite() birleşik çıktısı */
export interface SiteScrapeResult {
  /** Tüm seçili sayfaların birleşik temiz markdown'ı */
  markdown: string
  /** İlk başarılı sayfanın başlığı (genelde anasayfa) */
  title: string | null
  /** İlk başarılı sayfanın meta açıklaması */
  description: string | null
  /** Başarıyla taranan sayfa sayısı */
  pagesScanned: number
  /** Süre/limit nedeniyle erken kesildi mi */
  truncated: boolean
}
```

- [ ] **Step 2: Client testini yaz (önce başarısız)**

`src/tests/firecrawlClient.test.ts`:

```ts
/**
 * Firecrawl Client — Unit Tests
 * Çalıştırma: npx tsx src/tests/firecrawlClient.test.ts
 * Dış HTTP çağrıları global.fetch monkey-patch ile mock'lanır (gerçek kredi harcanmaz).
 */
import assert from 'assert'
import { isFirecrawlReady, firecrawlMap, firecrawlScrape } from '../../lib/firecrawl/client'

let passed = 0
let failed = 0
const pending: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  pending.push(async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
      passed++
    } catch (e) {
      console.error(`  ✗ ${name}`)
      console.error(`    ${e instanceof Error ? e.message : e}`)
      failed++
    }
  })
}

const realFetch = global.fetch
function mockFetch(handler: (url: string, init: RequestInit) => { ok: boolean; status?: number; json: unknown }): void {
  // @ts-expect-error test override
  global.fetch = async (url: string, init: RequestInit) => {
    const r = handler(String(url), init)
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.json,
    } as Response
  }
}
function restoreFetch(): void {
  global.fetch = realFetch
}

test('isFirecrawlReady: key yok → false', () => {
  delete process.env.FIRECRAWL_API_KEY
  process.env.FIRECRAWL_ENABLED = 'true'
  assert.strictEqual(isFirecrawlReady(), false)
})

test('isFirecrawlReady: flag kapalı → false', () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'false'
  assert.strictEqual(isFirecrawlReady(), false)
})

test('isFirecrawlReady: key var + flag açık → true', () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'true'
  assert.strictEqual(isFirecrawlReady(), true)
})

test('firecrawlMap: links objelerini normalize eder', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({
    ok: true,
    json: { success: true, links: [{ url: 'https://x.com/a' }, { url: 'https://x.com/b', title: 'B' }] },
  }))
  const links = await firecrawlMap('https://x.com')
  restoreFetch()
  assert.strictEqual(links.length, 2)
  assert.strictEqual(links[0].url, 'https://x.com/a')
})

test('firecrawlMap: links string dizisini de kabul eder', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({ ok: true, json: { success: true, links: ['https://x.com/a'] } }))
  const links = await firecrawlMap('https://x.com')
  restoreFetch()
  assert.strictEqual(links[0].url, 'https://x.com/a')
})

test('firecrawlScrape: markdown + metadata çıkarır', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({
    ok: true,
    json: { success: true, data: { markdown: '# Merhaba', metadata: { title: 'T', description: 'D' } } },
  }))
  const page = await firecrawlScrape('https://x.com')
  restoreFetch()
  assert.ok(page)
  assert.strictEqual(page!.markdown, '# Merhaba')
  assert.strictEqual(page!.title, 'T')
  assert.strictEqual(page!.description, 'D')
})

test('firecrawlScrape: metadata title dizi ise ilkini alır', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({
    ok: true,
    json: { success: true, data: { markdown: 'x', metadata: { title: ['T1', 'T2'] } } },
  }))
  const page = await firecrawlScrape('https://x.com')
  restoreFetch()
  assert.strictEqual(page!.title, 'T1')
})

test('firecrawlScrape: markdown yoksa null', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({ ok: true, json: { success: true, data: { metadata: {} } } }))
  const page = await firecrawlScrape('https://x.com')
  restoreFetch()
  assert.strictEqual(page, null)
})

test('firecrawlMap: HTTP 429 → hata fırlatır', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({ ok: false, status: 429, json: {} }))
  await assert.rejects(() => firecrawlMap('https://x.com'), /firecrawl_http_429/)
  restoreFetch()
})

async function runAll(): Promise<void> {
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}
runAll()
```

- [ ] **Step 3: Testi çalıştır, başarısız olduğunu gör**

Run: `npx tsx src/tests/firecrawlClient.test.ts`
Expected: FAIL — `Cannot find module '../../lib/firecrawl/client'`

- [ ] **Step 4: Client'ı uygula**

`lib/firecrawl/client.ts`:

```ts
/* YoAi — Firecrawl REST v2 client.
   Apify pattern'i ile aynı: isFirecrawlReady() flag + key kontrolü;
   hata/limit/timeout durumunda çağıran taraf HTTP fetch'e düşer. */
import type { FirecrawlPage, MapLink } from './types'

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v2'
const MAP_TIMEOUT_MS = 15_000
const SCRAPE_TIMEOUT_MS = 25_000

/** Apify'daki isApifyReady deseninin aynısı: key + default-off flag */
export function isFirecrawlReady(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY && process.env.FIRECRAWL_ENABLED === 'true')
}

function apiKey(): string {
  return process.env.FIRECRAWL_API_KEY || ''
}

async function firecrawlRequest<T>(path: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${FIRECRAWL_API_BASE}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    clearTimeout(timeout)
    if (!res.ok) {
      throw new Error(`firecrawl_http_${res.status}`)
    }
    const json = (await res.json()) as { success?: boolean } & T
    if (json && json.success === false) {
      throw new Error('firecrawl_unsuccessful')
    }
    return json as T
  } catch (e) {
    clearTimeout(timeout)
    throw e instanceof Error ? e : new Error('firecrawl_unknown_error')
  }
}

/** Site URL listesini döndürür (string veya {url,...} obje formatını normalize eder) */
export async function firecrawlMap(url: string, limit = 50): Promise<MapLink[]> {
  const json = await firecrawlRequest<{ links?: Array<MapLink | string> }>(
    '/map',
    { url, limit, sitemap: 'include', ignoreQueryParameters: true },
    MAP_TIMEOUT_MS,
  )
  const links = json.links || []
  return links
    .map((l) => (typeof l === 'string' ? { url: l } : l))
    .filter((l): l is MapLink => !!l && !!l.url)
}

/** Tek sayfayı temiz markdown olarak çeker; markdown yoksa null */
export async function firecrawlScrape(url: string): Promise<FirecrawlPage | null> {
  const json = await firecrawlRequest<{
    data?: {
      markdown?: string
      metadata?: { title?: string | string[]; description?: string | string[] }
    }
  }>('/scrape', { url, formats: ['markdown'], onlyMainContent: true, timeout: SCRAPE_TIMEOUT_MS }, SCRAPE_TIMEOUT_MS + 5_000)

  const data = json.data
  if (!data || !data.markdown) return null

  const firstStr = (v: string | string[] | undefined): string | null =>
    Array.isArray(v) ? v[0] || null : v || null

  return {
    url,
    title: firstStr(data.metadata?.title),
    description: firstStr(data.metadata?.description),
    markdown: data.markdown,
  }
}
```

- [ ] **Step 5: Testi çalıştır, geçtiğini gör**

Run: `npx tsx src/tests/firecrawlClient.test.ts`
Expected: PASS — `Results: 9 passed, 0 failed`

- [ ] **Step 6: Commit**

```bash
git add lib/firecrawl/types.ts lib/firecrawl/client.ts src/tests/firecrawlClient.test.ts
git commit -m "feat(firecrawl): REST v2 client (map/scrape) + isFirecrawlReady flag"
```

---

## Task 2: Kilit sayfa seçici (pageSelector)

**Files:**
- Create: `lib/firecrawl/pageSelector.ts`
- Test: `src/tests/firecrawlPageSelector.test.ts`

- [ ] **Step 1: Test yaz (önce başarısız)**

`src/tests/firecrawlPageSelector.test.ts`:

```ts
/**
 * Firecrawl pageSelector — Unit Tests
 * Çalıştırma: npx tsx src/tests/firecrawlPageSelector.test.ts
 */
import assert from 'assert'
import { selectKeyPages } from '../../lib/firecrawl/pageSelector'
import type { MapLink } from '../../lib/firecrawl/types'

let passed = 0
let failed = 0
const pending: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  pending.push(async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
      passed++
    } catch (e) {
      console.error(`  ✗ ${name}`)
      console.error(`    ${e instanceof Error ? e.message : e}`)
      failed++
    }
  })
}

const links: MapLink[] = [
  { url: 'https://x.com/blog/yazi-1' },
  { url: 'https://x.com/iletisim' },
  { url: 'https://x.com/hizmetler' },
  { url: 'https://x.com/hakkimizda' },
  { url: 'https://x.com/fiyatlandirma' },
  { url: 'https://x.com/blog/yazi-2' },
]

test('anasayfa her zaman ilk sırada', () => {
  const pages = selectKeyPages('https://x.com', links, 6)
  assert.strictEqual(pages[0], 'https://x.com')
})

test('öncelik sırası: hakkımızda > hizmetler > fiyat > iletişim > diğer', () => {
  const pages = selectKeyPages('https://x.com', links, 6)
  // anasayfa(0), hakkimizda(1), hizmetler(2), fiyatlandirma(3), iletisim(4), blog(99)
  assert.deepStrictEqual(pages.slice(0, 5), [
    'https://x.com',
    'https://x.com/hakkimizda',
    'https://x.com/hizmetler',
    'https://x.com/fiyatlandirma',
    'https://x.com/iletisim',
  ])
})

test('max sınırına uyar', () => {
  const pages = selectKeyPages('https://x.com', links, 3)
  assert.strictEqual(pages.length, 3)
})

test('duplicate path elenir', () => {
  const dupLinks: MapLink[] = [{ url: 'https://x.com/' }, { url: 'https://x.com/hizmetler' }, { url: 'https://x.com/hizmetler' }]
  const pages = selectKeyPages('https://x.com', dupLinks, 6)
  const hizmetCount = pages.filter((p) => p.includes('hizmetler')).length
  assert.strictEqual(hizmetCount, 1)
})

test('boş links → sadece anasayfa', () => {
  const pages = selectKeyPages('https://x.com', [], 6)
  assert.deepStrictEqual(pages, ['https://x.com'])
})

async function runAll(): Promise<void> {
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}
runAll()
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `npx tsx src/tests/firecrawlPageSelector.test.ts`
Expected: FAIL — `Cannot find module '../../lib/firecrawl/pageSelector'`

- [ ] **Step 3: pageSelector'ı uygula**

`lib/firecrawl/pageSelector.ts`:

```ts
/* YoAi — Firecrawl kilit sayfa seçici (deterministik).
   map çıktısından markaya dair en bilgilendirici sayfaları seçer. */
import type { MapLink } from './types'

/** rank düşük = öncelik yüksek */
const PAGE_PRIORITY: Array<{ rank: number; pattern: RegExp }> = [
  { rank: 1, pattern: /\/(hakk|about|kurumsal|biz-kimiz|who-we-are)/i },
  { rank: 2, pattern: /\/(hizmet|service|cozum|solution|urun|product|shop|magaza|katalog|collection)/i },
  { rank: 3, pattern: /\/(fiyat|pricing|paket|plan|ucret|price)/i },
  { rank: 4, pattern: /\/(iletisim|contact|ulasim|destek)/i },
]

function pathOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname.replace(/\/+$/, '') || '/'
  } catch {
    return rawUrl
  }
}

function rankFor(url: string): number {
  const path = pathOf(url)
  if (path === '/' || path === '') return 0 // anasayfa
  for (const { rank, pattern } of PAGE_PRIORITY) {
    if (pattern.test(path)) return rank
  }
  return 99 // diğer
}

/** rootUrl her zaman dahil; kalan sayfalar önceliğe göre sıralanıp max'a kadar alınır. */
export function selectKeyPages(rootUrl: string, links: MapLink[], max = 6): string[] {
  const seen = new Set<string>()
  const candidates: Array<{ url: string; rank: number }> = []

  candidates.push({ url: rootUrl, rank: 0 })
  seen.add(pathOf(rootUrl))

  for (const link of links) {
    if (!link.url) continue
    const norm = pathOf(link.url)
    if (seen.has(norm)) continue
    seen.add(norm)
    candidates.push({ url: link.url, rank: rankFor(link.url) })
  }

  return candidates
    .sort((a, b) => a.rank - b.rank)
    .slice(0, max)
    .map((c) => c.url)
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `npx tsx src/tests/firecrawlPageSelector.test.ts`
Expected: PASS — `Results: 5 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add lib/firecrawl/pageSelector.ts src/tests/firecrawlPageSelector.test.ts
git commit -m "feat(firecrawl): deterministik kilit sayfa seçici (pageSelector)"
```

---

## Task 3: Site orkestrasyonu (scrapeSite)

**Files:**
- Create: `lib/firecrawl/scrapeSite.ts`
- Test: `src/tests/firecrawlScrapeSite.test.ts`

- [ ] **Step 1: Test yaz (önce başarısız)**

`src/tests/firecrawlScrapeSite.test.ts`:

```ts
/**
 * Firecrawl scrapeSite — Unit Tests
 * Çalıştırma: npx tsx src/tests/firecrawlScrapeSite.test.ts
 * global.fetch monkey-patch ile map/scrape mock'lanır.
 */
import assert from 'assert'
import { scrapeSite } from '../../lib/firecrawl/scrapeSite'

let passed = 0
let failed = 0
const pending: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  pending.push(async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
      passed++
    } catch (e) {
      console.error(`  ✗ ${name}`)
      console.error(`    ${e instanceof Error ? e.message : e}`)
      failed++
    }
  })
}

const realFetch = global.fetch
function mockFetch(handler: (url: string) => { ok: boolean; status?: number; json: unknown }): void {
  // @ts-expect-error test override
  global.fetch = async (url: string) => {
    const r = handler(String(url))
    return { ok: r.ok, status: r.status ?? (r.ok ? 200 : 500), json: async () => r.json } as Response
  }
}
function restoreFetch(): void {
  global.fetch = realFetch
}

function defaultHandler(url: string): { ok: boolean; json: unknown } {
  if (url.includes('/v2/map')) {
    return { ok: true, json: { success: true, links: [{ url: 'https://x.com/hizmetler' }] } }
  }
  // scrape
  return { ok: true, json: { success: true, data: { markdown: `İçerik: ${url}`, metadata: { title: 'T', description: 'D' } } } }
}

test('map + scrape → birleşik markdown döner', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(defaultHandler)
  const result = await scrapeSite('https://x.com')
  restoreFetch()
  assert.ok(result)
  assert.strictEqual(result!.pagesScanned, 2) // anasayfa + hizmetler
  assert.ok(result!.markdown.includes('İçerik: https://x.com'))
  assert.strictEqual(result!.title, 'T')
})

test('tüm scrape başarısız → null (çağıran HTTP fetch\'e düşer)', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch((url) => {
    if (url.includes('/v2/map')) return { ok: true, json: { success: true, links: [] } }
    return { ok: true, json: { success: true, data: { metadata: {} } } } // markdown yok
  })
  const result = await scrapeSite('https://x.com')
  restoreFetch()
  assert.strictEqual(result, null)
})

test('deadline geçmişte → truncated, sadece eldekiyle biter', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(defaultHandler)
  const pastDeadline = Date.now() - 1000
  const result = await scrapeSite('https://x.com', pastDeadline)
  restoreFetch()
  // map çalışır ama hiçbir sayfa scrape edilmez → pagesScanned 0 → null
  assert.strictEqual(result, null)
})

test('map hata verse bile anasayfa scrape edilir', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch((url) => {
    if (url.includes('/v2/map')) return { ok: false, status: 500, json: {} }
    return { ok: true, json: { success: true, data: { markdown: 'home', metadata: { title: 'H' } } } }
  })
  const result = await scrapeSite('https://x.com')
  restoreFetch()
  assert.ok(result)
  assert.strictEqual(result!.pagesScanned, 1)
  assert.ok(result!.markdown.includes('home'))
})

async function runAll(): Promise<void> {
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}
runAll()
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `npx tsx src/tests/firecrawlScrapeSite.test.ts`
Expected: FAIL — `Cannot find module '../../lib/firecrawl/scrapeSite'`

- [ ] **Step 3: scrapeSite'ı uygula**

`lib/firecrawl/scrapeSite.ts`:

```ts
/* YoAi — Firecrawl akıllı seçki orkestrasyonu.
   map → kilit sayfa seç → her sayfayı scrape → birleşik temiz markdown.
   Hiçbir sayfa taranamazsa null döner (çağıran HTTP fetch'e düşer). */
import { firecrawlMap, firecrawlScrape } from './client'
import { selectKeyPages } from './pageSelector'
import type { SiteScrapeResult } from './types'

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
  let links
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
    let page
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
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `npx tsx src/tests/firecrawlScrapeSite.test.ts`
Expected: PASS — `Results: 4 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add lib/firecrawl/scrapeSite.ts src/tests/firecrawlScrapeSite.test.ts
git commit -m "feat(firecrawl): scrapeSite orkestrasyonu (map→seç→scrape→birleşik markdown)"
```

---

## Task 4: businessSourceScanner entegrasyonu (analyzeContent + Firecrawl yolu + fallback)

**Files:**
- Modify: `lib/yoai/businessSourceScanner.ts`
- Test: `src/tests/businessSourceScannerFirecrawl.test.ts`

### 4a — Önce regresyon testi (refactor güvenliği)

- [ ] **Step 1: Regresyon + Firecrawl testini yaz (önce kısmen başarısız)**

`src/tests/businessSourceScannerFirecrawl.test.ts`:

```ts
/**
 * businessSourceScanner — Firecrawl entegrasyonu + regresyon testleri
 * Çalıştırma: npx tsx src/tests/businessSourceScannerFirecrawl.test.ts
 * global.fetch monkey-patch: hem HTTP site fetch'i hem Firecrawl API'si mock'lanır.
 */
import assert from 'assert'
import { scanBusinessSource } from '../../lib/yoai/businessSourceScanner'

let passed = 0
let failed = 0
const pending: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  pending.push(async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
      passed++
    } catch (e) {
      console.error(`  ✗ ${name}`)
      console.error(`    ${e instanceof Error ? e.message : e}`)
      failed++
    }
  })
}

const realFetch = global.fetch
function mockFetch(handler: (url: string) => { ok: boolean; status?: number; headers?: Record<string, string>; text?: string; json?: unknown }): void {
  // @ts-expect-error test override
  global.fetch = async (url: string) => {
    const r = handler(String(url))
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      headers: { get: (k: string) => (r.headers || { 'content-type': 'text/html' })[k.toLowerCase()] ?? null },
      text: async () => r.text ?? '',
      json: async () => r.json ?? {},
    } as unknown as Response
  }
}
function restoreFetch(): void {
  global.fetch = realFetch
}

const SAMPLE_HTML =
  '<html><head><title>Antso Hukuk</title><meta name="description" content="İstanbul avukatlık hizmetleri"></head>' +
  '<body><h1>Hizmetlerimiz</h1><p>İletişime geç, randevu al. Profesyonel kurumsal yaklaşım. İstanbul ve Ankara.</p></body></html>'

test('REGRESYON: flag kapalı → HTTP fetch ile taranır, çıktı bozulmaz', async () => {
  delete process.env.FIRECRAWL_ENABLED
  process.env.FIRECRAWL_API_KEY = 'k'
  mockFetch(() => ({ ok: true, text: SAMPLE_HTML }))
  const out = await scanBusinessSource({ source_type: 'website', source_url: 'https://antso.com' })
  restoreFetch()
  assert.strictEqual(out.scan_status, 'completed')
  assert.strictEqual(out.extracted_title, 'Antso Hukuk')
  assert.strictEqual(out.extracted_description, 'İstanbul avukatlık hizmetleri')
  // NOT: 'İstanbul' (büyük İ) toLowerCase tuzağı nedeniyle eşleşmez (önceden var olan bug);
  // 'Ankara' temiz round-trip yapar → konum çıkarımının çalıştığını bununla doğrularız.
  assert.ok(out.extracted_locations.includes('Ankara'))
  assert.strictEqual(out.scanProvider, 'http')
})

test('Firecrawl yolu: flag açık → scanProvider firecrawl, markdown içeriği işlenir', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'true'
  mockFetch((url) => {
    if (url.includes('/v2/map')) return { ok: true, json: { success: true, links: [] } }
    if (url.includes('/v2/scrape')) {
      return {
        ok: true,
        json: {
          success: true,
          data: { markdown: 'Profesyonel kurumsal avukatlık. İletişime geç. Ankara.', metadata: { title: 'Antso', description: 'Hukuk' } },
        },
      }
    }
    return { ok: true, text: SAMPLE_HTML }
  })
  const out = await scanBusinessSource({ source_type: 'website', source_url: 'https://antso.com' })
  restoreFetch()
  assert.strictEqual(out.scan_status, 'completed')
  assert.strictEqual(out.scanProvider, 'firecrawl')
  assert.strictEqual(out.extracted_title, 'Antso')
  assert.ok(out.extracted_locations.includes('Ankara'))
})

test('Fallback: flag açık ama Firecrawl boş döner → HTTP fetch\'e düşer', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'true'
  mockFetch((url) => {
    if (url.includes('/v2/map')) return { ok: true, json: { success: true, links: [] } }
    if (url.includes('/v2/scrape')) return { ok: true, json: { success: true, data: { metadata: {} } } } // markdown yok → null
    return { ok: true, text: SAMPLE_HTML } // HTTP fallback
  })
  const out = await scanBusinessSource({ source_type: 'website', source_url: 'https://antso.com' })
  restoreFetch()
  assert.strictEqual(out.scan_status, 'completed')
  assert.strictEqual(out.scanProvider, 'http')
  assert.strictEqual(out.extracted_title, 'Antso Hukuk')
})

test('Sosyal kaynak Firecrawl\'a girmez (flag açık olsa bile)', async () => {
  process.env.FIRECRAWL_API_KEY = 'k'
  process.env.FIRECRAWL_ENABLED = 'true'
  let firecrawlCalled = false
  mockFetch((url) => {
    if (url.includes('api.firecrawl.dev')) {
      firecrawlCalled = true
      return { ok: true, json: { success: true, data: { markdown: 'x' } } }
    }
    return { ok: true, text: '<html><head><title>IG</title></head><body>x</body></html>' }
  })
  await scanBusinessSource({ source_type: 'instagram', source_url: 'https://instagram.com/antso' })
  restoreFetch()
  assert.strictEqual(firecrawlCalled, false)
})

async function runAll(): Promise<void> {
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}
runAll()
```

- [ ] **Step 2: Testi çalıştır — kısmen başarısız olmalı**

Run: `npx tsx src/tests/businessSourceScannerFirecrawl.test.ts`
Expected: Regresyon ve sosyal testi PASS olabilir ama `scanProvider` assert'leri ve Firecrawl yolu FAIL (`scanProvider` alanı yok, Firecrawl yolu yok).

### 4b — `analyzeContent` ortak yardımcısını çıkar

- [ ] **Step 3: `SourceScanOutput`'a opsiyonel `scanProvider` ekle**

`lib/yoai/businessSourceScanner.ts` — interface'e ekle (satır ~52, `scanned_at` öncesi):

```ts
  error_message: string | null
  scanned_at: string
  /** Teşhis: içerik hangi yolla geldi. DB'ye yazılmaz (mapping açık alan-alan). */
  scanProvider?: 'firecrawl' | 'http'
```

- [ ] **Step 4: `analyzeContent` yardımcısını ekle**

`lib/yoai/businessSourceScanner.ts` — `computeConfidence` fonksiyonundan **sonra**, `scanHttp`'ten **önce** ekle:

```ts
/* ── Ortak içerik analizi (HTTP + Firecrawl paylaşır) ─────────── */

function analyzeContent(
  input: SourceScanInput,
  parts: {
    url: string
    title: string | null
    description: string | null
    corpus: string
    body: string
    now: string
    scanProvider: 'firecrawl' | 'http'
  },
): SourceScanOutput {
  const { corpus, body } = parts
  const keywords = extractKeywords(corpus)
  const services = findHints(corpus, SERVICE_HINTS, 5)
  const products = findHints(corpus, PRODUCT_HINTS, 5)
  const ctas = findHints(corpus, CTA_HINTS, 5)
  const offers = findHints(corpus, OFFER_HINTS, 5)
  const proof = findHints(corpus, SOCIAL_PROOF_HINTS, 1)[0] || null
  const tone = detectBrandTone(corpus)
  const locations = extractLocations(corpus)

  const confidence = computeConfidence({
    hasTitle: !!parts.title,
    hasDescription: !!parts.description,
    bodyChars: body.length,
    ctaCount: ctas.length,
    keywordCount: keywords.length,
  })

  return {
    source_type: input.source_type,
    source_url: parts.url,
    scan_status: 'completed',
    raw_excerpt: body.slice(0, RAW_EXCERPT_CHARS),
    extracted_title: parts.title,
    extracted_description: parts.description,
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
    scanned_at: parts.now,
    scanProvider: parts.scanProvider,
  }
}
```

- [ ] **Step 5: `scanHttp`'in başarı bloğunu `analyzeContent`'e delege et**

`lib/yoai/businessSourceScanner.ts` — `scanHttp` içinde `const html = await res.text()` satırından sonraki **tüm başarı bloğunu** (satır ~269-312, `const title = ...`'dan `return { ... }`'a kadar) şununla değiştir:

```ts
    const html = await res.text()
    const title = extractTitle(html)
    const description = extractMetaDescription(html)
    const headings = extractHeadings(html)
    const body = extractBodyText(html)
    const corpus = [title, description, headings.join(' '), body].filter(Boolean).join(' ').slice(0, BODY_TEXT_CHARS)

    return analyzeContent(input, {
      url,
      title,
      description,
      corpus,
      body,
      now,
      scanProvider: 'http',
    })
```

- [ ] **Step 6: Regresyon testini çalıştır — HTTP davranışı korunmalı**

Run: `npx tsx src/tests/businessSourceScannerFirecrawl.test.ts`
Expected: Regresyon testi + `scanProvider === 'http'` PASS; Firecrawl yolu testi hâlâ FAIL (henüz yol yok).

Ayrıca mevcut testlerin bozulmadığını doğrula:
Run: `npx tsx src/tests/businessIntelligenceProfile.test.ts`
Expected: PASS (mevcut davranış korunur).

### 4c — Firecrawl yolu + dispatcher

- [ ] **Step 7: Firecrawl import'larını ve `scanFirecrawl`'ı ekle**

`lib/yoai/businessSourceScanner.ts` — dosya başındaki import'a ekle (satır 1 civarı):

```ts
import { scanSocialSource } from './socialSourceScanner'
import { isFirecrawlReady } from '../firecrawl/client'
import { scrapeSite } from '../firecrawl/scrapeSite'
```

Sabitlerin yanına (satır ~58, `BODY_TEXT_CHARS` altına) ekle:

```ts
const FIRECRAWL_CORPUS_CHARS = 12_000
```

`analyzeContent`'ten sonra `scanFirecrawl`'ı ekle:

```ts
/* ── Firecrawl scanner (website / marketplace / google_business) ── */

async function scanFirecrawl(input: SourceScanInput): Promise<SourceScanOutput | null> {
  const url = (input.source_url || '').trim()
  if (!url) return null
  let result
  try {
    result = await scrapeSite(url)
  } catch {
    return null
  }
  if (!result || !result.markdown) return null

  const now = new Date().toISOString()
  const body = result.markdown
  const corpus = [result.title, result.description, body].filter(Boolean).join(' ').slice(0, FIRECRAWL_CORPUS_CHARS)

  return analyzeContent(input, {
    url,
    title: result.title,
    description: result.description,
    corpus,
    body,
    now,
    scanProvider: 'firecrawl',
  })
}
```

- [ ] **Step 8: `scanBusinessSource` dispatcher'ına Firecrawl-önce-fallback ekle**

`lib/yoai/businessSourceScanner.ts` — `scanBusinessSource` sonundaki şu satırları:

```ts
  if (SOCIAL_TYPES.includes(input.source_type)) {
    return scanSocial(input)
  }
  // website / marketplace / google_business / extra → HTTP
  return scanHttp(input)
```

şununla değiştir:

```ts
  if (SOCIAL_TYPES.includes(input.source_type)) {
    return scanSocial(input)
  }
  // website / marketplace / google_business / extra
  // → Firecrawl hazırsa derin tara; başarısızsa HTTP fetch'e düş (asla crash yok)
  if (isFirecrawlReady()) {
    const fc = await scanFirecrawl(input)
    if (fc) return fc
  }
  return scanHttp(input)
```

- [ ] **Step 9: Tüm Firecrawl entegrasyon testlerini çalıştır**

Run: `npx tsx src/tests/businessSourceScannerFirecrawl.test.ts`
Expected: PASS — `Results: 4 passed, 0 failed`

- [ ] **Step 10: Komşu testlerin bozulmadığını doğrula**

Run: `npx tsx src/tests/socialSourceScanner.test.ts && npx tsx src/tests/businessIntelligenceProfile.test.ts`
Expected: İkisi de PASS.

- [ ] **Step 11: TypeScript derleme kontrolü**

Run: `npx tsc --noEmit`
Expected: Yeni dosyalarla ilgili hata yok. (Var olan, ilgisiz hatalar varsa not al ama bu task'a ait değil.)

- [ ] **Step 12: Commit**

```bash
git add lib/yoai/businessSourceScanner.ts src/tests/businessSourceScannerFirecrawl.test.ts
git commit -m "feat(firecrawl): businessSourceScanner Firecrawl yolu + HTTP fallback (default-off)"
```

---

## Task 5: Env dokümantasyonu, CHANGELOG, push

**Files:**
- Modify: `.env.example`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: `.env.example`'a Firecrawl değişkenlerini ekle**

`.env.example` sonuna ekle:

```
# ── Firecrawl (web sitesi derin tarama — marka + rakip web) ──
# Yalnızca WEB sitesi taraması için. Sosyal/Meta/Google = Apify (değişmez).
# Key yoksa veya FIRECRAWL_ENABLED!=true ise sistem mevcut HTTP fetch'e düşer (sıfır regresyon).
FIRECRAWL_API_KEY=
FIRECRAWL_ENABLED=false
FIRECRAWL_MAX_PAGES=6
```

- [ ] **Step 2: CHANGELOG'a giriş ekle (en üste)**

`docs/CHANGELOG.md` en üstüne ekle:

```markdown
## 2026-06-09 — Firecrawl web tarama entegrasyonu (alt-proje C)
- **Sorun:** Marka/rakip web siteleri yalnız basit HTTP fetch + regex ile taranıyordu; JS-render içerik ve çok sayfalı bilgi kaçıyordu.
- **Çözüm:** Yeni `lib/firecrawl/` katmanı (map → kilit sayfa seç → scrape → birleşik markdown). `businessSourceScanner` web kaynaklarında Firecrawl hazırsa derin tarar, değilse HTTP fetch'e düşer (default-off `FIRECRAWL_ENABLED` flag, sıfır regresyon). Sosyal/Meta/Google (Apify) değişmedi.
- **Dosyalar:** lib/firecrawl/{types,client,pageSelector,scrapeSite}.ts, lib/yoai/businessSourceScanner.ts, src/tests/firecrawl*.test.ts, .env.example
```

- [ ] **Step 3: Tüm yeni testleri son kez çalıştır**

Run:
```bash
npx tsx src/tests/firecrawlClient.test.ts && \
npx tsx src/tests/firecrawlPageSelector.test.ts && \
npx tsx src/tests/firecrawlScrapeSite.test.ts && \
npx tsx src/tests/businessSourceScannerFirecrawl.test.ts
```
Expected: Hepsi PASS.

- [ ] **Step 4: Commit + push**

```bash
git add .env.example docs/CHANGELOG.md
git commit -m "docs(firecrawl): env örneği + changelog (alt-proje C)"
git push
```

- [ ] **Step 5: Manuel canlı doğrulama notu (flag açıldıktan sonra)**

Bu adım kod değil, owner doğrulaması:
1. Vercel'e `FIRECRAWL_API_KEY` (firecrawl.dev console'dan) + `FIRECRAWL_ENABLED=true` ekle.
2. Owner hesabında İşletme Profili → "Marka Bilgilerini Yenile" tetikle.
3. `user_business_source_scans` kaydında web kaynağının `raw_excerpt`/`extracted_*` alanlarının HTTP fetch'e göre zenginleştiğini gözle.
4. Sorun olursa `FIRECRAWL_ENABLED=false` → anında eski davranışa döner.

---

## Self-Review Notları (yazım sonrası kontrol)

- **Spec coverage:** Mimari (T1-3), entegrasyon noktası + fallback (T4), env/flag (T5), hata yönetimi (client + scrapeSite try/catch + dispatcher fallback), test stratejisi (her task TDD + regresyon T4 Step 6/10), i18n (backend, yeni metin yok) — tümü karşılandı.
- **Kapsam sınırı:** `socialSourceScanner`, `apifyCompetitorProvider`, Meta/Google entegrasyonu hiçbir task'ta değişmiyor; sosyal kaynağın Firecrawl'a girmediği T4 Step-1 testiyle kanıtlanıyor.
- **Tip tutarlılığı:** `MapLink`, `FirecrawlPage`, `SiteScrapeResult` T1'de tanımlı; `scanProvider?: 'firecrawl' | 'http'` T4'te interface + `analyzeContent` + `scanFirecrawl`'da tutarlı. `selectKeyPages(rootUrl, links, max)`, `scrapeSite(rootUrl, deadline?)`, `firecrawlMap(url, limit?)`, `firecrawlScrape(url)` imzaları kullanıldıkları yerlerle eşleşiyor.
- **Migration yok:** `scanProvider` DB'ye yazılmaz (route.ts mapping açık alan-alan); `user_business_source_scans` şeması değişmez.
