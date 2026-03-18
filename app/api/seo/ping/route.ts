import { NextRequest, NextResponse } from 'next/server'

// ─── Ücretsiz Ping Endpoint Listesi ───
const PING_SERVICES = [
  { name: 'Google',        url: 'https://www.google.com/ping?sitemap={url}',      method: 'GET'  },
  { name: 'Bing',          url: 'https://www.bing.com/ping?sitemap={url}',         method: 'GET'  },
  { name: 'Ping-O-Matic',  url: 'https://rpc.pingomatic.com/',                    method: 'XMLRPC' },
  { name: 'Twingly',       url: 'https://rpc.twingly.com/',                        method: 'XMLRPC' },
  { name: 'WeblogUpdates', url: 'https://weblogUpdates.weblogs.com/RPC2',          method: 'XMLRPC' },
  { name: 'BlogHop',       url: 'https://www.bloghop.com/RPC/',                    method: 'XMLRPC' },
  { name: 'FeedShark',     url: 'https://feedshark.brainbliss.com/',               method: 'XMLRPC' },
  { name: 'Blogadr',       url: 'https://blogadr.com/RPC2',                        method: 'XMLRPC' },
  { name: 'Blog-Updates',  url: 'https://blog-updates.info/api/ping/',             method: 'XMLRPC' },
  { name: 'Yandex',        url: 'https://blogs.yandex.ru/pings',                   method: 'XMLRPC' },
]

function buildXmlRpc(title: string, url: string): string {
  return `<?xml version="1.0"?>
<methodCall>
  <methodName>weblogUpdates.ping</methodName>
  <params>
    <param><value><string>${escapeXml(title)}</string></value></param>
    <param><value><string>${escapeXml(url)}</string></value></param>
  </params>
</methodCall>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function pingOne(service: (typeof PING_SERVICES)[0], url: string): Promise<{ service: string; status: 'success' | 'fail'; detail: string }> {
  try {
    const hostname = new URL(url).hostname
    const title = hostname

    if (service.method === 'GET') {
      const pingUrl = service.url.replace('{url}', encodeURIComponent(url))
      const res = await fetch(pingUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'YoAI SEO Pinger/1.0' },
      })
      return {
        service: service.name,
        status: res.ok || res.status === 301 || res.status === 302 ? 'success' : 'fail',
        detail: `HTTP ${res.status}`,
      }
    }

    // XML-RPC
    const body = buildXmlRpc(title, url)
    const res = await fetch(service.url, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'User-Agent': 'YoAI SEO Pinger/1.0',
      },
      body,
    })
    const text = await res.text()
    const success = res.ok && !text.includes('<boolean>0</boolean>') && !text.includes('flerror')
    return {
      service: service.name,
      status: success ? 'success' : 'fail',
      detail: `HTTP ${res.status}`,
    }
  } catch (err: unknown) {
    return {
      service: service.name,
      status: 'fail',
      detail: err instanceof Error ? err.message : 'Timeout',
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { urls } = body

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'En az bir URL gereklidir.' }, { status: 400 })
    }

    const validUrls = urls
      .map((u: string) => u.trim())
      .filter((u: string) => {
        try { new URL(u); return true } catch { return false }
      })
      .slice(0, 20)

    if (validUrls.length === 0) {
      return NextResponse.json({ error: 'Geçerli URL bulunamadı.' }, { status: 400 })
    }

    const results = await Promise.all(
      validUrls.map(async (url: string) => {
        const serviceResults = await Promise.allSettled(
          PING_SERVICES.map(s => pingOne(s, url))
        )

        const details = serviceResults.map((r, i) =>
          r.status === 'fulfilled'
            ? r.value
            : { service: PING_SERVICES[i].name, status: 'fail' as const, detail: 'Error' }
        )

        const successCount = details.filter(d => d.status === 'success').length

        return {
          url,
          success: successCount > 0,
          response: `${successCount}/${PING_SERVICES.length} servise gönderildi`,
          details,
        }
      })
    )

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Ping error:', error)
    return NextResponse.json({ error: 'Ping işlemi sırasında hata oluştu.' }, { status: 500 })
  }
}
