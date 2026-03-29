'use client'

import { Shield, ArrowUp, CheckCircle } from 'lucide-react'
import type { DeepCampaignInsight, AggregatedKpis } from '@/lib/yoai/analysisTypes'

interface Props {
  campaigns: DeepCampaignInsight[]
  kpis: AggregatedKpis | null
  loading: boolean
}

interface ScoreBreakdown {
  category: string
  score: number
  maxScore: number
  status: 'good' | 'warning' | 'bad'
}

interface ImprovementTip {
  text: string
  impact: number // potential score increase
}

function computeHealthScore(campaigns: DeepCampaignInsight[], kpis: AggregatedKpis | null): {
  totalScore: number
  breakdown: ScoreBreakdown[]
  tips: ImprovementTip[]
  level: string
  nextLevel: string
  pointsToNext: number
} {
  const active = campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')
  if (active.length === 0 || !kpis) {
    return { totalScore: 0, breakdown: [], tips: [], level: 'Başlangıç', nextLevel: 'Bronz', pointsToNext: 30 }
  }

  const breakdown: ScoreBreakdown[] = []
  const tips: ImprovementTip[] = []
  let totalScore = 0

  // 1. Campaign Performance (0-25)
  const avgScore = active.reduce((s, c) => s + c.score, 0) / active.length
  const perfScore = Math.round((avgScore / 100) * 25)
  breakdown.push({ category: 'Kampanya Performansı', score: perfScore, maxScore: 25, status: perfScore >= 18 ? 'good' : perfScore >= 12 ? 'warning' : 'bad' })
  totalScore += perfScore
  if (perfScore < 18) tips.push({ text: 'Düşük performanslı kampanyaları optimize edin', impact: 5 })

  // 2. Risk Level (0-25)
  const criticalCount = active.filter(c => c.riskLevel === 'critical').length
  const highCount = active.filter(c => c.riskLevel === 'high').length
  const riskPenalty = (criticalCount * 8) + (highCount * 4)
  const riskScore = Math.max(0, 25 - riskPenalty)
  breakdown.push({ category: 'Risk Durumu', score: riskScore, maxScore: 25, status: riskScore >= 20 ? 'good' : riskScore >= 12 ? 'warning' : 'bad' })
  totalScore += riskScore
  if (criticalCount > 0) tips.push({ text: `${criticalCount} kritik kampanyayı düzeltin`, impact: criticalCount * 5 })
  if (highCount > 0) tips.push({ text: `${highCount} yüksek riskli kampanyayı inceleyin`, impact: highCount * 3 })

  // 3. Coverage / Diversity (0-25)
  let coverageScore = 0
  const hasMeta = active.some(c => c.platform === 'Meta')
  const hasGoogle = active.some(c => c.platform === 'Google')
  if (hasMeta) coverageScore += 8
  if (hasGoogle) coverageScore += 8
  if (active.length >= 3) coverageScore += 5
  if (active.length >= 5) coverageScore += 4
  coverageScore = Math.min(25, coverageScore)
  breakdown.push({ category: 'Platform Çeşitliliği', score: coverageScore, maxScore: 25, status: coverageScore >= 18 ? 'good' : coverageScore >= 12 ? 'warning' : 'bad' })
  totalScore += coverageScore
  if (!hasMeta) tips.push({ text: 'Meta Ads kampanyası ekleyerek çeşitliliği artırın', impact: 8 })
  if (!hasGoogle) tips.push({ text: 'Google Ads kampanyası ekleyerek erişimi genişletin', impact: 8 })

  // 4. Efficiency (0-25)
  let effScore = 0
  if (kpis.weightedCtr > 2) effScore += 8
  else if (kpis.weightedCtr > 1) effScore += 5
  else effScore += 2

  if (kpis.avgRoas != null && kpis.avgRoas >= 3) effScore += 10
  else if (kpis.avgRoas != null && kpis.avgRoas >= 1.5) effScore += 6
  else if (kpis.avgRoas != null && kpis.avgRoas >= 1) effScore += 3

  const adsetCount = active.reduce((s, c) => s + c.adsets.length, 0)
  if (adsetCount >= active.length * 2) effScore += 7
  else if (adsetCount >= active.length) effScore += 4
  else effScore += 1

  effScore = Math.min(25, effScore)
  breakdown.push({ category: 'Verimlilik', score: effScore, maxScore: 25, status: effScore >= 18 ? 'good' : effScore >= 12 ? 'warning' : 'bad' })
  totalScore += effScore
  if (kpis.weightedCtr < 1) tips.push({ text: 'Reklam metinlerini iyileştirerek tıklama oranını artırın', impact: 5 })

  // Level system
  let level = 'Başlangıç'
  let nextLevel = 'Bronz'
  let pointsToNext = 30 - totalScore
  if (totalScore >= 85) { level = 'Platin'; nextLevel = 'Mükemmel'; pointsToNext = 100 - totalScore }
  else if (totalScore >= 70) { level = 'Altın'; nextLevel = 'Platin'; pointsToNext = 85 - totalScore }
  else if (totalScore >= 55) { level = 'Gümüş'; nextLevel = 'Altın'; pointsToNext = 70 - totalScore }
  else if (totalScore >= 30) { level = 'Bronz'; nextLevel = 'Gümüş'; pointsToNext = 55 - totalScore }

  // Sort tips by impact
  tips.sort((a, b) => b.impact - a.impact)

  return { totalScore, breakdown, tips: tips.slice(0, 3), level, nextLevel, pointsToNext }
}

