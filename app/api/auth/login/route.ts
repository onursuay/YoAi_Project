import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { supabase } from '@/lib/supabase/client'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email?.trim() || !password) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()

    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 })
    }

    // Find active user
    const { data: user, error } = await supabase
      .from('signups')
      .select('id, name, email, password_hash, status')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (error || !user) {
      return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 })
    }

    if (user.status !== 'active') {
      return NextResponse.json({ ok: false, error: 'not_verified' }, { status: 403 })
    }

    if (!user.password_hash) {
      return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 })
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 })
    }

    // Create session
    const sessionId = randomUUID()
    const response = NextResponse.json({ ok: true, name: user.name })

    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    // Permanent user id — used as the stable key for all DB connections (Meta, Google Ads).
    // httpOnly so JS cannot read it; used server-side only for DB lookups.
    response.cookies.set('user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    // Display-only cookies (not sensitive)
    response.cookies.set('user_email', cleanEmail, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    response.cookies.set('user_name', user.name ?? '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    console.log('[Auth] Login success:', cleanEmail.slice(0, 3) + '***')
    return response
  } catch (error) {
    console.error('[Auth] Login error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}
