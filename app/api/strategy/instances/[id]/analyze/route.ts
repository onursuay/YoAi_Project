import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import { createJob } from '@/lib/strategy/job-runner'
import { runQueuedJobs } from '@/lib/strategy/job-runner'
import { isInngestReady, inngest } from '@/inngest/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/strategy/instances/:id/analyze — Analiz job'u başlat
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { id } = await params

  // Instance + input kontrolü
  const { data: instance } = await supabase
    .from('strategy_instances')
    .select('id, status')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (!instance) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // Input var mı?
  const { data: input } = await supabase
    .from('strategy_inputs')
    .select('id')
    .eq('strategy_instance_id', id)
    .limit(1)
    .single()

  if (!input) {
    return NextResponse.json({ ok: false, error: 'no_input', message: 'Önce Aşama 1 verilerini kaydedin' }, { status: 400 })
  }

  // Analyze job oluştur (runAnalyzeJob içeride generate_plan'i de zincirler)
  const jobId = await createJob(id, 'analyze')
  if (!jobId) {
    return NextResponse.json({ ok: false, error: 'job_create_failed' }, { status: 500 })
  }

  // Durumu hemen ANALYZING yap → UI spinner + polling
  await supabase
    .from('strategy_instances')
    .update({ status: 'ANALYZING', updated_at: new Date().toISOString() })
    .eq('id', id)

  // Arka planda çalıştır (Claude blueprint senkron HTTP'de 60s'i aşıyordu)
  if (isInngestReady()) {
    await inngest.send({ name: 'strategy/run-jobs', data: { instanceId: id } })
    return NextResponse.json({ ok: true, jobId, mode: 'inngest', message: 'Analiz başlatıldı' })
  }

  const result = await runQueuedJobs()
  return NextResponse.json({ ok: true, jobId, mode: 'inline', message: 'Analiz tamamlandı', ...result })
}
