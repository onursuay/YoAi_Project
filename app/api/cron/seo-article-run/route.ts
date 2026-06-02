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
import { listEnabledSchedules, claimScheduleRun, releaseScheduleClaim } from '@/lib/seo/scheduleStore'
import { isScheduleDue, getLocalParts } from '@/lib/seo/timezone'
import { runScheduleArticle } from '@/lib/seo/runScheduleArticle'

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

  const now = new Date()
  const schedules = await listEnabledSchedules()

  const due = schedules.filter((s) =>
    isScheduleDue(s.publish_time, s.timezone, s.frequency, s.weekday, s.last_run_date, now)
  )

  console.log('[seo-cron] enabled:', schedules.length, 'due:', due.length)

  if (due.length === 0) {
    return NextResponse.json({ ok: true, due: 0, sent: 0 })
  }

  // INLINE üret+yayınla — cron gövdesinde doğrudan çalışır.
  // NOT: Daha önce Inngest fan-out kullanılıyordu; ancak Inngest Cloud prod'da
  // function'ları sync etmediğinden gönderilen event'ler işlenmiyor ve makale
  // üretilmiyordu (cron 'mode:inngest' dönüp due>0 olsa bile çıktı yoktu). SEO
  // üretimi hafif ve idempotent (last_run_date ile günde bir) olduğundan, Inngest
  // kurulumuna BAĞIMLI OLMADAN cron gövdesinde inline çalıştırılır.
  // Vercel 60s sınırı için zaman bütçesiyle sırayla; yetişmeyen due'lar bir sonraki
  // saatlik cron'da (catch-up penceresiyle) AYNI GÜN telafi edilir.
  const startedAt = Date.now()
  const results: Array<Record<string, unknown>> = []
  for (const s of due) {
    // Atomik claim: eşzamanlı ikinci bir tetik (veya gecikmeli event) aynı
    // makaleyi İKİNCİ kez üretmesin. Yalnız claim'i kazanan invocation üretir.
    const localDate = getLocalParts(s.timezone, now).date
    const claimed = await claimScheduleRun(s.id, localDate)
    if (!claimed) {
      console.log('[seo-cron] skip (claimed by other)', s.id)
      results.push({ scheduleId: s.id, skipped: 'claimed_by_other' })
      continue
    }
    try {
      const r = await runScheduleArticle(s.id, s.user_id, { skipDateGuard: true })
      results.push({ scheduleId: s.id, ...r })
    } catch (e) {
      // Üretim patladı → claim'i bırak ki aynı gün bir sonraki saatlik cron tekrar denesin.
      await releaseScheduleClaim(s.id, localDate)
      console.error('[seo-cron] inline_error', s.id, (e as Error).message)
      results.push({ scheduleId: s.id, ok: false, error: (e as Error).message })
    }
    if (Date.now() - startedAt > 45_000) break
  }
  console.log('[seo-cron] ran:', results.length, '/', due.length)
  return NextResponse.json({ ok: true, mode: 'inline', due: due.length, ran: results.length, results })
}
