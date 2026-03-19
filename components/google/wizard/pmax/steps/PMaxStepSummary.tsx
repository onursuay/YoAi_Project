'use client'

import { AlertCircle, AlertTriangle, Eye } from 'lucide-react'
import type { PMaxStepProps } from '../shared/PMaxWizardTypes'
import { PMaxLanguageOptions } from '../shared/PMaxWizardTypes'
import { getPMaxBlockingIssues, getPMaxAdvisoryRecommendations } from '../shared/PMaxWizardValidation'

function Row({ label, value, error }: { label: string; value: string; error?: boolean }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-100 last:border-0 gap-4">
      <span className="text-sm text-gray-600 shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right max-w-sm ${error ? 'text-red-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  )
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="px-5 py-3 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  )
}

export default function PMaxStepSummary({ state, t }: PMaxStepProps) {
  const langNames = state.languageIds
    .map(id => PMaxLanguageOptions.find(l => l.id === id)?.name ?? id)
    .join(', ')
  const hCount = state.headlines.filter(h => h.trim()).length
  const lhCount = state.longHeadlines.filter(h => h.trim()).length
  const dCount = state.descriptions.filter(d => d.trim()).length
  const searchThemesList = state.searchThemes.map(st => st.text.trim()).filter(Boolean)

  const blockingIssues = getPMaxBlockingIssues(state, t)
  const advisoryRecs = getPMaxAdvisoryRecommendations(state, t)

  const euPoliticalLabel =
    state.euPoliticalAdsDeclaration === 'POLITICAL'
      ? t('settings.euPoliticalPolitical')
      : state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'
        ? t('settings.euPoliticalNotPolitical')
        : t('summary.notSpecified')

  return (
    <div className="space-y-4 pt-2">
      {/* Title */}
      <h3 className="text-base font-semibold text-gray-900">{t('summary.readyTitle')}</h3>

      {/* Blocking issues */}
      {blockingIssues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900">{t('summary.blockingIssuesTitle')}</h4>
          <p className="text-sm text-gray-500">{t('summary.blockingIssuesDesc')}</p>
          {blockingIssues.map((issue, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{issue}</span>
              </div>
              <button type="button" className="text-sm text-blue-600 hover:underline shrink-0 ml-4">
                {t('summary.viewAction')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Advisory recommendations */}
      {advisoryRecs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">{t('summary.advisoryTitle')}</h4>
            <span className="text-xs text-gray-500">{advisoryRecs.length} / {advisoryRecs.length}</span>
          </div>
          <p className="text-sm text-gray-500">{t('summary.advisoryDesc')}</p>
          {advisoryRecs.map((rec, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm text-amber-800">{rec}</span>
              </div>
              <button type="button" className="text-sm text-blue-600 hover:underline shrink-0 ml-4">
                {t('summary.viewAction')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Overview */}
      <SummarySection title={t('summary.overviewSection')}>
        <Row label={t('summary.campaignName')} value={state.campaignName || '—'} />
        <Row label={t('summary.campaignType')} value={t('summary.campaignTypePMax')} />
        <Row label={t('summary.campaignGoal')} value={t(`goal.labels.${state.campaignGoal}`)} />
      </SummarySection>

      {/* Bidding */}
      <SummarySection title={t('summary.biddingSection')}>
        <Row label={t('summary.biddingStrategy')} value={t(`bidding.labels.${state.biddingStrategy}`)} />
        <Row
          label={t('summary.biddingFocus')}
          value={state.biddingFocus === 'CONVERSION_VALUE' ? t('bidding.focusLabels.CONVERSION_VALUE') : t('bidding.focusLabels.CONVERSION_COUNT')}
        />
        {state.biddingStrategy === 'TARGET_CPA' && state.targetCpa && (
          <Row label={t('summary.targetCpa')} value={`${state.targetCpa} TRY`} />
        )}
        {state.biddingStrategy === 'TARGET_ROAS' && state.targetRoas && (
          <Row label={t('summary.targetRoas')} value={state.targetRoas} />
        )}
        <Row
          label={t('bidding.acquisitionTitle')}
          value={state.bidOnlyForNewCustomers ? t('summary.newCustomersOnly') : t('summary.allCustomers')}
        />
      </SummarySection>

      {/* Campaign Settings */}
      <SummarySection title={t('summary.campaignSettingsSection')}>
        <Row
          label={t('summary.locations')}
          value={
            state.locations.length > 0
              ? state.locations.map(l => l.name).join(', ')
              : t('summary.locationsAll')
          }
        />
        <Row label={t('summary.languages')} value={langNames || '—'} />
        <Row
          label={t('settings.euPoliticalTitle')}
          value={euPoliticalLabel}
          error={state.euPoliticalAdsDeclaration === null}
        />
      </SummarySection>

      {/* Asset Group */}
      <SummarySection title={t('summary.assetGroupSection')}>
        <Row label={t('summary.assetGroupName')} value={state.assetGroupName || '—'} />
        <Row label={t('summary.businessName')} value={state.businessName || '—'} />
        <Row label={t('summary.headlinesCount')} value={`${hCount} / 15`} />
        <Row label={t('summary.longHeadlinesCount')} value={`${lhCount} / 5`} />
        <Row label={t('summary.descriptionsCount')} value={`${dCount} / 5`} />
        <Row label={t('summary.imageCount')} value={String(state.images.filter(i => i.url?.trim()).length)} />
        <Row label={t('summary.logoCount')} value={String(state.logos.filter(i => i.url?.trim()).length)} />
        <Row label={t('summary.videoCount')} value={String(state.videos.filter(v => v.url?.trim()).length)} />
        <Row label={t('summary.sitelinkCount')} value={String(state.sitelinks.filter(s => s.title.trim()).length)} />
        <Row label={t('assetGroup.ctaTitle')} value={t(`assetGroup.ctaOptions.${state.callToAction}`)} />
        <Row label={t('summary.audienceSignalCount')} value={String(state.selectedAudienceSegments.length)} />
        <Row label={t('summary.searchThemeCount')} value={String(searchThemesList.length)} />
      </SummarySection>

      {/* Budget */}
      <SummarySection title={t('summary.budgetSection')}>
        {state.budgetType === 'DAILY' ? (
          <Row
            label={t('summary.dailyBudget')}
            value={state.dailyBudget ? `${state.dailyBudget} TRY/${t('summary.day')}` : '—'}
            error={!state.dailyBudget || parseFloat(state.dailyBudget) < 1}
          />
        ) : (
          <Row
            label={t('summary.totalBudget')}
            value={state.totalBudget ? `${state.totalBudget} TRY` : '—'}
            error={!state.totalBudget || parseFloat(state.totalBudget) < 1}
          />
        )}
      </SummarySection>
    </div>
  )
}
