import { NextResponse } from 'next/server'
import { getTikTokContext, buildTikTokHeaders, fetchWithRetry } from '@/lib/tiktokAdsAuth'
import { TIKTOK_ADS_API_BASE } from '@/lib/tiktok-ads/constants'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/tiktok-ads/creatives/upload
 * Upload image or video creative to TikTok Ads.
 * Accepts multipart/form-data with 'file' and 'type' (image|video) fields.
 */
export async function POST(request: Request) {
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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', message: 'multipart/form-data required' },
      { status: 400 }
    )
  }

  const file = formData.get('file') as File | null
  const type = (formData.get('type') as string) || 'image'

  if (!file) {
    return NextResponse.json(
      { ok: false, error: 'validation_error', message: 'File is required' },
      { status: 400 }
    )
  }

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // TikTok requires multipart upload for files
    const boundary = `----TikTokUpload${Date.now()}`
    const parts: Buffer[] = []

    // advertiser_id field
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="advertiser_id"\r\n\r\n${ctx.advertiserId}\r\n`
    ))

    if (type === 'video') {
      // Video upload
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="video_file"; filename="${file.name}"\r\nContent-Type: ${file.type || 'video/mp4'}\r\n\r\n`
      ))
      parts.push(buffer)
      parts.push(Buffer.from('\r\n'))
      parts.push(Buffer.from(`--${boundary}--\r\n`))

      const body = Buffer.concat(parts)

      const res = await fetchWithRetry(
        `${TIKTOK_ADS_API_BASE}/file/video/ad/upload/`,
        {
          method: 'POST',
          headers: {
            'Access-Token': ctx.accessToken,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
        }
      )

      const json = await res.json().catch(() => ({}))
      if (json.code !== 0) {
        return NextResponse.json(
          { ok: false, error: 'tiktok_api_error', message: json.message || 'Video upload failed' },
          { status: 502 }
        )
      }

      return NextResponse.json(
        { ok: true, type: 'video', videoId: json.data?.video_id },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      )
    } else {
      // Image upload
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image_file"; filename="${file.name}"\r\nContent-Type: ${file.type || 'image/jpeg'}\r\n\r\n`
      ))
      parts.push(buffer)
      parts.push(Buffer.from('\r\n'))

      // upload_type
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="upload_type"\r\n\r\nUPLOAD_BY_FILE\r\n`
      ))

      parts.push(Buffer.from(`--${boundary}--\r\n`))

      const body = Buffer.concat(parts)

      const res = await fetchWithRetry(
        `${TIKTOK_ADS_API_BASE}/file/image/ad/upload/`,
        {
          method: 'POST',
          headers: {
            'Access-Token': ctx.accessToken,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
        }
      )

      const json = await res.json().catch(() => ({}))
      if (json.code !== 0) {
        return NextResponse.json(
          { ok: false, error: 'tiktok_api_error', message: json.message || 'Image upload failed' },
          { status: 502 }
        )
      }

      return NextResponse.json(
        {
          ok: true,
          type: 'image',
          imageId: json.data?.image_id,
          imageUrl: json.data?.image_url,
        },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      )
    }
  } catch (err) {
    console.error('[TikTok Creative Upload] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { ok: false, error: 'tiktok_api_error', message },
      { status: 502 }
    )
  }
}
