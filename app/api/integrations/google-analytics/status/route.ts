import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGAConnectionStatus } from '@/lib/google-analytics/connectionStore'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_id')?.value

  if (!userId) {
    return NextResponse.json({ connected: false })
  }

  const status = await getGAConnectionStatus(userId)
  return NextResponse.json({
    connected: status.connected,
    propertyId: status.propertyId,
    propertyName: status.propertyName,
    lastSyncAt: status.lastSyncAt,
    hasSelectedProperty: !!status.propertyId,
  })
}
