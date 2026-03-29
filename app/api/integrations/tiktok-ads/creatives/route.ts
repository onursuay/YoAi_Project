import { NextResponse } from 'next/server'
import { getTikTokContext, tiktokApiRequest } from '@/lib/tiktokAdsAuth'

export const dynamic = 'force-dynamic'

interface TikTokImage {
  image_id: string
  material_id: string
  url: string
  width: number
  height: number
  file_name: string
  create_time: string
}

interface TikTokVideo {
  video_id: string
  material_id: string
  preview_url: string
  duration: number
  file_name: string
  create_time: string
  width: number
  height: number
}

/**
 * GET /api/integrations/tiktok-ads/creatives?type=image|video
 * List uploaded creative assets.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const type = url.searchParams.get('type') || 'image'

  let ctx
  try {
    ctx = await getTikTokContext()
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string }
    return NextResponse.json(
      { ok: false, error: e.code || 'not_connected', message: e.message },
      { status: e.status || 401 }
    )
  }

  try {
    if (type === 'video') {
      const data = await tiktokApiRequest<{ list: TikTokVideo[] }>(
        '/file/video/ad/get/',
        ctx,
        {
          params: {
            advertiser_id: ctx.advertiserId,
            page_size: '100',
          },
        }
      )

      const videos = (data?.list || []).map((v) => ({
        videoId: v.video_id,
        materialId: v.material_id,
        previewUrl: v.preview_url,
        duration: v.duration,
        fileName: v.file_name,
        width: v.width,
        height: v.height,
        createdAt: v.create_time,
      }))

      return NextResponse.json(
        { ok: true, type: 'video', assets: videos },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    } else {
      const data = await tiktokApiRequest<{ list: TikTokImage[] }>(
        '/file/image/ad/get/',
        ctx,
        {
          params: {
            advertiser_id: ctx.advertiserId,
            page_size: '100',
          },
        }
      )

      const images = (data?.list || []).map((img) => ({
        imageId: img.image_id,
        materialId: img.material_id,
        url: img.url,
        width: img.width,
        height: img.height,
        fileName: img.file_name,
        createdAt: img.create_time,
      }))

      return NextResponse.json(
        { ok: true, type: 'image', assets: images },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }
  } catch (err) {
    console.error('[TikTok Creatives] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 500 }
    )
  }
}
