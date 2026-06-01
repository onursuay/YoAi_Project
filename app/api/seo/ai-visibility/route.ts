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

const NOT_KNOWN_PHRASES = [
  "i don't have", "i do not have", "no information", "cannot find",
  "no specific information", "i couldn't find", "i could not find",
  "not aware", "don't know", "do not know", "unable to find",
  "bilinmiyor", "bilgi yok", "bulunamadı",
]

async function checkViaTavily(apiKey: string, domain: string): Promise<{ visible: boolean; excerpt: string | null }> {
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
    console.error('[ai-visibility] Tavily error', response.status, errText)
    throw new Error(`Tavily ${response.status}`)
  }
  const data = await response.json()
  const answer: string = data?.answer ?? ''
  const results: { content?: string }[] = data?.results ?? []
  const combined = [answer, ...results.map(r => r.content ?? '')].join(' ').toLowerCase()
  const domainBase = domain.split('.')[0]
  const mentioned = combined.includes(domainBase) || combined.includes(domain)
  const notVisible = NOT_KNOWN_PHRASES.some(p => combined.includes(p))
  const visible = !notVisible && (mentioned || results.length > 0)
  const excerpt = answer.length > 0 ? answer.substring(0, 300) : (results[0]?.content?.substring(0, 300) ?? null)
  return { visible, excerpt }
}

async function checkViaPerplexity(apiKey: string, domain: string): Promise<{ visible: boolean; excerpt: string | null }> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [{ role: 'user', content: `What is ${domain}? Briefly describe this website or business in 2-3 sentences.` }],
      max_tokens: 200,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`Perplexity ${response.status}`)
  const data = await response.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  const lower = content.toLowerCase()
  const domainBase = domain.split('.')[0]
  const mentioned = lower.includes(domainBase) || lower.includes(domain)
  const notVisible = NOT_KNOWN_PHRASES.some(p => lower.includes(p))
  const visible = !notVisible && (mentioned || content.length > 50)
  return { visible, excerpt: content.length > 0 ? content.substring(0, 300) : null }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const domain = extractDomain(url)
    const tavilyKey = process.env.TAVILY_API_KEY
    const perplexityKey = process.env.PERPLEXITY_API_KEY

    if (!tavilyKey && !perplexityKey) {
      return NextResponse.json({ visible: false, excerpt: null, domain, error: 'not_configured' })
    }

    // Tavily önce, Perplexity fallback
    if (tavilyKey) {
      const result = await checkViaTavily(tavilyKey, domain)
      return NextResponse.json({ ...result, domain })
    }

    const result = await checkViaPerplexity(perplexityKey!, domain)
    return NextResponse.json({ ...result, domain })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
