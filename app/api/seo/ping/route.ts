import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { urls } = body

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'En az bir URL gereklidir.' }, { status: 400 })
    }

    const apiKey = process.env.PINGLER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Pingler API key yapılandırılmamış.' }, { status: 500 })
    }

    const results = await Promise.allSettled(
      urls.map(async (url: string) => {
        const res = await fetch(
          `https://pingler.com/api/ping/?key=${apiKey}&url=${encodeURIComponent(url)}`,
          { signal: AbortSignal.timeout(10000) }
        )
        const text = await res.text()
        return { url, success: res.ok, response: text }
      })
    )

    const output = results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      return { url: urls[i], success: false, response: 'Timeout veya bağlantı hatası' }
    })

    return NextResponse.json({ results: output })
  } catch (error) {
    console.error('Ping error:', error)
    return NextResponse.json({ error: 'Ping işlemi sırasında hata oluştu.' }, { status: 500 })
  }
}
