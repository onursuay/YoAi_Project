'use client'

import { useTranslations, useLocale } from 'next-intl'
import CircularProgress from '@/components/CircularProgress'
import type { CampaignDetail } from '@/hooks/google/useGoogleCampaignDetail'
import { translateEnum } from '@/lib/yoai/translations'

const localeString = 'tr-TR'
const fmtCurrency = (n: number) => n.toLocaleString(localeString, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_KEYS: Record<string, string> = {
  ENABLED: 'statusEnabled',
  PAUSED: 'statusPaused',
  REMOVED: 'statusRemoved',
}

const SERVING_KEYS: Record<string, string> = {
  SERVING: 'servingServing',
  ENDED: 'servingEnded',
  PENDING: 'servingPending',
  SUSPENDED: 'servingSuspended',
  NONE: 'servingNone',
}

interface Props {
  detail: CampaignDetail
}

export default function CampaignOverviewTab({ detail }: Props) {
  const t = useTranslations('dashboard.google.detail.overview')
  const locale = useLocale() as 'tr' | 'en'
  const { campaign, metrics, diagnostics, adSummary } = detail

  return (
    <div className="p-6 space-y-6">
      {/* Top row: Optimization Score + Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Optimization Score Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-4">{t('optimizationScore')}</h3>
          <div className="flex items-center justify-center">
            {campaign.optimizationScore != null ? (
              <CircularProgress percentage={campaign.optimizationScore} size={80} />
            ) : (
              <span className="text-gray-400 text-sm">{t('scoreUnavailable')}</span>
            )}
          </div>
        </div>

        {/* Mini Diagnostics Health Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-500 mb-3">{t('statusAssessment')}</h3>
          {diagnostics.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm">{t('noIssues')}</span>
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
              <span>{t('totalAds', { count: adSummary.totalAds })}</span>
              {adSummary.disapprovedAds > 0 && (
                <span className="text-red-600 ml-2">{t('disapprovedAds', { count: adSummary.disapprovedAds })}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Campaign Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-500 mb-4">{t('campaignInfo')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoItem label={t('status')} value={STATUS_KEYS[campaign.status] ? t(STATUS_KEYS[campaign.status]) : campaign.status} />
          <InfoItem label={t('servingStatus')} value={SERVING_KEYS[campaign.servingStatus] ? t(SERVING_KEYS[campaign.servingStatus]) : campaign.servingStatus} />
          <InfoItem label={t('biddingStrategy')} value={campaign.biddingStrategyType ? translateEnum(campaign.biddingStrategyType, locale, 'google') : '—'} />
          <InfoItem
            label={t('dailyBudget')}
            value={campaign.budget != null ? `${fmtCurrency(campaign.budget)} TRY` : '—'}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-500 mb-4">{t('performanceSummary')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label={t('spent')} value={`${fmtCurrency(metrics.cost)} TRY`} />
          <MetricCard label={t('clicks')} value={metrics.clicks.toLocaleString(localeString)} />
          <MetricCard label={t('impressions')} value={metrics.impressions.toLocaleString(localeString)} />
          <MetricCard label={t('conversions')} value={metrics.conversions.toLocaleString(localeString)} />
          <MetricCard label="CTR" value={`${metrics.ctr.toFixed(2)}%`} />
          <MetricCard label={t('avgCpc')} value={`${fmtCurrency(metrics.cpc)} TRY`} />
          <MetricCard label="ROAS" value={metrics.roas != null && metrics.roas > 0 ? `${metrics.roas.toFixed(1)}x` : '—'} />
          <MetricCard label={t('conversionValue')} value={`${fmtCurrency(metrics.conversionsValue)} TRY`} />
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
