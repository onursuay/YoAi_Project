import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import { createJob, runQueuedJobs } from '@/lib/strategy/job-runner'

export const dynamic = 'force-dynamic'

// POST /api/strategy/instances/:id/generate-plan — Plan üretim job'u başlat
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

  const jobId = await createJob(id, 'generate_plan')
  if (!jobId) {
    return NextResponse.json({ ok: false, error: 'job_create_failed' }, { status: 500 })
  }

  const result = await runQueuedJobs()

  return NextResponse.json({ ok: true, jobId, message: 'Plan üretimi tamamlandı', ...result })
}
