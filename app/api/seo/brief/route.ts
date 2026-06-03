import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getBriefByConnection } from '@/lib/seo/siteContentBriefStore'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
  const siteConnectionId = new URL(request.url).searchParams.get('siteConnectionId')
  if (!siteConnectionId) return NextResponse.json({ ok: false, error: 'missing_param' }, { status: 400 })
  const brief = await getBriefByConnection(siteConnectionId)
  if (brief && brief.user_id !== userId) return NextResponse.json({ ok: true, brief: null })
  return NextResponse.json({
    ok: true,
    brief: brief ? { scan_status: brief.scan_status, categories: brief.categories } : null,
  })
}
