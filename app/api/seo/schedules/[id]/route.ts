import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'
import { upsertSchedule, deleteSchedule, type ScheduleFrequency } from '@/lib/seo/scheduleStore'

export const dynamic = 'force-dynamic'

function getUserId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  return cookieStore.get('user_id')?.value ?? null
}

// PATCH /api/seo/schedules/[id]
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const schedule = await upsertSchedule(userId, {
    id,
    siteConnectionId: (body.siteConnectionId as string) ?? undefined,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    frequency: body.frequency as ScheduleFrequency | undefined,
    publishTime: body.publishTime as string | undefined,
    timezone: body.timezone as string | undefined,
    weekday: typeof body.weekday === 'number' ? body.weekday : undefined,
    tone: body.tone as string | undefined,
    wordCount: typeof body.wordCount === 'number' ? body.wordCount : undefined,
    keywordPool: Array.isArray(body.keywordPool)
      ? (body.keywordPool as unknown[]).map((k) => String(k).trim()).filter(Boolean).slice(0, 50)
      : undefined,
    autoPublish: typeof body.autoPublish === 'boolean' ? body.autoPublish : undefined,
    generateImage: typeof body.generateImage === 'boolean' ? body.generateImage : undefined,
  })

  if (!schedule) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, schedule })
}

// DELETE /api/seo/schedules/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })

  const { id } = await params
  const ok = await deleteSchedule(id, userId)
  if (!ok) return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
