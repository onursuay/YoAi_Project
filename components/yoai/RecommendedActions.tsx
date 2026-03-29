'use client'

import {
  ImagePlus,
  RefreshCcw,
  DollarSign,
  Target,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  Inbox,
  Zap,
} from 'lucide-react'
import type { RecommendedAction, ActionPriority } from '@/lib/yoai/commandCenter'

const PRIORITY_MAP: Record<ActionPriority, { label: string; color: string; bg: string }> = {
  high: { label: 'Yüksek', color: 'text-red-700', bg: 'bg-red-50' },
  medium: { label: 'Orta', color: 'text-amber-700', bg: 'bg-amber-50' },
  low: { label: 'Düşük', color: 'text-gray-600', bg: 'bg-gray-100' },
}

// Icon selection based on keywords in title
function getActionIcon(title: string) {
  const lower = title.toLowerCase()
  if (lower.includes('bütçe') || lower.includes('budget')) return DollarSign
  if (lower.includes('kreatif') || lower.includes('görsel') || lower.includes('varyasyon')) return ImagePlus
  if (lower.includes('yenile') || lower.includes('güncelle')) return RefreshCcw
  if (lower.includes('hedef') || lower.includes('daralt') || lower.includes('targeting')) return Target
  if (lower.includes('landing') || lower.includes('sayfa')) return ExternalLink
  return Zap
}

interface Props {
  actions: RecommendedAction[]
  loading: boolean
}

export default function RecommendedActions({ actions, loading }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Önerilen Aksiyonlar</h2>
          <p className="text-xs text-gray-400 mt-0.5">AI tarafından tespit edilen iyileştirme fırsatları</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[100px] bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : actions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Şu anda önerilen aksiyon yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => {
            const Icon = getActionIcon(action.title)
            const priority = PRIORITY_MAP[action.priority] || PRIORITY_MAP.medium

            return (
              <div
                key={action.id}
                className="group bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">{action.title}</h3>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${priority.bg} ${priority.color}`}>
                        {priority.label}
                      </span>
                      {action.requiresApproval && (
                        <span className="inline-flex items-center text-[10px] text-gray-400 gap-0.5">
                          <ShieldCheck className="w-3 h-3" />
                          Manuel onay
                        </span>
                      )}
                    </div>

                    {action.platform && action.campaignName && (
                      <p className="text-[11px] text-gray-400 mb-1">
                        {action.platform} · {action.campaignName}
                      </p>
                    )}

                    <p className="text-xs text-gray-500 mb-2 leading-relaxed">{action.reason}</p>

                    <div className="flex items-center gap-1.5 text-xs">
                      <ArrowRight className="w-3 h-3 text-primary" />
                      <span className="text-primary font-medium">{action.expectedImpact}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
