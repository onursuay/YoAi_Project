import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revokeGSCConnection } from '@/lib/google-search-console/connectionStore'

export async function POST() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_id')?.value

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  await revokeGSCConnection(userId)
  return NextResponse.json({ disconnected: true })
}
