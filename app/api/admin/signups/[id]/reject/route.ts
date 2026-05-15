/**
 * Owner — başvuru reddet.
 * `approval_status='rejected'`, rejected_at/by yazılır.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkAdminAccess } from '@/lib/admin/superAdmin'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await checkAdminAccess(req)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_unavailable' }, { status: 503 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  let body: { note?: string } = {}
  try {
    body = (await req.json()) as { note?: string }
  } catch {
    body = {}
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    approval_status: 'rejected',
    rejected_at: now,
    rejected_by: access.email || 'admin',
    approved_at: null,
    approved_by: null,
    updated_at: now,
  }
  if (body.note && typeof body.note === 'string' && body.note.trim()) {
    update.approval_note = body.note.trim().slice(0, 1000)
  }

  const { error } = await supabase.from('signups').update(update).eq('id', id)

  if (error) {
    console.error('[admin/signups/reject] error:', error.message)
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
