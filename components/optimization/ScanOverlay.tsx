'use client'

import { useTranslations } from 'next-intl'

interface ScanOverlayProps {
  phase: number // 0-3
  fadeOut?: boolean
}

export default function ScanOverlay({ phase, fadeOut = false }: ScanOverlayProps) {
  const t = useTranslations('dashboard.optimizasyon.magicScan')

  return (
    <div
      className={`absolute inset-0 z-10 rounded-2xl overflow-hidden pointer-events-none
        transition-opacity duration-200 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      role="status"
      aria-live="polite"
    >
      {/* Semi-transparent green tint */}
      <div className="absolute inset-0 bg-green-500/[0.06]" />

      {/* Sweep line — GPU-accelerated via translate3d */}
      <div
        className="absolute left-0 w-full h-[3px] animate-scan-sweep"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.7) 30%, rgba(34,197,94,0.9) 50%, rgba(34,197,94,0.7) 70%, transparent 100%)',
          boxShadow: '0 0 12px 4px rgba(34,197,94,0.3)',
        }}
      />

      {/* Phase label */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
        <span className="px-3 py-1 text-caption font-medium text-green-700 bg-green-50/90 rounded-full border border-green-200/50 backdrop-blur-sm">
          {t(`phases.${phase}`)}
        </span>
      </div>
    </div>
  )
}
