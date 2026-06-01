import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import * as dns from 'dns/promises'
import { analyzeGeoAeo } from '@/lib/seo/geoAnalyzer'

function normalizeUrl(input: string): string {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  return url
}

// Returns true if the IP address is in a private/reserved range
function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  const privateRanges = [
    /^127\./,                        // loopback
    /^10\./,                         // RFC1918
    /^192\.168\./,                   // RFC1918
    /^172\.(1[6-9]|2\d|3[01])\./,   // RFC1918
    /^169\.254\./,                   // link-local (AWS metadata)
    /^0\.0\.0\.0/,                   // unspecified
    /^::1$/,                         // IPv6 loopback
    /^fc00:/,                        // IPv6 unique local
    /^fe80:/,                        // IPv6 link-local
  ]
  return privateRanges.some(r => r.test(ip))
}

async function assertSafeUrl(urlString: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    throw new Error('Invalid URL')
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are allowed')
  }

  const hostname = parsed.hostname

  // Reject bare IPs that are private
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname === '::1') {
    if (isPrivateIp(hostname)) throw new Error('Private IP addresses are not allowed')
    return
  }

  // DNS resolve and check all returned addresses
  try {
    const addresses = await dns.resolve(hostname)
    for (const addr of addresses) {
      if (isPrivateIp(addr)) throw new Error('URL resolves to a private address')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('private')) throw e
    // DNS failure = can't reach = let fetch handle it
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const url = body?.url
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }

    const normalized = normalizeUrl(url)

    // SSRF protection: reject private/internal addresses
    await assertSafeUrl(normalized)

    const res = await fetch(normalized, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YoAiBot/1.0)' },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Could not fetch URL' }, { status: 422 })
    }

    const html = await res.text()
    const $ = cheerio.load(html)
    const result = analyzeGeoAeo($, html)

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Error && (
      err.message.includes('private') ||
      err.message.includes('Private') ||
      err.message.includes('not allowed') ||
      err.message.includes('Invalid URL') ||
      err.message.includes('HTTP/HTTPS')
    )) {
      return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 422 })
    }
    // Generic error — don't leak internal details
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
