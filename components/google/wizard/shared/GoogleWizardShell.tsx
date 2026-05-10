'use client'

import { useEffect } from 'react'
import { X, AlertCircle, Loader2, Check } from 'lucide-react'

/**
 * Google Ads Wizard — paylaşılan full-screen shell.
 *
 * Display wizard'ında kanıtlanan modern düzeni Search ve PMax wizard'larının
 * da paylaşabileceği şekilde generic hale getirilmiş bir layout taşıyıcı.
 *
 * Shell SADECE layout taşır:
 *   - üst header (logo + eyebrow + title + close X)
 *   - sol dikey step menüsü (sub-nav opsiyonel)
 *   - orta içerik alanı
 *   - opsiyonel sağ sticky özet paneli
 *   - alt footer (back / step indicator / next-submit)
 *   - opsiyonel google-snake-border arka plan animasyonu
 *   - opsiyonel sonuç bandı (full / partial) — child içeriğin yerine geçer
 *
 * Validation, payload oluşturma, state yönetimi shell DIŞINDA kalır.
 */

export interface WizardShellStep {
  label: string
  /** Aktif step seçilince altında açılacak bağlantılar (PMax campaign settings sub-nav). */
  subItems?: { id: string; label: string }[]
}

export interface ResultBanner {
  variant: 'full' | 'partial'
  title: string
  message: string
  acknowledgeLabel: string
  onAcknowledge: () => void
}

export interface FooterLabels {
  cancel: string
  back: string
  next: string
  submit: string
  submitting: string
}

interface Props {
  isOpen: boolean
  onClose: () => void

  // Header
  logoSrc?: string
  eyebrow?: string
  title: string

  // Sol dikey step menüsü
  steps: WizardShellStep[]
  currentStep: number
  /** Soldaki step kategori başlığı — örn. "GÖRÜNTÜLÜ REKLAM". */
  campaignTypeLabel?: string
  /** İleriye gidilemez; geri ise serbest. Sadece tamamlanmış step'lere tıklanabilir. */
  onStepClick?: (i: number) => void
  /** Step item icon override — varsayılan: tamamlanmışta tick, mevcut/bekleyende numara. */
  stepStatusOf?: (i: number) => 'done' | 'error' | 'current' | 'pending'

  // Body
  children: React.ReactNode
  rightSummary?: React.ReactNode
  errorMessage?: string | null
  resultBanner?: ResultBanner | null
  showSnakeBorder?: boolean

  // Footer
  isFirstStep: boolean
  isLastStep: boolean
  submitting?: boolean
  submitDisabled?: boolean
  submitDisabledReason?: string
  onBack?: () => void
  onNext?: () => void
  onSubmit?: () => void
  labels: FooterLabels
  /** Footer'ı tamamen gizle (örn. result gösterilirken). */
  hideFooter?: boolean
}

