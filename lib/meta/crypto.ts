import crypto from 'node:crypto'

const DEBUG = process.env.NODE_ENV !== 'production'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function getSecret(): string | null {
  const secret = process.env.META_TOKEN_SECRET
  if (!secret || secret.length < 32) {
    return null
  }
  return secret
}

function deriveKey(secret: string): Buffer {
  const salt = secret.substring(0, SALT_LENGTH)
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256')
}

export function encrypt(text: string): string | null {
  const secret = getSecret()
  if (!secret) {
    return null
  }

  try {
    const key = deriveKey(secret)
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
  } catch (error) {
    if (DEBUG) console.error('Encryption error:', error)
    return null
  }
}

export function decrypt(payload: string): string | null {
  const secret = getSecret()
  if (!secret) {
    return null
  }

  try {
    const parts = payload.split(':')
    if (parts.length !== 3) {
      return null
    }

    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const key = deriveKey(secret)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    if (DEBUG) console.error('Decryption error:', error)
    return null
  }
}

