import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { revokeGAConnection } from '@/lib/google-analytics/connectionStore'

export async function POST() {
  const cookieStore = await cookies()
  const userId = readUserId(cookieStore)

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  await revokeGAConnection(userId)
  return NextResponse.json({ disconnected: true })
}
