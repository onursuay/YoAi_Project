import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { publishWebsite, unpublishWebsite, getPages } from '@/lib/website/store'

export const dynamic = 'force-dynamic'

/** Body: { action: 'publish' | 'unpublish' }. Yayın için en az bir sayfa gerekir. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string }
    const action = body.action === 'unpublish' ? 'unpublish' : 'publish'

    if (action === 'publish') {
      const pages = await getPages(user.id, params.id)
      if (pages.length === 0) {
        return NextResponse.json({ ok: false, error: 'Yayınlamadan önce siteyi oluşturun.' }, { status: 400 })
      }
      const website = await publishWebsite(user.id, params.id)
      if (!website) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
      return NextResponse.json({ ok: true, website })
    }

    const website = await unpublishWebsite(user.id, params.id)
    if (!website) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
    return NextResponse.json({ ok: true, website })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'İşlem başarısız'
    console.error('[website:publish]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
