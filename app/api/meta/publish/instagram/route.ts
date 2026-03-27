import { NextRequest, NextResponse } from 'next/server'
import { getUserAccessToken } from '@/lib/meta/authHelpers'
import { getPageAccessToken } from '@/lib/meta/pageToken'
import { MetaGraphClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Allow up to 2 minutes for video processing

const POLL_INTERVAL_MS = 5000
const MAX_POLLS = 12 // 60 seconds max

type PublishType = 'feed' | 'reels' | 'stories'

interface PublishRequest {
  pageId: string
  igUserId: string
  mediaUrl: string
  mediaType: 'image' | 'video'
  publishType?: PublishType
  caption?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PublishRequest
    const { pageId, igUserId, mediaUrl, mediaType, publishType = 'feed', caption } = body

    if (!pageId || !igUserId || !mediaUrl || !mediaType) {
      return NextResponse.json(
        { ok: false, error: 'invalid_request', message: 'pageId, igUserId, mediaUrl ve mediaType zorunludur' },
        { status: 400 }
      )
    }

    const userToken = await getUserAccessToken()
    if (!userToken) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    // Get page access token (Instagram API uses page token)
    let pageToken: string
    try {
      const tokenResult = await getPageAccessToken(userToken, pageId)
      pageToken = tokenResult.pageToken
    } catch (err: any) {
      const kind = err?.kind || 'unknown'
      return NextResponse.json(
        { ok: false, error: kind, message: err?.message || 'Sayfa token\'ı alınamadı' },
        { status: kind === 'meta_rate_limited' ? 429 : 502 }
      )
    }

    const client = new MetaGraphClient({ accessToken: pageToken, timeout: 30000 })

    // Validate: Reels only supports video
    if (publishType === 'reels' && mediaType === 'image') {
      return NextResponse.json(
        { ok: false, error: 'invalid_request', message: 'Reels yalnızca video destekler' },
        { status: 400 }
      )
    }

    // Step 1: Create media container
    const containerParams = new URLSearchParams()

    // Stories do not support captions per Instagram API
    if (caption && publishType !== 'stories') {
      containerParams.append('caption', caption)
    }

    // Set media URL
    if (mediaType === 'image') {
      containerParams.append('image_url', mediaUrl)
    } else {
      containerParams.append('video_url', mediaUrl)
    }

    // Set media_type based on publishType
    if (publishType === 'reels') {
      containerParams.append('media_type', 'REELS')
    } else if (publishType === 'stories') {
      containerParams.append('media_type', 'STORIES')
    }
    // feed: no media_type needed (default behavior)

    const containerResult = await client.postForm(`/${igUserId}/media`, containerParams)

    if (!containerResult.ok) {
      return NextResponse.json(
        { ok: false, error: 'ig_container_error', message: containerResult.error?.message || 'Instagram medya container\'ı oluşturulamadı' },
        { status: containerResult.status || 502 }
      )
    }

    const containerId = containerResult.data?.id
    if (!containerId) {
      return NextResponse.json(
        { ok: false, error: 'ig_container_error', message: 'Container ID alınamadı' },
        { status: 502 }
      )
    }

    // Step 2: For video (any publish type) and Stories, poll until container is ready
    const needsPolling = mediaType === 'video' || publishType === 'stories'
    if (needsPolling) {
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

        const statusResult = await client.get(`/${containerId}`, {
          fields: 'status_code',
        })

        if (statusResult.ok) {
          const statusCode = statusResult.data?.status_code
          if (statusCode === 'FINISHED') break
          if (statusCode === 'ERROR') {
            return NextResponse.json(
              { ok: false, error: 'ig_container_error', message: 'Instagram video işleme başarısız oldu' },
              { status: 502 }
            )
          }
        }

        if (i === MAX_POLLS - 1) {
          return NextResponse.json(
            { ok: false, error: 'ig_timeout', message: 'Instagram video işleme zaman aşımına uğradı' },
            { status: 504 }
          )
        }
      }
    }

    // Step 3: Publish the container
    const publishParams = new URLSearchParams()
    publishParams.append('creation_id', containerId)

    const publishResult = await client.postForm(`/${igUserId}/media_publish`, publishParams)

    if (!publishResult.ok) {
      return NextResponse.json(
        { ok: false, error: 'publish_failed', message: publishResult.error?.message || 'Instagram yayınlama başarısız oldu' },
        { status: publishResult.status || 502 }
      )
    }

    return NextResponse.json({ ok: true, mediaId: publishResult.data?.id })
  } catch (error) {
    console.error('[Instagram Publish] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
