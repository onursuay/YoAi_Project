'use client'

import type { InstanceStatus } from '@/lib/strategy/types'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/strategy/constants'

interface StatusBadgeProps {
  status: InstanceStatus
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status]
  const label = STATUS_LABELS[status]
  const isAnimated = ['COLLECTING', 'ANALYZING', 'GENERATING_PLAN', 'APPLYING'].includes(status)

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${colors.bg} ${colors.text} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} ${isAnimated ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}
