'use client'

import { Flag, Settings2, DollarSign, Users, Image as ImageIcon, ClipboardList, CheckCircle2, XCircle } from 'lucide-react'
import type { WizardState } from '../shared/WizardTypes'
import { LANGUAGE_OPTIONS } from '../shared/WizardTypes'
import { DisplaySidebarCard, DisplaySidebarRow } from './DisplayWizardUI'

interface Props {
  state: WizardState
  currentStep: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}

export default function DisplaySidebar({ state, currentStep, t }: Props) {
  const notSet = '—'

  // Step 0 — Conversion & Name
  const campaignNameComplete = state.campaignName.trim().length > 0
  const conversionGoalCount = state.selectedConversionGoalIds.length

  // Step 1 — Campaign Settings
  const langNames = state.languageIds
    .map(id => LANGUAGE_OPTIONS.find(l => l.id === id)?.name ?? id)
    .join(', ')
  const locParts = [
    ...state.locations.map(l => `${l.name}${l.isNegative ? ` (${t('location.excludedParens')})` : ''}`),
    ...state.proximityTargets.map(p => p.label ?? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`),
  ]
  const locSummary = locParts.length > 0
    ? (locParts.length > 2 ? `${locParts.slice(0, 2).join(', ')} +${locParts.length - 2}` : locParts.join(', '))
    : (state.geoSearchCountry === 'TR' ? t('display.locationTurkey') : t('display.locationAnywhere'))
  const settingsComplete = state.languageIds.length > 0

  // Step 2 — Budget & Bidding
  const budgetSet = !!state.dailyBudget && Number(state.dailyBudget) > 0
  const friendlyBidLabel = (() => {
    if (state.displayBiddingFocus === 'VIEWABLE_IMPRESSIONS') return t('display.focusViewableImpressions')
    if (state.displayBiddingFocus === 'CLICKS') {
      return state.displayClicksSub === 'MANUAL_CPC' ? t('display.manualCpc') : t('display.maximizeClicks')
    }
    if (state.displayBiddingFocus === 'CONVERSIONS') {
      return state.displayConversionsSub === 'TARGET_CPA' ? t('display.manualCpa') : t('display.maximizeConversions')
    }
    if (state.displayBiddingFocus === 'CONVERSION_VALUE') {
      return state.displayValueSub === 'TARGET_ROAS' ? t('display.targetRoas') : t('display.maximizeConversionValue')
    }
    return notSet
  })()

  // Step 3 — Audience
  const audienceCount = state.selectedAudienceSegments.length

  // Step 4 — Ads
  const headlineCount = state.displayHeadlines.map(h => h.trim()).filter(Boolean).length
  const descCount = state.displayDescriptions.map(d => d.trim()).filter(Boolean).length
  const longHeadlineSet = state.displayLongHeadline.trim().length > 0
  const businessNameSet = state.displayBusinessName.trim().length > 0
  const finalUrlSet = !!state.finalUrl && state.finalUrl !== 'https://'
  const imageCount = state.displayAssets.filter(a =>
    a.kind === 'MARKETING_IMAGE' || a.kind === 'SQUARE_MARKETING_IMAGE' || a.kind === 'PORTRAIT_MARKETING_IMAGE'
  ).length
  const logoCount = state.displayAssets.filter(a => a.kind === 'LOGO' || a.kind === 'SQUARE_LOGO').length
  const videoCount = state.displayAssets.filter(a => a.kind === 'YOUTUBE_VIDEO').length
  const adsComplete = headlineCount >= 1 && descCount >= 1 && longHeadlineSet && businessNameSet && finalUrlSet && imageCount >= 1

  const allReady = campaignNameComplete && settingsComplete && budgetSet && adsComplete

  return (
    <div className="sticky top-8 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {t('display.summarySidebarTitle')}
      </h3>

      <DisplaySidebarCard
        icon={<Flag className="w-4 h-4" />}
        title={t('conversion.title')}
        active={currentStep === 0}
        complete={campaignNameComplete}
      >
        <DisplaySidebarRow
          label={t('campaign.name')}
          value={state.campaignName.trim() || notSet}
          muted={!campaignNameComplete}
        />
        <DisplaySidebarRow
          label={t('display.summaryGoal')}
          value={t(`goal.labels.${state.campaignGoal}`)}
        />
        <DisplaySidebarRow
          label={t('conversion.title')}
          value={conversionGoalCount > 0 ? String(conversionGoalCount) : notSet}
          muted={conversionGoalCount === 0}
        />
      </DisplaySidebarCard>

      <DisplaySidebarCard
        icon={<Settings2 className="w-4 h-4" />}
        title={t('display.steps.campaignSettings')}
        active={currentStep === 1}
        complete={settingsComplete}
      >
        <DisplaySidebarRow label={t('steps.location')} value={locSummary} />
        <DisplaySidebarRow
          label={t('location.languageTargetingTitle')}
          value={langNames || notSet}
          muted={!langNames}
        />
        <DisplaySidebarRow
          label={t('settings.euPoliticalTitle')}
          value={
            state.euPoliticalAdsDeclaration === 'POLITICAL'
              ? t('settings.euPoliticalPolitical')
              : t('settings.euPoliticalNotPolitical')
          }
        />
      </DisplaySidebarCard>

      <DisplaySidebarCard
        icon={<DollarSign className="w-4 h-4" />}
        title={t('display.steps.budgetBidding')}
        active={currentStep === 2}
        complete={budgetSet}
      >
        <DisplaySidebarRow
          label={t('campaign.dailyBudget')}
          value={state.dailyBudget ? `${state.dailyBudget} TRY` : notSet}
          muted={!budgetSet}
        />
        <DisplaySidebarRow label={t('display.summaryBidStrategy')} value={friendlyBidLabel} />
      </DisplaySidebarCard>

      <DisplaySidebarCard
        icon={<Users className="w-4 h-4" />}
        title={t('steps.audience')}
        active={currentStep === 3}
      >
        <DisplaySidebarRow
          label={t('display.summaryAudienceCount', { count: audienceCount })}
          value={String(audienceCount)}
          muted={audienceCount === 0}
        />
        <DisplaySidebarRow
          label={t('display.summaryOptimizedTargeting')}
          value={state.optimizedTargeting ? '✓' : notSet}
          muted={!state.optimizedTargeting}
        />
      </DisplaySidebarCard>

      <DisplaySidebarCard
        icon={<ImageIcon className="w-4 h-4" />}
        title={t('display.steps.ads')}
        active={currentStep === 4}
        complete={adsComplete}
      >
        <DisplaySidebarRow
          label={t('display.businessName')}
          value={state.displayBusinessName.trim() || notSet}
          muted={!businessNameSet}
        />
        <DisplaySidebarRow
          label={t('display.summaryHeadlineCount')}
          value={String(headlineCount)}
          muted={headlineCount === 0}
        />
        <DisplaySidebarRow
          label={t('display.summaryDescriptionCount')}
          value={String(descCount)}
          muted={descCount === 0}
        />
        <DisplaySidebarRow
          label={t('display.summaryAssets')}
          value={`${imageCount}/${logoCount}/${videoCount}`}
          muted={imageCount + logoCount + videoCount === 0}
        />
      </DisplaySidebarCard>

      {currentStep === 5 && (
        <DisplaySidebarCard
          icon={<ClipboardList className="w-4 h-4" />}
          title={t('display.steps.summary')}
          active
        >
          <div className="flex items-center gap-1.5">
            {allReady ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px] font-medium text-emerald-700">
                  {t('display.summaryReadyLabel')}
                </span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[11px] font-medium text-red-600">
                  {t('display.summaryMissingLabel')}
                </span>
              </>
            )}
          </div>
        </DisplaySidebarCard>
      )}
    </div>
  )
}
