import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { supabase } from '@/lib/supabase/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yoai.yodijital.com'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/signup/verify?status=invalid', APP_URL))
  }

  if (!supabase) {
    return NextResponse.redirect(new URL('/signup/verify?status=error', APP_URL))
  }

  // Find signup by token
  const { data: signup, error } = await supabase
    .from('signups')
    .select('id, email, name, status, created_at')
    .eq('verification_token', token)
    .maybeSingle()

  if (error || !signup) {
    return NextResponse.redirect(new URL('/signup/verify?status=invalid', APP_URL))
  }

  if (signup.status === 'active') {
    // Already verified — still create session and redirect
    return await createSessionAndRedirect(signup.name)
  }

  // Check token expiry (24 hours)
  const createdAt = new Date(signup.created_at).getTime()
  const now = Date.now()
  const twentyFourHours = 24 * 60 * 60 * 1000

  if (now - createdAt > twentyFourHours) {
    // Expire the signup
    await supabase
      .from('signups')
      .update({ status: 'expired' })
      .eq('id', signup.id)

    return NextResponse.redirect(new URL('/signup/verify?status=expired', APP_URL))
  }

  // Activate the signup
  await supabase
    .from('signups')
    .update({
      status: 'active',
      verified_at: new Date().toISOString(),
    })
    .eq('id', signup.id)

  return await createSessionAndRedirect(signup.name)
}

async function createSessionAndRedirect(name: string) {
  const sessionId = randomUUID()
  const cookieStore = await cookies()

  const response = NextResponse.redirect(new URL('/dashboard', APP_URL))

  response.cookies.set('session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  console.log('[Signup] Verified and activated:', name.slice(0, 3) + '***')

  return response
}
