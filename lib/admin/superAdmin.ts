/**
 * Gözetim Merkezi yetki kontrolü.
 *
 * Kullanıcı-facing UI'da "Süper Admin" ifadesi kullanılmaz.
 * Bu dosya teknik helper'lar barındırır — UI metni daima "Gözetim Merkezi"dir.
 *
 * Yetki kuralı:
 *   - Env SUPER_ADMIN_EMAILS varsa virgülle ayrılmış e-posta listesi kullanılır.
 *   - Yoksa default olarak `onursuay@hotmail.com` tanımlıdır.
 *   - Karşılaştırma trim + lowercase ile yapılır.
 *
 * Güvenlik notu:
 *   - `user_email` cookie public/non-httpOnly olduğu için TEK BAŞINA güvenilmez.
 *   - Server-side doğrulamada `user_id` (httpOnly) cookie'sinden hareketle
 *     `signups` tablosundan e-posta okunur ve allowlist ile karşılaştırılır.
 */
import 'server-only'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'

const DEFAULT_SUPER_ADMIN_EMAIL = 'onursuay@hotmail.com'

function loadAllowlist(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS
  if (!raw || !raw.trim()) return [DEFAULT_SUPER_ADMIN_EMAIL]
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (list.length === 0) return [DEFAULT_SUPER_ADMIN_EMAIL]
  return list
}

export const SUPER_ADMIN_EMAILS: string[] = loadAllowlist()

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return SUPER_ADMIN_EMAILS.includes(normalized)
}

/**
 * Server-side: oturumdan kullanıcı e-postasını çözer.
 * `user_id` cookie (httpOnly) → signups.email lookup.
 * Cookie yoksa veya kullanıcı bulunamazsa null döner.
 */
export async function resolveSessionEmail(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId || !supabase) return null
    const { data, error } = await supabase
      .from('signups')
      .select('email')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return null
    return (data.email as string | null) ?? null
  } catch {
    return null
  }
}

/**
 * Server-side: mevcut oturum Gözetim Merkezi erişimine sahip mi?
 */
export async function getIsCurrentUserSuperAdmin(): Promise<boolean> {
  const email = await resolveSessionEmail()
  return isSuperAdminEmail(email)
}

/**
 * API route guard.
 * - `x-admin-secret` header doğru ise → allow (manuel/internal kullanım).
 * - Aksi halde server-side session lookup ile email kontrolü.
 *
 * Yetki yoksa `{ ok: false, status: 404 }` döner — `403` veya
 * "unauthorized" sızdırılmaz. Caller bu sinyali kullanarak admin alanının
 * varlığını ele vermeyen bir cevap üretir.
 */
export type AdminAccessResult =
  | { ok: true; via: 'secret' | 'session'; email: string | null }
  | { ok: false; status: 404 }

export async function checkAdminAccess(
  req: Request,
): Promise<AdminAccessResult> {
  const adminSecret = process.env.ADMIN_SECRET
  const headerSecret = req.headers.get('x-admin-secret')
  if (adminSecret && adminSecret.trim() && headerSecret === adminSecret) {
    return { ok: true, via: 'secret', email: null }
  }
  const email = await resolveSessionEmail()
  if (isSuperAdminEmail(email)) {
    return { ok: true, via: 'session', email }
  }
  return { ok: false, status: 404 }
}
