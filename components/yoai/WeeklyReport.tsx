'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
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

  const sorted = [...activeCampaigns].sort((a, b) => b.score - a.score)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const avgScore = activeCampaigns.reduce((s, c) => s + c.score, 0) / activeCampaigns.length

  const metaSpend = activeCampaigns.filter(c => c.platform === 'Meta').reduce((s, c) => s + c.metrics.spend, 0)
  const googleSpend = activeCampaigns.filter(c => c.platform === 'Google').reduce((s, c) => s + c.metrics.spend, 0)
  const totalSpend = metaSpend + googleSpend
  const metaPct = totalSpend > 0 ? (metaSpend / totalSpend) * 100 : 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Haftalık Özet</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">Son 7 günlük performans</p>
      </div>

      {/* KPIs — 2x2 grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Harcama</p>
          <p className="text-lg font-bold text-gray-900">₺{fmt(kpis.totalSpend)}</p>
          <p className="text-[10px] text-gray-400">{activeCampaigns.length} kampanya</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Dönüşüm</p>
          <p className="text-lg font-bold text-gray-900">{fmt(kpis.totalConversions)}</p>
          <p className="text-[10px] text-gray-400">{kpis.avgRoas != null ? `ROAS: ${kpis.avgRoas.toFixed(1)}x` : 'CPC: ₺' + fmt(kpis.weightedCpc, 2)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Tıklama</p>
          <p className="text-lg font-bold text-gray-900">{fmt(kpis.totalClicks)}</p>
          <p className="text-[10px] text-gray-400">TO: %{fmt(kpis.weightedCtr, 2)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Ort. Puan</p>
          <p className="text-lg font-bold text-gray-900">{avgScore.toFixed(0)}/100</p>
          <p className="text-[10px] text-gray-400">CPC: ₺{fmt(kpis.weightedCpc, 2)}</p>
        </div>
      </div>

      {/* Platform bar */}
      {totalSpend > 0 && (
        <div className="mb-4">
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
            {metaPct > 0 && <div className="bg-[#1877F2] transition-all" style={{ width: `${metaPct}%` }} />}
            {(100 - metaPct) > 0 && <div className="bg-gray-700 transition-all" style={{ width: `${100 - metaPct}%` }} />}
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            <span>Meta: ₺{fmt(metaSpend)} (%{metaPct.toFixed(0)})</span>
            <span>Google: ₺{fmt(googleSpend)} (%{(100 - metaPct).toFixed(0)})</span>
          </div>
        </div>
      )}

      {/* Best / Worst */}
      <div className="grid grid-cols-2 gap-2">
        {best && (
          <div className="flex items-center gap-2 bg-emerald-50/50 rounded-lg px-3 py-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-emerald-600 font-medium">En İyi</p>
              <p className="text-[11px] text-gray-900 font-medium truncate">{best.campaignName}</p>
              <p className="text-[9px] text-gray-500">{best.score}/100</p>
            </div>
          </div>
        )}
        {worst && worst.id !== best?.id && (
          <div className="flex items-center gap-2 bg-red-50/50 rounded-lg px-3 py-2">
            <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-red-600 font-medium">En Düşük</p>
              <p className="text-[11px] text-gray-900 font-medium truncate">{worst.campaignName}</p>
              <p className="text-[9px] text-gray-500">{worst.score}/100</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
