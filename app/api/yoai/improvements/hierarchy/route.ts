import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getImprovementHierarchy, type HierStatus } from '@/lib/yoai/ai/hierarchicalStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/**
 * GET /api/yoai/improvements/hierarchy
 * Hiyerarşik geliştirme kartlarını döner:
 *   { accountAlerts[], campaigns[ { ...campaign, adsets[ { ...adset, ads[] } ] } ] }
 * Query: ?status=pending,approved,applied,rejected_by_user (varsayılan görünür statüler)
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status')
    const statuses = statusParam
      ? (statusParam.split(',').map((s) => s.trim()).filter(Boolean) as HierStatus[])
      : undefined

    const data = await getImprovementHierarchy(userId, statuses)
    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[improvements hierarchy GET] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
