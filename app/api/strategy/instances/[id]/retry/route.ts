import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import { runQueuedJobs } from '@/lib/strategy/job-runner'

export const dynamic = 'force-dynamic'

// POST /api/strategy/instances/:id/retry — Başarısız job'u tekrar dene
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  if (instance.status !== 'FAILED' && instance.status !== 'NEEDS_ACTION') {
    return NextResponse.json({ ok: false, error: 'invalid_status', message: 'Sadece FAILED veya NEEDS_ACTION durumunda tekrar denenebilir' }, { status: 409 })
  }

  // Son başarısız job'u bul ve kuyruğa geri koy
  const { data: failedJobs } = await supabase
    .from('sync_jobs')
    .select('*')
    .eq('strategy_instance_id', id)
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)

  if (failedJobs?.length) {
    await supabase
      .from('sync_jobs')
      .update({
        status: 'queued',
        attempts: 0,
        next_run_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', failedJobs[0].id)
  }

  // Instance'ı önceki duruma döndür
  const targetStatus = instance.status === 'FAILED' ? 'DRAFT' : 'COLLECTING'
  await supabase
    .from('strategy_instances')
    .update({ status: targetStatus, last_error: null, updated_at: new Date().toISOString() })
    .eq('id', id)

  const result = await runQueuedJobs()

  return NextResponse.json({ ok: true, message: 'Tekrar deneme tamamlandı', ...result })
}
