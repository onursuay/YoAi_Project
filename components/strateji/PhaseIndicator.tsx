'use client'

import { Check } from 'lucide-react'
import type { InstanceStatus } from '@/lib/strategy/types'
import { STATUS_PHASE_MAP } from '@/lib/strategy/constants'

interface PhaseIndicatorProps {
  status: InstanceStatus
}

const PHASES = [
  { num: 1, label: 'Keşif & Veri' },
  { num: 2, label: 'Strateji Planı' },
  { num: 3, label: 'Uygulama' },
]

export default function PhaseIndicator({ status }: PhaseIndicatorProps) {
  const currentPhase = STATUS_PHASE_MAP[status]

  return (
    <div className="flex items-center gap-1">
      {PHASES.map((phase, i) => {
        const isCompleted = phase.num < currentPhase
        const isActive = phase.num === currentPhase

        return (
          <div key={phase.num} className="flex items-center">
            {i > 0 && (
              <div className={`w-6 h-0.5 mx-0.5 ${isCompleted ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-colors ${
                isCompleted
                  ? 'bg-green-500 text-white'
                  : isActive
                    ? 'bg-green-100 text-green-700 ring-2 ring-green-400'
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
