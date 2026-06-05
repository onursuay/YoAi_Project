import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'
import { isCryptoReady } from '@/lib/seo/crypto'
import { listConnections, upsertConnection } from '@/lib/seo/siteConnectionStore'
import { WordPressConnector } from '@/lib/seo/connectors/wordpress'

/**
 * WordPress'e MANUEL "Uygulama Şifresi" ile bağlanma.
 *
 * Tek-tık OAuth (wp-admin/authorize-application.php) ağır/yavaş WordPress
 * kurulumlarında beyaz ekrana / zaman aşımına düşebildiği için alternatif yol:
 * kullanıcı kendi WP profilinden bir uygulama parolası üretip buraya yapıştırır.
 * Doğrulama, hafif `wp-json/wp/v2/users/me` ucundan yapılır (testConnection
 * içinde 10sn timeout vardır) — bu uç ağır sitelerde de hızlı yanıt verir.
 *
 * POST body: { baseUrl | url, username, appPassword, label? }
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

function getUserId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  return cookieStore.get('user_id')?.value ?? null
}

function normalizeHttpsUrl(raw: string): string | null {
  let u = (raw || '').trim()
  if (!u) return null
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  try {
    const url = new URL(u)
    if (url.protocol !== 'https:') return null
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })

  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
  if (!isCryptoReady()) return NextResponse.json({ ok: false, error: 'crypto_unavailable' }, { status: 503 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const baseUrl = normalizeHttpsUrl((body.baseUrl as string) || (body.url as string) || '')
  if (!baseUrl) return NextResponse.json({ ok: false, error: 'invalid_url' }, { status: 400 })

  const username = ((body.username as string) || '').trim()
  if (!username) return NextResponse.json({ ok: false, error: 'username_required' }, { status: 400 })

  // WP uygulama parolası 24 karakter olup görüntülenirken 4'erli boşluklu gösterilir;
  // WordPress doğrulamada boşlukları yok sayar, biz de kaldırıp saklarız.
  const appPassword = ((body.appPassword as string) || '').replace(/\s+/g, '')
  if (appPassword.length < 16) return NextResponse.json({ ok: false, error: 'weak_password' }, { status: 400 })

  // Hafif uçtan doğrula (testConnection → users/me, 10sn timeout).
  const connector = new WordPressConnector({ baseUrl, wpUsername: username, wpAppPassword: appPassword })
  const test = await connector.testConnection()
  if (!test.ok) {
    const code =
      test.errorCode === 'auth' ? 'auth_failed'
      : test.errorCode === 'auth_blocked' ? 'auth_blocked'
      : test.errorCode === 'network' ? 'unreachable'
      : test.errorCode === 'not_found' ? 'not_wordpress'
      : 'test_failed'
    return NextResponse.json({ ok: false, error: code }, { status: 400 })
  }

  // İlk hedefse varsayılan yap (publish varsayılanı kullanır).
  const existing = await listConnections(userId)
  const isFirst = existing.length === 0
  const label =
    ((body.label as string) || '').trim() ||
    (() => {
      try {
        return new URL(baseUrl).host
      } catch {
        return 'WordPress'
      }
    })()

  const connection = await upsertConnection(userId, {
    platform: 'wordpress',
    label,
    baseUrl,
    isDefault: isFirst,
    secrets: { wpUsername: username, wpAppPassword: appPassword },
  })

  if (!connection) return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, connection })
}
