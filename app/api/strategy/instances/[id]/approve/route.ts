import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import { createJob, runQueuedJobs } from '@/lib/strategy/job-runner'
import { isInngestReady, inngest } from '@/inngest/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/strategy/instances/:id/approve — Planı onayla ve uygula (Aşama 3'e geç)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { id } = await params

  const { data: instance } = await supabase
    .from('strategy_instances')
    .select('id, status')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (!instance) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  if (instance.status !== 'READY_FOR_REVIEW') {
    return NextResponse.json({ ok: false, error: 'invalid_status', message: `Mevcut durum (${instance.status}) onay için uygun değil` }, { status: 409 })
  }

  // mode: "apply" veya "suggest_only"
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* boş body kabul */ }
  const mode = (body.mode as string) || 'apply'

  if (mode === 'suggest_only') {
    // Sadece öneri — push yok, RUNNING'e geç
    await supabase
      .from('strategy_instances')
      .update({ status: 'RUNNING', current_phase: 3, updated_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ ok: true, message: 'Öneri modu — push yapılmadı, durum RUNNING' })
  }

  // Apply modu — job oluştur
  const jobId = await createJob(id, 'apply')
  if (!jobId) {
    return NextResponse.json({ ok: false, error: 'job_create_failed' }, { status: 500 })
  }

  // Durumu hemen APPLYING yap → UI spinner + polling
  await supabase
    .from('strategy_instances')
    .update({ status: 'APPLYING', updated_at: new Date().toISOString() })
    .eq('id', id)

  // Uygulamayı arka planda çalıştır (audience + görev oluşturma; canlı push YOK)
  if (isInngestReady()) {
    await inngest.send({ name: 'strategy/run-jobs', data: { instanceId: id } })
    return NextResponse.json({ ok: true, jobId, mode: 'inngest', message: 'Uygulama başlatıldı' })
  }

  const result = await runQueuedJobs()
  return NextResponse.json({ ok: true, jobId, mode: 'inline', message: 'Uygulama tamamlandı', ...result })
}
