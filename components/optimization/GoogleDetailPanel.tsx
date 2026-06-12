'use client'

/* Google/TikTok Optimizasyon — detay paneli (Meta DetailPanel muadili).
   4 kapılı skor kırılımı (Teslimat/Verim/Kalite/Doygunluk) + tüm metrikler +
   ad grupları + tespit edilen sorunlar. Renk paleti proje kuralına uyar
   (amber/sarı YOK: pass=emerald, warn=gri, fail=kırmızı). */

import { useTranslations, useLocale } from 'next-intl'
import { translateEnum } from '@/lib/yoai/translations'
import { problemLabel } from '@/lib/google/optimization/labels'
import type { Gate } from '@/lib/google/optimization/gates'
import type { GoogleOptimizationCampaign } from '@/lib/google/optimization/types'

interface Props {
  campaign: GoogleOptimizationCampaign
}

function gateColor(status: Gate['status']): { bar: string; text: string } {
  if (status === 'pass') return { bar: 'bg-emerald-500', text: 'text-emerald-700' }
  if (status === 'fail') return { bar: 'bg-red-500', text: 'text-red-700' }
  return { bar: 'bg-gray-400', text: 'text-gray-600' } // warn → nötr gri
}

function fmtCurrency(v: number, currency: string): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}
function fmtNum(v: number): string {
  return new Intl.NumberFormat('tr-TR').format(Math.round(v))
}

export default function GoogleDetailPanel({ campaign }: Props) {
  const t = useTranslations('dashboard.optimizasyon.googleDetail')
  const locale = useLocale() as 'tr' | 'en'
  const m = campaign.metrics
  const gates: Gate[] = campaign.gates
    ? [campaign.gates.delivery, campaign.gates.efficiency, campaign.gates.quality, campaign.gates.saturation]
    : []

  const metrics = [
    { label: t('metrics.spend'), value: fmtCurrency(m.spend, campaign.currency) },
    { label: t('metrics.impressions'), value: fmtNum(m.impressions) },
    { label: t('metrics.clicks'), value: fmtNum(m.clicks) },
    { label: 'CTR', value: `${m.ctr.toFixed(2)}%` },
    { label: t('metrics.cpc'), value: fmtCurrency(m.cpc, campaign.currency) },
    { label: t('metrics.conversions'), value: fmtNum(m.conversions) },
    { label: 'ROAS', value: m.roas != null ? `${m.roas.toFixed(2)}x` : '—' },
    { label: t('metrics.reach'), value: m.reach != null ? fmtNum(m.reach) : '—' },
  ]

  const channel = campaign.channelType ? translateEnum(campaign.channelType, locale, 'google') : null
  const bidding = campaign.biddingStrategy ? translateEnum(campaign.biddingStrategy, locale, 'google') : null

  return (
    <div className="mt-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* 4 kapılı skor kırılımı */}
      {gates.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">{t('scoreBreakdown')}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {gates.map((g) => {
              const c = gateColor(g.status)
              return (
                <div key={g.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{g.label}</span>
                    <span className={`text-xs font-semibold ${c.text}`}>{g.score}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${g.score}%` }} />
                  </div>
                  {g.note && <p className="text-[10px] text-gray-400 mt-1 leading-tight">{g.note}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Metrikler */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">{t('metricsLast7Days')}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2.5 gap-x-4">
          {metrics.map((mt) => (
            <div key={mt.label}>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{mt.label}</p>
              <p className="text-sm font-semibold text-gray-800">{mt.value}</p>
            </div>
          ))}
        </div>
        {(channel || bidding || campaign.dailyBudget != null || campaign.optimizationScore != null) && (
          <div className="flex flex-wrap gap-3 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100">
            {channel && <span>{t('channel')}: <span className="font-medium text-gray-800">{channel}</span></span>}
            {bidding && <span>{t('bidding')}: <span className="font-medium text-gray-800">{bidding}</span></span>}
            {campaign.dailyBudget != null && <span>{t('dailyBudget')}: <span className="font-medium text-gray-800">{fmtCurrency(campaign.dailyBudget, campaign.currency)}</span></span>}
            {campaign.optimizationScore != null && <span>{t('optimizationScore')}: <span className="font-medium text-gray-800">%{Math.round(campaign.optimizationScore)}</span></span>}
          </div>
        )}
      </div>

      {/* Sorunlar */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">{t('detectedIssues')}</p>
        {campaign.problemTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {campaign.problemTags.map((tag, i) => (
              <span
                key={i}
                className={`text-[11px] px-2 py-1 rounded-md border ${
                  tag.severity === 'critical'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : tag.severity === 'warning'
                      ? 'bg-primary/5 text-primary border-primary/20'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}
              >
                {problemLabel(tag.id)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-emerald-700">{t('noIssuesDetected')}</p>
        )}
        <p className="text-[11px] text-gray-400 mt-2">{t('scanHint')}</p>
      </div>

      {/* Ad grupları (varsa) */}
      {campaign.adsets.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">{t('adGroups', { count: campaign.adsets.length })}</p>
          <div className="space-y-1.5">
            {campaign.adsets.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate mr-3">{a.name}</span>
                <span className="text-gray-500 shrink-0">
                  {fmtCurrency(a.metrics.spend, campaign.currency)} · {t('clicksShort', { count: fmtNum(a.metrics.clicks) })} · {a.metrics.ctr.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
