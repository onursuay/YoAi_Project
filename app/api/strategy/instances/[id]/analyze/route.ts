import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import { createJob } from '@/lib/strategy/job-runner'
import { runQueuedJobs } from '@/lib/strategy/job-runner'

export const dynamic = 'force-dynamic'

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

  // Analyze job oluştur
  const jobId = await createJob(id, 'analyze')
  if (!jobId) {
    return NextResponse.json({ ok: false, error: 'job_create_failed' }, { status: 500 })
  }

  // Job'ları senkron çalıştır (Vercel serverless'ta fire-and-forget çalışmaz)
  const result = await runQueuedJobs()

  return NextResponse.json({ ok: true, jobId, message: 'Analiz tamamlandı', ...result })
}
