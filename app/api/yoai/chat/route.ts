import { buildGenerationPrompt } from '@/lib/yoai/prompts'
import type { ContentCategory } from '@/lib/yoai/types'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { category, params } = (await req.json()) as {
      category: Exclude<ContentCategory, 'off_topic'>
      params: Record<string, string>
    }

    if (!category || !params) {
      return Response.json({ error: 'Kategori ve parametreler gerekli' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'AI servisi yapılandırılmamış' }, { status: 500 })
    }

    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const systemPrompt = buildGenerationPrompt(category, params)

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'İçeriği oluştur.' },
        ],
        temperature: 0.6,
        max_tokens: 4000,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[YoAi Chat] OpenAI error:', response.status, errorText)
      return Response.json({ error: 'AI yanıt veremedi' }, { status: 502 })
    }

    // Forward SSE stream
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || !trimmed.startsWith('data: ')) continue

              const data = trimmed.slice(6)
              if (data === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                continue
              }

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                if (content) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                  )
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        } catch (err) {
          console.error('[YoAi Chat] Stream error:', err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[YoAi Chat] Unexpected error:', err)
    return Response.json({ error: 'Beklenmeyen bir hata oluştu' }, { status: 500 })
  }
}
