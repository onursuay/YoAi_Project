import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { supabase } from '@/lib/supabase/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yoai.yodijital.com'

/**
 * Email doğrulama callback'i.
 *
 * Manuel onay akışında bu endpoint:
 *  1) Token'ı doğrular ve `signups.status='active'` yapar (email doğrulandı).
 *  2) `approval_status`'a DOKUNMAZ — owner manuel onay verene kadar 'pending' kalır.
 *  3) Oturum cookie'lerini (`session_id`, `user_id`, `user_email`, `user_name`)
 *     kurar — kullanıcı `/basvuru-durumu` ekranını görebilsin ve ön görüşme
 *     planlama API'larını kullanabilsin.
 *  4) Dashboard yerine `/basvuru-durumu` sayfasına yönlendirir.
 */
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
    // Zaten doğrulanmış — yine de oturumu açıp başvuru durumu sayfasına gönder.
    return createSessionAndRedirect({
      id: signup.id as string,
      email: signup.email as string | null,
      name: signup.name as string | null,
    })
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

  // Activate email verification. NOT: approval_status'a dokunmuyoruz —
  // 'pending' kalır, owner manuel onay verene kadar iç paneller kapalı.
  await supabase
    .from('signups')
    .update({
      status: 'active',
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', signup.id)

  return createSessionAndRedirect({
    id: signup.id as string,
    email: signup.email as string | null,
    name: signup.name as string | null,
  })
}

function createSessionAndRedirect(user: {
  id: string
  email: string | null
  name: string | null
}): NextResponse {
  const sessionId = randomUUID()
  const response = NextResponse.redirect(new URL('/basvuru-durumu', APP_URL))

  const cookieDefaults = {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  }

  response.cookies.set('session_id', sessionId, {
    ...cookieDefaults,
    httpOnly: true,
  })

  // Permanent user id — diğer admin/billing endpoint'lerinin authentic kaynak
  // saydığı cookie. Email doğrulamasından sonra zaten kullanıcıya emanet.
  response.cookies.set('user_id', user.id, {
    ...cookieDefaults,
    httpOnly: true,
  })

  // Display-only cookies — middleware ve UI tarafı isim/owner kontrolünde kullanır.
  if (user.email) {
    response.cookies.set('user_email', user.email, {
      ...cookieDefaults,
      httpOnly: false,
    })
  }
  if (user.name) {
    response.cookies.set('user_name', user.name, {
      ...cookieDefaults,
      httpOnly: false,
    })
  }

  console.log('[Signup] Verified — pending owner approval:', (user.name || '').slice(0, 3) + '***')
  return response
}
