'use client'

import { AlertTriangle, TrendingUp, TrendingDown, Target, Zap, Newspaper, Eye, Users, BarChart3, DollarSign, Shield, Layers, ArrowRight } from 'lucide-react'
import type { DeepAnalysisResult } from '@/lib/yoai/analysisTypes'

interface Props {
  data: DeepAnalysisResult | null
  loading: boolean
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('tr-TR')
}

export default function DailyBriefing({ data, loading }: Props) {
  if (loading || !data) return null

  const { campaigns, kpis } = data
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')
  const criticalCampaigns = campaigns.filter(c => c.riskLevel === 'critical' || c.riskLevel === 'high')
  const lowRoasCampaigns = campaigns.filter(c => c.metrics.roas != null && c.metrics.roas < 1 && c.metrics.spend > 100)
  const highPerformers = campaigns.filter(c => c.score >= 80).length
  const actionCount = data.actions.length
  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Ek metrikler
  const totalReach = activeCampaigns.reduce((s, c) => s + (c.metrics.reach ?? 0), 0)
  const avgFrequency = totalReach > 0 ? kpis.totalImpressions / totalReach : 0
  const avgCpm = kpis.totalImpressions > 0 ? (kpis.totalSpend / kpis.totalImpressions) * 1000 : 0
  const avgCpc = kpis.weightedCpc

  // Platform dağılımı
  const metaCampaigns = activeCampaigns.filter(c => c.platform === 'Meta')
  const googleCampaigns = activeCampaigns.filter(c => c.platform === 'Google')
  const metaSpend = metaCampaigns.reduce((s, c) => s + c.metrics.spend, 0)
  const googleSpend = googleCampaigns.reduce((s, c) => s + c.metrics.spend, 0)
  const metaClicks = metaCampaigns.reduce((s, c) => s + c.metrics.clicks, 0)
  const googleClicks = googleCampaigns.reduce((s, c) => s + c.metrics.clicks, 0)
  const metaConv = metaCampaigns.reduce((s, c) => s + c.metrics.conversions, 0)
  const googleConv = googleCampaigns.reduce((s, c) => s + c.metrics.conversions, 0)

  // Risk dağılımı
  const riskCounts = {
    critical: campaigns.filter(c => c.riskLevel === 'critical').length,
    high: campaigns.filter(c => c.riskLevel === 'high').length,
    medium: campaigns.filter(c => c.riskLevel === 'medium').length,
    low: campaigns.filter(c => c.riskLevel === 'low').length,
  }
  const totalRiskCampaigns = riskCounts.critical + riskCounts.high + riskCounts.medium + riskCounts.low

  // Top aksiyonlar
  const topActions = data.actions
    .sort((a, b) => {
      const p = { high: 3, medium: 2, low: 1 }
      return (p[b.priority] ?? 0) - (p[a.priority] ?? 0)
    })
    .slice(0, 3)

  // Yapısal sorunlar
  const structuralIssues = data.structuralIssues?.filter(s => s.severity === 'critical' || s.severity === 'warning') ?? []

  // Build prioritized items
  const priorities: { icon: React.ElementType; text: string; type: 'critical' | 'warning' | 'success' | 'info' }[] = []

  if (criticalCampaigns.length > 0) {
    priorities.push({ icon: AlertTriangle, text: `${criticalCampaigns.length} kampanya kritik durumda, acil müdahale önerilir.`, type: 'critical' })
  }
  if (lowRoasCampaigns.length > 0) {
    priorities.push({ icon: TrendingDown, text: `${lowRoasCampaigns.length} kampanyada ROAS 1x altında, harcama geri dönmüyor.`, type: 'warning' })
  }
  if (highPerformers > 0) {
    priorities.push({ icon: TrendingUp, text: `${highPerformers} kampanya yüksek performans gösteriyor.`, type: 'success' })
  }
  if (kpis.totalClicks > 0) {
    const convRate = (kpis.totalConversions / kpis.totalClicks) * 100
    if (convRate < 1) {
      priorities.push({ icon: Target, text: `Dönüşüm oranı %${convRate.toFixed(2)}, landing page optimizasyonu değerlendirin.`, type: 'warning' })
    }
  }
  if (kpis.totalImpressions > 0) {
    priorities.push({ icon: Eye, text: `Toplam ${kpis.totalImpressions.toLocaleString('tr-TR')} görüntüleme, CPM: ₺${avgCpm.toFixed(2)}`, type: 'info' })
  }
  if (totalReach > 0) {
    priorities.push({ icon: Users, text: `${totalReach.toLocaleString('tr-TR')} kişiye ulaşıldı, ort. sıklık: ${avgFrequency.toFixed(1)}x`, type: 'info' })
  }
  if (avgFrequency > 3) {
    priorities.push({ icon: BarChart3, text: `Frekans ${avgFrequency.toFixed(1)}x — reklam yorgunluğu riski, hedef kitle genişletmeyi düşünün.`, type: 'warning' })
  }
  if (avgCpc > 10) {
    priorities.push({ icon: DollarSign, text: `Ortalama tıklama maliyeti ₺${avgCpc.toFixed(2)}, reklam metinleri ve hedefleme gözden geçirilmeli.`, type: 'warning' })
  }
  if (actionCount > 0) {
    priorities.push({ icon: Zap, text: `${actionCount} aksiyon önerisi mevcut.`, type: 'info' })
  }

  if (priorities.length === 0) return null

  const typeStyles = {
    critical: 'border-l-red-500 bg-red-50/50',
    warning: 'border-l-gray-500 bg-gray-50/50',
    success: 'border-l-emerald-500 bg-emerald-50/50',
    info: 'border-l-blue-500 bg-blue-50/50',
  }
  const iconStyles = {
    critical: 'text-red-600',
    warning: 'text-gray-600',
    success: 'text-emerald-600',
    info: 'text-blue-600',
  }

  const priorityColors = { high: 'text-red-600 bg-red-50', medium: 'text-gray-600 bg-gray-50', low: 'text-gray-500 bg-gray-50' }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden h-full flex flex-col">
      <div className="p-6 flex-1 overflow-y-auto">
        {/* Header */}
        <div className="mb-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{today}</p>
          <h2 className="text-base font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5">
            <Newspaper className="w-4 h-4 text-primary" />Günlük Brifing
          </h2>
        </div>

        {/* Executive summary */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            Son 7 günde <strong className="text-gray-900">₺{kpis.totalSpend.toFixed(0)}</strong> harcanarak{' '}
            <strong className="text-gray-900">{kpis.totalConversions}</strong> dönüşüm elde edildi.{' '}
            <strong className="text-gray-900">{kpis.totalImpressions.toLocaleString('tr-TR')}</strong> görüntüleme{' '}
            ve <strong className="text-gray-900">{kpis.totalClicks.toLocaleString('tr-TR')}</strong> tıklama gerçekleşti.{' '}
            {criticalCampaigns.length > 0 ? `${criticalCampaigns.length} kampanya dikkat gerektiriyor.` : 'Genel durum stabil.'}
          </p>
        </div>

        {/* Mini KPI bar */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center bg-gray-50/80 rounded-lg py-2 px-1">
            <p className="text-xs font-bold text-gray-900">₺{fmtCompact(kpis.totalSpend)}</p>
            <p className="text-[9px] text-gray-400">Harcama</p>
          </div>
          <div className="text-center bg-gray-50/80 rounded-lg py-2 px-1">
            <p className="text-xs font-bold text-gray-900">{fmtCompact(kpis.totalImpressions)}</p>
            <p className="text-[9px] text-gray-400">Gösterim</p>
          </div>
          <div className="text-center bg-gray-50/80 rounded-lg py-2 px-1">
            <p className="text-xs font-bold text-gray-900">%{kpis.weightedCtr.toFixed(1)}</p>
            <p className="text-[9px] text-gray-400">TO</p>
          </div>
          <div className="text-center bg-gray-50/80 rounded-lg py-2 px-1">
            <p className="text-xs font-bold text-gray-900">₺{avgCpm.toFixed(1)}</p>
            <p className="text-[9px] text-gray-400">CPM</p>
          </div>
        </div>

        {/* Priority items */}
        <div className="space-y-2 mb-4">
          {priorities.map((item, i) => {
            const Icon = item.icon
            return (
              <div key={i} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border-l-[3px] ${typeStyles[item.type]}`}>
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconStyles[item.type]}`} />
                <p className="text-[13px] text-gray-700 leading-relaxed">{item.text}</p>
              </div>
            )
          })}
        </div>

        {/* Platform Karşılaştırma */}
        {(metaCampaigns.length > 0 || googleCampaigns.length > 0) && (
          <div className="mb-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3 h-3" />Platform Karşılaştırma
            </p>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Platform</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">Harcama</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">Tıklama</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">Dönüşüm</th>
                  </tr>
                </thead>
                <tbody>
                  {metaCampaigns.length > 0 && (
                    <tr className="border-t border-gray-50">
                      <td className="px-3 py-2 font-medium text-[#1877F2]">Meta</td>
                      <td className="px-3 py-2 text-right text-gray-700">₺{fmtCompact(metaSpend)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtCompact(metaClicks)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtCompact(metaConv)}</td>
                    </tr>
                  )}
                  {googleCampaigns.length > 0 && (
                    <tr className="border-t border-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-700">Google</td>
                      <td className="px-3 py-2 text-right text-gray-700">₺{fmtCompact(googleSpend)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtCompact(googleClicks)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtCompact(googleConv)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Risk Dağılımı */}
        {totalRiskCampaigns > 0 && (
          <div className="mb-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2.5 flex items-center gap-1.5">
              <Shield className="w-3 h-3" />Risk Dağılımı
            </p>
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
              {riskCounts.critical > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(riskCounts.critical / totalRiskCampaigns) * 100}%` }} />}
              {riskCounts.high > 0 && <div className="bg-orange-400 transition-all" style={{ width: `${(riskCounts.high / totalRiskCampaigns) * 100}%` }} />}
              {riskCounts.medium > 0 && <div className="bg-gray-300 transition-all" style={{ width: `${(riskCounts.medium / totalRiskCampaigns) * 100}%` }} />}
              {riskCounts.low > 0 && <div className="bg-emerald-400 transition-all" style={{ width: `${(riskCounts.low / totalRiskCampaigns) * 100}%` }} />}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {riskCounts.critical > 0 && <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Kritik: {riskCounts.critical}</span>}
              {riskCounts.high > 0 && <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />Yüksek: {riskCounts.high}</span>}
              {riskCounts.medium > 0 && <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-gray-300" />Orta: {riskCounts.medium}</span>}
              {riskCounts.low > 0 && <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Düşük: {riskCounts.low}</span>}
            </div>
          </div>
        )}

        {/* Top Aksiyonlar */}
        {topActions.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2.5 flex items-center gap-1.5">
              <Zap className="w-3 h-3" />Öncelikli Aksiyonlar
            </p>
            <div className="space-y-1.5">
              {topActions.map((action, i) => (
                <div key={action.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-gray-50/60 border border-gray-100/60">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${priorityColors[action.priority]}`}>
                    {action.priority === 'high' ? 'ACİL' : action.priority === 'medium' ? 'ORTA' : 'DÜŞÜK'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-800 font-medium truncate">{action.title}</p>
                    <p className="text-[9px] text-gray-400 truncate">{action.campaignName}</p>
                  </div>
                  <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Yapısal Sorunlar */}
        {structuralIssues.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2.5">Yapısal Sorunlar</p>
            <div className="space-y-1.5">
              {structuralIssues.slice(0, 3).map((issue) => (
                <div key={issue.id} className={`flex items-start gap-2 rounded-lg px-3 py-2 ${issue.severity === 'critical' ? 'bg-red-50/50 border border-red-100/50' : 'bg-gray-50/50 border border-gray-100/50'}`}>
                  <AlertTriangle className={`w-3 h-3 mt-0.5 shrink-0 ${issue.severity === 'critical' ? 'text-red-500' : 'text-gray-500'}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-800 font-medium">{issue.title}</p>
                    <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">{issue.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
