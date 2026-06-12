'use client'

import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import type { InstanceStatus } from '@/lib/strategy/types'
import { STATUS_PHASE_MAP } from '@/lib/strategy/constants'

interface PhaseIndicatorProps {
  status: InstanceStatus
}

export default function PhaseIndicator({ status }: PhaseIndicatorProps) {
  const t = useTranslations('dashboard.strateji.phases')
  const PHASES = [
    { num: 1, label: t('discovery') },
    { num: 2, label: t('plan') },
    { num: 3, label: t('apply') },
  ]
  const currentPhase = STATUS_PHASE_MAP[status]

  return (
    <div className="flex items-center gap-1">
      {PHASES.map((phase, i) => {
        const isCompleted = phase.num < currentPhase
        const isActive = phase.num === currentPhase

        return (
          <div key={phase.num} className="flex items-center">
            {i > 0 && (
              <div className={`w-6 h-0.5 mx-0.5 ${isCompleted ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-colors ${
                isCompleted
                  ? 'bg-emerald-500 text-white'
                  : isActive
                    ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-400'
                    : 'bg-gray-100 text-gray-400'
              }`}
              title={phase.label}
            >
              {isCompleted ? <Check className="w-3.5 h-3.5" /> : phase.num}
            </div>
          </div>
        )
      })}
    </div>
  )
}
