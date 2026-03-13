import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('meta_access_token')?.value
  const rawAccountId = cookieStore.get('meta_selected_ad_account_id')?.value

  if (!accessToken || !rawAccountId) {
    return NextResponse.json({ ok: false, message: 'Meta bağlantısı bulunamadı' }, { status: 401 })
  }

  const accountId = rawAccountId.startsWith('act_')
    ? rawAccountId
    : `act_${rawAccountId}`

  return NextResponse.json({ ok: true, accessToken, accountId })
}
