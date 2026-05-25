import 'server-only'
import crypto from 'node:crypto'

/**
 * Site bağlantı kimlik bilgileri için AES-256-GCM şifreleme.
 *
 * Site connector credential'ları (WordPress application password,
 * Shopify admin token, İdeaSoft client secret) kalıcı + tam yazma yetkili
 * sırlardır. Meta/Google OAuth token'larından farklı olarak revoke/scope/
 * süre koruması yoktur — bu yüzden veritabanında ŞİFRELİ saklanır.
 *
 * Format: "iv:authTag:ciphertext" (her parça base64).
 * Anahtar: SITE_CREDENTIALS_KEY env (32 byte; hex/base64/utf8 kabul edilir).
 *
 * Güvenlik: çözülmüş sır asla log'a yazılmaz.
 */

const ALGO = 'aes-256-gcm'

/** Env'den 32 byte anahtar türet. hex(64), base64(44) veya ham 32 char destekler. */
function getKey(): Buffer {
  const raw = process.env.SITE_CREDENTIALS_KEY
  if (!raw) {
    throw new Error('SITE_CREDENTIALS_KEY not configured')
  }

  // hex 64 char → 32 byte
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }
  // base64 → 32 byte
  try {
    const b = Buffer.from(raw, 'base64')
    if (b.length === 32) return b
  } catch {
    /* ignore */
  }
  // ham utf8 32 byte
  const utf8 = Buffer.from(raw, 'utf8')
  if (utf8.length === 32) return utf8

  // Son çare: SHA-256 ile 32 byte'a sıkıştır (deterministik).
  return crypto.createHash('sha256').update(raw).digest()
}

/** Düz metni şifreler → "iv:tag:cipher" (base64). */
export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12) // GCM için 96-bit nonce önerilir
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

/** "iv:tag:cipher" formatını çözer → düz metin. Hatalıysa Error fırlatır. */
export function decryptSecret(payload: string): string {
  const key = getKey()
  const parts = payload.split(':')
  if (parts.length !== 3) {
    throw new Error('invalid_ciphertext_format')
  }
  const [ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}

/** Şifreleme anahtarı yapılandırılmış mı? (route guard'ları için) */
export function isCryptoReady(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}

/** Gizli bilgiyi maskele (UI/log için). "••••1234" benzeri kuyruk gösterir. */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return ''
  if (secret.length <= 4) return '••••'
  return `••••${secret.slice(-4)}`
}
