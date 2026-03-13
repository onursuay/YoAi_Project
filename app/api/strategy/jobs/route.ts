import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

// GET /api/strategy/jobs?instance_id=xxx — Instance'a ait job'ları getir
export async function GET(request: Request) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const instanceId = searchParams.get('instance_id')

  if (!instanceId) {
    return NextResponse.json({ ok: false, error: 'missing_instance_id' }, { status: 400 })
  }

  // İnstance sahiplik kontrolü
  const { data: instance } = await supabase
    .from('strategy_instances')
    .select('id')
    .eq('id', instanceId)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (!instance) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { data: jobs, error } = await supabase
    .from('sync_jobs')
    .select('*')
    .eq('strategy_instance_id', instanceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, jobs: jobs ?? [] })
}
