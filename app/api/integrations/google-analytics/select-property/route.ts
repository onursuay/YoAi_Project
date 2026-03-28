import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { upsertGAConnection } from '@/lib/google-analytics/connectionStore'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_id')?.value

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { propertyId, propertyName } = body

  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId required' }, { status: 400 })
  }

  const ok = await upsertGAConnection(userId, {
    selectedPropertyId: propertyId,
    selectedPropertyName: propertyName || `Property ${propertyId}`,
  })

  if (!ok) {
    return NextResponse.json({ error: 'Failed to save property selection' }, { status: 500 })
  }

  return NextResponse.json({ propertyId, propertyName })
}
