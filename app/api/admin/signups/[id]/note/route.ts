/**
 * Owner — başvuruya manuel not ekle.
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
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (!note) {
    return NextResponse.json({ ok: false, error: 'note_required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('signups')
    .update({
      approval_note: note.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[admin/signups/note] error:', error.message)
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
