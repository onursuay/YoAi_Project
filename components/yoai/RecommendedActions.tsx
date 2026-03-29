'use client'

import { ImagePlus, RefreshCcw, DollarSign, Target, ExternalLink, ArrowRight, ShieldCheck, Inbox, Zap, Pause, Play } from 'lucide-react'
import type { DeepAction } from '@/lib/yoai/analysisTypes'
import type { ExecutableAction, ActionType } from '@/lib/yoai/actionTypes'

const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'Yüksek', color: 'text-red-700', bg: 'bg-red-50' },
  medium: { label: 'Orta', color: 'text-amber-700', bg: 'bg-amber-50' },
  low: { label: 'Düşük', color: 'text-gray-600', bg: 'bg-gray-100' },
}

function getActionIcon(title: string, actionType?: string) {
  if (actionType === 'pause' || actionType === 'pause_campaign' || actionType === 'pause_adset' || actionType === 'pause_ad') return Pause
  if (actionType === 'resume' || actionType === 'resume_campaign') return Play
  const lower = title.toLowerCase()
  if (lower.includes('bütçe') || lower.includes('budget')) return DollarSign
  if (lower.includes('kreatif') || lower.includes('görsel') || lower.includes('varyasyon')) return ImagePlus
  if (lower.includes('yenile') || lower.includes('güncelle')) return RefreshCcw
  if (lower.includes('hedef') || lower.includes('daralt') || lower.includes('targeting')) return Target
  if (lower.includes('landing') || lower.includes('sayfa')) return ExternalLink
  return Zap
}

const PLATFORM_STYLE: Record<string, { bg: string; text: string }> = {
  Meta: { bg: 'bg-blue-50', text: 'text-blue-700' },
  Google: { bg: 'bg-red-50', text: 'text-red-700' },
}

// Turkish labels for action categories
const CATEGORY_TR: Record<string, string> = {
  objective: 'Kampanya Amacı',
  destination: 'Dönüşüm Hedefi',
  optimization_goal: 'Optimizasyon',
  bidding: 'Teklif Stratejisi',
  targeting: 'Hedefleme',
  budget: 'Bütçe',
  conversion: 'Dönüşüm Takibi',
  refresh_creative: 'Kreatif',
  duplicate: 'Kopyalama',
  pause: 'Durum',
  increase_budget: 'Bütçe',
  decrease_budget: 'Bütçe',
}

// Map AI action types to executable action types
function toExecutableActionType(actionType: string): ActionType | null {
  const map: Record<string, ActionType> = {
    pause: 'pause_campaign',
    pause_campaign: 'pause_campaign',
    pause_adset: 'pause_adset',
    pause_ad: 'pause_ad',
    resume: 'resume_campaign',
    resume_campaign: 'resume_campaign',
    increase_budget: 'increase_budget',
    decrease_budget: 'decrease_budget',
    duplicate: 'duplicate_campaign',
    duplicate_campaign: 'duplicate_campaign',
    duplicate_adset: 'duplicate_adset',
    duplicate_ad: 'duplicate_ad',
  }
  return map[actionType] || null
}

interface Props {
  actions: DeepAction[]
  loading: boolean
  onExecuteAction?: (action: ExecutableAction) => void
}

export default function RecommendedActions({ actions, loading, onExecuteAction }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Önerilen Aksiyonlar</h2>
          <p className="text-xs text-gray-400 mt-0.5">AI tarafından tespit edilen iyileştirme fırsatları</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-[200px] bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
        </div>
      ) : actions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Şu anda önerilen aksiyon yok.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map(action => {
            const Icon = getActionIcon(action.title, action.actionType)
            const priority = PRIORITY_MAP[action.priority] || PRIORITY_MAP.medium
            const platform = PLATFORM_STYLE[action.platform] || { bg: 'bg-gray-50', text: 'text-gray-700' }
            const execType = toExecutableActionType(action.actionType)
            const canExecute = !!execType && !!onExecuteAction

            const handleClick = () => {
              if (!execType || !onExecuteAction) return
              const entityType = action.targetEntityType === 'ad_group' ? 'ad_group' as const : action.targetEntityType as 'campaign' | 'adset' | 'ad'
              const executable: ExecutableAction = {
                actionType: execType,
                platform: action.platform,
                entityType,
                entityId: action.targetEntityId,
                entityName: action.campaignName || action.targetEntityId,
                campaignId: action.campaignId,
                campaignName: action.campaignName,
              }
              onExecuteAction(executable)
            }

            return (
              <div key={action.id} className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-gray-200 transition-all duration-200 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${platform.bg} ${platform.text}`}>{action.platform}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${priority.bg} ${priority.color}`}>{priority.label}</span>
                    <span className="text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{CATEGORY_TR[action.actionType] || action.actionType}</span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-gray-900 mb-1">{action.title}</h3>
                <p className="text-[10px] text-gray-400 mb-2">{action.campaignName}</p>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed flex-1 line-clamp-3">{action.reason}</p>

                <div className="flex items-center gap-1.5 text-xs mb-3">
                  <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-primary font-medium line-clamp-1">{action.expectedImpact}</span>
                </div>

                {/* Action button */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                  {canExecute ? (
                    <button
                      onClick={handleClick}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      <Zap className="w-3 h-3" />
                      Uygula
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-400">Manuel uygulama gerekli</span>
                  )}
                  {action.requiresApproval && (
                    <span className="inline-flex items-center text-[10px] text-gray-400 gap-0.5 ml-auto">
                      <ShieldCheck className="w-3 h-3" />
                      Onay gerekli
                    </span>
                  )}
                  {!canExecute && !action.requiresApproval && (
                    <span className="text-[10px] text-gray-400 ml-auto">İnceleme gerekli</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
