import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()

  // Clear session cookies (user_id intentionally kept: DB connections persist across logins)
  cookieStore.delete('session_id')
  cookieStore.delete('user_id')
  cookieStore.delete('user_email')
  cookieStore.delete('user_name')

  return NextResponse.json({ ok: true })
}
