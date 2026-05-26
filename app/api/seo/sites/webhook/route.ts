import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'
import { listConnections, upsertConnection } from '@/lib/seo/siteConnectionStore'

/**
 * Generic Webhook hedefi oluşturma — WordPress dışı / özel yazılım siteleri için.
 *
 * WordPress'in OAuth tek-tık akışının aksine, kullanıcı doğrudan bir webhook
 * adresi + gizli anahtar verir. Gizli anahtar AES-256-GCM ile şifrelenip
 * site_connections.credentials_enc içinde saklanır (düz metin tutulmaz).
 *
 * POST body: { url: string, secret: string, label?: string }
 */
export const dynamic = 'force-dynamic'

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
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const url = normalizeHttpsUrl(body.url as string)
  if (!url) return NextResponse.json({ ok: false, error: 'invalid_url' }, { status: 400 })

  const secret = ((body.secret as string) || '').trim()
  if (secret.length < 8) return NextResponse.json({ ok: false, error: 'weak_secret' }, { status: 400 })

  const label = ((body.label as string) || '').trim() || null

  // İlk hedefse varsayılan yap (publish varsayılanı kullanır).
  const existing = await listConnections(userId)
  const isFirst = existing.length === 0

  const connection = await upsertConnection(userId, {
    platform: 'generic',
    label,
    baseUrl: url,
    webhookUrl: url,
    isDefault: isFirst,
    secrets: { webhookSecret: secret },
  })

  if (!connection) return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, connection })
}
