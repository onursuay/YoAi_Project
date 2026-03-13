'use client'

import { useTranslations } from 'next-intl'
import { Sparkles, Zap, Eye, ClipboardList, X } from 'lucide-react'
import type { MagicScanResult, Recommendation } from '@/lib/meta/optimization/types'

interface ScanHeroBannerProps {
  result: MagicScanResult
  grouped: Record<string, Recommendation[]>
  onClose: () => void
}

export default function ScanHeroBanner({ result, grouped, onClose }: ScanHeroBannerProps) {
  const t = useTranslations('dashboard.optimizasyon.magicScan')
  const isAI = result.aiGenerated

  const stats = [
    { key: 'AUTO_APPLY_SAFE', icon: Zap, color: 'text-green-400', label: t('categories.autoApply') },
    { key: 'REVIEW_REQUIRED', icon: Eye, color: 'text-amber-400', label: t('categories.review') },
    { key: 'TASK', icon: ClipboardList, color: 'text-blue-400', label: t('categories.task') },
  ]

  return (
    <div
      className="relative overflow-hidden rounded-t-2xl"
      style={{
        background: isAI
          ? 'linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 40%, #1a3a2e 100%)'
          : 'linear-gradient(135deg, #0f1f15 0%, #1a2e22 50%, #0d1b12 100%)',
      }}
    >
      {/* Animated mesh grid SVG */}
      <svg className="absolute inset-0 w-full h-full animate-mesh-breathe" aria-hidden="true">
        <defs>
          <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke={isAI ? 'rgba(139, 92, 246, 0.3)' : 'rgba(43, 182, 115, 0.3)'}
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>

      {/* Floating particles */}
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-float-particle"
          style={{
            width: 3 + i * 1.5,
            height: 3 + i * 1.5,
            left: `${15 + i * 18}%`,
            top: `${20 + (i % 3) * 25}%`,
            background: isAI ? 'rgba(139, 92, 246, 0.6)' : 'rgba(43, 182, 115, 0.6)',
            animationDelay: `${i * 0.8}s`,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 px-5 py-5">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-white">{t('resultsTitle')}</h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border ${
                isAI
                  ? 'bg-purple-500/20 text-purple-300 border-purple-400/30 animate-ai-glow'
                  : 'bg-green-500/20 text-green-300 border-green-400/30'
              }`}
            >
              {isAI ? <Sparkles className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {isAI ? t('aiPowered') : t('deterministic')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stat cards */}
        <div className="flex items-center gap-3">
          {stats.map(({ key, icon: Icon, color, label }, i) => {
            const count = grouped[key]?.length || 0
            if (count === 0) return null
            return (
              <div
                key={key}
                className="flex items-center gap-2 px-3 py-2 bg-white/[0.07] backdrop-blur-sm rounded-lg border border-white/[0.08] animate-stat-pop"
                style={{ animationDelay: `${(i + 1) * 120}ms` }}
              >
                <Icon className={`w-4 h-4 ${color}`} />
                <div>
                  <p className="text-lg font-bold text-white leading-none">{count}</p>
                  <p className="text-[10px] text-white/50 mt-0.5">{label}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
