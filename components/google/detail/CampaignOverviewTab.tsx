'use client'

import CircularProgress from '@/components/CircularProgress'
import type { CampaignDetail } from '@/hooks/google/useGoogleCampaignDetail'

const localeString = 'tr-TR'
const fmtCurrency = (n: number) => n.toLocaleString(localeString, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const statusLabels: Record<string, string> = {
  ENABLED: 'Aktif',
  PAUSED: 'Duraklatıldı',
  REMOVED: 'Kaldırıldı',
}

const servingStatusLabels: Record<string, string> = {
  SERVING: 'Yayında',
  ENDED: 'Sona Erdi',
  PENDING: 'Beklemede',
  SUSPENDED: 'Askıda',
  NONE: '—',
}

const biddingLabels: Record<string, string> = {
  MAXIMIZE_CLICKS: 'Tıklamaları Maksimize Et',
  MAXIMIZE_CONVERSIONS: 'Dönüşümleri Maksimize Et',
  TARGET_CPA: 'Hedef EBM',
  TARGET_ROAS: 'Hedef ROAS',
  MANUAL_CPC: 'Manuel TBM',
  MAXIMIZE_CONVERSION_VALUE: 'Dönüşüm Değerini Maksimize Et',
  TARGET_SPEND: 'Hedef Harcama',
}

interface Props {
  detail: CampaignDetail
}

export default function CampaignOverviewTab({ detail }: Props) {
  const { campaign, metrics, diagnostics, adSummary } = detail

  return (
    <div className="p-6 space-y-6">
      {/* Top row: Optimization Score + Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Optimization Score Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Optimizasyon Skoru</h3>
          <div className="flex items-center justify-center">
            {campaign.optimizationScore != null ? (
              <CircularProgress percentage={campaign.optimizationScore} size={80} />
            ) : (
              <span className="text-gray-400 text-sm">Skor mevcut değil</span>
            )}
          </div>
        </div>

        {/* Mini Diagnostics Health Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Durum Değerlendirmesi</h3>
          {diagnostics.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm">Herhangi bir sorun tespit edilmedi.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {diagnostics.map((d) => (
                <div
                  key={d.code}
                  className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
                    d.type === 'error' ? 'bg-red-50 text-red-700' :
                    d.type === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-blue-50 text-blue-700'
                  }`}
                >
                  <span className="mt-0.5">
                    {d.type === 'error' ? '●' : d.type === 'warning' ? '▲' : 'ℹ'}
                  </span>
                  <span>{d.message}</span>
                </div>
              ))}
            </div>
          )}
          {/* Ad Summary */}
          {adSummary.totalAds > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
              <span>Toplam {adSummary.totalAds} reklam</span>
              {adSummary.disapprovedAds > 0 && (
                <span className="text-red-600 ml-2">({adSummary.disapprovedAds} onaylanmadı)</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Campaign Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Kampanya Bilgileri</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoItem label="Durum" value={statusLabels[campaign.status] || campaign.status} />
          <InfoItem label="Yayın Durumu" value={servingStatusLabels[campaign.servingStatus] || campaign.servingStatus} />
          <InfoItem label="Teklif Stratejisi" value={biddingLabels[campaign.biddingStrategyType] || campaign.biddingStrategyType} />
          <InfoItem
            label="Günlük Bütçe"
            value={campaign.budget != null ? `${fmtCurrency(campaign.budget)} TRY` : '—'}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Performans Özeti</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Harcanan" value={`${fmtCurrency(metrics.cost)} TRY`} />
          <MetricCard label="Tıklamalar" value={metrics.clicks.toLocaleString(localeString)} />
          <MetricCard label="Gösterim" value={metrics.impressions.toLocaleString(localeString)} />
          <MetricCard label="Dönüşüm" value={metrics.conversions.toLocaleString(localeString)} />
          <MetricCard label="CTR" value={`${metrics.ctr.toFixed(2)}%`} />
          <MetricCard label="Ort. TBM" value={`${fmtCurrency(metrics.cpc)} TRY`} />
          <MetricCard label="ROAS" value={metrics.roas != null && metrics.roas > 0 ? `${metrics.roas.toFixed(1)}x` : '—'} />
          <MetricCard label="Dönüşüm Değeri" value={`${fmtCurrency(metrics.conversionsValue)} TRY`} />
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}
