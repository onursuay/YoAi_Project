'use client'

/**
 * Ön görüşme planlama (oturumlu signup için).
 *
 * Mevcut DB'deki başka randevuları okuyup dolu slotları engeller. Endpoint
 * tarafında da çakışmalar uniqueness ile reddedilir.
 * Tasarım: landing page `ScheduleModal`'a hizalı ama tek panel — kullanıcı
 * zaten oturumlu, isim/email zorunlu değil.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, CalendarCheck } from 'lucide-react'

interface Slot {
  iso: string
  time: string
}
interface DaySlots {
  date: string
  slots: Slot[]
}

export interface PreMeetingScheduleModalProps {
  onClose: () => void
  onScheduled: (scheduledAtIso: string) => void
}

const MONTH_NAMES_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]
const DAY_SHORT_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

function formatDayHeader(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${d} ${MONTH_NAMES_TR[m - 1]} ${y}, ${DAY_SHORT_TR[dt.getDay()]}`
}

export default function PreMeetingScheduleModal({
  onClose,
  onScheduled,
}: PreMeetingScheduleModalProps) {
  const [days, setDays] = useState<DaySlots[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // body scroll lock + ESC yutma
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [])

  const loadAvailability = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/signup/premeeting/availability', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'load_failed')
      }
      const list = (data.days as DaySlots[]) || []
      setDays(list)
      if (list.length > 0 && !selectedDate) {
        setSelectedDate(list[0].date)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load_failed')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    loadAvailability()
  }, [loadAvailability])

  const slotsForSelectedDay = useMemo<Slot[]>(() => {
    if (!selectedDate) return []
    const found = days.find((d) => d.date === selectedDate)
    return found?.slots || []
  }, [days, selectedDate])

  async function handleConfirm() {
    if (!selectedIso || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/signup/premeeting/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: selectedIso }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        if (data?.error === 'slot_taken') {
          setError('Bu saat az önce başkası tarafından alındı. Lütfen başka bir slot seçin.')
          setSelectedIso(null)
          await loadAvailability()
        } else {
          setError('Randevu kaydedilemedi. Lütfen tekrar deneyin.')
        }
        setSubmitting(false)
        return
      }
      onScheduled(data.scheduledAt as string)
    } catch {
      setError('Randevu kaydedilemedi. Lütfen tekrar deneyin.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premeeting-schedule-title"
      data-testid="premeeting-schedule-modal"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-hidden="true"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      />

      <div className="relative w-full max-w-[760px] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-primary" />

        <div className="px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
              <CalendarCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2
                id="premeeting-schedule-title"
                className="text-lg font-bold text-gray-900 truncate"
              >
                30 Dakikalık Ön Görüşme
              </h2>
              <p className="text-xs text-gray-500">
                İstanbul (GMT+3) · Hafta içi 10:00 – 18:00
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
          ) : days.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
              Şu an uygun bir saat görünmüyor. Lütfen daha sonra tekrar deneyin
              veya destek ekibimizle iletişime geçin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
              {/* Tarihler */}
              <div className="max-h-[360px] overflow-y-auto pr-1 space-y-1.5">
                {days.map((d) => {
                  const active = selectedDate === d.date
                  return (
                    <button
                      key={d.date}
                      onClick={() => {
                        setSelectedDate(d.date)
                        setSelectedIso(null)
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                        active
                          ? 'border-primary/40 bg-primary/5 text-primary font-semibold'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {formatDayHeader(d.date)}
                      <span className="block text-[11px] font-normal text-gray-500 mt-0.5">
                        {d.slots.length} uygun saat
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Saatler */}
              <div>
                {slotsForSelectedDay.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
                    Bu gün için boş saat kalmadı. Başka bir gün seçin.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[360px] overflow-y-auto pr-1">
                    {slotsForSelectedDay.map((slot) => {
                      const active = selectedIso === slot.iso
                      return (
                        <button
                          key={slot.iso}
                          onClick={() => setSelectedIso(slot.iso)}
                          className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition ${
                            active
                              ? 'border-primary bg-primary text-white shadow-sm'
                              : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                          }`}
                        >
                          {slot.time}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="premeeting-schedule-cancel"
            >
              Geri
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedIso || submitting}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="premeeting-schedule-confirm"
            >
              {submitting ? 'Kaydediliyor…' : 'Randevuyu Onayla'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
