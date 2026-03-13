import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

/** GET /api/audiences/[id] — Fetch a single audience */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
  }

  const { id } = await params

  const { data, error } = await supabase
    .from('audiences')
    .select('*')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'not_found', message: 'Kitle bulunamadı' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, audience: data })
}

/** PATCH /api/audiences/[id] — Update a DRAFT audience */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
  }

  const { id } = await params

  // Check current status
  const { data: existing } = await supabase
    .from('audiences')
    .select('status')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  if (existing.status !== 'DRAFT') {
    return NextResponse.json(
      { ok: false, error: 'not_editable', message: 'Sadece DRAFT durumundaki kitleler düzenlenebilir' },
      { status: 409 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const allowedFields = ['name', 'description', 'source', 'yoai_spec_json']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabase
    .from('audiences')
    .update(updates)
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .select()
    .single()

  if (error) {
    console.error('[audiences/PATCH] Supabase error:', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, audience: data })
}

/** DELETE /api/audiences/[id] — Soft-delete (status → DELETED) */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
  }

  const { id } = await params

  const { error } = await supabase
    .from('audiences')
    .update({ status: 'DELETED', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)

  if (error) {
    console.error('[audiences/DELETE] Supabase error:', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
