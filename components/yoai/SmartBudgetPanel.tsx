'use client'

import { ArrowRight, TrendingUp } from 'lucide-react'
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
      suggestions.push({ campaignId: c.id, campaignName: c.campaignName, platform: c.platform, currentBudget: budget, suggestedBudget: Math.round(budget * 0.6), reason: `ROAS ${roas.toFixed(1)}x — zarar`, direction: 'decrease' })
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
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Bütçe Dağılımı</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Performansa dayalı bütçe optimizasyonu</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {diff > 0 ? '+' : ''}₺{diff.toFixed(0)}
          </p>
          <p className="text-[10px] text-gray-400">günlük fark</p>
        </div>
      </div>

      {/* Suggestions */}
      <div className="space-y-1.5">
        {suggestions.map(sg => (
          <div key={sg.campaignId + sg.direction} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${sg.platform === 'Meta' ? 'bg-[#1877F2]/10 text-[#1877F2]' : 'bg-gray-100 text-gray-600'}`}>
              {sg.platform}
            </span>
            <p className="text-[12px] text-gray-700 truncate flex-1">{sg.campaignName}</p>
            <div className="flex items-center gap-1.5 shrink-0 text-[12px]">
              <span className="text-gray-400">₺{sg.currentBudget}</span>
              <ArrowRight className="w-3 h-3 text-gray-300" />
              <span className={`font-semibold ${sg.direction === 'increase' ? 'text-emerald-600' : 'text-red-600'}`}>
                ₺{sg.suggestedBudget}
              </span>
            </div>
            <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${sg.direction === 'increase' ? 'text-emerald-400' : 'text-red-400 rotate-180'}`} />
          </div>
        ))}
      </div>

      {/* Summary footer */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 text-[10px] text-gray-400">
        {increases.length > 0 && <span className="text-emerald-600">{increases.length} artış önerisi</span>}
        {decreases.length > 0 && <span className="text-red-600">{decreases.length} azalma önerisi</span>}
      </div>
    </div>
  )
}
