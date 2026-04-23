import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext, buildGoogleAdsHeaders, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'

const ASSET_ERRORS = {
  tr: {
    invalidBody: 'Geçersiz istek gövdesi',
    missingImage: 'Görsel verisi eksik',
    missingVideo: 'YouTube video kimliği eksik',
    imageTooLarge: 'Görsel 5 MB sınırını aşıyor',
    invalidKind: 'Geçersiz asset türü',
    uploadFailed: 'Google Ads\'e yükleme başarısız oldu',
    generic: 'Asset yükleme başarısız oldu',
  },
  en: {
    invalidBody: 'Invalid request body',
    missingImage: 'Image data is missing',
    missingVideo: 'YouTube video ID is missing',
    imageTooLarge: 'Image exceeds 5 MB limit',
    invalidKind: 'Invalid asset kind',
    uploadFailed: 'Upload to Google Ads failed',
    generic: 'Asset upload failed',
  },
} as const

type AssetKind =
  | 'MARKETING_IMAGE'
  | 'SQUARE_MARKETING_IMAGE'
  | 'PORTRAIT_MARKETING_IMAGE'
  | 'LOGO'
  | 'SQUARE_LOGO'
  | 'YOUTUBE_VIDEO'

const IMAGE_KINDS: AssetKind[] = ['MARKETING_IMAGE', 'SQUARE_MARKETING_IMAGE', 'PORTRAIT_MARKETING_IMAGE', 'LOGO', 'SQUARE_LOGO']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

interface UploadBody {
  kind: AssetKind
  name: string
  /** Base64-encoded image bytes (without data URL prefix). Required for image kinds. */
  data?: string
  /** YouTube video ID (11 chars). Required for YOUTUBE_VIDEO. */
  youtubeVideoId?: string
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('NEXT_LOCALE')?.value ?? 'tr') === 'en' ? 'en' : 'tr'
  const msg = ASSET_ERRORS[locale]

  try {
    const ctx = await getGoogleAdsContext()
    const body = (await req.json()) as UploadBody

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: msg.invalidBody }, { status: 400 })
    }
    if (!body.kind || (!IMAGE_KINDS.includes(body.kind) && body.kind !== 'YOUTUBE_VIDEO')) {
      return NextResponse.json({ error: msg.invalidKind }, { status: 400 })
    }

    const safeName = (body.name || 'display_asset').slice(0, 120) + ' ' + Date.now()

    let operation: Record<string, unknown>
    if (body.kind === 'YOUTUBE_VIDEO') {
      if (!body.youtubeVideoId) {
        return NextResponse.json({ error: msg.missingVideo }, { status: 400 })
      }
      operation = {
        create: {
          name: safeName,
          type: 'YOUTUBE_VIDEO',
          youtubeVideoAsset: { youtubeVideoId: body.youtubeVideoId },
        },
      }
    } else {
      if (!body.data) {
        return NextResponse.json({ error: msg.missingImage }, { status: 400 })
      }
      // Approximate size check (base64 inflates by ~4/3)
      const approxBytes = Math.ceil((body.data.length * 3) / 4)
      if (approxBytes > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: msg.imageTooLarge }, { status: 400 })
      }
      operation = {
        create: {
          name: safeName,
          type: 'IMAGE',
          imageAsset: { data: body.data },
        },
      }
    }

    const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/assets:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({ operations: [operation] }),
    })
    const data = await res.json()
    if (!res.ok) {
      const googleErr = data?.error
      const firstDetail = googleErr?.details?.[0]?.errors?.[0]
      const message = firstDetail?.message ?? googleErr?.message ?? msg.uploadFailed
      return NextResponse.json({ error: message }, { status: res.status })
    }

    const resourceName: string = data.results?.[0]?.resourceName
    return NextResponse.json({ resourceName, kind: body.kind, name: safeName }, { status: 201 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[assets/upload] error:', message)
    return NextResponse.json({ error: msg.generic }, { status: 500 })
  }
}
