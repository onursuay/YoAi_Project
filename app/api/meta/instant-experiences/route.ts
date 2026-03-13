import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
import { MetaGraphClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

interface PageWithToken { id: string; name: string; access_token?: string }

/**
 * GET /api/meta/instant-experiences?pageId=xxx
 * Returns Instant Experience (Canvas) objects for a given page.
 * Uses Page Access Token (required by /{page_id}/canvases).
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
    const experiences: { id: string; name: string }[] = []

    const fetchCanvases = async (page: PageWithToken, limit: string) => {
      const client = page.access_token
        ? new MetaGraphClient({ accessToken: page.access_token })
        : ctx.client
      const res = await client.get<{
        data?: { id: string; name?: string; body_elements?: unknown }[]
      }>(`/${page.id}/canvases`, {
        fields: 'id,name',
        limit,
      })
      if (res.ok && res.data?.data) {
        for (const c of res.data.data) {
          experiences.push({
            id: c.id,
            name: c.name || `Instant Experience ${c.id}`,
          })
        }
      }
    }

    if (pageId?.trim()) {
      const page = pages.find(p => p.id === pageId.trim())
      await fetchCanvases(page ?? { id: pageId.trim(), name: '' }, '50')
      return NextResponse.json({ ok: true, data: experiences })
    }

    // No pageId: get all pages' canvases
    for (const page of pages) {
      await fetchCanvases(page, '25')
    }

    return NextResponse.json({ ok: true, data: experiences })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
