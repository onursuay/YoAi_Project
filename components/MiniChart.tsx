'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

interface MiniChartProps {
  data: number[]
  color: 'red' | 'green' | 'gray'
  labels?: string[]
  tooltipValues?: string[]
  locale?: string
}

/* ── colour palette ── */
const STROKE = { red: '#EF4444', green: '#10B981', gray: '#D1D5DB' } as const
const FILL_TOP = { red: 'rgba(239,68,68,0.38)', green: 'rgba(16,185,129,0.38)', gray: 'rgba(209,213,219,0.18)' } as const
const FILL_BOT = { red: 'rgba(239,68,68,0.03)', green: 'rgba(16,185,129,0.03)', gray: 'rgba(209,213,219,0.01)' } as const
const DOT = { red: '#DC2626', green: '#059669', gray: '#6B7280' } as const

/* ── data-level smoothing (weighted moving average) ── */
function smoothData(raw: number[], windowSize = 3): number[] {
  if (raw.length <= 3) return raw
  const out: number[] = []
  const half = Math.floor(windowSize / 2)
  for (let i = 0; i < raw.length; i++) {
    let sum = 0
    let weight = 0
    for (let j = -half; j <= half; j++) {
      const idx = Math.max(0, Math.min(raw.length - 1, i + j))
      const w = 1 / (1 + Math.abs(j)) // closer points weigh more
      sum += raw[idx] * w
      weight += w
    }
    out.push(sum / weight)
  }
  return out
}

/**
 * Monotone cubic Hermite interpolation (Fritsch-Carlson).
 * Guarantees no overshoot — the curve stays within the data range.
 * Returns a dense array of {x,y} points for an SVG polyline/path.
 */
function monotoneCubicHermite(
  pts: { x: number; y: number }[],
  density = 6 // interpolated points between each pair
): { x: number; y: number }[] {
  const n = pts.length
  if (n < 2) return pts
  if (n === 2) {
    // Linear interpolation between 2 points
    const out: { x: number; y: number }[] = []
    for (let t = 0; t <= density; t++) {
      const frac = t / density
      out.push({
        x: pts[0].x + (pts[1].x - pts[0].x) * frac,
        y: pts[0].y + (pts[1].y - pts[0].y) * frac,
      })
    }
    return out
  }

  // 1. Compute slopes (deltas) and secants
  const dx: number[] = []
  const dy: number[] = []
  const m: number[] = [] // slopes
  const delta: number[] = []

  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x)
    dy.push(pts[i + 1].y - pts[i].y)
    delta.push(dy[i] / (dx[i] || 1))
  }

  // 2. Initial tangents via finite differences
  m.push(delta[0])
  for (let i = 1; i < n - 1; i++) {
    m.push((delta[i - 1] + delta[i]) / 2)
  }
  m.push(delta[n - 2])

  // 3. Fritsch-Carlson monotonicity constraint
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(delta[i]) < 1e-12) {
      m[i] = 0
      m[i + 1] = 0
    } else {
      const alpha = m[i] / delta[i]
      const beta = m[i + 1] / delta[i]
      const s = alpha * alpha + beta * beta
      if (s > 9) {
        const tau = 3 / Math.sqrt(s)
        m[i] = tau * alpha * delta[i]
        m[i + 1] = tau * beta * delta[i]
      }
    }
  }

  // 4. Hermite basis interpolation
  const result: { x: number; y: number }[] = []
  for (let i = 0; i < n - 1; i++) {
    const segDx = dx[i]
    const steps = Math.max(density, 2)
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const t2 = t * t
      const t3 = t2 * t

      const h00 = 2 * t3 - 3 * t2 + 1
      const h10 = t3 - 2 * t2 + t
      const h01 = -2 * t3 + 3 * t2
      const h11 = t3 - t2

      const x = pts[i].x + segDx * t
      const y = h00 * pts[i].y + h10 * segDx * m[i] + h01 * pts[i + 1].y + h11 * segDx * m[i + 1]

      result.push({ x, y })
    }
  }
  // Add the final point
  result.push(pts[n - 1])

  return result
}

function formatDateLabel(dateStr: string, locale: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function MiniChart({ data, color, labels, tooltipValues, locale = 'tr' }: MiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 300, h: 80 })
  const [hover, setHover] = useState<{ index: number } | null>(null)

  // Measure real pixel size of container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDims({ w: width, h: height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const safeData = data.length >= 2 ? data : [0, 0]

  // 1. Data-level smoothing
  const smoothed = smoothData(safeData, safeData.length > 14 ? 5 : 3)

  // 2. Compute pixel coords (real pixel space — no viewBox distortion)
  const padTop = 6
  const padBot = 0
  const padLeft = 0
  const padRight = 0
  const W = dims.w - padLeft - padRight
  const H = dims.h - padTop - padBot

  const min = Math.min(...smoothed)
  const max = Math.max(...smoothed)
  const range = max - min || 1

  const dataCoords = smoothed.map((v, i) => ({
    x: padLeft + (i / (smoothed.length - 1)) * W,
    y: padTop + H - ((v - min) / range) * H,
  }))

  // 3. Monotone cubic interpolation → dense smooth curve
  const curvePoints = monotoneCubicHermite(dataCoords, 8)

  // Build SVG path string
  const linePath = curvePoints.length > 0
    ? 'M' + curvePoints.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L')
    : ''

  const areaPath = linePath
    + ` L${(padLeft + W).toFixed(2)},${(padTop + H).toFixed(2)}`
    + ` L${padLeft.toFixed(2)},${(padTop + H).toFixed(2)} Z`

  const gradientId = `areaGrad-${color}-${dims.w}`

  // Tooltip support
  const hasTooltip = !!(labels?.length || tooltipValues?.length)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasTooltip) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const pct = relX / rect.width
    const idx = Math.round(pct * (safeData.length - 1))
    setHover({ index: Math.max(0, Math.min(safeData.length - 1, idx)) })
  }, [hasTooltip, safeData.length])

  const handleMouseLeave = useCallback(() => setHover(null), [])

  // Hover dot position (use dataCoords for snapping to original data points)
  const dotCoord = hover != null ? dataCoords[hover.index] : null

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        width={dims.w}
        height={dims.h}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        className="block"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={FILL_TOP[color]} />
            <stop offset="100%" stopColor={FILL_BOT[color]} />
          </linearGradient>
        </defs>

        {/* Filled area */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={STROKE[color]}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Hover dot */}
      {hasTooltip && dotCoord && hover && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: dotCoord.x,
            top: dotCoord.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="rounded-full border-2 border-white"
            style={{
              width: 9,
              height: 9,
              backgroundColor: DOT[color],
              boxShadow: '0 0 6px rgba(0,0,0,0.18)',
            }}
          />
        </div>
      )}

      {/* Tooltip */}
      {hasTooltip && hover && dotCoord && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: dotCoord.x,
            bottom: dims.h - dotCoord.y + 10,
            transform: hover.index <= safeData.length * 0.3
              ? 'translateX(-10%)'
              : hover.index >= safeData.length * 0.7
                ? 'translateX(-90%)'
                : 'translateX(-50%)',
          }}
        >
          <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-2.5 py-1.5 whitespace-nowrap">
            {labels?.[hover.index] && (
              <div className="text-[10px] text-gray-400 leading-tight">
                {formatDateLabel(labels[hover.index], locale)}
              </div>
            )}
            {tooltipValues?.[hover.index] && (
              <div className="text-[12px] font-semibold text-gray-800 leading-tight mt-0.5">
                {tooltipValues[hover.index]}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
