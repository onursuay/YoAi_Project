import { NextRequest, NextResponse } from 'next/server'
import { claudeText, isClaudeReady } from '@/lib/anthropic/text'
import { chargeFeature } from '@/lib/billing/featureGuard'

export async function POST(req: NextRequest) {
  try {
    // Yardımcı (ucuz) Claude çağrısı — kredi düşmez ama kimlik şart (bedava kullanım engeli).
    const access = await chargeFeature({ featureKey: 'design_enhance_prompt' })
    if (!access.ok) return NextResponse.json(access.body, { status: access.status })

    const { prompt, mode, hasReferenceImage, locale = 'tr' } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!isClaudeReady()) {
      return NextResponse.json({ error: 'AI servisi yapılandırılmamış' }, { status: 500 })
    }

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

    const enhanced = (await claudeText({
      system: systemPrompt,
      user: prompt,
      maxTokens: 400,
      temperature: 0.8,
    }))?.trim()

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
