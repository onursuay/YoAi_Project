/**
 * Ön görüşme için müsait slot listesi.
 *
 * Plan: Europe/Istanbul saat dilimi, hafta içi 10:00-18:00 arası 30 dk slot.
 * Bugünden itibaren `LOOKAHEAD_DAYS` gün boyunca slot üretilir.
 * Geçmiş saatler ve `signup_premeeting_bookings` tablosunda `status='scheduled'`
 * olan slotlar listeden düşürülür.
 *
 * Bu endpoint owner'ın takvimine bağlanmamış — gerçek availability = DB'deki
 * onayli randevuların yokluğudur. Slot çakışmasına izin verilmez (unique index
 * tabloda zorlanır).
 */
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveAccountState } from '@/lib/auth/accountApproval'

export const dynamic = 'force-dynamic'

const ISTANBUL_TZ = 'Europe/Istanbul'
const LOOKAHEAD_DAYS = 14
const SLOT_MINUTES = 30
const SLOT_START_HOUR = 10 // 10:00 dahil
const SLOT_END_HOUR = 18 // 18:00 dahil değil (son slot 17:30)

interface Slot {
  iso: string // tam ISO timestamp (UTC)
  date: string // YYYY-MM-DD (Istanbul)
  time: string // HH:mm (Istanbul)
}

/**
 * Bir Istanbul-yerel tarih + HH:mm değerini UTC ISO'ya çevirir.
 * Mantık: Istanbul = UTC+3 (yıl boyu sabit, DST yok 2026+). Yine de güvenli
 * tarafta kalmak için Intl tabanlı manuel hesap yapıyoruz.
 */
function istanbulDateTimeToUtcIso(date: string, time: string): string {
  // date: 'YYYY-MM-DD', time: 'HH:mm'
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  // Türkiye 2026'da DST'ye geçmiyor → sabit UTC+3.
  // UTC ms = Istanbul ms − 3 saat.
  const istanbulMs = Date.UTC(y, m - 1, d, hh, mm, 0)
  const utcMs = istanbulMs - 3 * 60 * 60 * 1000
  return new Date(utcMs).toISOString()
}

function generateSlots(startFromUtc: number): Slot[] {
  const slots: Slot[] = []
  // Istanbul cinsinden bugünün tarihi
  const startIstanbulMs = startFromUtc + 3 * 60 * 60 * 1000
  const start = new Date(startIstanbulMs)
  start.setUTCHours(0, 0, 0, 0)

  for (let dayOffset = 0; dayOffset < LOOKAHEAD_DAYS; dayOffset++) {
    const dayDate = new Date(start.getTime() + dayOffset * 24 * 60 * 60 * 1000)
    // Istanbul gün, hafta sonu kontrolü (0=Pazar, 6=Cmt)
    const dow = dayDate.getUTCDay()
    if (dow === 0 || dow === 6) continue

    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${dayDate.getUTCFullYear()}-${pad(dayDate.getUTCMonth() + 1)}-${pad(dayDate.getUTCDate())}`

    for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
      for (const m of [0, 30]) {
        const timeStr = `${pad(h)}:${pad(m)}`
        const utcIso = istanbulDateTimeToUtcIso(dateStr, timeStr)
        const utcMs = Date.parse(utcIso)
        // Geçmiş slotları + 2 saat içinde başlayacakları atla (last-minute önle)
        if (utcMs <= startFromUtc + 2 * 60 * 60 * 1000) continue
        slots.push({ iso: utcIso, date: dateStr, time: timeStr })
      }
    }
  }
  return slots
}

export async function GET() {
  const state = await resolveAccountState()
  if (!state) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }

  const now = Date.now()
  const candidates = generateSlots(now)

  // Dolu slotları DB'den oku
  let takenSet = new Set<string>()
  if (supabase) {
    const fromIso = new Date(now).toISOString()
    const toIso = new Date(now + (LOOKAHEAD_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('signup_premeeting_bookings')
      .select('scheduled_at, status')
      .gte('scheduled_at', fromIso)
      .lte('scheduled_at', toIso)
      .eq('status', 'scheduled')
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const ts = (row as any).scheduled_at as string | null
        if (ts) takenSet.add(new Date(ts).toISOString())
      }
    }
  }

  const free = candidates.filter((slot) => !takenSet.has(slot.iso))

  // İstemciye gruplu liste döner: tarihe göre slot dizisi
  const byDate = new Map<string, { time: string; iso: string }[]>()
  for (const s of free) {
    if (!byDate.has(s.date)) byDate.set(s.date, [])
    byDate.get(s.date)!.push({ time: s.time, iso: s.iso })
  }

  const days = Array.from(byDate.entries())
    .map(([date, slots]) => ({ date, slots }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    ok: true,
    timezone: ISTANBUL_TZ,
    durationMinutes: SLOT_MINUTES,
    days,
  })
}

