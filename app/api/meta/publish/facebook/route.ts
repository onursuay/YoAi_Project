import { NextRequest, NextResponse } from 'next/server'
import { getUserAccessToken } from '@/lib/meta/authHelpers'
import { getPageAccessToken } from '@/lib/meta/pageToken'
import { MetaGraphClient } from '@/lib/meta/client'
import { META_GRAPH_VERSION } from '@/lib/metaConfig'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Reels upload may take time

type FbPublishType = 'feed' | 'reels'

interface PublishRequest {
  pageId: string
  mediaUrl: string
  mediaType: 'image' | 'video'
  publishType?: FbPublishType
  caption?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PublishRequest
    const { pageId, mediaUrl, mediaType, publishType = 'feed', caption } = body

    if (!pageId || !mediaUrl || !mediaType) {
      return NextResponse.json(
        { ok: false, error: 'invalid_request', message: 'pageId, mediaUrl ve mediaType zorunludur' },
        { status: 400 }
      )
    }

    // Reels only supports video
    if (publishType === 'reels' && mediaType === 'image') {
      return NextResponse.json(
        { ok: false, error: 'invalid_request', message: 'Facebook Reels yalnızca video destekler' },
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

    // ─── Reels (3-phase upload) ───
    if (publishType === 'reels') {
      return await publishReels(client, pageId, pageToken, mediaUrl, caption)
    }

    // ─── Feed ───
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

/**
 * Facebook Reels — 3-phase upload flow
 * 1. POST /{page-id}/video_reels  upload_phase=start  → video_id
 * 2. POST rupload.facebook.com    binary upload
 * 3. POST /{page-id}/video_reels  upload_phase=finish  → published
 */
async function publishReels(
  client: MetaGraphClient,
  pageId: string,
  pageToken: string,
  videoUrl: string,
  caption?: string
): Promise<NextResponse> {
  // Phase 1: Initialize upload
  const startParams = new URLSearchParams()
  startParams.append('upload_phase', 'start')

  const startResult = await client.postForm(`/${pageId}/video_reels`, startParams)

  if (!startResult.ok || !startResult.data?.video_id) {
    return NextResponse.json(
      { ok: false, error: 'reels_start_failed', message: startResult.error?.message || 'Reels başlatılamadı' },
      { status: startResult.status || 502 }
    )
  }

  const videoId = startResult.data.video_id

  // Phase 2: Download video from URL and upload binary to rupload
  let videoBuffer: ArrayBuffer
  try {
    const videoRes = await fetch(videoUrl, { signal: AbortSignal.timeout(30000) })
    if (!videoRes.ok) throw new Error(`Video indirilemedi: ${videoRes.status}`)
    videoBuffer = await videoRes.arrayBuffer()
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'video_download_failed', message: err?.message || 'Video indirilemedi' },
      { status: 502 }
    )
  }

  const uploadUrl = `https://rupload.facebook.com/video-upload/${META_GRAPH_VERSION}/${videoId}`

  try {
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${pageToken}`,
        'offset': '0',
        'file_size': videoBuffer.byteLength.toString(),
        'Content-Type': 'application/octet-stream',
      },
      body: videoBuffer,
      signal: AbortSignal.timeout(60000),
    })

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text().catch(() => '')
      console.error('[Facebook Reels] Upload failed:', uploadRes.status, errBody)
      return NextResponse.json(
        { ok: false, error: 'reels_upload_failed', message: 'Reels video yüklenemedi' },
        { status: 502 }
      )
    }
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'reels_upload_failed', message: err?.message || 'Video upload hatası' },
      { status: 502 }
    )
  }

  // Phase 3: Finish and publish
  const finishParams = new URLSearchParams()
  finishParams.append('upload_phase', 'finish')
  finishParams.append('video_id', videoId)
  if (caption) finishParams.append('description', caption)

  const finishResult = await client.postForm(`/${pageId}/video_reels`, finishParams)

  if (!finishResult.ok) {
    return NextResponse.json(
      { ok: false, error: 'reels_finish_failed', message: finishResult.error?.message || 'Reels yayınlanamadı' },
      { status: finishResult.status || 502 }
    )
  }

  return NextResponse.json({ ok: true, postId: finishResult.data?.id || videoId })
}
