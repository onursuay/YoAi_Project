/**
 * Owner — başvuru onayla.
 * `approval_status='approved'`, approved_at/by yazılır.
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

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('signups')
    .update({
      approval_status: 'approved',
      approved_at: now,
      approved_by: access.email || 'admin',
      rejected_at: null,
      rejected_by: null,
      updated_at: now,
    })
    .eq('id', id)

  if (error) {
    console.error('[admin/signups/approve] error:', error.message)
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
