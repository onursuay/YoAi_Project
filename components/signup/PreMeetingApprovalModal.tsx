'use client'

/**
 * Başvuru sonrası kullanıcıya gösterilen ana popup.
 *
 * "Başvurunuz Alındı" + iki seçenek:
 *   1) Görüşme Planla       → onSchedule()
 *   2) Şimdilik Planlamak İstemiyorum → onDecline()
 *
 * Davranış:
 *   - Kapatma X yok, ESC kapatmaz, dış tıklama kapatmaz
 *   - Backdrop blur + dim
 *   - body scroll lock (mount sırasında)
 * Tasarım `AccessRequiredModal` ailesinden alınmıştır.
 */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarCheck, Sparkles } from 'lucide-react'

export interface PreMeetingApprovalModalProps {
  onSchedule: () => void
  onDecline: () => void
  busy?: boolean
}

export default function PreMeetingApprovalModal({
  onSchedule,
  onDecline,
  busy,
}: PreMeetingApprovalModalProps) {
  const t = useTranslations('landing.premeeting.approval')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => setMounted(true))
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premeeting-approval-title"
      data-testid="premeeting-approval-modal"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        aria-hidden="true"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      />

      <div
        className={[
          'relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/5',
          'transition-all duration-500 ease-out',
          mounted ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4',
        ].join(' ')}
      >
        <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-primary" />

        <div className="px-10 pt-10 pb-9 text-center">
          {/* Icon */}
          <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-primary/10 ring-1 ring-primary/15" />
            <div className="absolute inset-0 rounded-2xl animate-pulse bg-primary/5" />
            <CalendarCheck className="relative h-10 w-10 text-primary" />
            <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-primary/15 shadow-md">
              <Sparkles className="h-4 w-4 text-primary" />
            </span>
          </div>

          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/15">
            {t('badge')}
          </span>

          <h2
            id="premeeting-approval-title"
            className="text-2xl font-bold tracking-tight text-gray-900"
          >
            {t('title')}
          </h2>

          <p className="mt-4 text-[15px] leading-relaxed text-gray-500">
            {t.rich('body1', {
              strong: (chunks) => (
                <span className="font-semibold text-gray-700">{chunks}</span>
              ),
            })}
          </p>
          <p className="mt-2.5 text-[15px] leading-relaxed text-gray-500">
            {t('body2')}
          </p>

          <button
            type="button"
            onClick={onSchedule}
            disabled={busy}
            className="mt-8 w-full rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed"
            data-testid="premeeting-schedule-cta"
          >
            {t('scheduleCta')}
          </button>
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-white py-3.5 text-[15px] font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
            data-testid="premeeting-decline-cta"
          >
            {t('declineCta')}
          </button>
        </div>
      </div>
    </div>
  )
}
