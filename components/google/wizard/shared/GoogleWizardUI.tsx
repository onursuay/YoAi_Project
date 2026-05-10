'use client'

import { Check, CheckCircle2, AlertTriangle } from 'lucide-react'

/**
 * Google Ads Wizard — paylaşılan UI primitive'leri.
 *
 * Bu modül Display wizard'ında kanıtlanan modern full-screen tasarım dilinin
 * Search ve PMax wizard'larında da kullanılabilmesi için ortak bileşenleri içerir.
 *
 * Dikkat: Burada SADECE görsel/layout helper'ları yer alır.
 * Wizard step logic, validation, payload veya state şekli bu modüle GİRMEZ.
 */

export const googleWizardInputCls =
  'w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'

interface SectionProps {
  icon?: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
  id?: string
}

export function GoogleWizardSection({ icon, title, description, children, id }: SectionProps) {
  return (
    <div id={id} className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start gap-3 mb-5">
        {icon && <span className="mt-0.5 text-gray-400">{icon}</span>}
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

interface RadioCardProps {
  selected: boolean
  onClick: () => void
  title: string
  description?: string
  badge?: string
  badgeColor?: 'blue' | 'green' | 'gray'
  badgeIcon?: React.ReactNode
}

export function GoogleWizardRadioCard({
  selected,
  onClick,
  title,
  description,
  badge,
  badgeColor = 'blue',
  badgeIcon,
}: RadioCardProps) {
  const badgeColors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    gray: 'bg-gray-100 text-gray-600',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary bg-primary/[0.03] shadow-sm'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <div
            className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
              selected ? 'border-primary' : 'border-gray-300'
            }`}
          >
            {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{title}</span>
            {badge && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${badgeColors[badgeColor]}`}
              >
                {badgeIcon}
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
    </button>
  )
}

interface SummaryCardProps {
  icon: React.ReactNode
  title: string
  active: boolean
  complete?: boolean
  children: React.ReactNode
}

export function GoogleWizardSummaryCard({ icon, title, active, complete, children }: SummaryCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        active ? 'border-primary/30 bg-primary/[0.03] shadow-sm' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={active ? 'text-primary' : 'text-gray-400'}>{icon}</span>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex-1">{title}</h4>
        {complete && !active && (
          <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="w-3 h-3 text-primary" />
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export function GoogleWizardSummaryRow({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={`font-medium text-right truncate ${muted ? 'text-gray-400 italic' : 'text-gray-900'}`}
      >
        {value}
      </span>
    </div>
  )
}

interface ResultStateProps {
  variant: 'full' | 'partial'
  title: string
  message: string
  acknowledgeLabel: string
  onAcknowledge: () => void
}

export function GoogleWizardResultState({
  variant,
  title,
  message,
  acknowledgeLabel,
  onAcknowledge,
}: ResultStateProps) {
  const isFull = variant === 'full'
  return (
    <div
      className={`flex flex-col items-center justify-center py-10 px-6 rounded-xl border ${
        isFull
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-gray-50 border-gray-200'
      }`}
    >
      {isFull ? (
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-3" />
      ) : (
        <AlertTriangle className="w-12 h-12 text-gray-600 mb-3" />
      )}
      <h3
        className={`text-lg font-semibold mb-1 ${
          isFull ? 'text-emerald-800' : 'text-gray-800'
        }`}
      >
        {title}
      </h3>
      <p
        className={`text-sm text-center mb-4 ${
          isFull ? 'text-emerald-700' : 'text-gray-700'
        }`}
      >
        {message}
      </p>
      <button
        type="button"
        onClick={onAcknowledge}
        className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
      >
        {acknowledgeLabel}
      </button>
    </div>
  )
}
