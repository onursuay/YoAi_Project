import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from '@/lib/seo/imageForArticle'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { COST_PER_GENERATION } from '@/lib/subscription/types'

export async function POST(req: NextRequest) {
  try {
    const { prompt, aspect_ratio = '1:1', image_url } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    // Sunucu-taraflı kimlik + kredi guard — istemci atlanamaz (ç-curl/doğrudan fetch).
    const access = await chargeFeature({ featureKey: 'design_generation', creditCost: COST_PER_GENERATION })
    if (!access.ok) return NextResponse.json(access.body, { status: access.status })

    try {
      const result = await generateImage({ prompt, aspectRatio: aspect_ratio, imageUrl: image_url })
      return NextResponse.json({
        url: result.url,
        width: result.width,
        height: result.height,
      })
    } catch (genErr) {
      await access.refund() // üretim başarısız → düşülen krediyi geri ver
      throw genErr
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Image generation failed'
    console.error('[generate-image]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
