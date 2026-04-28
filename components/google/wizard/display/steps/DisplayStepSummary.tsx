'use client'

import { Flag, Globe, DollarSign, Users, Image as ImageIcon } from 'lucide-react'
import type { StepProps } from '../../shared/WizardTypes'
import { LANGUAGE_OPTIONS } from '../../shared/WizardTypes'
import { DisplaySection } from '../DisplayWizardUI'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-3 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-right text-gray-900">{value}</span>
    </div>
  )
}

export default function DisplayStepSummary({ state, update: _update, t }: StepProps) {
  void _update
  const langNames = state.languageIds
    .map(id => LANGUAGE_OPTIONS.find(l => l.id === id)?.name ?? id)
    .join(', ')

  const locParts: string[] = [
    ...state.locations.map(l => `${l.name}${l.isNegative ? ` (${t('location.excludedParens')})` : ''}`),
    ...state.proximityTargets.map(p => p.label ?? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} (${p.radiusMeters / 1000} km)`),
  ]
  const locSummary = locParts.length > 0
    ? locParts.join(', ')
    : state.geoSearchCountry === 'TR'
      ? t('display.locationTurkey')
      : t('display.locationAnywhere')

  const adGroupName = state.adGroupName.trim() || `${state.campaignName.trim() || ''} - ${t('adgroup.defaultNameFallback')}`.trim()

  const friendlyBidLabel = (() => {
    if (state.displayBiddingFocus === 'VIEWABLE_IMPRESSIONS') return t('display.focusViewableImpressions')
    if (state.displayBiddingFocus === 'CONVERSIONS') {
      return state.displayConversionsSub === 'TARGET_CPA'
        ? t('display.manualCpa')
        : t('display.maximizeConversions')
    }
    if (state.displayBiddingFocus === 'CONVERSION_VALUE') {
      return state.displayValueSub === 'TARGET_ROAS'
        ? t('display.targetRoas')
        : t('display.maximizeConversionValue')
    }
    return '—'
  })()

  const euLabel =
    state.euPoliticalAdsDeclaration === 'POLITICAL'
      ? t('settings.euPoliticalPolitical')
      : t('settings.euPoliticalNotPolitical')

  const headlineCount = state.displayHeadlines.map(h => h.trim()).filter(Boolean).length
  const descCount = state.displayDescriptions.map(d => d.trim()).filter(Boolean).length

  const audienceCount = state.selectedAudienceSegments.length

  const landscapeCount = state.displayAssets.filter(a => a.kind === 'MARKETING_IMAGE').length
  const squareCount = state.displayAssets.filter(a => a.kind === 'SQUARE_MARKETING_IMAGE').length
  const portraitCount = state.displayAssets.filter(a => a.kind === 'PORTRAIT_MARKETING_IMAGE').length
  const logoCount = state.displayAssets.filter(a => a.kind === 'LOGO' || a.kind === 'SQUARE_LOGO').length
  const videoCount = state.displayAssets.filter(a => a.kind === 'YOUTUBE_VIDEO').length

  return (
    <div className="space-y-6">
      <DisplaySection
        icon={<Flag className="w-[18px] h-[18px]" />}
        title={t('display.summaryCampaign')}
      >
        <div className="space-y-2.5">
          <Row label={t('campaign.name')} value={state.campaignName.trim() || '—'} />
          <Row label={t('display.summaryType')} value={t('display.campaignTypeDisplay')} />
          <Row label={t('display.summaryGoal')} value={t(`goal.labels.${state.campaignGoal}`)} />
          <Row
            label={t('conversion.title')}
            value={
              state.selectedConversionGoalIds.length > 0
                ? state.selectedConversionGoalIds.length === 1
                  ? (state.conversionActions.find(a => a.resourceName === state.selectedConversionGoalIds[0])?.name ?? '1')
                  : t('conversion.goalsSelected', { count: state.selectedConversionGoalIds.length })
                : '—'
            }
          />
        </div>
      </DisplaySection>

      <DisplaySection
        icon={<Globe className="w-[18px] h-[18px]" />}
        title={t('display.summaryGeoLangEu')}
      >
        <div className="space-y-2.5">
          <Row label={t('steps.location')} value={locSummary} />
          <Row label={t('location.languageTargetingTitle')} value={langNames || '—'} />
          <Row label={t('settings.euPoliticalTitle')} value={euLabel} />
        </div>
      </DisplaySection>

      <DisplaySection
        icon={<DollarSign className="w-[18px] h-[18px]" />}
        title={t('display.summaryBudgetBid')}
      >
        <div className="space-y-2.5">
          <Row label={t('campaign.dailyBudget')} value={state.dailyBudget ? `${state.dailyBudget} TRY` : '—'} />
          <Row
            label={t('display.summaryBidStrategy')}
            value={
              friendlyBidLabel +
              (state.displayBiddingFocus === 'CONVERSIONS' && state.displayConversionsSub === 'TARGET_CPA' && state.targetCpa
                ? ` — ${t('campaign.targetCpa')}: ${state.targetCpa}`
                : '') +
              (state.displayBiddingFocus === 'CONVERSION_VALUE' && state.displayValueSub === 'TARGET_ROAS' && state.targetRoas
                ? ` — ${t('campaign.targetRoas')}: ${state.targetRoas}`
                : '')
            }
          />
        </div>
      </DisplaySection>

      <DisplaySection
        icon={<Users className="w-[18px] h-[18px]" />}
        title={t('steps.audience')}
      >
        <div className="space-y-2.5">
          <Row label={t('display.summaryAudienceCount', { count: audienceCount })} value={String(audienceCount)} />
          <Row label={t('display.summaryOptimizedTargeting')} value={state.optimizedTargeting ? '✓' : '—'} />
        </div>
      </DisplaySection>

      <DisplaySection
        icon={<ImageIcon className="w-[18px] h-[18px]" />}
        title={t('display.summaryAd')}
      >
        <div className="space-y-2.5">
          <Row label={t('display.summaryAdGroup')} value={adGroupName || '—'} />
          <Row label={t('display.businessName')} value={state.displayBusinessName.trim() || '—'} />
          <Row label={t('display.summaryHeadlineCount')} value={String(headlineCount)} />
          <Row label={t('display.summaryDescriptionCount')} value={String(descCount)} />
          <Row
            label={t('display.summaryAssets')}
            value={t('display.summaryAssetsDetail', {
              landscape: landscapeCount,
              square: squareCount,
              portrait: portraitCount,
              logo: logoCount,
              video: videoCount,
            })}
          />
          {state.displayCallToAction && (
            <Row label={t('display.callToActionLabel')} value={state.displayCallToAction} />
          )}
        </div>
      </DisplaySection>
    </div>
  )
}
