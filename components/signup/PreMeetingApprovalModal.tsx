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
import { useEffect } from 'react'
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

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-primary" />

        <div className="px-8 pt-8 pb-7 text-center">
          <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <CalendarCheck className="h-8 w-8 text-primary" />
            <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-primary/15 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </span>
          </div>

          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/15">
            ÖN GÖRÜŞME
          </span>

          <h2
            id="premeeting-approval-title"
            className="text-xl font-bold tracking-tight text-gray-900"
          >
            Başvurunuz Alındı
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            YoAi hesabınızı aktif kullanıma açmadan önce, işletmenizi ve
            ihtiyaçlarınızı daha doğru anlayabilmemiz için 30 dakikalık kısa bir
            ön görüşme planlıyoruz.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Uygun olduğunuz günü ve saati takvim üzerinden seçerek başvurunuzu
            tamamlayabilirsiniz.
          </p>

          <button
            type="button"
            onClick={onSchedule}
            disabled={busy}
            className="mt-7 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed"
            data-testid="premeeting-schedule-cta"
          >
            Görüşme Planla
          </button>
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
            data-testid="premeeting-decline-cta"
          >
            Şimdilik Planlamak İstemiyorum
          </button>
        </div>
      </div>
    </div>
  )
}
