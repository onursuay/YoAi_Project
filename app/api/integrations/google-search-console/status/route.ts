import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGSCConnectionStatus } from '@/lib/google-search-console/connectionStore'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return NextResponse.json({ connected: false })
  }

  const status = await getGSCConnectionStatus(userId)
  return NextResponse.json({
    connected: status.connected,
    siteUrl: status.siteUrl,
    siteName: status.siteName,
    lastSyncAt: status.lastSyncAt,
    hasSelectedSite: !!status.siteUrl,
  })
}
