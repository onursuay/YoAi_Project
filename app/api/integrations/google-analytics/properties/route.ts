import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGAConnection } from '@/lib/google-analytics/connectionStore'
import { listProperties } from '@/lib/google-analytics/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_id')?.value

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const conn = await getGAConnection(userId)
  if (!conn) {
    return NextResponse.json({ error: 'Google Analytics not connected' }, { status: 401 })
  }

  try {
    const properties = await listProperties(conn.refreshToken)
    return NextResponse.json({ properties })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list properties'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
