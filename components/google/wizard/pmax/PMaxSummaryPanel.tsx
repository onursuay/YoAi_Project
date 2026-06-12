'use client'

import {
  Flag,
  DollarSign,
  Settings2,
  Image as ImageIcon,
  ClipboardList,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { PMaxWizardState } from './shared/PMaxWizardTypes'
import { PMaxLanguageOptions } from './shared/PMaxWizardTypes'
import { GoogleWizardSummaryCard, GoogleWizardSummaryRow } from '../shared/GoogleWizardUI'

interface Props {
  state: PMaxWizardState
  currentStep: number
  /** PMax wizard scope (`dashboard.google.pmaxWizard`) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
  /** Üst başlık ("Özet") — dış aileden geliyor (`dashboard.google.wizard` scope) */
  sidebarTitle: string
  /** Bölüm bayraklı kullanılabilecek "Yayına hazır" / "Eksik alanlar var" başlıkları */
  readyLabel: string
  missingLabel: string
}

/**
 * PMax wizard — sağ readonly özet paneli.
 * Display wizard'ın DisplaySidebar tasarım dilini birebir paylaşır.
 * State okumadan başka bir şey yapmaz; validation/payload'a dokunmaz.
 */
export default function PMaxSummaryPanel({
  state,
  currentStep,
  t,
  sidebarTitle,
  readyLabel,
  missingLabel,
}: Props) {
  const notSpecified = (() => {
    try { return t('summary.notSpecified') } catch { return '—' }
  })()

  // Step 0 — Entry (campaign name + goal + finalUrl)
  const goalLabel = (() => {
    try { return t(`goal.labels.${state.campaignGoal}`) } catch { return state.campaignGoal }
  })()
  const campaignNameComplete = state.campaignName.trim().length > 0
  const finalUrlSet = !!state.finalUrl && state.finalUrl !== 'https://' && state.finalUrl.length > 0

  // Step 1 — Bidding
  const biddingComplete = !!state.biddingStrategy
  const biddingLabelMap: Record<string, string> = {
    MAXIMIZE_CONVERSIONS: 'Maximize Conversions',
    TARGET_CPA: 'Target CPA',
    TARGET_ROAS: 'Target ROAS',
  }
  const biddingLabel = biddingLabelMap[state.biddingStrategy] ?? state.biddingStrategy

  // Step 2 — Settings (locations, languages, EU political)
  const langNames = state.languageIds
    .map(id => PMaxLanguageOptions.find(l => l.id === id)?.name ?? id)
    .join(', ')
  const locParts = [
    ...state.locations.map(l => `${l.name}${l.isNegative ? ' (-)' : ''}`),
    ...state.proximityTargets.map(p => p.label ?? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`),
  ]
  const locSummary = locParts.length > 0
    ? (locParts.length > 2 ? `${locParts.slice(0, 2).join(', ')} +${locParts.length - 2}` : locParts.join(', '))
    : (() => { try { return t('summary.locationsAll') } catch { return notSpecified } })()
  const euPoliticalLabel = state.euPoliticalAdsDeclaration === 'POLITICAL'
    ? t('summary.yes')
    : state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'
      ? t('summary.no')
      : notSpecified
  const settingsComplete = state.languageIds.length > 0 && state.euPoliticalAdsDeclaration !== null

  // Step 3 — Asset Group
  const headlineCount = state.headlines.map(h => h.trim()).filter(Boolean).length
  const longHeadlineCount = state.longHeadlines.map(h => h.trim()).filter(Boolean).length
  const descCount = state.descriptions.map(d => d.trim()).filter(Boolean).length
  const imageCount = state.images.length
  const logoCount = state.logos.length
  const videoCount = state.videos.length
  const businessNameSet = state.businessName.trim().length > 0
  const assetGroupComplete =
    businessNameSet &&
    headlineCount >= 3 &&
    longHeadlineCount >= 1 &&
    descCount >= 2 &&
    imageCount >= 1

  // Step 4 — Budget
  const dailyBudgetSet = !!state.dailyBudget && Number(state.dailyBudget) > 0
  const totalBudgetSet = !!state.totalBudget && Number(state.totalBudget) > 0
  const budgetSet = state.budgetType === 'TOTAL' ? totalBudgetSet : dailyBudgetSet

  // Overall readiness
  const allReady =
    campaignNameComplete &&
    finalUrlSet &&
    biddingComplete &&
    settingsComplete &&
    assetGroupComplete &&
    budgetSet

  return (
    <div className="sticky top-8 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {sidebarTitle}
      </h3>

      <GoogleWizardSummaryCard
        icon={<Flag className="w-4 h-4" />}
        title={t('summary.overviewSection')}
        active={currentStep === 0}
        complete={campaignNameComplete && finalUrlSet}
      >
        <GoogleWizardSummaryRow
          label={t('summary.campaignName')}
          value={state.campaignName.trim() || notSpecified}
          muted={!campaignNameComplete}
        />
        <GoogleWizardSummaryRow label={t('summary.campaignGoal')} value={goalLabel} />
        <GoogleWizardSummaryRow
          label={t('summary.finalUrl')}
          value={finalUrlSet ? state.finalUrl : notSpecified}
          muted={!finalUrlSet}
        />
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<DollarSign className="w-4 h-4" />}
        title={t('summary.biddingSection')}
        active={currentStep === 1}
        complete={biddingComplete}
      >
        <GoogleWizardSummaryRow label={t('summary.biddingStrategy')} value={biddingLabel} />
        {state.biddingStrategy === 'TARGET_CPA' && (
          <GoogleWizardSummaryRow
            label={t('summary.targetCpa')}
            value={state.targetCpa ? `${state.targetCpa} TRY` : notSpecified}
            muted={!state.targetCpa}
          />
        )}
        {state.biddingStrategy === 'TARGET_ROAS' && (
          <GoogleWizardSummaryRow
            label={t('summary.targetRoas')}
            value={state.targetRoas ? `%${state.targetRoas}` : notSpecified}
            muted={!state.targetRoas}
          />
        )}
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<Settings2 className="w-4 h-4" />}
        title={t('summary.campaignSettingsSection')}
        active={currentStep === 2}
        complete={settingsComplete}
      >
        <GoogleWizardSummaryRow label={t('summary.locations')} value={locSummary} />
        <GoogleWizardSummaryRow label={t('summary.languages')} value={langNames || notSpecified} />
        <GoogleWizardSummaryRow label={t('summary.euPoliticalDeclaration')} value={euPoliticalLabel} />
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<ImageIcon className="w-4 h-4" />}
        title={t('summary.assetGroupSection')}
        active={currentStep === 3}
        complete={assetGroupComplete}
      >
        <GoogleWizardSummaryRow
          label={t('summary.businessName')}
          value={businessNameSet ? state.businessName : notSpecified}
          muted={!businessNameSet}
        />
        <GoogleWizardSummaryRow
          label={t('summary.imageCount')}
          value={`${imageCount}`}
          muted={imageCount === 0}
        />
        <GoogleWizardSummaryRow
          label={t('summary.logoCount')}
          value={`${logoCount}`}
          muted={logoCount === 0}
        />
        <GoogleWizardSummaryRow
          label={t('summary.videoCount')}
          value={`${videoCount}`}
          muted={videoCount === 0}
        />
        <GoogleWizardSummaryRow
          label={t('summary.headlinesCount')}
          value={`${headlineCount}`}
          muted={headlineCount === 0}
        />
        <GoogleWizardSummaryRow
          label={t('summary.descriptionsCount')}
          value={`${descCount}`}
          muted={descCount === 0}
        />
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<DollarSign className="w-4 h-4" />}
        title={t('summary.budgetSection')}
        active={currentStep === 4}
        complete={budgetSet}
      >
        {state.budgetType === 'TOTAL' ? (
          <GoogleWizardSummaryRow
            label={t('summary.totalBudget')}
            value={totalBudgetSet ? `${state.totalBudget} TRY` : notSpecified}
            muted={!totalBudgetSet}
          />
        ) : (
          <GoogleWizardSummaryRow
            label={t('summary.dailyBudget')}
            value={dailyBudgetSet ? `${state.dailyBudget} TRY` : notSpecified}
            muted={!dailyBudgetSet}
          />
        )}
      </GoogleWizardSummaryCard>

      <GoogleWizardSummaryCard
        icon={<ClipboardList className="w-4 h-4" />}
        title={t('summary.campaignSection')}
        active={currentStep === 5}
        complete={allReady}
      >
        <div className="flex items-center gap-2 text-xs">
          {allReady ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-700 font-medium">{readyLabel}</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600 font-medium">{missingLabel}</span>
            </>
          )}
        </div>
      </GoogleWizardSummaryCard>
    </div>
  )
}
