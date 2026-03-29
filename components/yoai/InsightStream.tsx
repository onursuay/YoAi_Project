'use client'

import { AlertTriangle, TrendingUp, Eye, CheckCircle2, Inbox, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { DeepCampaignInsight, InsightStatus, RiskLevel } from '@/lib/yoai/analysisTypes'

type CampaignWithAI = DeepCampaignInsight & {
  summary: string
  recommendation: string
  confidence: number
  insightStatus: InsightStatus
}

const STATUS_MAP: Record<InsightStatus, { label: string; color: string; bg: string }> = {
  monitoring: { label: 'İzleniyor', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  review_needed: { label: 'İnceleme Gerekli', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  ready_for_approval: { label: 'Onaya Hazır', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
}

const RISK_MAP: Record<RiskLevel, { label: string; dot: string; color: string }> = {
  low: { label: 'Düşük', dot: 'bg-emerald-500', color: 'text-emerald-600' },
  medium: { label: 'Orta', dot: 'bg-amber-500', color: 'text-amber-600' },
  high: { label: 'Yüksek', dot: 'bg-orange-500', color: 'text-orange-600' },
  critical: { label: 'Kritik', dot: 'bg-red-500', color: 'text-red-600' },
}

const PLATFORM_STYLE: Record<string, { bg: string; text: string }> = {
  Meta: { bg: 'bg-blue-50', text: 'text-blue-700' },
  Google: { bg: 'bg-red-50', text: 'text-red-700' },
}

// Turkish labels for problem tags
const PROBLEM_TR: Record<string, string> = {
  NO_DELIVERY: 'Teslimat Yok',
  INSUFFICIENT_DATA: 'Yetersiz Veri',
  LOW_CTR: 'Düşük CTR',
  HIGH_CPC: 'Yüksek CPC',
  HIGH_CPM: 'Yüksek CPM',
  HIGH_CPA: 'Yüksek CPA',
  HIGH_CPL: 'Yüksek CPL',
  LOW_ROAS: 'Düşük ROAS',
  NEGATIVE_ROAS: 'Negatif ROAS',
  HIGH_FREQUENCY: 'Yüksek Frekans',
  CRITICAL_FREQUENCY: 'Kritik Frekans',
  QUALITY_BELOW_AVERAGE: 'Düşük Kalite',
  ENGAGEMENT_BELOW_AVERAGE: 'Düşük Etkileşim',
  CONVERSION_BELOW_AVERAGE: 'Düşük Dönüşüm',
  LPV_DROP: 'Sayfa Görüntüleme Düşüşü',
  FUNNEL_BOTTLENECK: 'Dönüşüm Darboğazı',
  BUDGET_UNDERUTILIZED: 'Bütçe Düşük Kullanım',
  ADSET_IMBALANCE: 'Set Dengesizliği',
  SINGLE_ADSET_RISK: 'Tek Set Riski',
}

// Turkish labels for objectives
const OBJECTIVE_TR: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Trafik',
  OUTCOME_AWARENESS: 'Bilinirlik',
  OUTCOME_ENGAGEMENT: 'Etkileşim',
  OUTCOME_LEADS: 'Potansiyel Müşteri',
  OUTCOME_SALES: 'Satış',
  OUTCOME_APP_PROMOTION: 'Uygulama',
  SEARCH: 'Arama',
  DISPLAY: 'Görüntülü',
  VIDEO: 'Video',
  PERFORMANCE_MAX: 'Performans Max',
  SHOPPING: 'Alışveriş',
}

interface Props {
  insights: CampaignWithAI[]
  loading: boolean
}

export default function InsightStream({ insights, loading }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Only show active campaigns
  const activeCampaigns = insights.filter(c =>
    c.status === 'ACTIVE' || c.status === 'ENABLED'
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI Kampanya Analizi</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeCampaigns.length} aktif kampanya analiz edildi
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-[260px] bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
        </div>
      ) : activeCampaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aktif kampanya bulunamadı.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeCampaigns.map(insight => {
            const status = STATUS_MAP[insight.insightStatus] || STATUS_MAP.monitoring
            const risk = RISK_MAP[insight.riskLevel] || RISK_MAP.low
            const platform = PLATFORM_STYLE[insight.platform] || { bg: 'bg-gray-50', text: 'text-gray-700' }
            const isExpanded = expandedId === insight.id
            const activeAdsets = insight.adsets.filter(as => as.status === 'ACTIVE' || as.status === 'ENABLED')
            const activeAds = activeAdsets.reduce((s, as) => s + as.ads.filter(ad => ad.status === 'ACTIVE' || ad.status === 'ENABLED').length, 0)
            const objectiveLabel = OBJECTIVE_TR[insight.objective] || insight.objective

            return (
              <div key={insight.id} className={`bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all duration-300 flex flex-col ${insight.riskLevel === 'critical' ? 'ring-1 ring-red-200' : ''}`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${platform.bg} ${platform.text}`}>{insight.platform}</span>
                  <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                    {insight.insightStatus === 'monitoring' && <Eye className="w-3 h-3 mr-1" />}
                    {insight.insightStatus === 'review_needed' && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {insight.insightStatus === 'ready_for_approval' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {status.label}
                  </span>
                </div>

                {/* Campaign name */}
                <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">{insight.campaignName}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-gray-400">{objectiveLabel}</span>
                  <span className="text-[10px] text-gray-300">·</span>
                  <span className="text-[10px] text-gray-400">Puan: {insight.score}/100</span>
                </div>

                {/* Problem tags — Turkish */}
                {insight.problemTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {insight.problemTags.slice(0, 3).map((tag, i) => (
                      <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded ${tag.severity === 'critical' ? 'bg-red-50 text-red-700' : tag.severity === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {PROBLEM_TR[tag.id] || tag.id}
                      </span>
                    ))}
                    {insight.problemTags.length > 3 && <span className="text-[9px] text-gray-400">+{insight.problemTags.length - 3}</span>}
                  </div>
                )}

                {/* AI Summary */}
                {insight.summary && <p className="text-xs text-gray-600 leading-relaxed mb-2 flex-1 line-clamp-2">{insight.summary}</p>}

                {/* Metrics — Turkish */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-400 mb-3 pb-2 border-b border-gray-50">
                  <span>Harcama: <strong className="text-gray-600">₺{insight.metrics.spend.toFixed(0)}</strong></span>
                  <span>Tıklama: <strong className="text-gray-600">{insight.metrics.clicks.toLocaleString('tr-TR')}</strong></span>
                  <span>Tıklama Oranı: <strong className="text-gray-600">%{(insight.metrics.ctr * 100).toFixed(1)}</strong></span>
                  {insight.metrics.roas != null && <span>Getiri Oranı: <strong className="text-gray-600">{insight.metrics.roas.toFixed(1)}x</strong></span>}
                </div>

                {/* AI Recommendation */}
                {insight.recommendation && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-semibold text-gray-500">Öneri</span>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">{insight.recommendation}</p>
                  </div>
                )}

                {/* Footer: risk + dropdown toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-auto">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${risk.dot}`} />
                    <span className={`text-[11px] font-semibold ${risk.color}`}>{risk.label} Risk</span>
                    <span className="text-[10px] text-gray-400 ml-1">%{insight.confidence}</span>
                  </div>
                  {activeAdsets.length > 0 && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                      className="text-[10px] text-primary font-medium flex items-center gap-1 hover:underline"
                    >
                      {activeAdsets.length} reklam seti · {activeAds} reklam
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {/* Inline dropdown: adsets + ads */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 max-h-[300px] overflow-y-auto">
                    {activeAdsets.map(as => {
                      const activeAdsInSet = as.ads.filter(ad => ad.status === 'ACTIVE' || ad.status === 'ENABLED')
                      return (
                        <div key={as.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-gray-800 truncate">{as.name}</span>
                            <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Aktif</span>
                          </div>
                          <div className="flex gap-3 text-[10px] text-gray-500 mb-2">
                            <span>₺{as.metrics.spend.toFixed(0)}</span>
                            <span>{as.metrics.clicks} tıklama</span>
                            <span>%{(as.metrics.ctr * 100).toFixed(1)} TO</span>
                          </div>
                          {activeAdsInSet.length > 0 && (
                            <div className="space-y-1">
                              {activeAdsInSet.map(ad => (
                                <div key={ad.id} className="flex items-center justify-between bg-white rounded px-2.5 py-1.5 text-[10px]">
                                  <span className="text-gray-700 truncate max-w-[55%]">{ad.name}</span>
                                  <div className="flex gap-2 text-gray-500 shrink-0">
                                    <span>₺{ad.metrics.spend.toFixed(0)}</span>
                                    <span>%{(ad.metrics.ctr * 100).toFixed(1)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
