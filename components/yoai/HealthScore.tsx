'use client'

import { ArrowUp } from 'lucide-react'
import type { DeepCampaignInsight, AggregatedKpis } from '@/lib/yoai/analysisTypes'

interface Props {
  campaigns: DeepCampaignInsight[]
  kpis: AggregatedKpis | null
  loading: boolean
}

interface ScoreBreakdown { category: string; score: number; maxScore: number }
interface Tip { text: string; impact: number }

function computeHealthScore(campaigns: DeepCampaignInsight[], kpis: AggregatedKpis | null) {
  const active = campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')
  if (active.length === 0 || !kpis) return { totalScore: 0, breakdown: [] as ScoreBreakdown[], tips: [] as Tip[], level: 'Başlangıç', pointsToNext: 30 }

  const breakdown: ScoreBreakdown[] = []
  const tips: Tip[] = []
  let totalScore = 0

  // Performance (0-25)
  const avgScore = active.reduce((s, c) => s + c.score, 0) / active.length
  const perfScore = Math.round((avgScore / 100) * 25)
  breakdown.push({ category: 'Kampanya Performansı', score: perfScore, maxScore: 25 })
  totalScore += perfScore
  if (perfScore < 18) tips.push({ text: 'Düşük performanslı kampanyaları optimize edin', impact: 5 })

  // Risk (0-25)
  const critCount = active.filter(c => c.riskLevel === 'critical').length
  const highCount = active.filter(c => c.riskLevel === 'high').length
  const riskScore = Math.max(0, 25 - (critCount * 8) - (highCount * 4))
  breakdown.push({ category: 'Risk Durumu', score: riskScore, maxScore: 25 })
  totalScore += riskScore
  if (critCount > 0) tips.push({ text: `${critCount} kritik kampanyayı düzeltin`, impact: critCount * 5 })

  // Coverage (0-25)
  let covScore = 0
  if (active.some(c => c.platform === 'Meta')) covScore += 8
  if (active.some(c => c.platform === 'Google')) covScore += 8
  if (active.length >= 3) covScore += 5
  if (active.length >= 5) covScore += 4
  covScore = Math.min(25, covScore)
  breakdown.push({ category: 'Platform Çeşitliliği', score: covScore, maxScore: 25 })
  totalScore += covScore

  // Efficiency (0-25)
  let effScore = 0
  if (kpis.weightedCtr > 2) effScore += 8; else if (kpis.weightedCtr > 1) effScore += 5; else effScore += 2
  if (kpis.avgRoas != null && kpis.avgRoas >= 3) effScore += 10; else if (kpis.avgRoas != null && kpis.avgRoas >= 1.5) effScore += 6; else if (kpis.avgRoas != null && kpis.avgRoas >= 1) effScore += 3
  const adsetCount = active.reduce((s, c) => s + c.adsets.length, 0)
  if (adsetCount >= active.length * 2) effScore += 7; else if (adsetCount >= active.length) effScore += 4; else effScore += 1
  effScore = Math.min(25, effScore)
  breakdown.push({ category: 'Verimlilik', score: effScore, maxScore: 25 })
  totalScore += effScore
  if (kpis.weightedCtr < 1) tips.push({ text: 'Reklam metinlerini iyileştirin', impact: 5 })

  let level = 'Başlangıç'; let pointsToNext = 30 - totalScore
  if (totalScore >= 85) { level = 'Platin'; pointsToNext = 100 - totalScore }
  else if (totalScore >= 70) { level = 'Altın'; pointsToNext = 85 - totalScore }
  else if (totalScore >= 55) { level = 'Gümüş'; pointsToNext = 70 - totalScore }
  else if (totalScore >= 30) { level = 'Bronz'; pointsToNext = 55 - totalScore }

  tips.sort((a, b) => b.impact - a.impact)
  return { totalScore, breakdown, tips: tips.slice(0, 3), level, pointsToNext }
}

export default function HealthScore({ campaigns, kpis, loading }: Props) {
  if (loading) return null
  const { totalScore, breakdown, tips, level, pointsToNext } = computeHealthScore(campaigns, kpis)
  if (breakdown.length === 0) return null

  const scoreColor = totalScore >= 70 ? 'text-emerald-600' : totalScore >= 50 ? 'text-amber-600' : 'text-red-600'
  const ringColor = totalScore >= 70 ? 'stroke-emerald-500' : totalScore >= 50 ? 'stroke-amber-500' : 'stroke-red-500'
  const circumference = 2 * Math.PI * 40
  const dashOffset = circumference - (totalScore / 100) * circumference

  const levelStyle: Record<string, string> = {
    Platin: 'bg-violet-50 text-violet-700',
    Altın: 'bg-amber-50 text-amber-700',
    Gümüş: 'bg-gray-100 text-gray-600',
    Bronz: 'bg-orange-50 text-orange-700',
    Başlangıç: 'bg-gray-50 text-gray-500',
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Sağlık Skoru</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">Genel hesap sağlık durumu</p>
      </div>

      <div className="flex items-start gap-6">
        {/* Score circle */}
        <div className="relative w-[88px] h-[88px] shrink-0">
          <svg className="w-[88px] h-[88px] -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="6" />
            <circle cx="50" cy="50" r="40" fill="none" className={ringColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} style={{ transition: 'stroke-dashoffset 1s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${scoreColor}`}>{totalScore}</span>
            <span className="text-[8px] text-gray-400">/100</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 min-w-0">
          {/* Level */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${levelStyle[level] || levelStyle.Başlangıç}`}>{level}</span>
            {pointsToNext > 0 && pointsToNext < 100 && <span className="text-[10px] text-gray-400">Sonraki seviyeye {pointsToNext} puan</span>}
          </div>

          {/* Bars */}
          <div className="space-y-2">
            {breakdown.map(b => {
              const pct = (b.score / b.maxScore) * 100
              const barColor = pct >= 72 ? 'bg-emerald-500' : pct >= 48 ? 'bg-amber-500' : 'bg-red-500'
              return (
                <div key={b.category}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-gray-500">{b.category}</span>
                    <span className="text-[10px] text-gray-400">{b.score}/{b.maxScore}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tips */}
      {tips.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-50">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] mb-1 last:mb-0">
              <ArrowUp className="w-3 h-3 text-primary shrink-0" />
              <span className="text-gray-600 flex-1">{tip.text}</span>
              <span className="text-primary font-medium shrink-0">+{tip.impact}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
