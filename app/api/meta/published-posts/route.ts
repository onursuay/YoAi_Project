import { NextRequest, NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

interface PublishedPost {
  id: string
  message?: string
  full_picture?: string
  permalink_url?: string
  created_time?: string
  type?: string // 'photo', 'video', 'carousel_album', etc.
  media_url?: string // Instagram media URL
  thumbnail_url?: string // Instagram video thumbnail
  caption?: string // Instagram caption
  media_type?: string // Instagram: 'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'
  platform: 'facebook' | 'instagram'
}

/**
 * GET /api/meta/published-posts
 * Query params:
 *   - pageId: Facebook Page ID (required)
 *   - instagramAccountId: Instagram Business Account ID (optional)
 *   - platform: 'facebook' | 'instagram' | 'both' (default: 'both')
 *
 * Returns published posts from Facebook page and/or Instagram account
 */
export async function GET(request: NextRequest) {
  try {
    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const pageId = searchParams.get('pageId')
    const instagramAccountId = searchParams.get('instagramAccountId')
    const platform = searchParams.get('platform') || 'both'

    if (!pageId) {
      return NextResponse.json(
        { ok: false, error: 'missing_page_id', message: 'Facebook Page ID gereklidir' },
        { status: 400 }
      )
    }

    const posts: PublishedPost[] = []

    // Fetch Facebook Posts
    if (platform === 'facebook' || platform === 'both') {
      try {
        const fbPostsResult = await metaClient.client.get(`/${pageId}/posts`, {
          fields: 'id,message,full_picture,permalink_url,created_time,type',
          limit: '50', // Son 50 post
        })

        if (fbPostsResult.ok && fbPostsResult.data?.data) {
          const fbPosts = fbPostsResult.data.data.map((post: any) => ({
            ...post,
            platform: 'facebook' as const,
          }))
          posts.push(...fbPosts)
          if (DEBUG) console.log('[Published Posts] Facebook posts:', fbPosts.length)
        }
      } catch (error) {
        if (DEBUG) console.error('[Published Posts] Facebook error:', error)
      }
    }

    // Fetch Instagram Posts
    if ((platform === 'instagram' || platform === 'both') && instagramAccountId) {
      try {
        const igMediaResult = await metaClient.client.get(`/${instagramAccountId}/media`, {
          fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
          limit: '50', // Son 50 medya
        })

        if (igMediaResult.ok && igMediaResult.data?.data) {
          const igPosts = igMediaResult.data.data.map((media: any) => ({
            id: media.id,
            message: media.caption,
            caption: media.caption,
            full_picture: media.media_type === 'VIDEO' ? media.thumbnail_url : media.media_url,
            media_url: media.media_url,
            thumbnail_url: media.thumbnail_url,
            permalink_url: media.permalink,
            created_time: media.timestamp,
            type: media.media_type?.toLowerCase(),
            media_type: media.media_type,
            platform: 'instagram' as const,
          }))
          posts.push(...igPosts)
          if (DEBUG) console.log('[Published Posts] Instagram posts:', igPosts.length)
        }
      } catch (error) {
        if (DEBUG) console.error('[Published Posts] Instagram error:', error)
      }
    }

    // Tarihe göre sırala (en yeni en başta)
    posts.sort((a, b) => {
      const timeA = a.created_time ? new Date(a.created_time).getTime() : 0
      const timeB = b.created_time ? new Date(b.created_time).getTime() : 0
      return timeB - timeA
    })

    return NextResponse.json({
      ok: true,
      data: posts,
      count: posts.length,
    })
  } catch (error) {
    if (DEBUG) console.error('[Published Posts] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
