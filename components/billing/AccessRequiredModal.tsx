'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Sparkles, Zap, ShieldCheck, Lock, X } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import {
  getFeatureRule,
  type FeatureAccessRule,
  type FeatureKey,
} from '@/lib/billing/featureAccessMap'

export type AccessRequiredType = 'credit' | 'subscription'

export interface AccessRequiredModalProps {
  /**
   * Modal türü:
   *   - 'credit'       → Kredi yükleme odaklı modal
   *   - 'subscription' → Abonelik / plan yükseltme odaklı modal
   *
   * Her iki tür de aynı tasarım ailesinden olup ikon, badge, başlık ve
   * CTA metniyle birbirinden ayrılır.
   */
  type: AccessRequiredType
  /** Hangi alanın engellendiği — başlığa/açıklamaya katılır */
  featureName?: string
  /** Feature key — verilirse `featureAccessMap` kayıtlarından default'lar çekilir */
  featureKey?: FeatureKey | string
  /** Modal başlığı; verilmezse type'a göre default Türkçe metin */
  title?: string
  /** Açıklama metni; verilmezse type/feature'a göre default */
  description?: string
  /** Badge etiketi; verilmezse type'a göre default ('ABONELİK' / 'AI KREDİ') */
  badgeLabel?: string
  /** Primary CTA buton metni; verilmezse type'a göre default */
  ctaLabel?: string
  /** Primary CTA hedefi — default `/abonelik` */
  ctaHref?: string
  /** Telemetri/log için kısa sebep (UI'da gösterilmez) */
  reason?: string
  /**
   * Yumuşak (soft) limit/upsell senaryoları için kapatılabilirlik. Default
   * KAPALI → alan erişim bariyerlerinde modal kapatılamaz (mevcut davranış).
   * `dismissible` + `onClose` verilirse X / ESC / dış tıklama ile kapanır.
   */
  dismissible?: boolean
  onClose?: () => void
}

/**
 * YoAi'de ücretli erişim gerektiren TÜM alanlarda kullanılan global modal.
 *
 * Davranış (her iki tür için ortak):
 *   - Kapatma X yok, ESC kapatmaz, dış tıklama kapatmaz.
 *   - Backdrop blur + dim.
 *   - Sadece CTA (kredi yükleme veya plan/abonelik sayfasına yönlendirir).
 *   - Body scroll mount sırasında kilitlenir, unmount'ta açılır.
 *
 * Tür ayrımı (görsel):
 *   - subscription → Lock + ShieldCheck ikonları, "ABONELİK" rozet, "Planları İncele"
 *   - credit       → Sparkles + Zap ikonları, "AI KREDİ" rozet, "Kredi Yükle"
 */
export default function AccessRequiredModal({
  type,
  featureName,
  featureKey,
  title,
  description,
  badgeLabel,
  ctaLabel,
  ctaHref,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  reason,
  dismissible = false,
  onClose,
}: AccessRequiredModalProps) {
  const router = useRouter()
  const t = useTranslations('billing.accessRequired')
  const canDismiss = dismissible && typeof onClose === 'function'

  // Body scroll lock — modal kapatılamadığı sürece arkadaki sayfada
  // gezilemez. unmount'ta restore edilir.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ESC: kapatılabilir modda kapatır; aksi halde yutulur (kazara kapanma yok).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (canDismiss) onClose!()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [canDismiss, onClose])

  const isCredit = type === 'credit'
  const typeKey = isCredit ? 'credit' : 'subscription'

  const rule: FeatureAccessRule | null = featureKey
    ? getFeatureRule(featureKey)
    : null
  // Feature etiketi/açıklaması i18n öncelikli (TR+EN); featureAccessMap'teki TR
  // değerler geriye-uyum fallback olarak kalır.
  const featureLabelI18n =
    rule && t.has(`features.${rule.key}`) ? t(`features.${rule.key}`) : undefined
  const featureDescI18n =
    rule && t.has(`featureDescriptions.${rule.key}`)
      ? t(`featureDescriptions.${rule.key}`)
      : undefined
  const resolvedFeatureName = featureName ?? featureLabelI18n ?? rule?.label

  const resolvedTitle = title ?? t(`${typeKey}.title`)
  const resolvedBadge = badgeLabel ?? t(`${typeKey}.badge`)
  const resolvedDescription =
    description ??
    featureDescI18n ??
    rule?.description ??
    (resolvedFeatureName
      ? t(`${typeKey}.descWithFeature`, { feature: resolvedFeatureName })
      : t(`${typeKey}.description`))
  const resolvedCta = ctaLabel ?? t(`${typeKey}.cta`)
  // Tek billing alanı şu an `/abonelik` — kredi sekmesine derin link veriyoruz.
  const defaultHref = isCredit
    ? `${ROUTES.SUBSCRIPTION}#krediler`
    : ROUTES.SUBSCRIPTION
  const resolvedHref = ctaHref ?? defaultHref

  const accentClass = isCredit
    ? 'from-primary via-emerald-400 to-primary'
    : 'from-primary via-primary/70 to-primary'

  const PrimaryIcon = isCredit ? Sparkles : ShieldCheck
  const SecondaryIcon = isCredit ? Zap : Lock

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-required-title"
      data-testid="access-required-modal"
      data-access-type={type}
    >
      {/* Backdrop — pointer events absorb, no click-through */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        aria-hidden="true"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (canDismiss) onClose!()
        }}
      />

      {/* Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Top gradient accent */}
        <div className={`h-1.5 bg-gradient-to-r ${accentClass}`} />

        {/* Kapatma — yalnız soft/upsell modunda (dismissible) */}
        {canDismiss && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeAria')}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="px-8 pt-8 pb-7 text-center">
          <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <PrimaryIcon className="h-8 w-8 text-primary" />
            <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-primary/15 shadow-sm">
              <SecondaryIcon className="h-3.5 w-3.5 text-primary" />
            </span>
          </div>

          <span
            className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/15"
            data-testid="access-required-badge"
          >
            {resolvedBadge}
          </span>

          <h2
            id="access-required-title"
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
            data-testid="access-required-cta"
          >
            {resolvedCta}
          </button>
        </div>
      </div>
    </div>
  )
}
