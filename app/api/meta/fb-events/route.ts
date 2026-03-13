import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
import { MetaGraphClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

interface PageWithToken { id: string; name: string; access_token?: string }

/**
 * GET /api/meta/fb-events?pageId=xxx
 * Returns Facebook events for a given page.
 * Uses Page Access Token (required by /{page_id}/events).
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
    const events: { id: string; name: string; start_time?: string; place?: string }[] = []

    const fetchEvents = async (page: PageWithToken, limit: string) => {
      const client = page.access_token
        ? new MetaGraphClient({ accessToken: page.access_token })
        : ctx.client
      const res = await client.get<{
        data?: { id: string; name: string; start_time?: string; place?: { name?: string } }[]
      }>(`/${page.id}/events`, {
        fields: 'id,name,start_time,place',
        limit,
      })
      if (res.ok && res.data?.data) {
        for (const e of res.data.data) {
          events.push({
            id: e.id,
            name: e.name || `Event ${e.id}`,
            start_time: e.start_time,
            place: e.place?.name,
          })
        }
      }
    }

    if (pageId?.trim()) {
      const page = pages.find(p => p.id === pageId.trim())
      await fetchEvents(page ?? { id: pageId.trim(), name: '' }, '50')
      return NextResponse.json({ ok: true, data: events })
    }

    // No pageId: get all pages' events
    for (const page of pages) {
      await fetchEvents(page, '25')
    }

    return NextResponse.json({ ok: true, data: events })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
