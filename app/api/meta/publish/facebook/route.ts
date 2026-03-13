import { NextRequest, NextResponse } from 'next/server'
import { getUserAccessToken } from '@/lib/meta/authHelpers'
import { getPageAccessToken } from '@/lib/meta/pageToken'
import { MetaGraphClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

interface PublishRequest {
  pageId: string
  mediaUrl: string
  mediaType: 'image' | 'video'
  caption?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PublishRequest
    const { pageId, mediaUrl, mediaType, caption } = body

    if (!pageId || !mediaUrl || !mediaType) {
      return NextResponse.json(
        { ok: false, error: 'invalid_request', message: 'pageId, mediaUrl ve mediaType zorunludur' },
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

    // Get page access token
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

    const client = new MetaGraphClient({ accessToken: pageToken, timeout: 60000 })

    if (mediaType === 'image') {
      const params = new URLSearchParams()
      params.append('url', mediaUrl)
      if (caption) params.append('message', caption)

      const result = await client.postForm(`/${pageId}/photos`, params)

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: 'publish_failed', message: result.error?.message || 'Görsel yayınlanamadı' },
          { status: result.status || 502 }
        )
      }

      return NextResponse.json({ ok: true, postId: result.data?.id || result.data?.post_id })
    } else {
      // Video publishing
      const params = new URLSearchParams()
      params.append('file_url', mediaUrl)
      if (caption) params.append('description', caption)

      const result = await client.postForm(`/${pageId}/videos`, params)

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: 'publish_failed', message: result.error?.message || 'Video yayınlanamadı' },
          { status: result.status || 502 }
        )
      }

      return NextResponse.json({ ok: true, postId: result.data?.id })
    }
  } catch (error) {
    console.error('[Facebook Publish] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
