import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { analyzeGeoAeo } from '@/lib/seo/geoAnalyzer'
import { assertSafeUrl } from '@/lib/seo/assertSafeUrl'

function normalizeUrl(input: string): string {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  return url
}

const MAX_REDIRECTS = 5

async function safeFetch(startUrl: string): Promise<Response> {
  let currentUrl = startUrl
  let hops = 0

  while (hops < MAX_REDIRECTS) {
    // Validate before each fetch (covers redirect destinations too)
    await assertSafeUrl(currentUrl)

    const res = await fetch(currentUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YoAiBot/1.0)' },
      signal: AbortSignal.timeout(15000),
      redirect: 'manual',
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) throw new Error('Redirect with no Location header')

      // Resolve relative redirects against current URL
      const next = new URL(location, currentUrl).toString()

      // Only allow http/https redirects
      if (!/^https?:\/\//i.test(next)) {
        throw new Error('Redirect to non-HTTP scheme rejected')
      }

      currentUrl = next
      hops++
      continue
    }

    return res
  }

  throw new Error('Too many redirects')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const url = body?.url
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }

    const normalized = normalizeUrl(url)

    const res = await safeFetch(normalized)

    if (!res.ok) {
      return NextResponse.json({ error: 'Could not fetch URL' }, { status: 422 })
    }

    const html = await res.text()
    const $ = cheerio.load(html)
    const result = analyzeGeoAeo($, html)

    return NextResponse.json(result)
  } catch (err) {
    const isSsrf = err instanceof Error && (
      err.message.includes('private') ||
      err.message.includes('Private') ||
      err.message.includes('not allowed') ||
      err.message.includes('Invalid URL') ||
      err.message.includes('HTTP/HTTPS') ||
      err.message.includes('resolve') ||
      err.message.includes('Redirect') ||
      err.message.includes('redirects')
    )
    if (isSsrf) {
      return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
