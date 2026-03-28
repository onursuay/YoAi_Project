import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGSCConnection } from '@/lib/google-search-console/connectionStore'
import { listSites } from '@/lib/google-search-console/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_id')?.value

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const conn = await getGSCConnection(userId)
  if (!conn) {
    return NextResponse.json({ error: 'Google Search Console not connected' }, { status: 401 })
  }

  try {
    const sites = await listSites(conn.refreshToken)
    return NextResponse.json({ sites })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list sites'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
