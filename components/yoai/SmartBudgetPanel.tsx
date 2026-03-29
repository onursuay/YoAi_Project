'use client'

import { DollarSign, ArrowRight, TrendingUp } from 'lucide-react'
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
  direction: 'increase' | 'decrease' | 'keep'
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
    const ctr = c.metrics.ctr * 100
    const score = c.score

    // High performer → increase budget
    if (score >= 75 && (roas == null || roas >= 2)) {
      const increase = Math.round(budget * 1.2)
      if (increase !== budget) {
        suggestions.push({
          campaignId: c.id,
          campaignName: c.campaignName,
          platform: c.platform,
          currentBudget: budget,
          suggestedBudget: increase,
          reason: `Yüksek performans (puan: ${score}). Bütçe artırılarak daha fazla dönüşüm alınabilir.`,
          direction: 'increase',
        })
      }
    }

    // Low performer with high spend → decrease budget
    if (score < 40 && c.metrics.spend > 200) {
      const decrease = Math.round(budget * 0.7)
      suggestions.push({
        campaignId: c.id,
        campaignName: c.campaignName,
        platform: c.platform,
        currentBudget: budget,
        suggestedBudget: decrease,
        reason: `Düşük performans (puan: ${score}). Bütçe azaltılarak israf önlenebilir.`,
        direction: 'decrease',
      })
    }

    // ROAS negative → decrease
    if (roas != null && roas < 1 && c.metrics.spend > 100) {
      const decrease = Math.round(budget * 0.6)
      suggestions.push({
        campaignId: c.id,
        campaignName: c.campaignName,
        platform: c.platform,
        currentBudget: budget,
        suggestedBudget: decrease,
        reason: `ROAS ${roas.toFixed(1)}x — harcama geri dönmüyor. Bütçe düşürülmeli.`,
        direction: 'decrease',
      })
    }
  }

  // Sort: increases first (opportunities), then decreases (savings)
  suggestions.sort((a, b) => {
    if (a.direction === 'increase' && b.direction !== 'increase') return -1
    if (a.direction !== 'increase' && b.direction === 'increase') return 1
    return 0
  })

  return suggestions.slice(0, 6)
}

export default function SmartBudgetPanel({ campaigns, loading }: Props) {
  if (loading) return null

  const suggestions = computeBudgetSuggestions(campaigns)
  if (suggestions.length === 0) return null

  const totalCurrent = suggestions.reduce((s, sg) => s + sg.currentBudget, 0)
  const totalSuggested = suggestions.reduce((s, sg) => s + sg.suggestedBudget, 0)
  const diff = totalSuggested - totalCurrent

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Akıllı Bütçe Dağılımı</h2>
            <p className="text-[10px] text-gray-400">Performansa dayalı bütçe optimizasyonu</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400">Önerilen değişiklik</p>
          <p className={`text-sm font-bold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {diff > 0 ? '+' : ''}₺{diff.toFixed(0)}/gün
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {suggestions.map(sg => (
          <div key={sg.campaignId} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
            {/* Platform */}
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
              sg.platform === 'Meta' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
            }`}>{sg.platform}</span>

            {/* Campaign name */}
            <p className="text-xs text-gray-700 truncate flex-1">{sg.campaignName}</p>

            {/* Budget change */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-gray-400">₺{sg.currentBudget.toFixed(0)}</span>
              <ArrowRight className="w-3 h-3 text-gray-300" />
              <span className={`text-[11px] font-semibold ${sg.direction === 'increase' ? 'text-emerald-600' : 'text-red-600'}`}>
                ₺{sg.suggestedBudget.toFixed(0)}
              </span>
            </div>

            {/* Direction indicator */}
            <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${
              sg.direction === 'increase' ? 'text-emerald-500' : 'text-red-500 rotate-180'
            }`} />
          </div>
        ))}
      </div>

    </div>
  )
}
