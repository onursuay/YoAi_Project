'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { ROUTES } from '@/lib/routes'

export interface CreditRequiredModalProps {
  /** Hangi alanın engellendiği — başlığa/açıklamaya katılır */
  featureName?: string
  /** Modal başlığı; verilmezse default Türkçe metin */
  title?: string
  /** Açıklama metni; verilmezse default */
  description?: string
  /** "Premium" / "Starter" gibi gerekli plan etiketi (opsiyonel rozet) */
  requiredPlanLabel?: string
  /** Primary CTA buton metni */
  ctaLabel?: string
  /** Primary CTA hedefi — default `/abonelik` */
  billingHref?: string
  /** Telemetri/log için kısa sebep (UI'da gösterilmez) */
  reason?: string
}

const DEFAULT_TITLE = 'Bu alan için kredi gerekiyor'
const DEFAULT_DESCRIPTION =
  'Bu özelliği kullanabilmek için aktif kredi veya uygun plan gerekir. Kredi yükleyerek kampanya analizlerini ve AI önerilerini kullanabilirsiniz.'
const DEFAULT_CTA = 'Kredi Yükle / Plan Yükselt'

/**
 * Kredi/abonelik gerektiren tüm YoAi alanlarında kullanılan global modal.
 *
 * Davranış:
 *   - Kapatma X yok, ESC kapatmaz, dış tıklama kapatmaz.
 *   - Backdrop blur + dim.
 *   - Sadece CTA (kredi/plan sayfasına yönlendirir).
 *   - Body scroll mount sırasında kilitlenir, unmount'ta açılır.
 */
export default function CreditRequiredModal({
  featureName,
  title,
  description,
  requiredPlanLabel,
  ctaLabel,
  billingHref,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  reason,
}: CreditRequiredModalProps) {
  const router = useRouter()

  // Body scroll lock — modal kapatılamadığı sürece arkadaki sayfada
  // gezilemez. unmount'ta restore edilir.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ESC tuşunu yutuyoruz — kullanıcı kazara kapatamasın.
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

  const resolvedTitle = title ?? DEFAULT_TITLE
  const resolvedDescription =
    description ??
    (featureName
      ? `${featureName} özelliğini kullanabilmek için aktif kredi veya uygun plan gerekir. Kredi yükleyerek kampanya analizlerini ve AI önerilerini kullanabilirsiniz.`
      : DEFAULT_DESCRIPTION)
  const resolvedCta = ctaLabel ?? DEFAULT_CTA
  const resolvedHref = billingHref ?? ROUTES.SUBSCRIPTION

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-required-title"
      data-testid="credit-required-modal"
    >
      {/* Backdrop — pointer events absorb, no click-through */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        aria-hidden="true"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      />

      {/* Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Top gradient accent */}
        <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-primary" />

        <div className="px-8 pt-8 pb-7 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>

          {requiredPlanLabel && (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/15">
              {requiredPlanLabel}
            </span>
          )}

          <h2
            id="credit-required-title"
            className="text-xl font-bold tracking-tight text-gray-900"
          >
            {resolvedTitle}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            {resolvedDescription}
          </p>

          <button
            type="button"
            onClick={() => router.push(resolvedHref)}
            className="mt-7 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="credit-required-cta"
          >
            {resolvedCta}
          </button>
        </div>
      </div>
    </div>
  )
}
