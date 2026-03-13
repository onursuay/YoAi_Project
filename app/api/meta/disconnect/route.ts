import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  
  // Clear all Meta cookies
  cookieStore.delete('meta_access_token')
  cookieStore.delete('meta_access_expires_at')
  cookieStore.delete('meta_selected_ad_account_id')
  cookieStore.delete('meta_selected_ad_account_name')

  return NextResponse.json({ success: true })
}
