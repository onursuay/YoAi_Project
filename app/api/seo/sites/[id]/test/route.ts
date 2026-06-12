import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'
import { getConnectionWithCredentials, setConnectionStatus } from '@/lib/seo/siteConnectionStore'
import { getConnector } from '@/lib/seo/connectors'

export const dynamic = 'force-dynamic'

function getUserId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  return readUserId(cookieStore) ?? null
}

// POST /api/seo/sites/[id]/test — kayıtlı kimlik bilgileriyle bağlantı testi
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })

  const { id } = await params
  const conn = await getConnectionWithCredentials(id, userId)
  if (!conn) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  try {
    const connector = getConnector(conn.platform, conn.credentials)
    const result = await connector.testConnection()
    await setConnectionStatus(id, userId, result.ok ? 'active' : 'error', result.ok ? null : result.detail ?? null)
    return NextResponse.json({ ok: result.ok, detail: result.detail, errorCode: result.errorCode })
  } catch (err) {
    const message = (err as Error).message
    await setConnectionStatus(id, userId, 'error', message)
    return NextResponse.json({ ok: false, error: message })
  }
}
