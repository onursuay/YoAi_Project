'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Tabs from '@/components/Tabs'
import KpiDisplay from './KpiDisplay'
import AlertList from './AlertList'
import FunnelChart from './FunnelChart'
import QuickActions from './QuickActions'
import ScoreBadge from './ScoreBadge'
import type { OptimizationCampaign } from '@/lib/meta/optimization/types'

/** Safe translation helper — returns translated label or humanized fallback */
function safeT(t: ReturnType<typeof useTranslations>, key: string, rawEnum: string): string {
  try {
    const result = t(key)
    if (result.includes('.') && result.includes('dashboard.')) {
      return rawEnum.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }
    return result
  } catch {
    return rawEnum.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}

interface DetailPanelProps {
  campaign: OptimizationCampaign
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export default function DetailPanel({ campaign, onSuccess, onError }: DetailPanelProps) {
  const t = useTranslations('dashboard.optimizasyon')
  const [activeTab, setActiveTab] = useState('overview')

  const { scoreResult, kpiTemplate, insights, triple } = campaign
  const isSales = triple.objective === 'OUTCOME_SALES'

  const tabs = [
    { id: 'overview', label: t('tabs.overview') },
    { id: 'metrics', label: t('tabs.metrics') },
    ...(isSales ? [{ id: 'funnel', label: t('tabs.funnel') }] : []),
    { id: 'adsets', label: `${t('tabs.adsets')} (${campaign.adsets.length})` },
    { id: 'actions', label: t('tabs.actions') },
  ]

  return (
    <div className="bg-white border border-gray-200 border-t-0 rounded-b-2xl overflow-hidden">
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Gate Scores */}
            <div>
              <h4 className="text-ui font-medium text-gray-600 uppercase tracking-wider mb-3">{t('tabs.overview')}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['delivery', 'efficiency', 'quality', 'saturation'] as const).map((gate) => {
                  const g = scoreResult.gateResults[gate]
                  return (
                    <div key={gate} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                      <ScoreBadge score={g.score} status={scoreResult.status} size={40} />
                      <div>
                        <p className="text-ui text-gray-600">{t(`gates.${gate}`)}</p>
                        <p className={`text-sm font-semibold ${g.passed ? 'text-green-600' : 'text-red-500'}`}>
                          {g.score}/100
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Reasons */}
            {scoreResult.reasons.length > 0 && (
              <div>
                <h4 className="text-ui font-medium text-gray-600 uppercase tracking-wider mb-2">
                  {t('tabs.overview')}
                </h4>
                <ul className="space-y-1">
                  {scoreResult.reasons.map((reason, i) => {
                    const key = reason.split('.').pop() || reason
                    return (
                      <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full shrink-0" />
                        {t(`reasons.${key}`)}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Alerts */}
            {scoreResult.alerts.length > 0 && (
              <AlertList alerts={scoreResult.alerts} />
            )}

            {/* North Star KPI */}
            <KpiDisplay
              title={t('metrics.northStar')}
              metrics={[kpiTemplate.northStar]}
              insights={insights}
              currency={campaign.currency}
            />
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <KpiDisplay
              title={t('metrics.northStar')}
              metrics={[kpiTemplate.northStar]}
              insights={insights}
              currency={campaign.currency}
            />
            <KpiDisplay
              title={t('metrics.efficiencyMetrics')}
              metrics={kpiTemplate.efficiency}
              insights={insights}
              currency={campaign.currency}
            />
            <KpiDisplay
              title={t('metrics.volumeMetrics')}
              metrics={kpiTemplate.volume}
              insights={insights}
              currency={campaign.currency}
            />
            <KpiDisplay
              title={t('metrics.diagnosticMetrics')}
              metrics={kpiTemplate.diagnostics}
              insights={insights}
              currency={campaign.currency}
            />
          </div>
        )}

        {/* Funnel Tab (OUTCOME_SALES only) */}
        {activeTab === 'funnel' && isSales && (
          <FunnelChart insights={insights} />
        )}

        {/* Ad Sets Tab */}
        {activeTab === 'adsets' && (
          <div className="space-y-3">
            {campaign.adsets.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">{t('noData')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ui text-gray-600 border-b border-gray-200">
                      <th className="pb-2 pr-4 font-medium">Ad Set</th>
                      <th className="pb-2 pr-4 font-medium">{t('metrics.spend')}</th>
                      <th className="pb-2 pr-4 font-medium">{t('metrics.impressions')}</th>
                      <th className="pb-2 pr-4 font-medium">{t('metrics.ctr')}</th>
                      <th className="pb-2 pr-4 font-medium">{t('metrics.cpc')}</th>
                      <th className="pb-2 font-medium">{t('triple.optimizationGoal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.adsets.map((adset) => (
                      <tr key={adset.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${adset.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className="text-gray-900 truncate max-w-[200px]">{adset.name}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-gray-700">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: campaign.currency }).format(adset.insights.spend)}
                        </td>
                        <td className="py-2 pr-4 text-gray-700">{adset.insights.impressions.toLocaleString('tr-TR')}</td>
                        <td className="py-2 pr-4 text-gray-700">{adset.insights.ctr.toFixed(2)}%</td>
                        <td className="py-2 pr-4 text-gray-700">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: campaign.currency }).format(adset.insights.cpc)}
                        </td>
                        <td className="py-2 text-gray-600 text-ui">{safeT(t, `optimizationGoals.${adset.optimizationGoal}`, adset.optimizationGoal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            {/* Campaign actions */}
            <div>
              <h4 className="text-ui font-medium text-gray-600 uppercase tracking-wider mb-2">{campaign.name}</h4>
              <QuickActions
                entityType="campaign"
                entityId={campaign.id}
                entityName={campaign.name}
                currentStatus={campaign.status}
                currentBudget={campaign.dailyBudget || campaign.lifetimeBudget}
                budgetType={campaign.dailyBudget ? 'daily' : 'lifetime'}
                onSuccess={(action) => onSuccess?.(t(`toast.${action === 'budget_updated' ? 'budgetSuccess' : 'statusSuccess'}`))}
                onError={(msg) => onError?.(msg)}
              />
            </div>

            {/* Adset actions */}
            {campaign.adsets.map((adset) => (
              <div key={adset.id}>
                <h4 className="text-ui font-medium text-gray-600 mb-2">{adset.name}</h4>
                <QuickActions
                  entityType="adset"
                  entityId={adset.id}
                  entityName={adset.name}
                  currentStatus={adset.status}
                  currentBudget={adset.dailyBudget || adset.lifetimeBudget}
                  budgetType={adset.dailyBudget ? 'daily' : 'lifetime'}
                  onSuccess={(action) => onSuccess?.(t(`toast.${action === 'budget_updated' ? 'budgetSuccess' : 'statusSuccess'}`))}
                  onError={(msg) => onError?.(msg)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
