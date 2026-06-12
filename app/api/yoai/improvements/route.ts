import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { listImprovementsForUser, type AdImprovementStatus } from '@/lib/yoai/ai/improvementStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/**
 * GET /api/yoai/improvements
 * Kullanıcının per-ad geliştirme kartlarını döner.
 * Query: ?status=pending,approved  ?platform=meta|google
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status')
    const platformParam = url.searchParams.get('platform')
    const statuses = statusParam
      ? (statusParam.split(',').map((s) => s.trim()).filter(Boolean) as AdImprovementStatus[])
      : undefined
    const platform = platformParam === 'meta' || platformParam === 'google' ? platformParam : undefined

    const data = await listImprovementsForUser(userId, { statuses, platform })
    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[improvements GET] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
