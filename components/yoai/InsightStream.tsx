'use client'

import { AlertTriangle, Eye, CheckCircle2, Inbox, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { DeepCampaignInsight, InsightStatus, RiskLevel } from '@/lib/yoai/analysisTypes'

type CampaignWithAI = DeepCampaignInsight & {
  summary: string
  recommendation: string
  confidence: number
  insightStatus: InsightStatus
}

const STATUS_LABEL: Record<InsightStatus, string> = {
  monitoring: 'İzleniyor',
  review_needed: 'İnceleme Gerekli',
  ready_for_approval: 'Onaya Hazır',
}

const STATUS_COLOR: Record<InsightStatus, string> = {
  monitoring: 'text-blue-700 bg-blue-50 border-blue-200',
  review_needed: 'text-amber-700 bg-amber-50 border-amber-200',
  ready_for_approval: 'text-emerald-700 bg-emerald-50 border-emerald-200',
}

const RISK_DOT: Record<RiskLevel, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
}

const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  critical: 'Kritik',
}

const OBJECTIVE_TR: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Trafik', OUTCOME_AWARENESS: 'Bilinirlik', OUTCOME_ENGAGEMENT: 'Etkileşim',
  OUTCOME_LEADS: 'Potansiyel Müşteri', OUTCOME_SALES: 'Satış', OUTCOME_APP_PROMOTION: 'Uygulama',
  SEARCH: 'Arama', DISPLAY: 'Görüntülü', VIDEO: 'Video', PERFORMANCE_MAX: 'Performans Max', SHOPPING: 'Alışveriş',
}

interface Props {
  insights: CampaignWithAI[]
  loading: boolean
}

export default function InsightStream({ insights, loading }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const activeCampaigns = insights.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI Kampanya Analizi</h2>
          <p className="text-xs text-gray-400 mt-0.5">{activeCampaigns.length} aktif kampanya</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-[100px] bg-white rounded-xl border border-gray-100 animate-pulse" />)}
        </div>
      ) : activeCampaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Aktif kampanya bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeCampaigns.map(c => {
            const isExpanded = expandedId === c.id
            const status = c.insightStatus || 'monitoring'
            const activeAdsets = c.adsets.filter(as => as.status === 'ACTIVE' || as.status === 'ENABLED')
            const activeAds = activeAdsets.reduce((s, as) => s + as.ads.filter(ad => ad.status === 'ACTIVE' || ad.status === 'ENABLED').length, 0)

            return (
              <div key={c.id} className={`bg-white rounded-xl border transition-all ${c.riskLevel === 'critical' ? 'border-red-200' : 'border-gray-100'}`}>
                {/* Main row — always visible */}
                <div className="flex items-center gap-4 px-4 py-3">
                  {/* Platform badge */}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${c.platform === 'Meta' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                    {c.platform}
                  </span>

                  {/* Campaign name + objective */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.campaignName}</p>
                    <p className="text-[10px] text-gray-400">{OBJECTIVE_TR[c.objective] || c.objective} · Puan: {c.score}/100</p>
                  </div>

                  {/* Metrics — compact */}
                  <div className="hidden md:flex items-center gap-4 text-[11px] text-gray-500 shrink-0">
                    <span>₺{c.metrics.spend.toFixed(0)}</span>
                    <span>{c.metrics.clicks} tık</span>
                    <span>%{(c.metrics.ctr * 100).toFixed(1)} TO</span>
                    {c.metrics.roas != null && <span>{c.metrics.roas.toFixed(1)}x</span>}
                  </div>

                  {/* Risk indicator */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${RISK_DOT[c.riskLevel]}`} />
                    <span className={`text-[10px] font-medium ${c.riskLevel === 'critical' ? 'text-red-600' : c.riskLevel === 'high' ? 'text-orange-600' : 'text-gray-500'}`}>
                      {RISK_LABEL[c.riskLevel]}
                    </span>
                  </div>

                  {/* Status */}
                  <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border shrink-0 hidden sm:inline-flex items-center gap-1 ${STATUS_COLOR[status]}`}>
                    {status === 'monitoring' && <Eye className="w-2.5 h-2.5" />}
                    {status === 'review_needed' && <AlertTriangle className="w-2.5 h-2.5" />}
                    {status === 'ready_for_approval' && <CheckCircle2 className="w-2.5 h-2.5" />}
                    {STATUS_LABEL[status]}
                  </span>

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    className="text-[10px] text-gray-400 hover:text-primary flex items-center gap-1 shrink-0"
                  >
                    <span className="hidden lg:inline">{activeAdsets.length} set · {activeAds} reklam</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* AI recommendation — compact bar */}
                {c.recommendation && !isExpanded && (
                  <div className="px-4 pb-3 -mt-1">
                    <p className="text-[11px] text-gray-500 truncate">
                      <span className="text-primary font-medium">Öneri:</span> {c.recommendation}
                    </p>
                  </div>
                )}

                {/* Expanded: adsets + ads */}
                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 py-3 space-y-2 bg-gray-50/50">
                    {/* AI summary + recommendation */}
                    {(c.summary || c.recommendation) && (
                      <div className="bg-white rounded-lg p-3 mb-2">
                        {c.summary && <p className="text-xs text-gray-600 mb-1">{c.summary}</p>}
                        {c.recommendation && <p className="text-xs text-primary"><span className="font-medium">Öneri:</span> {c.recommendation}</p>}
                      </div>
                    )}

                    {/* Mobile metrics */}
                    <div className="flex gap-3 text-[11px] text-gray-500 md:hidden mb-2">
                      <span>Harcama: ₺{c.metrics.spend.toFixed(0)}</span>
                      <span>Tıklama: {c.metrics.clicks}</span>
                      <span>TO: %{(c.metrics.ctr * 100).toFixed(1)}</span>
                    </div>

                    {/* Adsets */}
                    {activeAdsets.map(as => {
                      const adsInSet = as.ads.filter(ad => ad.status === 'ACTIVE' || ad.status === 'ENABLED')
                      return (
                        <div key={as.id} className="bg-white rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-medium text-gray-800 truncate">{as.name}</span>
                            <div className="flex gap-3 text-[10px] text-gray-400 shrink-0">
                              <span>₺{as.metrics.spend.toFixed(0)}</span>
                              <span>{as.metrics.clicks} tık</span>
                              <span>%{(as.metrics.ctr * 100).toFixed(1)}</span>
                            </div>
                          </div>
                          {adsInSet.length > 0 && (
                            <div className="space-y-1 mt-2">
                              {adsInSet.map(ad => (
                                <div key={ad.id} className="flex items-center justify-between text-[10px] bg-gray-50 rounded px-2.5 py-1.5">
                                  <span className="text-gray-600 truncate max-w-[55%]">{ad.name}</span>
                                  <div className="flex gap-2 text-gray-400 shrink-0">
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
