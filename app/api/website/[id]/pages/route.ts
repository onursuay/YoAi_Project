import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getPages } from '@/lib/website/store'

export const dynamic = 'force-dynamic'

/** Sahibinin sitesinin sayfaları (önizleme). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const pages = await getPages(user.id, params.id)
    return NextResponse.json({ ok: true, pages })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
