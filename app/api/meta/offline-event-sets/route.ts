import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meta/offline-event-sets
 * Returns offline event sets for the ad account.
 * Meta endpoint: /{ad_account_id}/offline_conversion_data_sets
 */
export async function GET() {
  try {
    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
    }

    const res = await ctx.client.get<{
      data?: { id: string; name: string; event_stats?: string; is_mta_use?: boolean }[]
    }>(`/${ctx.accountId}/offline_conversion_data_sets`, {
      fields: 'id,name,event_stats,is_mta_use',
      limit: '50',
    })

    if (res.ok && res.data?.data) {
      return NextResponse.json({
        ok: true,
        data: res.data.data.map(s => ({
          id: s.id,
          name: s.name,
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
