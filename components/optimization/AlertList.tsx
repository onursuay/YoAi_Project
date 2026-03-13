'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import type { Alert } from '@/lib/meta/optimization/types'

interface AlertListProps {
  alerts: Alert[]
}

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', iconColor: 'text-red-500' },
  warning: { icon: AlertCircle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconColor: 'text-amber-500' },
  info: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconColor: 'text-blue-500' },
}

export default function AlertList({ alerts }: AlertListProps) {
  const t = useTranslations('dashboard.optimizasyon.alerts')

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const config = SEVERITY_CONFIG[alert.severity]
        const Icon = config.icon
        // Extract alert key for translation (e.g. 'alerts.roasBelow1' → 'roasBelow1')
        const alertKey = alert.messageKey.split('.').pop() || alert.messageKey

        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 p-3 rounded-lg border ${config.bg} ${config.border}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${config.text}`}>{t(alertKey)}</p>
              {alert.threshold != null && (
                <p className="text-caption text-gray-500 mt-1">
                  {alert.currentValue.toFixed(2)} / {alert.threshold}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
