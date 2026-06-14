import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meta/page-phone?pageId=...
 * Seçili Facebook sayfasının kayıtlı telefonunu (tek 'phone' alanı) döner.
 * İZOLE + GRACEFUL: yalnız Telefon Aramaları (CALL) akışında, sayfa seçilince çağrılır.
 * Herhangi bir hata/izin eksikliğinde { ok:true, phone:null } döner — kritik sayfa/pixel/capabilities
 * yüklemesini ASLA etkilemez (manuel girişe düşülür).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageId = (searchParams.get('pageId') ?? '').trim()
    if (!pageId) return NextResponse.json({ ok: true, phone: null })

    const ctx = await resolveMetaContext()
    if (!ctx) return NextResponse.json({ ok: true, phone: null })

    const res = await ctx.client.get<{ phone?: string }>(`/${pageId}`, { fields: 'phone' })
    const phone = res.ok && typeof res.data?.phone === 'string' ? res.data.phone.trim() : null
    return NextResponse.json({ ok: true, phone: phone || null })
  } catch {
    return NextResponse.json({ ok: true, phone: null })
  }
}
