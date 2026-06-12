import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { rejectImprovement } from '@/lib/yoai/ai/improvementStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/**
 * POST /api/yoai/improvements/[id]/reject
 * Body: { reason?: string }
 * Kartı "Reddedildi" yapar. Reddedilen reklam bir sonraki taramada
 * yeniden üretilmez (refresh policy — karar 2).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

    let reason: string | undefined
    try {
      const body = await request.json()
      if (typeof body?.reason === 'string') reason = body.reason.slice(0, 500)
    } catch { /* gövdesiz reject ok */ }

    const ok = await rejectImprovement(userId, id, reason)
    if (!ok) return NextResponse.json({ ok: false, error: 'Reddedilemedi' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[improvements reject] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
