/**
 * Owner — başvuru listesi (Gözetim Merkezi → Başvurular sekmesi).
 *
 * Yetkisiz çağrı için 404 döner. Sayfalama/limit yok; signups tablosu
 * görece küçük. Premeeting bookings ile sol birleştirme yapılır.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkAdminAccess } from '@/lib/admin/superAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await checkAdminAccess(req)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_unavailable' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10) || 200, 500)

  const { data, error } = await supabase
    .from('signups')
    .select(
      'id, email, name, company, phone, status, approval_status, approval_note, signup_source, premeeting_status, premeeting_scheduled_at, premeeting_declined_at, premeeting_requested_at, approved_at, approved_by, rejected_at, rejected_by, created_at, verified_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[admin/signups] list error:', error.message)
    return NextResponse.json(
      { ok: false, error: 'list_failed', message: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, signups: data || [] })
}