export default function GoogleWizardShell({
  isOpen,
  onClose,
  logoSrc = '/integration-icons/google-ads.svg',
  eyebrow,
  title,
  steps,
  currentStep,
  campaignTypeLabel,
  onStepClick,
  stepStatusOf,
  children,
  rightSummary,
  errorMessage,
  resultBanner,
  showSnakeBorder = true,
  isFirstStep,
  isLastStep,
  submitting,
  submitDisabled,
  submitDisabledReason,
  onBack,
  onNext,
  onSubmit,
  labels,
  hideFooter,
}: Props) {
  // Lock body scroll & Escape key
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const totalSteps = steps.length
  const isResultShown = !!resultBanner
  const showFooter = !hideFooter && !isResultShown
  const hasRightSummary = !!rightSummary

  const renderStepIcon = (i: number) => {
    const explicit = stepStatusOf?.(i)
    const status: 'done' | 'error' | 'current' | 'pending' =
      explicit ?? (i < currentStep ? 'done' : i === currentStep ? 'current' : 'pending')
    if (status === 'done') {
      return (
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border-2 bg-primary border-primary text-white">
          <Check className="w-3.5 h-3.5" />
        </span>
      )
    }
    if (status === 'error') {
      return (
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border-2 bg-red-50 border-red-300 text-red-600">
          !
        </span>
      )
    }
    if (status === 'current') {
      return (
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border-2 border-primary bg-white text-primary">
          {i + 1}
        </span>
      )
    }
    return (
      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border-2 border-gray-300 bg-white text-gray-400">
        {i + 1}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ── Header ── */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="Google Ads" width={32} height={32} className="shrink-0" />
          <div className="flex flex-col leading-tight">
            {eyebrow && (
              <span className="text-[11px] font-semibold tracking-[0.12em] text-gray-500">
                {eyebrow}
              </span>
            )}
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label={labels.cancel}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 relative overflow-hidden bg-white">
        {showSnakeBorder && <div className="google-snake-border" aria-hidden="true" />}
        <div className="absolute inset-0 overflow-y-auto z-10">
          <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
            {/* ─── Sol: dikey step menüsü ─── */}
            <aside className="w-56 shrink-0">
              <nav className="sticky top-0 space-y-1">
                {campaignTypeLabel && (
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3">
                    {campaignTypeLabel}
                  </p>
                )}
                {steps.map((s, i) => {
                  const explicit = stepStatusOf?.(i)
                  const isCompleted = explicit ? explicit === 'done' || explicit === 'error' : i < currentStep
                  const isCurrent = i === currentStep
                  const isClickable = isCompleted && !isResultShown && !!onStepClick
                  return (
                    <div key={i}>
                      <button
                        type="button"
                        disabled={!isClickable}
                        onClick={() => isClickable && onStepClick?.(i)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          isCurrent
                            ? 'bg-primary/10 text-primary font-semibold'
                            : isCompleted
                              ? 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                              : 'text-gray-400 cursor-default'
                        }`}
                      >
                        {renderStepIcon(i)}
                        <span className="flex-1 text-left truncate">{s.label}</span>
                      </button>
                      {isCurrent && s.subItems && s.subItems.length > 0 && (
                        <div className="ml-10 border-l border-gray-200 pl-2 py-1 space-y-0.5">
                          {s.subItems.map(sub => (
                            <a
                              key={sub.id}
                              href={`#${sub.id}`}
                              className="block px-2 py-1 text-xs text-gray-500 hover:text-primary truncate"
                            >
                              {sub.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </nav>
            </aside>

            {/* ─── Orta + Sağ ─── */}
            <div className={`flex-1 ${hasRightSummary ? 'grid grid-cols-3 gap-8' : ''} min-w-0`}>
              <div className={hasRightSummary ? 'col-span-2 space-y-4' : 'space-y-4'}>
                {resultBanner && (
                  <div
                    className={`flex flex-col items-center justify-center py-10 px-6 rounded-xl border ${
                      resultBanner.variant === 'full'
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <h3
                      className={`text-lg font-semibold mb-1 ${
                        resultBanner.variant === 'full' ? 'text-emerald-800' : 'text-gray-800'
                      }`}
                    >
                      {resultBanner.title}
                    </h3>
                    <p
                      className={`text-sm text-center mb-4 ${
                        resultBanner.variant === 'full' ? 'text-emerald-700' : 'text-gray-700'
                      }`}
                    >
                      {resultBanner.message}
                    </p>
                    <button
                      type="button"
                      onClick={resultBanner.onAcknowledge}
                      className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      {resultBanner.acknowledgeLabel}
                    </button>
                  </div>
                )}

                {errorMessage && !isResultShown && (
                  <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {!isResultShown && children}
              </div>

              {hasRightSummary && <div className="col-span-1">{rightSummary}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      {showFooter && (
        <div className="h-16 flex items-center justify-between px-8 border-t border-gray-200 bg-white flex-shrink-0">
          <button
            type="button"
            onClick={isFirstStep ? onClose : onBack}
            disabled={submitting}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isFirstStep
                ? 'text-gray-700 hover:bg-gray-50'
                : 'text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {isFirstStep ? labels.cancel : labels.back}
          </button>

          <span className="text-xs text-gray-400">
            {currentStep + 1} / {totalSteps}
          </span>

          {isLastStep ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || submitDisabled}
              title={submitDisabled ? submitDisabledReason : undefined}
              className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? labels.submitting : labels.submit}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {labels.next}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
