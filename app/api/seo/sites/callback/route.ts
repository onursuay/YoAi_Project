import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isCryptoReady } from '@/lib/seo/crypto'
import { listConnections, upsertConnection } from '@/lib/seo/siteConnectionStore'
import { WordPressConnector } from '@/lib/seo/connectors/wordpress'

/**
 * WordPress tek-tık yetkilendirme callback'i.
 *
 * WP, onaydan sonra success_url'e şu parametreleri ekler:
 *   site_url, user_login, password (otomatik üretilen uygulama şifresi)
 * Reddedilirse rejected=1 (bizim eklediğimiz) veya success=false döner.
 *
 * Adımlar: state doğrula → credential test → şifreli kaydet → SEO'ya dön.
 */
export const dynamic = 'force-dynamic'
// Credential testi dış siteye istek atar; site yavaş/engelliyse fonksiyonun erken
// ölmemesi için süre tanı (testConnection zaten 10sn'de timeout olur).
export const maxDuration = 30

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const cookieStore = await cookies()
  const isEn = cookieStore.get('NEXT_LOCALE')?.value === 'en'
  const seoUrl = (q: string) => (isEn ? `/en/seo/articles?${q}` : `/seo/icerikler?${q}`)

  const clearCookies = (res: NextResponse) => {
    res.cookies.set('seo_site_oauth_state', '', { maxAge: 0, path: '/' })
    res.cookies.set('seo_site_oauth_target', '', { maxAge: 0, path: '/' })
    return res
  }

  const fail = (reason: string) =>
    clearCookies(NextResponse.redirect(new URL(seoUrl(`site=error&reason=${reason}`), origin), { status: 302 }))

  // Reddetme
  if (url.searchParams.get('rejected') === '1' || url.searchParams.get('success') === 'false') {
    return clearCookies(NextResponse.redirect(new URL(seoUrl('site=rejected'), origin), { status: 302 }))
  }

  const userId = cookieStore.get('user_id')?.value
  if (!userId) return fail('no_session')
  if (!isCryptoReady()) return fail('crypto_unavailable')

  // CSRF state doğrula
  const state = url.searchParams.get('state')
  const expected = cookieStore.get('seo_site_oauth_state')?.value
  if (!state || !expected || state !== expected) return fail('invalid_state')

  const siteUrl = url.searchParams.get('site_url')
  const userLogin = url.searchParams.get('user_login')
  const password = url.searchParams.get('password')
  if (!siteUrl || !userLogin || !password) return fail('missing_credentials')

  // Hedef siteyi cookie ile karşılaştır (host bazında)
  const target = cookieStore.get('seo_site_oauth_target')?.value
  try {
    if (target && new URL(target).host !== new URL(siteUrl).host) return fail('site_mismatch')
  } catch {
    return fail('invalid_url')
  }

  // Credential'ı test et
  const connector = new WordPressConnector({
    baseUrl: siteUrl,
    wpUsername: userLogin,
    wpAppPassword: password,
  })
  const test = await connector.testConnection()
  if (!test.ok) {
    // auth → uygulama şifresi/kullanıcı hatalı; network/timeout → site sunucu isteğini
    // engelliyor olabilir (net "ulaşılamadı" mesajı, sonsuz bekleme yerine).
    return fail(test.errorCode === 'auth' ? 'auth_failed' : test.errorCode === 'network' ? 'unreachable' : 'test_failed')
  }

  // İlk bağlantıysa varsayılan yap
  const existing = await listConnections(userId)
  const isFirst = existing.length === 0

  const saved = await upsertConnection(userId, {
    platform: 'wordpress',
    label: (() => {
      try {
        return new URL(siteUrl).host
      } catch {
        return 'WordPress'
      }
    })(),
    baseUrl: siteUrl,
    isDefault: isFirst,
    secrets: { wpUsername: userLogin, wpAppPassword: password },
  })

  if (!saved) return fail('save_failed')

  return clearCookies(NextResponse.redirect(new URL(seoUrl('site=connected'), origin), { status: 302 }))
}
