import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from '@/lib/seo/imageForArticle'

export async function POST(req: NextRequest) {
  try {
    const { prompt, aspect_ratio = '1:1', image_url } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    const result = await generateImage({ prompt, aspectRatio: aspect_ratio, imageUrl: image_url })

    return NextResponse.json({
      url: result.url,
      width: result.width,
      height: result.height,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Image generation failed'
    console.error('[generate-image]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
