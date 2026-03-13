import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

/** GET /api/audiences — List audiences for the selected ad account */
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable', message: 'Supabase not configured' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('audiences')
    .select('*')
    .eq('ad_account_id', ctx.accountId)
    .neq('status', 'DELETED')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[audiences/GET] Supabase error:', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, audiences: data ?? [] })
}

/** POST /api/audiences — Create a new audience in DRAFT status */
export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable', message: 'Supabase not configured' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body', message: 'Geçersiz JSON' }, { status: 400 })
  }

  const { type, source, name, description, yoai_spec_json } = body as {
    type?: string
    source?: string
    name?: string
    description?: string
    yoai_spec_json?: Record<string, unknown>
  }

  if (!type || !['CUSTOM', 'LOOKALIKE', 'SAVED'].includes(type)) {
    return NextResponse.json({ ok: false, error: 'invalid_type', message: 'type must be CUSTOM, LOOKALIKE, or SAVED' }, { status: 400 })
  }

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ ok: false, error: 'missing_name', message: 'name is required' }, { status: 400 })
  }

  const row = {
    ad_account_id: ctx.accountId,
    type,
    source: source ?? null,
    name: name.trim(),
    description: description ?? null,
    yoai_spec_json: yoai_spec_json ?? {},
    status: 'DRAFT',
  }

  const { data, error } = await supabase.from('audiences').insert(row).select().single()

  if (error) {
    console.error('[audiences/POST] Supabase error:', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, audience: data }, { status: 201 })
}
