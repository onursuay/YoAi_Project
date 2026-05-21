'use client'

/* SEVİYE 0 — Hesap geneli sağlık uyarıları (account_alerts).
   Üst banner (mevcut Meta ⚠ Pixel/CAPI tarzı). Light tema (sayfa açık).
   Renk kuralı: critical/high → kırmızı; medium/info → primary/gri. AMBER YOK. */

import { useTranslations } from 'next-intl'
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react'
import type { AccountAlertRow } from '@/lib/yoai/ai/hierarchicalStore'

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, info: 3 }

export default function AccountAlertsBanner({ alerts }: { alerts: AccountAlertRow[] }) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  if (!alerts?.length) return null

  const sorted = [...alerts].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('alertsTitle')}</p>
      {sorted.map((a) => {
        const isCritical = a.severity === 'critical' || a.severity === 'high'
        const wrap = isCritical
          ? 'bg-red-50 border-red-200'
          : 'bg-primary/5 border-primary/20'
        const Icon = isCritical ? AlertOctagon : a.severity === 'medium' ? AlertTriangle : Info
        const iconCls = isCritical ? 'text-red-600' : 'text-primary'
        const titleCls = isCritical ? 'text-red-800' : 'text-gray-800'
        const bodyCls = isCritical ? 'text-red-700' : 'text-gray-600'
        return (
          <div key={a.id} className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${wrap}`}>
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconCls}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${titleCls}`}>{a.title}</p>
              {a.body ? <p className={`text-xs mt-0.5 ${bodyCls}`}>{a.body}</p> : null}
              {a.recommended_action ? (
                <p className={`text-xs mt-1 font-medium ${isCritical ? 'text-red-800' : 'text-primary'}`}>→ {a.recommended_action}</p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
