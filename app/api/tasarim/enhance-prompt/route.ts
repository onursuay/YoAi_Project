import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { prompt, mode, hasReferenceImage, locale = 'tr' } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const isVideo = mode === 'video'

    const lang = locale === 'en' ? 'English' : 'Turkish'

    const systemPrompt = `You are a professional AI creative director. The user will write a simple prompt, and you will transform it into a detailed, professional prompt optimized for ${isVideo ? 'video' : 'image'} generation models.

Rules:
- Write the prompt in ${lang}
- Think from an advertising/product perspective (this is an ad platform)
- Add details like lighting, composition, color palette, camera angle
- ${isVideo ? 'Add video-specific details: motion, camera movement, speed, transitions' : 'Add details: texture, depth of field, background'}
- ${hasReferenceImage ? 'The user uploaded a reference image, the prompt should be compatible with it' : ''}
- Write ONLY the prompt, no explanations
- Maximum 3-4 sentences, keep it concise`

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 300,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `OpenAI API error: ${res.status}`)
    }

    const data = await res.json()
    const enhanced = data.choices?.[0]?.message?.content?.trim()

    if (!enhanced) {
      throw new Error('No response from AI')
    }

    return NextResponse.json({ enhanced })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Prompt enhancement failed'
    console.error('[enhance-prompt]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
