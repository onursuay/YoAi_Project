import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import sharp from 'sharp'

fal.config({ credentials: process.env.FAL_KEY! })

const MIN_DIMENSION = 300

async function uploadBase64ToFal(dataUrl: string): Promise<string> {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
  let buffer = Buffer.from(base64, 'base64')

  // Ensure minimum 300x300 for fal.ai
  const image = sharp(buffer)
  const metadata = await image.metadata()
  const w = metadata.width ?? 0
  const h = metadata.height ?? 0

  if (w < MIN_DIMENSION || h < MIN_DIMENSION) {
    const newW = Math.max(w, MIN_DIMENSION)
    const newH = Math.max(h, MIN_DIMENSION)
    buffer = Buffer.from(await image.resize(newW, newH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).jpeg().toBuffer())
  }

  const blob = new Blob([buffer], { type: 'image/jpeg' })
  const file = new File([blob], 'reference.jpg', { type: 'image/jpeg' })
  const url = await fal.storage.upload(file)
  return url
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, aspect_ratio = '16:9', duration = '5', image_url } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    let result

    if (image_url) {
      // Reference image provided → use image-to-video endpoint
      const uploadedUrl = image_url.startsWith('data:')
        ? await uploadBase64ToFal(image_url)
        : image_url

      console.log('[generate-video] i2v url:', uploadedUrl.substring(0, 100))

      result = await fal.subscribe('fal-ai/kling-video/v2.5-turbo/pro/image-to-video', {
        input: {
          prompt,
          image_url: uploadedUrl,
          duration: '5' as const,
        },
        logs: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    } else {
      // No reference image → text-to-video
      result = await fal.subscribe('fal-ai/kling-video/v2.5-turbo/pro/text-to-video', {
        input: {
          prompt,
          duration: duration as '5' | '10',
          aspect_ratio,
          negative_prompt: 'blur, distort, low quality, watermark',
          cfg_scale: 0.5,
        },
        logs: false,
      })
    }

    const data = result.data as { video?: { url: string } }

    if (!data.video?.url) {
      return NextResponse.json({ error: 'No video generated' }, { status: 500 })
    }

    return NextResponse.json({
      url: data.video.url,
    })
  } catch (err: unknown) {
    let message = 'Video generation failed'
    let status = 500

    if (err instanceof Error) {
      message = err.message
      // fal.ai ApiError has status and body
      const falErr = err as Error & { status?: number; body?: { detail?: string } }
      if (falErr.status) status = falErr.status
      if (falErr.body?.detail) message = falErr.body.detail
    } else if (typeof err === 'object' && err !== null) {
      const e = err as Record<string, unknown>
      if (typeof e.message === 'string') message = e.message
      if (typeof e.status === 'number') status = e.status
      if (e.body && typeof e.body === 'object') {
        const body = e.body as Record<string, unknown>
        if (typeof body.detail === 'string') message = body.detail
        else message = JSON.stringify(body)
      }
    }

    console.error('[generate-video] Error:', status, message, JSON.stringify(err, null, 2))
    return NextResponse.json({ error: message }, { status })
  }
}
