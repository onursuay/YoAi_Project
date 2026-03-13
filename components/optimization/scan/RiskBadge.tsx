'use client'

import { useTranslations } from 'next-intl'

const RISK_STYLES = {
  low: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  high: 'bg-red-500/10 text-red-600 border-red-500/20 animate-risk-pulse',
}

interface RiskBadgeProps {
  risk: 'low' | 'medium' | 'high'
}

export default function RiskBadge({ risk }: RiskBadgeProps) {
  const t = useTranslations('dashboard.optimizasyon.magicScan')

  return (
    <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full border ${RISK_STYLES[risk]}`}>
      {t(`riskLevels.${risk}`)}
    </span>
  )
}
