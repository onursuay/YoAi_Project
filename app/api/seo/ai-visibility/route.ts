import { NextRequest, NextResponse } from 'next/server'

function extractDomain(raw: string): string {
  try {
    let url = raw.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return raw.trim().replace(/^www\./, '')
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const domain = extractDomain(url)

    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        visible: false,
        excerpt: null,
        domain,
        error: 'not_configured',
      })
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `What is ${domain}? Describe this website or business.`,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json({ error: `Tavily API error: ${response.status}`, detail: errText }, { status: 502 })
    }

    const data = await response.json()
    const answer: string = data?.answer ?? ''
    const results: { url?: string; content?: string }[] = data?.results ?? []

    // İçeriği birleştir: answer + ilk sonuçların içeriği
    const combinedText = [answer, ...results.map(r => r.content ?? '')].join(' ').toLowerCase()

    const domainBase = domain.split('.')[0]
    const domainMentioned = combinedText.includes(domainBase.toLowerCase()) || combinedText.includes(domain.toLowerCase())

    const notKnownPhrases = [
      "i don't have", "i do not have", "no information", "cannot find",
      "no specific information", "i couldn't find", "i could not find",
      "not aware", "don't know", "do not know", "unable to find",
    ]
    const notVisible = notKnownPhrases.some(p => combinedText.includes(p))

    const visible = !notVisible && (domainMentioned || results.length > 0)

    const excerpt = answer.length > 0
      ? answer.substring(0, 300)
      : results[0]?.content?.substring(0, 300) ?? null

    return NextResponse.json({ visible, excerpt, domain })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
