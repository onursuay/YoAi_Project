import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
import { MetaGraphClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

interface PageWithToken { id: string; name: string; access_token?: string }

/**
 * GET /api/meta/videos?pageId=xxx
 * Returns videos for a given Facebook page.
 * Uses Page Access Token (required by /{page_id}/videos).
 */
export async function GET(request: Request) {
  try {
    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')

    // Get all pages with their access tokens
    const pagesRes = await ctx.client.get<{
      data?: PageWithToken[]
    }>('/me/accounts', { fields: 'id,name,access_token', limit: '100' })

    const pages = pagesRes.ok ? pagesRes.data?.data ?? [] : []

    const videos: { id: string; title: string; description?: string; length?: number; created_time?: string }[] = []

    const fetchVideos = async (page: PageWithToken, limit: string) => {
      // Use page access token if available, fall back to user token
      const client = page.access_token
        ? new MetaGraphClient({ accessToken: page.access_token })
        : ctx.client
      const res = await client.get<{
        data?: { id: string; title?: string; description?: string; length?: number; created_time?: string }[]
      }>(`/${page.id}/videos`, {
        fields: 'id,title,description,length,created_time',
        limit,
      })
      if (res.ok && res.data?.data) {
        for (const v of res.data.data) {
          videos.push({
            id: v.id,
            title: v.title || `Video ${v.id}`,
            description: v.description,
            length: v.length,
            created_time: v.created_time,
          })
        }
      }
    }

    if (pageId?.trim()) {
      const page = pages.find(p => p.id === pageId.trim())
      await fetchVideos(page ?? { id: pageId.trim(), name: '' }, '50')
      return NextResponse.json({ ok: true, data: videos })
    }

    // No pageId: get all pages' videos
    for (const page of pages) {
      await fetchVideos(page, '25')
    }

    return NextResponse.json({ ok: true, data: videos })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
