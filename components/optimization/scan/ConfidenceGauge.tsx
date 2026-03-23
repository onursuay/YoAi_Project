'use client'

interface ConfidenceGaugeProps {
  confidence: number // 0-1
  size?: number
}

export default function ConfidenceGauge({ confidence, size = 44 }: ConfidenceGaugeProps) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const progress = confidence * circumference
  const color = confidence >= 0.8 ? '#10B981' : confidence >= 0.6 ? '#F59E0B' : '#EF4444'

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span
        className="absolute text-xs font-bold"
        style={{ color }}
      >
        {Math.round(confidence * 100)}%
      </span>
    </div>
  )
}
