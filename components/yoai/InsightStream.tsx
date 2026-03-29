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

interface Props {
  insights: CampaignWithAI[]
  loading: boolean
}

export default function InsightStream({ insights, loading }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI Kampanya Analizi</h2>
          <p className="text-xs text-gray-400 mt-0.5">Kampanya → Adset → Reklam hiyerarşik analiz</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-[280px] bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
        </div>
      ) : insights.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Analiz edilecek kampanya bulunamadı.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map(insight => {
            const status = STATUS_MAP[insight.insightStatus] || STATUS_MAP.monitoring
            const risk = RISK_MAP[insight.riskLevel] || RISK_MAP.low
            const platform = PLATFORM_STYLE[insight.platform] || { bg: 'bg-gray-50', text: 'text-gray-700' }
            const isExpanded = expandedId === insight.id
            const totalAds = insight.adsets.reduce((s, as) => s + as.ads.length, 0)

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

                <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">{insight.campaignName}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-gray-400">{insight.objective}</span>
                  <span className="text-[10px] text-gray-300">·</span>
                  <span className="text-[10px] text-gray-400">Skor: {insight.score}/100</span>
                </div>

                {/* Problem tags */}
                {insight.problemTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {insight.problemTags.slice(0, 3).map((tag, i) => (
                      <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded ${tag.severity === 'critical' ? 'bg-red-50 text-red-700' : tag.severity === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {tag.id.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {insight.problemTags.length > 3 && (
                      <span className="text-[9px] text-gray-400">+{insight.problemTags.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Summary (from AI) */}
                {insight.summary && <p className="text-xs text-gray-600 leading-relaxed mb-2 flex-1 line-clamp-2">{insight.summary}</p>}

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-400 mb-3 pb-2 border-b border-gray-50">
                  <span>Harcama: <strong className="text-gray-600">₺{insight.metrics.spend.toFixed(0)}</strong></span>
                  <span>Tıklama: <strong className="text-gray-600">{insight.metrics.clicks.toLocaleString('tr-TR')}</strong></span>
                  <span>CTR: <strong className="text-gray-600">{(insight.metrics.ctr * 100).toFixed(1)}%</strong></span>
                  {insight.metrics.roas != null && <span>ROAS: <strong className="text-gray-600">{insight.metrics.roas.toFixed(1)}x</strong></span>}
                </div>

                {/* AI Recommendation */}
                {insight.recommendation && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">AI Önerisi</span>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">{insight.recommendation}</p>
                  </div>
                )}

                {/* Footer: risk + confidence + expand */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${risk.dot}`} />
                    <span className={`text-[11px] font-semibold ${risk.color}`}>{risk.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-gray-900">%{insight.confidence}</span>
                    {insight.adsets.length > 0 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                        className="text-[10px] text-primary flex items-center gap-0.5 hover:underline"
                      >
                        {insight.adsets.length} adset · {totalAds} reklam
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded: adset drill-down */}
                {isExpanded && insight.adsets.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    {insight.adsets.map(as => (
                      <div key={as.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-gray-800">{as.name}</span>
                          <span className="text-[9px] text-gray-400">{as.status}</span>
                        </div>
                        <div className="flex gap-3 text-[10px] text-gray-500">
                          <span>₺{as.metrics.spend.toFixed(0)}</span>
                          <span>{as.metrics.clicks} tık</span>
                          <span>CTR {(as.metrics.ctr * 100).toFixed(1)}%</span>
                        </div>
                        {/* Ads within adset */}
                        {as.ads.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {as.ads.slice(0, 5).map(ad => (
                              <div key={ad.id} className="flex items-center justify-between text-[9px] bg-white rounded px-2 py-1">
                                <span className="text-gray-600 truncate max-w-[60%]">{ad.name}</span>
                                <span className="text-gray-400">₺{ad.metrics.spend.toFixed(0)} · {(ad.metrics.ctr * 100).toFixed(1)}%</span>
                              </div>
                            ))}
                            {as.ads.length > 5 && <span className="text-[9px] text-gray-400 pl-2">+{as.ads.length - 5} reklam daha</span>}
                          </div>
                        )}
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
}
