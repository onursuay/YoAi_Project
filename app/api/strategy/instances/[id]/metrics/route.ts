import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import { createJob, runQueuedJobs } from '@/lib/strategy/job-runner'

export const dynamic = 'force-dynamic'

// POST /api/strategy/instances/:id/metrics — Manuel metrik çekme + optimizasyon tetikle
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { id } = await params

  // Instance kontrolü
  const { data: instance } = await supabase
    .from('strategy_instances')
    .select('status')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (!instance) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  if (instance.status !== 'RUNNING') {
    return NextResponse.json({ ok: false, error: 'invalid_status', message: 'Strateji çalışır durumda değil' }, { status: 400 })
  }

  // Halihazırda çalışan/bekleyen job var mı kontrol et
  const { data: pendingJobs } = await supabase
    .from('sync_jobs')
    .select('id')
    .eq('strategy_instance_id', id)
    .in('job_type', ['pull_metrics', 'optimize'])
    .in('status', ['queued', 'running'])
    .limit(1)

  if (pendingJobs?.length) {
    return NextResponse.json({ ok: true, message: 'Zaten bekleyen bir güncelleme var' })
  }

  // pull_metrics job oluştur (optimize otomatik zincirlenir)
  await createJob(id, 'pull_metrics')
  await runQueuedJobs()

  return NextResponse.json({ ok: true, message: 'Metrik güncelleme başlatıldı' })
}
