'use client'

import { Check } from 'lucide-react'

/**
 * Display Wizard — Meta Ads Trafik wizard'ının görsel diline birebir hizalanmış
 * paylaşılan UI primitive'leri. Bu modül sadece Görüntülü reklam wizard'ında kullanılır;
 * paylaşılan StepConversionAndName / StepAudience / StepLocationLanguage'a dokunulmaz.
 */

export const displayInputCls =
  'w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'

export const displaySelectCls =
  'w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'

export const displayLabelCls = 'block text-sm font-medium text-gray-800 mb-1.5'

export const displaySmallLabelCls =
  'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5'

interface SectionProps {
  icon: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
}

export function DisplaySection({ icon, title, description, children }: SectionProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="mt-0.5 text-gray-400">{icon}</span>
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

export function DisplayRadioCard({
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

interface ProgressStep {
  label: string
}

interface ProgressProps {
  steps: ProgressStep[]
  currentStep: number
  onStepClick?: (i: number) => void
}

export function DisplayProgress({ steps, currentStep, onStepClick }: ProgressProps) {
  return (
    <div className="flex items-center gap-1">
      {steps.map(({ label }, i) => {
        const isCompleted = i < currentStep
        const isCurrent = i === currentStep
        const isLast = i === steps.length - 1
        const isClickable = isCompleted && !!onStepClick
        return (
          <div key={i} className="flex items-center">
            <button
              type="button"
              onClick={() => isClickable && onStepClick?.(i)}
              disabled={!isClickable}
              className={`flex items-center gap-2 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                  isCompleted
                    ? 'bg-primary border-primary text-white'
                    : isCurrent
                      ? 'border-primary bg-white text-primary'
                      : 'border-gray-300 bg-white text-gray-400'
                } ${isClickable ? 'hover:opacity-80' : ''}`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                } ${isClickable ? 'hover:text-primary' : ''}`}
              >
                {label}
              </span>
            </button>
            {!isLast && (
              <div
                className={`w-8 h-0.5 mx-2 ${isCompleted ? 'bg-primary' : 'bg-gray-200'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface SidebarCardProps {
  icon: React.ReactNode
  title: string
  active: boolean
  complete?: boolean
  children: React.ReactNode
}

export function DisplaySidebarCard({ icon, title, active, complete, children }: SidebarCardProps) {
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

export function DisplaySidebarRow({
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
