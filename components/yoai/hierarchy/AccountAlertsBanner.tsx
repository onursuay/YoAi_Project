'use client'

/* SEVİYE 0 — Hesap Sağlık Durumu (account_alerts).
   Animasyonlu dikdörtgen kartlar + başlık ikonu. Light tema.
   Renk kuralı: critical/high → kırmızı; medium → primary; info → gri. AMBER YOK
   (Google logosundaki sarı marka rengidir, uyarı değil — istisna). */

import { useTranslations } from 'next-intl'
import { Activity, AlertOctagon, AlertTriangle, Info } from 'lucide-react'
import type { AccountAlertRow } from '@/lib/yoai/ai/hierarchicalStore'

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, info: 3 }

export default function AccountAlertsBanner({ alerts }: { alerts: AccountAlertRow[] }) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  if (!alerts?.length) return null

  const sorted = [...alerts].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))

  return (
    <div>
      <style>{`
        @keyframes yoaiAlertIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { [data-yoai-alert] { animation: none !important; } }
      `}</style>

      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
          <Activity className="w-4 h-4 text-primary" />
        </span>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t('alertsTitle')}</h3>
      </div>

      <div className="space-y-3">
        {sorted.map((a, i) => {
          const isCritical = a.severity === 'critical' || a.severity === 'high'
          const wrap = isCritical
            ? 'bg-red-50 border-red-200 border-l-red-500'
            : a.severity === 'medium'
              ? 'bg-primary/5 border-primary/20 border-l-primary'
              : 'bg-gray-50 border-gray-200 border-l-gray-400'
          const Icon = isCritical ? AlertOctagon : a.severity === 'medium' ? AlertTriangle : Info
          const iconCls = isCritical ? 'text-red-600' : a.severity === 'medium' ? 'text-primary' : 'text-gray-500'
          const titleCls = isCritical ? 'text-red-800' : 'text-gray-900'
          const bodyCls = isCritical ? 'text-red-700' : 'text-gray-600'
          const actCls = isCritical ? 'text-red-800' : 'text-primary'
          return (
            <div
              key={a.id}
              data-yoai-alert
              style={{ animation: 'yoaiAlertIn .45s ease-out both', animationDelay: `${i * 70}ms` }}
              className={`flex items-start gap-3 border border-l-4 rounded-lg px-4 py-3.5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${wrap}`}
            >
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconCls}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-[15px] font-semibold leading-snug ${titleCls}`}>{a.title}</p>
                {a.body ? <p className={`text-[13px] mt-1 leading-relaxed ${bodyCls}`}>{a.body}</p> : null}
                {a.recommended_action ? (
                  <p className={`text-[13px] mt-1.5 font-medium leading-relaxed ${actCls}`}>→ {a.recommended_action}</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
