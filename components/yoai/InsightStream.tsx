'use client'

import {
  AlertTriangle,
  TrendingUp,
  Eye,
  CheckCircle2,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import type { CampaignInsight, InsightStatus, RiskLevel } from '@/lib/yoai/commandCenter'

const STATUS_MAP: Record<InsightStatus, { label: string; color: string; bg: string }> = {
  monitoring: { label: 'Monitoring', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  review_needed: { label: 'Review Needed', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  ready_for_approval: { label: 'Ready for Approval', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
}

const RISK_MAP: Record<RiskLevel, { label: string; color: string; dot: string }> = {
  low: { label: 'Düşük', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  medium: { label: 'Orta', color: 'text-amber-600', dot: 'bg-amber-500' },
  high: { label: 'Yüksek', color: 'text-orange-600', dot: 'bg-orange-500' },
  critical: { label: 'Kritik', color: 'text-red-600', dot: 'bg-red-500' },
}

const PLATFORM_STYLE: Record<string, { bg: string; text: string }> = {
  Meta: { bg: 'bg-blue-50', text: 'text-blue-700' },
  Google: { bg: 'bg-red-50', text: 'text-red-700' },
}

interface Props {
  insights: CampaignInsight[]
  loading: boolean
}

export default function InsightStream({ insights, loading }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI Insight Stream</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Kampanya bazlı yapay zeka analiz sonuçları
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[160px] bg-white rounded-2xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Analiz edilecek kampanya bulunamadı.</p>
          <p className="text-xs text-gray-400 mt-1">Reklam platformlarınızı bağlayın ve aktif kampanyalarınız olduğundan emin olun.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => {
            const status = STATUS_MAP[insight.status] || STATUS_MAP.monitoring
            const risk = RISK_MAP[insight.riskLevel] || RISK_MAP.low
            const platform = PLATFORM_STYLE[insight.platform] || { bg: 'bg-gray-50', text: 'text-gray-700' }

            return (
              <div
                key={insight.id}
                className={`group relative bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-gray-100/80 transition-all duration-300 ${
                  insight.riskLevel === 'critical' ? 'ring-1 ring-red-200' : ''
                }`}
              >
                {/* Top row */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${platform.bg} ${platform.text}`}>
                    {insight.platform}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{insight.campaignName}</span>
                  <span className="text-[11px] text-gray-400 bg-gray-50 rounded px-1.5 py-0.5">
                    {insight.objective}
                  </span>
                  <div className="ml-auto">
                    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                      {insight.status === 'monitoring' && <Eye className="w-3 h-3 mr-1" />}
                      {insight.status === 'review_needed' && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {insight.status === 'ready_for_approval' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {status.label}
                    </span>
                  </div>
                </div>

                {/* Summary */}
                <p className="text-sm text-gray-600 leading-relaxed mb-3">{insight.summary}</p>

                {/* Metrics row (if available) */}
                {insight.metrics && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400 mb-3 pb-3 border-b border-gray-50">
                    {insight.metrics.spend != null && (
                      <span>Harcama: <strong className="text-gray-600">₺{insight.metrics.spend.toFixed(2)}</strong></span>
                    )}
                    {insight.metrics.impressions != null && (
                      <span>Gösterim: <strong className="text-gray-600">{insight.metrics.impressions.toLocaleString('tr-TR')}</strong></span>
                    )}
                    {insight.metrics.clicks != null && (
                      <span>Tıklama: <strong className="text-gray-600">{insight.metrics.clicks.toLocaleString('tr-TR')}</strong></span>
                    )}
                    {insight.metrics.ctr != null && (
                      <span>CTR: <strong className="text-gray-600">{(insight.metrics.ctr * 100).toFixed(2)}%</strong></span>
                    )}
                    {insight.metrics.roas != null && (
                      <span>ROAS: <strong className="text-gray-600">{insight.metrics.roas.toFixed(2)}x</strong></span>
                    )}
                  </div>
                )}

                {/* Bottom row */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        AI Önerisi
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{insight.recommendation}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 sm:pb-1">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 mb-1">Risk</p>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${risk.dot}`} />
                        <span className={`text-xs font-semibold ${risk.color}`}>{risk.label}</span>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 mb-1">Confidence</p>
                      <span className="text-sm font-bold text-gray-900">{insight.confidence}%</span>
                    </div>

                    <button className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
