import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY! })

const ASPECT_MAP: Record<string, string> = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
}

async function uploadBase64ToFal(dataUrl: string): Promise<string> {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const buffer = Buffer.from(base64, 'base64')
  const blob = new Blob([buffer], { type: mime })
  const file = new File([blob], 'reference.jpg', { type: mime })
  const url = await fal.storage.upload(file)
  return url
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, aspect_ratio = '1:1', image_url } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    let result

    if (image_url) {
      // Reference image provided → use Flux Kontext (understands image context + prompt)
      const uploadedUrl = image_url.startsWith('data:')
        ? await uploadBase64ToFal(image_url)
        : image_url

      result = await fal.subscribe('fal-ai/flux-pro/kontext', {
        input: {
          prompt,
          image_url: uploadedUrl,
          aspect_ratio,
          output_format: 'jpeg',
          safety_tolerance: '2',
        },
        logs: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    } else {
      // No reference image → Seedream v4 (best price/quality: $0.03/image)
      result = await fal.subscribe('fal-ai/bytedance/seedream/v4/text-to-image', {
        input: {
          prompt,
          image_size: ASPECT_MAP[aspect_ratio] || 'square_hd',
          num_images: 1,
        },
        logs: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.data as any

    if (!data.images || data.images.length === 0) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 })
    }

    return NextResponse.json({
      url: data.images[0].url,
      width: data.images[0].width,
      height: data.images[0].height,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Image generation failed'
    console.error('[generate-image]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
