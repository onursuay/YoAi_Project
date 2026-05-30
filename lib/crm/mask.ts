/**
 * CRM liste görünümü için PII maskeleme. Detay modalında (kullanıcının KENDİ
 * lead'i) tam değer gösterilir; liste satırında maskeli gösterilir.
 */

export function maskEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null
  const at = email.indexOf('@')
  if (at <= 0) return '***@***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const show = local.length <= 2 ? local.slice(0, 1) + '*' : local.slice(0, 2) + '***'
  return `${show}@${domain}`
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null
  if (phone.length <= 4) return '***'
  return '***' + phone.slice(-4)
}
