'use client'

import {
  AlertTriangle,
  TrendingUp,
  Eye,
  CheckCircle2,
  Inbox,
} from 'lucide-react'
import type { CampaignInsight, InsightStatus, RiskLevel } from '@/lib/yoai/commandCenter'

const STATUS_MAP: Record<InsightStatus, { label: string; color: string; bg: string }> = {
  monitoring: { label: 'İzleniyor', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  review_needed: { label: 'İnceleme Gerekli', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  ready_for_approval: { label: 'Onaya Hazır', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
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
          <h2 className="text-lg font-semibold text-gray-900">AI Kampanya Analizi</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Kampanya bazlı yapay zeka analiz sonuçları
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[260px] bg-white rounded-2xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Analiz edilecek kampanya bulunamadı.</p>
          <p className="text-xs text-gray-400 mt-1">Reklam platformlarınızı bağlayın ve aktif kampanyalarınız olduğundan emin olun.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((insight) => {
            const status = STATUS_MAP[insight.status] || STATUS_MAP.monitoring
            const risk = RISK_MAP[insight.riskLevel] || RISK_MAP.low
            const platform = PLATFORM_STYLE[insight.platform] || { bg: 'bg-gray-50', text: 'text-gray-700' }

            return (
              <div
                key={insight.id}
                className={`group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-gray-100/80 transition-all duration-300 flex flex-col ${
                  insight.riskLevel === 'critical' ? 'ring-1 ring-red-200' : ''
                }`}
              >
                {/* Header: platform + status */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${platform.bg} ${platform.text}`}>
                    {insight.platform}
                  </span>
                  <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                    {insight.status === 'monitoring' && <Eye className="w-3 h-3 mr-1" />}
                    {insight.status === 'review_needed' && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {insight.status === 'ready_for_approval' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {status.label}
                  </span>
                </div>

                {/* Campaign name */}
                <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">{insight.campaignName}</h3>
                <span className="text-[10px] text-gray-400 mb-3">{insight.objective}</span>

                {/* Summary */}
                <p className="text-xs text-gray-600 leading-relaxed mb-3 flex-1 line-clamp-3">{insight.summary}</p>

                {/* Metrics */}
                {insight.metrics && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-400 mb-3 pb-3 border-b border-gray-50">
                    {insight.metrics.spend != null && (
                      <span>Harcama: <strong className="text-gray-600">₺{insight.metrics.spend.toFixed(0)}</strong></span>
                    )}
                    {insight.metrics.clicks != null && (
                      <span>Tıklama: <strong className="text-gray-600">{insight.metrics.clicks.toLocaleString('tr-TR')}</strong></span>
                    )}
                    {insight.metrics.ctr != null && (
                      <span>CTR: <strong className="text-gray-600">{(insight.metrics.ctr * 100).toFixed(1)}%</strong></span>
                    )}
                    {insight.metrics.roas != null && (
                      <span>ROAS: <strong className="text-gray-600">{insight.metrics.roas.toFixed(1)}x</strong></span>
                    )}
                  </div>
                )}

                {/* AI Recommendation */}
                <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">AI Önerisi</span>
                  </div>
                  <p className="text-xs text-gray-700 line-clamp-2">{insight.recommendation}</p>
                </div>

                {/* Risk + Confidence footer */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${risk.dot}`} />
                    <span className={`text-[11px] font-semibold ${risk.color}`}>{risk.label} Risk</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-900">%{insight.confidence}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
