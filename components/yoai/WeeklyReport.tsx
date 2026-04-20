'use client'

import { TrendingUp, TrendingDown, CalendarDays, Award, Target } from 'lucide-react'
import type { DeepCampaignInsight, AggregatedKpis } from '@/lib/yoai/analysisTypes'

interface Props {
  campaigns: DeepCampaignInsight[]
  kpis: AggregatedKpis | null
  loading: boolean
}

function fmt(n: number, d = 0): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return fmt(n)
}

export default function WeeklyReport({ campaigns, kpis, loading }: Props) {
  if (loading || !kpis || campaigns.length === 0) return null

  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')
  if (activeCampaigns.length === 0) return null

  const sorted = [...activeCampaigns].sort((a, b) => b.score - a.score)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const avgScore = activeCampaigns.reduce((s, c) => s + c.score, 0) / activeCampaigns.length

  const metaCampaigns = activeCampaigns.filter(c => c.platform === 'Meta')
  const googleCampaigns = activeCampaigns.filter(c => c.platform === 'Google')
  const metaSpend = metaCampaigns.reduce((s, c) => s + c.metrics.spend, 0)
  const googleSpend = googleCampaigns.reduce((s, c) => s + c.metrics.spend, 0)
  const totalSpend = metaSpend + googleSpend
  const metaPct = totalSpend > 0 ? (metaSpend / totalSpend) * 100 : 0

  // Ek metrikler
  const totalImpressions = kpis.totalImpressions
  const totalReach = activeCampaigns.reduce((s, c) => s + (c.metrics.reach ?? 0), 0)
  const avgFrequency = totalReach > 0 ? totalImpressions / totalReach : 0
  const avgCpm = totalImpressions > 0 ? (kpis.totalSpend / totalImpressions) * 1000 : 0

  // Skor dağılımı
  const scoreRanges = [
    { label: '80-100', color: 'bg-emerald-500', count: activeCampaigns.filter(c => c.score >= 80).length },
    { label: '60-79', color: 'bg-lime-400', count: activeCampaigns.filter(c => c.score >= 60 && c.score < 80).length },
    { label: '40-59', color: 'bg-gray-400', count: activeCampaigns.filter(c => c.score >= 40 && c.score < 60).length },
    { label: '0-39', color: 'bg-red-400', count: activeCampaigns.filter(c => c.score < 40).length },
  ]
  const maxScoreCount = Math.max(...scoreRanges.map(r => r.count), 1)

  // Objective dağılımı
  const objectiveMap = new Map<string, { spend: number; count: number }>()
  for (const c of activeCampaigns) {
    const obj = c.objective || 'Diğer'
    const prev = objectiveMap.get(obj) || { spend: 0, count: 0 }
    objectiveMap.set(obj, { spend: prev.spend + c.metrics.spend, count: prev.count + 1 })
  }
  const objectiveEntries = [...objectiveMap.entries()]
    .sort((a, b) => b[1].spend - a[1].spend)
    .slice(0, 4)

  // Platform performans karşılaştırma
  const metaImpressions = metaCampaigns.reduce((s, c) => s + c.metrics.impressions, 0)
  const googleImpressions = googleCampaigns.reduce((s, c) => s + c.metrics.impressions, 0)
  const metaClicks = metaCampaigns.reduce((s, c) => s + c.metrics.clicks, 0)
  const googleClicks = googleCampaigns.reduce((s, c) => s + c.metrics.clicks, 0)
  const metaCtr = metaImpressions > 0 ? (metaClicks / metaImpressions) * 100 : 0
  const googleCtr = googleImpressions > 0 ? (googleClicks / googleImpressions) * 100 : 0
  const metaAvgScore = metaCampaigns.length > 0 ? metaCampaigns.reduce((s, c) => s + c.score, 0) / metaCampaigns.length : 0
  const googleAvgScore = googleCampaigns.length > 0 ? googleCampaigns.reduce((s, c) => s + c.score, 0) / googleCampaigns.length : 0

  // Top 3 kampanya
  const top3 = sorted.slice(0, 3)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 h-full flex flex-col overflow-hidden">
      <div className="p-6 flex-1 overflow-y-auto">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-primary" />Haftalık Özet</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">Son 7 günlük performans</p>
      </div>

      {/* KPIs — 3x2 grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Harcama</p>
          <p className="text-base font-bold text-gray-900">₺{fmt(kpis.totalSpend)}</p>
          <p className="text-[10px] text-gray-400">{activeCampaigns.length} kampanya</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Dönüşüm</p>
          <p className="text-base font-bold text-gray-900">{fmt(kpis.totalConversions)}</p>
          <p className="text-[10px] text-gray-400">{kpis.avgRoas != null ? `ROAS: ${kpis.avgRoas.toFixed(1)}x` : 'CPC: ₺' + fmt(kpis.weightedCpc, 2)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Tıklama</p>
          <p className="text-base font-bold text-gray-900">{fmt(kpis.totalClicks)}</p>
          <p className="text-[10px] text-gray-400">TO: %{fmt(kpis.weightedCtr, 2)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Görüntüleme</p>
          <p className="text-base font-bold text-gray-900">{fmtCompact(totalImpressions)}</p>
          <p className="text-[10px] text-gray-400">CPM: ₺{fmt(avgCpm, 2)}</p>
        </div>
        {totalReach > 0 ? (
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-400">Erişim</p>
            <p className="text-base font-bold text-gray-900">{fmtCompact(totalReach)}</p>
            <p className="text-[10px] text-gray-400">Sıklık: {avgFrequency.toFixed(1)}x</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-400">CPC</p>
            <p className="text-base font-bold text-gray-900">₺{fmt(kpis.weightedCpc, 2)}</p>
            <p className="text-[10px] text-gray-400">ort. tıklama maliyeti</p>
          </div>
        )}
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Ort. Puan</p>
          <p className="text-base font-bold text-gray-900">{avgScore.toFixed(0)}/100</p>
          <p className="text-[10px] text-gray-400">CPC: ₺{fmt(kpis.weightedCpc, 2)}</p>
        </div>
      </div>

      {/* Platform bar — Harcama */}
      {totalSpend > 0 && (
        <div className="mb-3">
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

      {/* Platform Performans Karşılaştırma */}
      {metaCampaigns.length > 0 && googleCampaigns.length > 0 && (
        <div className="mb-4">
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Platform</th>
                  <th className="text-right px-2 py-2 font-medium text-gray-500">TO</th>
                  <th className="text-right px-2 py-2 font-medium text-gray-500">CPC</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">Puan</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-50">
                  <td className="px-3 py-2 font-medium text-[#1877F2]">Meta <span className="text-gray-400 font-normal">({metaCampaigns.length})</span></td>
                  <td className="px-2 py-2 text-right text-gray-700">%{metaCtr.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">₺{metaClicks > 0 ? (metaSpend / metaClicks).toFixed(2) : '0'}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">{metaAvgScore.toFixed(0)}</td>
                </tr>
                <tr className="border-t border-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-700">Google <span className="text-gray-400 font-normal">({googleCampaigns.length})</span></td>
                  <td className="px-2 py-2 text-right text-gray-700">%{googleCtr.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">₺{googleClicks > 0 ? (googleSpend / googleClicks).toFixed(2) : '0'}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">{googleAvgScore.toFixed(0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Skor Dağılımı — mini histogram */}
      <div className="mb-4">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Kampanya Skor Dağılımı</p>
        <div className="space-y-1.5">
          {scoreRanges.map(range => (
            <div key={range.label} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-10 text-right tabular-nums">{range.label}</span>
              <div className="flex-1 h-4 bg-gray-50 rounded overflow-hidden">
                {range.count > 0 && (
                  <div className={`h-full ${range.color} rounded transition-all flex items-center px-1.5`} style={{ width: `${(range.count / maxScoreCount) * 100}%`, minWidth: range.count > 0 ? '20px' : '0' }}>
                    <span className="text-[9px] font-bold text-white">{range.count}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hedef Bazlı Harcama */}
      {objectiveEntries.length > 1 && (
        <div className="mb-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
            <Target className="w-3 h-3" />Hedef Bazlı Harcama
          </p>
          <div className="space-y-1.5">
            {objectiveEntries.map(([obj, val]) => {
              const pct = totalSpend > 0 ? (val.spend / totalSpend) * 100 : 0
              return (
                <div key={obj} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 w-24 truncate" title={obj}>{obj}</span>
                  <div className="flex-1 h-3 bg-gray-50 rounded overflow-hidden">
                    <div className="h-full bg-primary/60 rounded transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-500 w-14 text-right tabular-nums">₺{fmtCompact(val.spend)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top 3 Kampanya */}
      {top3.length > 1 && (
        <div className="mb-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
            <Award className="w-3 h-3" />En İyi Kampanyalar
          </p>
          <div className="space-y-1.5">
            {top3.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-gray-50/60">
                <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  i === 0 ? 'bg-gray-100 text-gray-700' : i === 1 ? 'bg-gray-200 text-gray-600' : 'bg-orange-100 text-orange-600'
                }`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-800 font-medium truncate">{c.campaignName}</p>
                  <p className="text-[9px] text-gray-400">{c.platform} · ₺{fmtCompact(c.metrics.spend)}</p>
                </div>
                <span className={`text-[11px] font-bold ${c.score >= 70 ? 'text-emerald-600' : c.score >= 50 ? 'text-gray-600' : 'text-red-600'}`}>{c.score}</span>
              </div>
            ))}
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
    </div>
  )
}
