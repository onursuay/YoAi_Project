import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { upsertGSCConnection } from '@/lib/google-search-console/connectionStore'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { siteUrl, siteName } = body

  if (!siteUrl) {
    return NextResponse.json({ error: 'siteUrl required' }, { status: 400 })
  }

  const ok = await upsertGSCConnection(userId, {
    selectedSiteUrl: siteUrl,
    selectedSiteName: siteName || siteUrl,
  })

  if (!ok) {
    return NextResponse.json({ error: 'Failed to save site selection' }, { status: 500 })
  }

  return NextResponse.json({ siteUrl, siteName })
}