export default function HealthScore({ campaigns, kpis, loading }: Props) {
  if (loading) return null

  const { totalScore, breakdown, tips, level, nextLevel, pointsToNext } = computeHealthScore(campaigns, kpis)
  if (breakdown.length === 0) return null

  const scoreColor = totalScore >= 70 ? 'text-emerald-600' : totalScore >= 50 ? 'text-amber-600' : 'text-red-600'
  const ringColor = totalScore >= 70 ? 'stroke-emerald-500' : totalScore >= 50 ? 'stroke-amber-500' : 'stroke-red-500'
  const circumference = 2 * Math.PI * 40
  const dashOffset = circumference - (totalScore / 100) * circumference

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Reklam Sağlık Skoru</h2>
          <p className="text-[10px] text-gray-400">Genel hesap sağlık durumu</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Score circle */}
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
            <circle cx="50" cy="50" r="40" fill="none" className={ringColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} style={{ transition: 'stroke-dashoffset 1s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${scoreColor}`}>{totalScore}</span>
            <span className="text-[9px] text-gray-400">/100</span>
          </div>
        </div>

        {/* Breakdown + Level */}
        <div className="flex-1">
          {/* Level badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              level === 'Platin' ? 'bg-violet-100 text-violet-700' :
              level === 'Altın' ? 'bg-amber-100 text-amber-700' :
              level === 'Gümüş' ? 'bg-gray-200 text-gray-700' :
              level === 'Bronz' ? 'bg-orange-100 text-orange-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {level}
            </span>
            {pointsToNext > 0 && pointsToNext < 100 && (
              <span className="text-[10px] text-gray-400">{nextLevel} seviyesine {pointsToNext} puan</span>
            )}
          </div>

          {/* Category bars */}
          <div className="space-y-1.5">
            {breakdown.map(b => (
              <div key={b.category} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-28 shrink-0 truncate">{b.category}</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${b.status === 'good' ? 'bg-emerald-500' : b.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(b.score / b.maxScore) * 100}%` }} />
                </div>
                <span className="text-[9px] text-gray-400 w-8 text-right">{b.score}/{b.maxScore}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Improvement tips */}
      {tips.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-[10px] font-semibold text-gray-500 mb-2">Puanınızı Artırın</p>
          <div className="space-y-1.5">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <ArrowUp className="w-3 h-3 text-primary shrink-0" />
                <span className="text-gray-600 flex-1">{tip.text}</span>
                <span className="text-primary font-medium shrink-0">+{tip.impact} puan</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
