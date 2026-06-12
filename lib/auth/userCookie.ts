/**
 * user_id kimlik çerezi bütünlüğü (HMAC-SHA256).
 *
 * Sorun: user_id çerezi düz signups.id idi → istemci taklit edebilir (impersonation).
 * Çözüm: çerez değeri `${id}.${hmac(id)}` olarak imzalanır; okumada doğrulanır.
 *
 * Deploy-güvenli geriye uyumluluk:
 *  - SESSION_SECRET yoksa: imzasız davranışa düşer (signUserId düz id döner,
 *    readUserId değeri olduğu gibi kabul eder) → KIRILMAZ, sadece korumasız.
 *  - SESSION_SECRET varsa: imzasız/legacy/taklit değerler reddedilir (null) →
 *    kullanıcı yeniden login olur. Forgery imkânsız (secret olmadan geçerli
 *    imza üretilemez).
 *
 * Tüm okuyucular bu helper'ı kullanır; ham `cookieStore.get('user_id')?.value`
 * KULLANILMAZ (aksi halde imzalı değer ham okunur ve kimlik çözülemez).
 */
import crypto from 'node:crypto'

const COOKIE = 'user_id'

function getSecret(): string | null {
  const s = process.env.SESSION_SECRET
  return s && s.length >= 16 ? s : null
}

function hmac(id: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(id).digest('hex')
}

/** Login/verify'da user_id çerez DEĞERİNİ üretir (imzalı). */
export function signUserId(id: string): string {
  const secret = getSecret()
  if (!secret) return id
  return `${id}.${hmac(id, secret)}`
}

type CookieStore = { get(name: string): { value: string } | undefined }

/** Çerez deposundan doğrulanmış user_id'yi döndürür; geçersizse null. */
export function readUserId(store: CookieStore): string | null {
  const raw = store.get(COOKIE)?.value
  if (!raw) return null

  const secret = getSecret()
  if (!secret) return raw // secret yoksa eski davranış (imzasız kabul)

  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null // imzasız/legacy/taklit → reddet
  const id = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = hmac(id, secret)
  if (sig.length !== expected.length) return null
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  return id
}
