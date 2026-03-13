import { INTENT_DETECTION_PROMPT } from '@/lib/yoai/prompts'
import type { ContentCategory } from '@/lib/yoai/types'

export const runtime = 'edge'

const VALID_INTENTS: ContentCategory[] = [
  'seo_article',
  'ad_copy',
  'social_media',
  'email_marketing',
  'product_description',
  'landing_page',
  'slogan',
  'off_topic',
]

export async function POST(req: Request) {
  try {
    const { message } = (await req.json()) as { message: string }

    if (!message) {
      return Response.json({ error: 'Mesaj gerekli' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'AI servisi yapılandırılmamış' }, { status: 500 })
    }

    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: INTENT_DETECTION_PROMPT },
          { role: 'user', content: message },
        ],
        temperature: 0,
        max_tokens: 30,
      }),
    })

    if (!response.ok) {
      console.error('[YoAi Intent] OpenAI error:', response.status)
      return Response.json({ error: 'AI yanıt veremedi' }, { status: 502 })
    }

    const data = await response.json()
    const raw = (data.choices?.[0]?.message?.content || '').trim().toLowerCase()

    // Extract valid intent from response
    const intent: ContentCategory = VALID_INTENTS.find((i) => raw.includes(i)) || 'off_topic'

    return Response.json({ intent })
  } catch (err) {
    console.error('[YoAi Intent] Unexpected error:', err)
    return Response.json({ error: 'Beklenmeyen bir hata oluştu' }, { status: 500 })
  }
}
