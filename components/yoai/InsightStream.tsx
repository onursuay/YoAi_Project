'use client'

import { AlertTriangle, Eye, CheckCircle2, Inbox, ChevronDown, ChevronUp, ScanSearch } from 'lucide-react'
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
  review_needed: 'text-gray-700 bg-gray-50 border-gray-200',
  ready_for_approval: 'text-emerald-700 bg-emerald-50 border-emerald-200',
}

const RISK_DOT: Record<RiskLevel, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-gray-500',
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

  const criticalCount = activeCampaigns.filter(c => c.riskLevel === 'critical').length
  const highCount = activeCampaigns.filter(c => c.riskLevel === 'high').length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      {/* Header — matches DailyBriefing language */}
      <div className="mb-5">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Kampanya İzleme</p>
        <h2 className="text-base font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5"><ScanSearch className="w-4 h-4 text-primary" />AI Kampanya Analizi</h2>
        <p className="text-[11px] text-gray-400 mt-1">
          {activeCampaigns.length} aktif kampanya izleniyor
          {criticalCount > 0 && <span className="text-red-500 font-medium"> · {criticalCount} kritik</span>}
          {highCount > 0 && <span className="text-orange-500 font-medium"> · {highCount} yüksek risk</span>}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-[100px] bg-gray-50 rounded-xl animate-pulse" />)}
        </div>
      ) : activeCampaigns.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Aktif kampanya bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeCampaigns.map(c => {
            const isExpanded = expandedId === c.id
            const status = c.insightStatus || 'monitoring'
            const activeAdsets = c.adsets.filter(as => as.status === 'ACTIVE' || as.status === 'ENABLED')
            const activeAds = activeAdsets.reduce((s, as) => s + as.ads.filter(ad => ad.status === 'ACTIVE' || ad.status === 'ENABLED').length, 0)

            const riskBorder = c.riskLevel === 'critical' ? 'border-l-red-500' : c.riskLevel === 'high' ? 'border-l-orange-400' : c.riskLevel === 'medium' ? 'border-l-gray-400' : 'border-l-emerald-400'
            const riskBg = c.riskLevel === 'critical' ? 'bg-red-50/40' : c.riskLevel === 'high' ? 'bg-orange-50/30' : ''

            return (
              <div key={c.id} className={`rounded-xl border border-gray-100 transition-all overflow-hidden ${riskBg}`}>
                {/* Campaign card row */}
                <div className={`border-l-[3px] ${riskBorder}`}>
                  <div
                    className="px-4 py-3.5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    {/* Top line: Platform + Name + Status */}
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${c.platform === 'Meta' ? 'bg-blue-100/70 text-blue-700' : 'bg-red-100/70 text-red-700'}`}>
                        {c.platform}
                      </span>
                      <p className="text-[13px] font-medium text-gray-900 truncate flex-1">{c.campaignName}</p>
                      <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border shrink-0 hidden sm:inline-flex items-center gap-1 ${STATUS_COLOR[status]}`}>
                        {status === 'monitoring' && <Eye className="w-2.5 h-2.5" />}
                        {status === 'review_needed' && <AlertTriangle className="w-2.5 h-2.5" />}
                        {status === 'ready_for_approval' && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {STATUS_LABEL[status]}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                    </div>

                    {/* Middle line: Objective + Score + Risk */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] text-gray-400">{OBJECTIVE_TR[c.objective] || c.objective}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className={`text-[10px] font-semibold ${c.score >= 70 ? 'text-emerald-600' : c.score >= 50 ? 'text-gray-600' : 'text-red-600'}`}>
                        {c.score}/100
                      </span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[c.riskLevel]}`} />
                        <span className={`text-[10px] font-medium ${c.riskLevel === 'critical' ? 'text-red-600' : c.riskLevel === 'high' ? 'text-orange-600' : 'text-gray-500'}`}>
                          {RISK_LABEL[c.riskLevel]}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-300 hidden lg:inline">·</span>
                      <span className="text-[10px] text-gray-400 hidden lg:inline">{activeAdsets.length} set · {activeAds} reklam</span>
                    </div>

                    {/* Bottom line: Metrics row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] bg-gray-100/80 text-gray-600 px-2 py-0.5 rounded-md font-medium">₺{c.metrics.spend.toFixed(0)}</span>
                      <span className="text-[10px] bg-gray-100/80 text-gray-600 px-2 py-0.5 rounded-md">{c.metrics.clicks} tık</span>
                      <span className="text-[10px] bg-gray-100/80 text-gray-600 px-2 py-0.5 rounded-md">%{(c.metrics.ctr * 100).toFixed(1)} TO</span>
                      {c.metrics.roas != null && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${c.metrics.roas >= 2 ? 'bg-emerald-50 text-emerald-700' : c.metrics.roas >= 1 ? 'bg-gray-50 text-gray-700' : 'bg-red-50 text-red-600'}`}>
                          {c.metrics.roas.toFixed(1)}x ROAS
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI recommendation — subtle bar */}
                  {c.recommendation && !isExpanded && (
                    <div className="px-4 pb-3 -mt-1">
                      <div className="bg-primary/[0.04] rounded-lg px-3 py-2">
                        <p className="text-[11px] text-gray-600 leading-relaxed truncate">
                          <span className="text-primary font-medium">AI Öneri:</span> {c.recommendation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded: detail panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50/40">
                    {/* AI summary + recommendation */}
                    {(c.summary || c.recommendation) && (
                      <div className="bg-white rounded-xl p-4 border border-gray-100">
                        {c.summary && <p className="text-[12px] text-gray-600 leading-relaxed mb-2">{c.summary}</p>}
                        {c.recommendation && (
                          <div className="bg-primary/[0.04] rounded-lg px-3 py-2">
                            <p className="text-[12px] text-gray-700 leading-relaxed">
                              <span className="text-primary font-semibold">Öneri:</span> {c.recommendation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mobile metrics */}
                    <div className="flex gap-2 flex-wrap text-[11px] text-gray-500 md:hidden">
                      <span className="bg-white rounded-md px-2.5 py-1 border border-gray-100">Harcama: ₺{c.metrics.spend.toFixed(0)}</span>
                      <span className="bg-white rounded-md px-2.5 py-1 border border-gray-100">Tıklama: {c.metrics.clicks}</span>
                      <span className="bg-white rounded-md px-2.5 py-1 border border-gray-100">TO: %{(c.metrics.ctr * 100).toFixed(1)}</span>
                    </div>

                    {/* Adsets */}
                    {activeAdsets.map(as => {
                      const adsInSet = as.ads.filter(ad => ad.status === 'ACTIVE' || ad.status === 'ENABLED')
                      return (
                        <div key={as.id} className="bg-white rounded-xl p-4 border border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[12px] font-medium text-gray-800 truncate">{as.name}</span>
                            <div className="flex gap-2 shrink-0">
                              <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">₺{as.metrics.spend.toFixed(0)}</span>
                              <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">{as.metrics.clicks} tık</span>
                              <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">%{(as.metrics.ctr * 100).toFixed(1)}</span>
                            </div>
                          </div>
                          {adsInSet.length > 0 && (
                            <div className="space-y-1.5 mt-2.5">
                              {adsInSet.map(ad => (
                                <div key={ad.id} className="flex items-center justify-between text-[10px] bg-gray-50/80 rounded-lg px-3 py-2">
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
