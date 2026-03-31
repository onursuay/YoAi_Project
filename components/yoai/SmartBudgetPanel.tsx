'use client'

import { ArrowRight, TrendingUp, Wallet } from 'lucide-react'
import type { DeepCampaignInsight } from '@/lib/yoai/analysisTypes'

interface Props {
  campaigns: DeepCampaignInsight[]
  loading: boolean
}

interface BudgetSuggestion {
  campaignId: string
  campaignName: string
  platform: string
  currentBudget: number
  suggestedBudget: number
  reason: string
  direction: 'increase' | 'decrease'
}

function computeBudgetSuggestions(campaigns: DeepCampaignInsight[]): BudgetSuggestion[] {
  const active = campaigns.filter(c =>
    (c.status === 'ACTIVE' || c.status === 'ENABLED') && c.dailyBudget != null && c.dailyBudget > 0
  )
  if (active.length === 0) return []

  const suggestions: BudgetSuggestion[] = []

  for (const c of active) {
    const budget = c.dailyBudget!
    const roas = c.metrics.roas
    const score = c.score

    if (score >= 75 && (roas == null || roas >= 2)) {
      const increase = Math.round(budget * 1.2)
      if (increase !== budget) {
        suggestions.push({ campaignId: c.id, campaignName: c.campaignName, platform: c.platform, currentBudget: budget, suggestedBudget: increase, reason: `Yüksek performans (${score}/100)`, direction: 'increase' })
      }
    }
    if (score < 40 && c.metrics.spend > 200) {
      suggestions.push({ campaignId: c.id, campaignName: c.campaignName, platform: c.platform, currentBudget: budget, suggestedBudget: Math.round(budget * 0.7), reason: `Düşük performans (${score}/100)`, direction: 'decrease' })
    }
    if (roas != null && roas < 1 && c.metrics.spend > 100) {
      suggestions.push({ campaignId: c.id, campaignName: c.campaignName, platform: c.platform, currentBudget: budget, suggestedBudget: Math.round(budget * 0.6), reason: `ROAS ${roas.toFixed(1)}x, zarar riski`, direction: 'decrease' })
    }
  }

  suggestions.sort((a, b) => a.direction === 'increase' && b.direction !== 'increase' ? -1 : a.direction !== 'increase' && b.direction === 'increase' ? 1 : 0)
  return suggestions.slice(0, 6)
}

export default function SmartBudgetPanel({ campaigns, loading }: Props) {
  if (loading) return null

  const suggestions = computeBudgetSuggestions(campaigns)
  if (suggestions.length === 0) return null

  const totalCurrent = suggestions.reduce((s, sg) => s + sg.currentBudget, 0)
  const totalSuggested = suggestions.reduce((s, sg) => s + sg.suggestedBudget, 0)
  const diff = totalSuggested - totalCurrent
  const increases = suggestions.filter(s => s.direction === 'increase')
  const decreases = suggestions.filter(s => s.direction === 'decrease')

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden h-fit">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/8">
                <Wallet className="w-4 h-4 text-primary" />
              </span>
              Bütçe Dağılımı
            </h2>
            <p className="text-[11px] text-gray-400 mt-1 ml-9 tracking-wide">Performansa dayalı bütçe optimizasyonu</p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold ${
              diff > 0 ? 'bg-emerald-50 text-emerald-700' : diff < 0 ? 'bg-rose-50 text-rose-700' : 'bg-gray-50 text-gray-600'
            }`}>
              {diff > 0 ? '+' : ''}₺{diff.toFixed(0)}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">günlük fark</p>
          </div>
        </div>

        {/* Summary bar */}
        <div className="bg-gray-50/80 rounded-xl px-4 py-3 mb-5 flex items-center gap-4">
          {increases.length > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {increases.length} artış önerisi
            </span>
          )}
          {decreases.length > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-rose-700">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              {decreases.length} azalma önerisi
            </span>
          )}
          <span className="ml-auto text-[11px] text-gray-400">{suggestions.length} kampanya</span>
        </div>

        {/* Suggestion rows */}
        <div className="space-y-2">
          {suggestions.map(sg => {
            const isIncrease = sg.direction === 'increase'
            return (
              <div
                key={sg.campaignId + sg.direction}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 border transition-all duration-200 ${
                  isIncrease
                    ? 'border-emerald-100/80 bg-emerald-50/30 hover:bg-emerald-50/60'
                    : 'border-rose-100/80 bg-rose-50/20 hover:bg-rose-50/40'
                }`}
              >
                {/* Platform badge */}
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-md shrink-0 tracking-wide ${
                  sg.platform === 'Meta'
                    ? 'bg-[#1877F2]/8 text-[#1877F2]/90'
                    : 'bg-gray-100/80 text-gray-500'
                }`}>
                  {sg.platform}
                </span>

                {/* Campaign info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 truncate leading-snug">{sg.campaignName}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{sg.reason}</p>
                </div>

                {/* Budget values */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[12px] text-gray-400 tabular-nums">₺{sg.currentBudget}</span>
                  <ArrowRight className="w-3 h-3 text-gray-300" />
                  <span className={`text-[13px] font-semibold tabular-nums ${
                    isIncrease ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    ₺{sg.suggestedBudget}
                  </span>
                </div>

                {/* Trend icon */}
                <TrendingUp className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                  isIncrease
                    ? 'text-emerald-400 group-hover:translate-y-[-1px]'
                    : 'text-rose-400 rotate-180 group-hover:translate-y-[1px]'
                }`} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
