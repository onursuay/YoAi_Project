import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

// PATCH /api/strategy/instances/:id/tasks — Görev durumunu güncelle
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
  }

  const { id } = await params

  // Instance'ın bu hesaba ait olduğunu doğrula
  const { data: instance } = await supabase
    .from('strategy_instances')
    .select('id')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (!instance) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  let body: { taskId: string; status: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  if (!body.taskId || !body.status) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
  }

  const validStatuses = ['todo', 'in_progress', 'done', 'blocked']
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('strategy_tasks')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', body.taskId)
    .eq('strategy_instance_id', id)
    .select()
    .single()

  if (error) {
    console.error('[strategy/tasks/PATCH]', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, task: data })
}
