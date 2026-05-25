/* ──────────────────────────────────────────────────────────
   GET /api/cron/seo-article-run

   Saatlik Vercel cron (0 * * * *). enabled olan article_schedules
   içinde, kullanıcının yerel saati publish_time ile eşleşen ve bugün
   henüz çalışmamış olanları bulup `article/generate-publish.user`
   Inngest event'ini fan-out eder.

   Auth: CRON_SECRET (Bearer header). Manuel tetik için admin de bu
   secret ile çağırabilir.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { inngest, isInngestReady } from '@/inngest/client'
import { listEnabledSchedules } from '@/lib/seo/scheduleStore'
import { isScheduleDue } from '@/lib/seo/timezone'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret && isProduction) {
    return NextResponse.json({ ok: false, error: 'Cron not configured' }, { status: 503 })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!isInngestReady()) {
    return NextResponse.json({ ok: false, error: 'inngest_not_ready' }, { status: 503 })
  }

  const now = new Date()
  const schedules = await listEnabledSchedules()

  const due = schedules.filter((s) =>
    isScheduleDue(s.publish_time, s.timezone, s.frequency, s.weekday, s.last_run_date, now)
  )

  if (due.length === 0) {
    return NextResponse.json({ ok: true, due: 0, sent: 0 })
  }

  const events = due.map((s) => ({
    name: 'article/generate-publish.user',
    data: { scheduleId: s.id, userId: s.user_id },
  }))

  await inngest.send(events)

  return NextResponse.json({ ok: true, due: due.length, sent: events.length })
}
