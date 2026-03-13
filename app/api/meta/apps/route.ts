import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meta/apps
 * Returns apps connected to the ad account (SDK-registered).
 * Meta endpoint: /{ad_account_id}/advertisable_applications
 */
export async function GET() {
  try {
    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
    }

    const res = await ctx.client.get<{
      data?: { id: string; name: string; object_store_urls?: { google_play?: string; itunes?: string } }[]
    }>(`/${ctx.accountId}/advertisable_applications`, {
      fields: 'id,name,object_store_urls',
      limit: '50',
    })

    if (res.ok && res.data?.data) {
      return NextResponse.json({
        ok: true,
        data: res.data.data.map(a => ({
          id: a.id,
          name: a.name,
          storeUrl: a.object_store_urls?.google_play || a.object_store_urls?.itunes || undefined,
        })),
      })
    }

    return NextResponse.json({ ok: true, data: [] })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
