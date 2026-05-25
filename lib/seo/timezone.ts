/**
 * Timezone yardımcıları — kullanıcının yerel saatini (publish_time + IANA
 * timezone) UTC cron tetiklemesiyle eşleştirmek için.
 *
 * Sabit offset hesaplamak yerine Intl ile tz'ye çevirir → DST ve farklı
 * ülkeler için doğru çalışır.
 */

export interface LocalParts {
  date: string // YYYY-MM-DD (yerel)
  hour: number
  minute: number
  weekday: number // 0=Pazar .. 6=Cumartesi
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

export function getLocalParts(tz: string, at: Date = new Date()): LocalParts {
  let timeZone = tz
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
  } catch {
    timeZone = 'Europe/Istanbul'
  }
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = fmt.formatToParts(at)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  let hour = parseInt(get('hour'), 10)
  if (hour === 24) hour = 0 // bazı ortamlar 24 döndürür
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    minute: parseInt(get('minute'), 10),
    weekday: WEEKDAY_MAP[get('weekday')] ?? 0,
  }
}

/** Schedule bu anda (saat bazında) tetiklenmeli mi? */
export function isScheduleDue(
  publishTime: string,
  timezone: string,
  frequency: 'daily' | 'weekdays' | 'weekly',
  weekday: number | null,
  lastRunDate: string | null,
  at: Date = new Date()
): boolean {
  const local = getLocalParts(timezone, at)
  const targetHour = parseInt(publishTime.split(':')[0] ?? '9', 10)

  // Saat eşleşmesi (cron 0. dakikada çalışır → saat bazlı)
  if (local.hour !== targetHour) return false

  // Aynı yerel günde tekrar tetikleme engeli
  if (lastRunDate === local.date) return false

  // Frekans kontrolü
  if (frequency === 'weekdays' && (local.weekday === 0 || local.weekday === 6)) return false
  if (frequency === 'weekly' && weekday != null && local.weekday !== weekday) return false

  return true
}
