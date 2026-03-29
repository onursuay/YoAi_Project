'use client'

import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { DeepCampaignInsight, AggregatedKpis } from '@/lib/yoai/analysisTypes'

interface Props {
  campaigns: DeepCampaignInsight[]
  kpis: AggregatedKpis | null
  loading: boolean
}

function fmt(n: number, d = 0): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export default function WeeklyReport({ campaigns, kpis, loading }: Props) {
  if (loading || !kpis || campaigns.length === 0) return null

  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')
  if (activeCampaigns.length === 0) return null

  // Sort by score to find best/worst
  const sorted = [...activeCampaigns].sort((a, b) => b.score - a.score)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  // Sort by spend for biggest spender
  const bySpend = [...activeCampaigns].sort((a, b) => b.metrics.spend - a.metrics.spend)
  const topSpender = bySpend[0]

  // Average score
  const avgScore = activeCampaigns.reduce((s, c) => s + c.score, 0) / activeCampaigns.length

  // Platform distribution
  const metaSpend = activeCampaigns.filter(c => c.platform === 'Meta').reduce((s, c) => s + c.metrics.spend, 0)
  const googleSpend = activeCampaigns.filter(c => c.platform === 'Google').reduce((s, c) => s + c.metrics.spend, 0)
  const totalSpend = metaSpend + googleSpend
  const metaPct = totalSpend > 0 ? (metaSpend / totalSpend) * 100 : 0

  const metrics = [
    { label: 'Toplam Harcama', value: `₺${fmt(kpis.totalSpend)}`, sub: `${activeCampaigns.length} kampanya` },
    { label: 'Toplam Tıklama', value: fmt(kpis.totalClicks), sub: `TO: %${fmt(kpis.weightedCtr, 2)}` },
    { label: 'Toplam Dönüşüm', value: fmt(kpis.totalConversions), sub: kpis.avgRoas != null ? `ROAS: ${kpis.avgRoas.toFixed(1)}x` : 'ROAS: N/A' },
    { label: 'Ort. CPC', value: `₺${fmt(kpis.weightedCpc, 2)}`, sub: `Ort. puan: ${avgScore.toFixed(0)}/100` },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-violet-600" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Haftalık Performans Özeti</h2>
          <p className="text-[10px] text-gray-400">Son 7 günlük reklam performansı</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {metrics.map(m => (
          <div key={m.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-gray-400">{m.label}</p>
            <p className="text-base font-bold text-gray-900">{m.value}</p>
            <p className="text-[10px] text-gray-500">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Platform distribution bar */}
      {totalSpend > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-gray-400 mb-1.5">Platform Dağılımı</p>
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
            {metaPct > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${metaPct}%` }} />}
            {(100 - metaPct) > 0 && <div className="bg-red-500 transition-all" style={{ width: `${100 - metaPct}%` }} />}
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            <span>Meta: ₺{fmt(metaSpend)} (%{metaPct.toFixed(0)})</span>
            <span>Google: ₺{fmt(googleSpend)} (%{(100 - metaPct).toFixed(0)})</span>
          </div>
        </div>
      )}

      {/* Best / Worst / Top Spender */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {best && (
          <div className="flex items-center gap-2.5 bg-emerald-50 rounded-lg px-3 py-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-emerald-600 font-medium">En İyi Performans</p>
              <p className="text-[11px] text-gray-900 font-medium truncate">{best.campaignName}</p>
              <p className="text-[9px] text-gray-500">Puan: {best.score} · %{(best.metrics.ctr * 100).toFixed(1)} TO</p>
            </div>
          </div>
        )}
        {worst && worst.id !== best?.id && (
          <div className="flex items-center gap-2.5 bg-red-50 rounded-lg px-3 py-2">
            <TrendingDown className="w-4 h-4 text-red-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-red-600 font-medium">En Düşük Performans</p>
              <p className="text-[11px] text-gray-900 font-medium truncate">{worst.campaignName}</p>
              <p className="text-[9px] text-gray-500">Puan: {worst.score} · %{(worst.metrics.ctr * 100).toFixed(1)} TO</p>
            </div>
          </div>
        )}
        {topSpender && (
          <div className="flex items-center gap-2.5 bg-blue-50 rounded-lg px-3 py-2">
            <Minus className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-blue-600 font-medium">En Çok Harcayan</p>
              <p className="text-[11px] text-gray-900 font-medium truncate">{topSpender.campaignName}</p>
              <p className="text-[9px] text-gray-500">₺{fmt(topSpender.metrics.spend)} · {topSpender.platform}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
