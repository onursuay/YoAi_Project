import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { analyzeGeoAeo } from '@/lib/seo/geoAnalyzer'

function normalizeUrl(input: string): string {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  return url
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const normalized = normalizeUrl(url as string)

    const res = await fetch(normalized, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YoAiBot/1.0)' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch URL: ${res.status}` }, { status: 422 })
    }

    const html = await res.text()
    const $ = cheerio.load(html)
    const result = analyzeGeoAeo($, html)

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
