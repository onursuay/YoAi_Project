import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'
import { listSchedules, upsertSchedule, type ScheduleFrequency } from '@/lib/seo/scheduleStore'
import { getBriefByConnection } from '@/lib/seo/siteContentBriefStore'
import { runSiteBriefPipeline } from '@/lib/seo/siteBriefPipeline'

export const dynamic = 'force-dynamic'

function getUserId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  return cookieStore.get('user_id')?.value ?? null
}

const FREQ: ScheduleFrequency[] = ['daily', 'weekdays', 'weekly']

// GET /api/seo/schedules — kullanıcının otomasyon zamanlamaları
export async function GET() {
  if (!supabase) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })

  const schedules = await listSchedules(userId)
  return NextResponse.json({ ok: true, schedules })
}

// POST /api/seo/schedules — oluştur / güncelle
export async function POST(request: Request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const publishTime = body.publishTime as string | undefined
  if (publishTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(publishTime)) {
    return NextResponse.json({ ok: false, error: 'invalid_time' }, { status: 400 })
  }
  const frequency = body.frequency as ScheduleFrequency | undefined
  if (frequency && !FREQ.includes(frequency)) {
    return NextResponse.json({ ok: false, error: 'invalid_frequency' }, { status: 400 })
  }

  const keywordPool = Array.isArray(body.keywordPool)
    ? (body.keywordPool as unknown[]).map((k) => String(k).trim()).filter(Boolean).slice(0, 50)
    : undefined

  const MODES = ['daily', 'weekly_days', 'monthly_days'] as const
  const scheduleMode = MODES.includes(body.scheduleMode as never)
    ? (body.scheduleMode as 'daily' | 'weekly_days' | 'monthly_days')
    : undefined

  const daysOfWeek = Array.isArray(body.daysOfWeek)
    ? (body.daysOfWeek as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : undefined
  const daysOfMonth = Array.isArray(body.daysOfMonth)
    ? (body.daysOfMonth as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 31)
    : undefined
  const targetCategories = Array.isArray(body.targetCategories)
    ? (body.targetCategories as unknown[]).map((c) => String(c).trim()).filter(Boolean).slice(0, 50)
    : undefined

  const schedule = await upsertSchedule(userId, {
    id: body.id as string | undefined,
    siteConnectionId: (body.siteConnectionId as string) ?? undefined,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    frequency,
    publishTime,
    timezone: (body.timezone as string) || 'Europe/Istanbul',
    weekday: typeof body.weekday === 'number' ? body.weekday : undefined,
    tone: (body.tone as string) ?? undefined,
    wordCount: typeof body.wordCount === 'number' ? body.wordCount : undefined,
    keywordPool,
    scheduleMode,
    daysOfWeek,
    daysOfMonth,
    targetCategories,
    autoPublish: typeof body.autoPublish === 'boolean' ? body.autoPublish : undefined,
    generateImage: typeof body.generateImage === 'boolean' ? body.generateImage : undefined,
  })

  if (!schedule) return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 })

  // Hedef sitenin brief'i yoksa arka planda üret (fire-and-forget).
  if (schedule.site_connection_id) {
    const existing = await getBriefByConnection(schedule.site_connection_id)
    if (!existing) {
      void runSiteBriefPipeline(schedule.site_connection_id, userId).catch((e) =>
        console.error('[schedules] BRIEF_TRIGGER_FAIL', (e as Error).message)
      )
    }
  }

  return NextResponse.json({ ok: true, schedule }, { status: 201 })
}
