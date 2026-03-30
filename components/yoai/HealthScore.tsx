'use client'

import { ArrowUp, HeartPulse } from 'lucide-react'
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

  // Generate status commentary based on score & breakdown
  const getStatusCommentary = () => {
    const effScore = breakdown.find(b => b.category === 'Verimlilik')
    const riskScore = breakdown.find(b => b.category === 'Risk Durumu')
    const perfScore = breakdown.find(b => b.category === 'Kampanya Performansı')

    if (totalScore >= 85) return 'Hesap mükemmel durumda. Tüm metrikler hedef aralığında.'
    if (totalScore >= 70) {
      if (effScore && (effScore.score / effScore.maxScore) < 0.5) return 'Hesap genel olarak stabil, ancak verimlilik tarafında iyileştirme alanı var.'
      if (riskScore && (riskScore.score / riskScore.maxScore) < 0.5) return 'Performans iyi, ancak bazı kampanyalarda risk seviyesi yüksek.'
      return 'Hesap sağlıklı görünüyor. Küçük optimizasyonlarla daha yukarı çıkabilir.'
    }
    if (totalScore >= 50) {
      if (perfScore && (perfScore.score / perfScore.maxScore) < 0.5) return 'Kampanya performansı beklentinin altında. Optimizasyon önerileri değerlendirilmeli.'
      return 'Hesap orta düzeyde. Birkaç kritik alan iyileştirme gerektiriyor.'
    }
    return 'Hesap acil müdahale gerektiriyor. Kritik alanlar önceliklendirilmeli.'
  }

  // Quick summary badges
  const strongAreas = breakdown.filter(b => (b.score / b.maxScore) >= 0.72)
  const weakAreas = breakdown.filter(b => (b.score / b.maxScore) < 0.48)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      {/* Header — matches DailyBriefing language */}
      <div className="mb-5">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Hesap Durumu</p>
        <h2 className="text-base font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5"><HeartPulse className="w-4 h-4 text-primary" />Sağlık Skoru</h2>
      </div>

      {/* Score + Level hero area */}
      <div className="bg-gray-50 rounded-xl px-5 py-4 mb-4">
        <div className="flex items-center gap-5">
          {/* Score circle */}
          <div className="relative w-[88px] h-[88px] shrink-0">
            <svg className="w-[88px] h-[88px] -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="6" />
              <circle cx="50" cy="50" r="40" fill="none" className={ringColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${scoreColor}`}>{totalScore}</span>
              <span className="text-[8px] text-gray-400">/100</span>
            </div>
          </div>

          {/* Level + Commentary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${levelStyle[level] || levelStyle.Başlangıç}`}>{level}</span>
              {pointsToNext > 0 && pointsToNext < 100 && (
                <span className="text-[10px] text-gray-400">Sonraki seviyeye {pointsToNext} puan</span>
              )}
            </div>
            <p className="text-[12px] text-gray-600 leading-relaxed">{getStatusCommentary()}</p>

            {/* Quick insight badges */}
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              {strongAreas.length > 0 && (
                <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">
                  {strongAreas.length} güçlü alan
                </span>
              )}
              {weakAreas.length > 0 && (
                <span className="text-[9px] bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-medium">
                  {weakAreas.length} zayıf alan
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-3 mb-4">
        {breakdown.map(b => {
          const pct = (b.score / b.maxScore) * 100
          const barColor = pct >= 72 ? 'bg-emerald-500' : pct >= 48 ? 'bg-amber-500' : 'bg-red-500'
          const statusLabel = pct >= 72 ? 'İyi' : pct >= 48 ? 'Orta' : 'Zayıf'
          const statusText = pct >= 72 ? 'text-emerald-600' : pct >= 48 ? 'text-amber-600' : 'text-red-600'
          return (
            <div key={b.category}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-700">{b.category}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-medium ${statusText}`}>{statusLabel}</span>
                  <span className="text-[10px] text-gray-400 font-medium">{b.score}/{b.maxScore}</span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Tips — improvement opportunities */}
      {tips.length > 0 && (
        <div className="pt-4 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2.5">İyileştirme Fırsatları</p>
          <div className="space-y-2">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-center gap-3 bg-primary/[0.03] rounded-lg px-3 py-2">
                <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[11px] text-gray-600 flex-1 leading-relaxed">{tip.text}</span>
                <span className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-md shrink-0">+{tip.impact} puan</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
