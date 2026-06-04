import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'node:crypto'

/**
 * WordPress "Uygulama Şifresi Yetkilendirme" (tek-tık) akışını başlatır.
 *
 * Kullanıcı yalnızca site adresini girer; şifresini YoAi'ye GİRMEZ — kendi
 * WordPress panelinde "Onayla" der ve WP, otomatik üretilen uygulama
 * şifresini callback'e geri gönderir.
 *
 * Akış (WP Application Passwords Integration Guide):
 *   {site}/wp-admin/authorize-application.php
 *     ?app_name=YoAi SEO&app_id={uuid}&success_url={callback}&reject_url={callback}
 *   → onay → success_url'e site_url, user_login, password eklenerek redirect.
 *
 * Güvenlik: state cookie (CSRF) + success_url HTTPS zorunlu (WP şartı).
 *
 * GET /api/seo/sites/connect?siteUrl=https://example.com&platform=wordpress
 */
export const dynamic = 'force-dynamic'

const APP_ID = '7b3f2c1a-9e44-4a21-8c2b-0a1b2c3d4e5f' // sabit YoAi uygulama kimliği (geçerli UUID — WP şartı)

function normalizeSite(raw: string): string | null {
  let url = raw.trim()
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const u = new URL(url)
    // WP success_url HTTPS zorunlu; site de HTTPS olmalı.
    if (u.protocol !== 'https:') return null
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const cookieStore = await cookies()
  const isEn = cookieStore.get('NEXT_LOCALE')?.value === 'en'
  const seoUrl = (q: string) => (isEn ? `/en/seo/articles?${q}` : `/seo/articles?${q}`)

  const userId = cookieStore.get('user_id')?.value
  if (!userId) {
    return NextResponse.redirect(new URL(seoUrl('site=error&reason=no_session'), origin), { status: 302 })
  }

  const siteRaw = url.searchParams.get('siteUrl') || ''
  const site = normalizeSite(siteRaw)
  if (!site) {
    return NextResponse.redirect(new URL(seoUrl('site=error&reason=invalid_url'), origin), { status: 302 })
  }

  // WP REST API + Application Passwords desteğini doğrula, authorize endpoint'ini al.
  // Site WordPress değilse / REST API kapalıysa kullanıcıyı authorize ekranına
  // GÖNDERME — önce net hata ile geri döndür (403 ekranı yaşatma).
  let authEndpoint = `${site}/wp-admin/authorize-application.php`
  try {
    const probe = await fetch(`${site}/wp-json/`, { headers: { Accept: 'application/json' } })
    if (probe.ok) {
      const data = (await probe.json()) as {
        authentication?: { 'application-passwords'?: { endpoints?: { authorization?: string } } }
      }
      const ep = data?.authentication?.['application-passwords']?.endpoints?.authorization
      if (ep) {
        authEndpoint = ep
      } else {
        // WordPress ama uygulama şifresi (application passwords) desteği yok/kapalı
        return NextResponse.redirect(new URL(seoUrl('site=error&reason=no_app_passwords'), origin), { status: 302 })
      }
    } else if (probe.status === 401 || probe.status === 403) {
      // REST API güvenlik duvarı/koruma ile kapalı — otomatik yayın yapılamaz
      return NextResponse.redirect(new URL(seoUrl('site=error&reason=rest_blocked'), origin), { status: 302 })
    } else {
      return NextResponse.redirect(new URL(seoUrl('site=error&reason=not_wordpress'), origin), { status: 302 })
    }
  } catch {
    return NextResponse.redirect(new URL(seoUrl('site=error&reason=unreachable'), origin), { status: 302 })
  }

  // CSRF state + hedef siteyi cookie'de sakla (callback doğrular).
  const state = crypto.randomBytes(16).toString('hex')

  const callbackBase = `${origin}/api/seo/sites/callback`
  const successUrl = `${callbackBase}?state=${state}`
  const rejectUrl = `${callbackBase}?state=${state}&rejected=1`

  const authUrl = new URL(authEndpoint)
  authUrl.searchParams.set('app_name', 'YoAi SEO')
  authUrl.searchParams.set('app_id', APP_ID)
  authUrl.searchParams.set('success_url', successUrl)
  authUrl.searchParams.set('reject_url', rejectUrl)

  const res = NextResponse.redirect(authUrl.toString(), { status: 302 })
  res.cookies.set('seo_site_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 dk
  })
  res.cookies.set('seo_site_oauth_target', site, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  })
  return res
}
