import 'server-only'
import { fal } from '@fal-ai/client'

/**
 * Paylaşılan fal.ai görsel üretim katmanı.
 *
 * Hem Tasarım alanı (app/api/tasarim/generate-image) hem de SEO otomatik
 * makale akışı (inngest/functions/seoArticleRun + manuel publish) bu
 * fonksiyonu kullanır. Böylece görsel üretim mantığı tek yerde tutulur ve
 * Tasarım route'unun imzası korunur.
 *
 * - Referans görseli (image_url) varsa → Flux Pro Kontext (image+text)
 * - Yoksa → ByteDance Seedream v4 (text-to-image, en iyi fiyat/kalite)
 */

const ASPECT_MAP: Record<string, string> = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
}

let configured = false
function ensureConfigured() {
  if (!configured) {
    fal.config({ credentials: process.env.FAL_KEY! })
    configured = true
  }
}

export function isImageReady(): boolean {
  return Boolean(process.env.FAL_KEY)
}

async function uploadBase64ToFal(dataUrl: string): Promise<string> {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const buffer = Buffer.from(base64, 'base64')
  const blob = new Blob([buffer], { type: mime })
  const file = new File([blob], 'reference.jpg', { type: mime })
  return fal.storage.upload(file)
}

export interface GenerateImageInput {
  prompt: string
  aspectRatio?: string            // '1:1' | '16:9' | '9:16' | '4:3'
  imageUrl?: string               // referans görsel (url veya data: base64)
}

export interface GenerateImageResult {
  url: string
  width?: number
  height?: number
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY not configured')
  }
  ensureConfigured()

  const aspect = input.aspectRatio || '1:1'
  let result

  if (input.imageUrl) {
    const uploadedUrl = input.imageUrl.startsWith('data:')
      ? await uploadBase64ToFal(input.imageUrl)
      : input.imageUrl
    result = await fal.subscribe('fal-ai/flux-pro/kontext', {
      input: {
        prompt: input.prompt,
        image_url: uploadedUrl,
        aspect_ratio: aspect,
        output_format: 'jpeg',
        safety_tolerance: '2',
      },
      logs: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  } else {
    result = await fal.subscribe('fal-ai/bytedance/seedream/v4/text-to-image', {
      input: {
        prompt: input.prompt,
        image_size: ASPECT_MAP[aspect] || 'square_hd',
        num_images: 1,
      },
      logs: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.data as any
  if (!data?.images || data.images.length === 0) {
    throw new Error('No image generated')
  }
  return {
    url: data.images[0].url,
    width: data.images[0].width,
    height: data.images[0].height,
  }
}
