import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  getProfileByUserId,
  listCompetitors,
  upsertProfile,
} from '@/lib/yoai/businessProfileStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/yoai/business-profile/scan
 * Re-runs source scan + intelligence build for the current user.
 * Reuses the orchestration helper from the main business-profile route by
 * dispatching back to it via internal fetch is overkill — instead we simply
 * mark the profile to running and the next save / cron picks it up.
 *
 * This endpoint is the manual "Yeniden Tara" trigger.
 */
export async function POST() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }
    const profile = await getProfileByUserId(userId)
    if (!profile) {
      return NextResponse.json({ ok: false, error: 'profile_not_found' }, { status: 404 })
    }
    const competitors = await listCompetitors(userId)
    if (competitors.length < 3) {
      return NextResponse.json(
        { ok: false, error: 'min_3_competitors_required' },
        { status: 400 },
      )
    }
    await upsertProfile({
      ...profile,
      scan_status: 'running',
      intelligence_status: 'running',
      last_scan_started_at: new Date().toISOString(),
    })

    // Defer work — the inline scanner from the POST /api/yoai/business-profile
    // route is shared (we duplicate logic minimally here to avoid coupling).
    // For now we just flip status; cron / next save runs the scans.
    return NextResponse.json({
      ok: true,
      data: {
        message: 'Tarama kuyruğa alındı. Profili tekrar kaydedince ya da günlük cron ile yenilenecek.',
        scan_status: 'running',
      },
    })
  } catch (e) {
    console.error('[business-profile/scan] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
