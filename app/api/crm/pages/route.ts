import { NextResponse } from 'next/server'
import { checkCrmAccess } from '@/lib/crm/guard'
import { resolveMetaContext } from '@/lib/meta/context'
import { listSubscriptions } from '@/lib/crm/pageSubscriptionStore'

export const dynamic = 'force-dynamic'

/**
 * GET /api/crm/pages
 * Kullanıcının bağlanabilir Facebook Page'leri (/me/accounts) + halihazırda
 * CRM'e bağlı (leadgen abone) page'ler. Abonelik gate korunur.
 */
export async function GET() {
  const access = await checkCrmAccess()
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  const subs = await listSubscriptions(access.user.id)
  const connected = subs.map((s) => ({ pageId: s.page_id, pageName: s.page_name }))

  const ctx = await resolveMetaContext()
  if (!ctx) {
    // Meta bağlı değil — UI "önce Meta'yı bağla" gösterir.
    return NextResponse.json({ ok: true, metaConnected: false, pages: [], connected })
  }

  const res = await ctx.client.get<{ data?: Array<{ id: string; name?: string }> }>(
    '/me/accounts',
    { fields: 'id,name', limit: '200' },
  )
  const pages = (res.ok ? res.data?.data ?? [] : []).map((p) => ({ id: p.id, name: p.name ?? p.id }))

  return NextResponse.json({ ok: true, metaConnected: true, pages, connected })
}
