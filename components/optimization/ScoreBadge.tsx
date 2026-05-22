'use client'

import type { ScoreStatus } from '@/lib/meta/optimization/types'

// Onaylı palet: emerald / gri / kırmızı (amber-sarı-turuncu YASAK — CLAUDE.md).
const STATUS_COLORS: Record<ScoreStatus, string> = {
  excellent: '#10B981', // emerald-500
  good: '#34D399',      // emerald-400
  average: '#6B7280',   // gray-500 (orta — nötr)
  poor: '#F87171',      // red-400
  critical: '#EF4444',  // red-500
  insufficient_data: '#9CA3AF', // gray-400
}

interface ScoreBadgeProps {
  score: number
  status: ScoreStatus
  size?: number
}

export default function ScoreBadge({ score, status, size = 56 }: ScoreBadgeProps) {
  const color = STATUS_COLORS[status]
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const progress = status === 'insufficient_data' ? 0 : (score / 100) * circumference
  const strokeDash = `${progress} ${circumference - progress}`

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={strokeDash}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className="absolute text-caption font-bold"
        style={{ color }}
      >
        {status === 'insufficient_data' ? '—' : score}
      </span>
    </div>
  )
}
