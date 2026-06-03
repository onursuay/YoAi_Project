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

export interface ScheduleDueInput {
  publishTime: string
  timezone: string
  lastRunDate: string | null
  scheduleMode?: string | null            // 'daily' | 'weekly_days' | 'monthly_days'
  daysOfWeek?: number[] | null            // 0=Pazar..6=Cumartesi
  daysOfMonth?: number[] | null           // 1..31
  // legacy (schedule_mode yoksa kullanılır)
  frequency?: 'daily' | 'weekdays' | 'weekly'
  weekday?: number | null
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate() // month1to12 ay sonu
}

/**
 * Schedule bu anda tetiklenmeli mi?
 *
 * Saatlik cron (0 * * * *) ile çalışır. Tek-saat tam eşleşme yerine "yayın anı
 * bugün geldi/geçti + bugün henüz çalışmadı" mantığı kullanır → kullanıcı yayın
 * saatini o günkü pencereden SONRA ayarlasa bile (ör. 23:14'ü 23:30'da kaydetse)
 * bir sonraki saatlik cron'da AYNI GÜN telafi edilir; ertesi güne sarkmaz.
 *
 * scheduleMode değerlerine göre gün uygunluğu:
 *   'daily'        — her gün tetiklenir
 *   'weekly_days'  — daysOfWeek listesindeki hafta günlerinde tetiklenir
 *   'monthly_days' — daysOfMonth listesindeki ay günlerinde tetiklenir;
 *                    kısa aylarda seçilen 29-31 → ayın son gününe clamp edilir
 *   (boş/null)     — legacy: frequency ('daily'|'weekdays'|'weekly') + weekday alanı kullanılır
 */
export function isScheduleDue(input: ScheduleDueInput, at: Date = new Date()): boolean {
  const local = getLocalParts(input.timezone, at)
  const [hStr, mStr] = input.publishTime.split(':')
  const targetMinutes = parseInt(hStr ?? '9', 10) * 60 + parseInt(mStr ?? '0', 10)

  // Aynı yerel günde zaten çalıştıysa tekrar tetikleme.
  if (input.lastRunDate === local.date) return false

  const [yStr, moStr, dStr] = local.date.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(moStr, 10)
  const dayOfMonth = parseInt(dStr, 10)

  const mode = input.scheduleMode || ''
  let dayOk: boolean

  if (mode === 'weekly_days') {
    dayOk = (input.daysOfWeek ?? []).includes(local.weekday)
  } else if (mode === 'monthly_days') {
    const dom = input.daysOfMonth ?? []
    const lastDay = lastDayOfMonth(year, month)
    // Kısa ayda 29-31 seçilmişse → ayın son gününe clamp.
    dayOk = dom.some((d) => d === dayOfMonth || (d > lastDay && dayOfMonth === lastDay))
  } else if (mode === 'daily') {
    dayOk = true
  } else {
    // Legacy: schedule_mode yoksa eski frequency mantığı.
    const freq = input.frequency ?? 'daily'
    if (freq === 'weekdays' && (local.weekday === 0 || local.weekday === 6)) dayOk = false
    else if (freq === 'weekly' && input.weekday != null && local.weekday !== input.weekday) dayOk = false
    else dayOk = true
  }
  if (!dayOk) return false

  const nowMinutes = local.hour * 60 + local.minute
  return nowMinutes >= targetMinutes
}
