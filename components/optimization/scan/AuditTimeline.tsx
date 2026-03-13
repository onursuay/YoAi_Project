'use client'

import { useTranslations } from 'next-intl'
import { CheckCircle, XCircle, Undo2 } from 'lucide-react'
import type { ChangeSet } from '@/lib/meta/optimization/types'

interface AuditTimelineProps {
  items: ChangeSet[]
  onRollback: (cs: ChangeSet) => void
}

const STATUS_ICON = {
  applied: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500' },
  rolled_back: { icon: Undo2, color: 'text-gray-400', bg: 'bg-gray-400' },
}

export default function AuditTimeline({ items, onRollback }: AuditTimelineProps) {
  const t = useTranslations('dashboard.optimizasyon.magicScan')

  if (items.length === 0) return null

  return (
    <div className="border-t border-gray-200 px-4 py-3">
      <h4 className="text-xs font-medium text-gray-500 mb-3">Audit Log</h4>
      <div className="relative pl-5">
        {/* Vertical timeline line */}
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-200" />

        <div className="space-y-3">
          {items.map((cs) => {
            const status = cs.status as keyof typeof STATUS_ICON
            const cfg = STATUS_ICON[status] || STATUS_ICON.failed
            const Icon = cfg.icon

            return (
              <div key={cs.id} className="relative flex items-start gap-3">
                {/* Timeline dot */}
                <div className={`absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${cfg.bg}`} />

                {/* Content */}
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
                    <span className="text-xs text-gray-700 truncate">
                      {cs.changeType === 'duplicate_adset'
                        ? `${cs.entityName}: ${t('duplicated')}`
                        : `${cs.entityName}: ${t(`changeTypes.${cs.changeType}`)} ${String(cs.oldValue)} → ${String(cs.newValue)}`
                      }
                    </span>
                  </div>

                  {status === 'applied' && cs.changeType !== 'duplicate_adset' && (
                    <button
                      onClick={() => onRollback(cs)}
                      className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1 shrink-0 ml-2"
                    >
                      <Undo2 className="w-3 h-3" />
                      {t('rollback')}
                    </button>
                  )}
                  {status === 'rolled_back' && (
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">{t('rolledBack')}</span>
                  )}
                  {status === 'failed' && (
                    <span className="text-[10px] text-red-400 shrink-0 ml-2">{t('failed')}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
