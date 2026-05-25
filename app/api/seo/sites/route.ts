import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'
import { listConnections } from '@/lib/seo/siteConnectionStore'

export const dynamic = 'force-dynamic'

function getUserId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  return cookieStore.get('user_id')?.value ?? null
}

// GET /api/seo/sites — kullanıcının bağlı sitelerini (maskeli) listele.
// Bağlantı oluşturma OAuth/tek-tık akışıyla yapılır:
//   /api/seo/sites/connect → /api/seo/sites/callback
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }
  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
  }

  const connections = await listConnections(userId)
  return NextResponse.json({ ok: true, connections })
}
