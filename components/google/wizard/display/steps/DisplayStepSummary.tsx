'use client'

import type { StepProps } from '../../shared/WizardTypes'
import { LANGUAGE_OPTIONS } from '../../shared/WizardTypes'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-2">{title}</h4>
      <div className="text-[13px] text-gray-700 space-y-1">{children}</div>
    </div>
  )
}

export default function DisplayStepSummary({ state, update: _update, t }: StepProps) {
  void _update
  const langNames = state.languageIds
    .map(id => LANGUAGE_OPTIONS.find(l => l.id === id)?.name ?? id)
    .join(', ')

  const locSummary =
    state.displayLocationMode === 'ALL'
      ? t('display.locationAll')
      : state.displayLocationMode === 'TURKEY'
        ? t('display.locationTurkey')
        : state.locations.map(l => `${l.name}${l.isNegative ? ` (${t('location.excludedParens')})` : ''}`).join(', ') || '—'

  const euLabel =
    state.euPoliticalAdsDeclaration === 'POLITICAL'
      ? t('settings.euPoliticalPolitical')
      : t('settings.euPoliticalNotPolitical')

  const headlineCount = state.displayHeadlines.map(h => h.trim()).filter(Boolean).length
  const descCount = state.displayDescriptions.map(d => d.trim()).filter(Boolean).length

  const audienceCount = state.selectedAudienceSegments.length

  return (
    <div className="space-y-4">
      <Card title={t('display.summaryCampaign')}>
        <p>
          <span className="text-gray-500">{t('campaign.name')}: </span>
          {state.campaignName.trim() || '—'}
        </p>
        <p>
          <span className="text-gray-500">{t('display.summaryType')}: </span>
          {t('display.campaignTypeDisplay')}
        </p>
        <p>
          <span className="text-gray-500">{t('display.summaryGoal')}: </span>
          {t(`goal.labels.${state.campaignGoal}`)}
        </p>
        <p>
          <span className="text-gray-500">{t('conversion.title')}: </span>
          {state.selectedConversionGoalIds.length > 0
            ? state.selectedConversionGoalIds.length === 1
              ? (state.conversionActions.find(a => a.resourceName === state.selectedConversionGoalIds[0])?.name ?? '1')
              : t('conversion.goalsSelected', { count: state.selectedConversionGoalIds.length })
            : '—'}
        </p>
      </Card>

      <Card title={t('display.summaryGeoLangEu')}>
        <p>
          <span className="text-gray-500">{t('steps.location')}: </span>
          {locSummary}
        </p>
        <p>
          <span className="text-gray-500">{t('location.languageTargetingTitle')}: </span>
          {langNames || '—'}
        </p>
        <p>
          <span className="text-gray-500">{t('settings.euPoliticalTitle')}: </span>
          {euLabel}
        </p>
      </Card>

      <Card title={t('display.summaryBudgetBid')}>
        <p>
          <span className="text-gray-500">{t('campaign.dailyBudget')}: </span>
          {state.dailyBudget ? `${state.dailyBudget} TRY` : '—'}
        </p>
        <p>
          <span className="text-gray-500">{t('display.summaryBidStrategy')}: </span>
          {state.biddingStrategy}
          {state.displayBiddingFocus === 'CONVERSIONS' && state.displayConversionsSub === 'TARGET_CPA' && state.targetCpa
            ? ` — ${t('campaign.targetCpa')}: ${state.targetCpa}`
            : ''}
          {state.displayBiddingFocus === 'CONVERSION_VALUE' && state.displayValueSub === 'TARGET_ROAS' && state.targetRoas
            ? ` — ${t('campaign.targetRoas')}: ${state.targetRoas}`
            : ''}
        </p>
      </Card>

      <Card title={t('steps.audience')}>
        <p>
          {t('display.summaryAudienceCount', { count: audienceCount })}
        </p>
      </Card>

      <Card title={t('display.summaryAd')}>
        <p>
          <span className="text-gray-500">{t('display.businessName')}: </span>
          {state.displayBusinessName.trim() || '—'}
        </p>
        <p>
          <span className="text-gray-500">{t('display.summaryHeadlineCount')}: </span>
          {headlineCount}
        </p>
        <p>
          <span className="text-gray-500">{t('display.summaryDescriptionCount')}: </span>
          {descCount}
        </p>
      </Card>
    </div>
  )
}
