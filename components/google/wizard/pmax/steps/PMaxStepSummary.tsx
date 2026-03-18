'use client'

import { CheckCircle2, Zap, AlertCircle, AlertTriangle } from 'lucide-react'
import type { PMaxStepProps } from '../shared/PMaxWizardTypes'
import { PMaxLanguageOptions } from '../shared/PMaxWizardTypes'
import { getPMaxBlockingIssues, getPMaxAdvisoryRecommendations } from '../shared/PMaxWizardValidation'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0 gap-2">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-xs truncate">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-sm font-semibold text-gray-900 mb-2 pb-1 border-b border-gray-200">{title}</h4>
      <div className="pt-1">{children}</div>
    </section>
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
  const searchThemeCount = searchThemesList.length

  const blockingIssues = getPMaxBlockingIssues(state, t)
  const advisoryRecs = getPMaxAdvisoryRecommendations(state, t)

  const datesValue =
    state.startDate && state.endDate
      ? t('budget.dateRangeSet', { start: state.startDate, end: state.endDate })
      : state.startDate
        ? t('budget.dateRangeStartOnly', { start: state.startDate })
        : t('budget.dateRangeNone')

  const euPoliticalLabel =
    state.euPoliticalAdsDeclaration === 'POLITICAL'
      ? t('settings.euPoliticalPolitical')
      : t('settings.euPoliticalNotPolitical')

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <Zap className="w-5 h-5 text-blue-600 shrink-0" />
        <p className="text-sm font-medium text-blue-800">{t('summary.pmaxNote')}</p>
      </div>

      {blockingIssues.length > 0 && (
        <Section title={t('summary.blockingIssuesTitle')}>
          <div className="space-y-2">
            {blockingIssues.map((issue, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {advisoryRecs.length > 0 && (
        <Section title={t('summary.advisoryTitle')}>
          <div className="space-y-2">
            {advisoryRecs.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={t('summary.campaignSection')}>
        <Row label={t('summary.campaignName')} value={state.campaignName || '—'} />
        <Row label={t('summary.campaignType')} value={t('summary.campaignTypePMax')} />
        <Row label={t('summary.campaignGoal')} value={t(`goal.labels.${state.campaignGoal}`)} />
        <Row label={t('summary.finalUrl')} value={state.finalUrl || '—'} />
        <Row label={t('summary.biddingStrategy')} value={t(`bidding.labels.${state.biddingStrategy}`)} />
        {state.biddingStrategy === 'TARGET_CPA' && state.targetCpa && (
          <Row label={t('summary.targetCpa')} value={`${state.targetCpa} TRY`} />
        )}
        {state.biddingStrategy === 'TARGET_ROAS' && state.targetRoas && (
          <Row label={t('summary.targetRoas')} value={state.targetRoas} />
        )}
        <Row label={t('summary.dailyBudget')} value={`${state.dailyBudget} TRY`} />
        <Row label={t('summary.dates')} value={datesValue} />
        <Row label={t('summary.adScheduleCount')} value={t('summary.adScheduleCountValue', { count: state.adSchedule.length })} />
        <Row label={t('summary.finalUrlExpansion')} value={state.finalUrlExpansionEnabled ? t('summary.yes') : t('summary.no')} />
      </Section>

      <Section title={t('summary.targetingSection')}>
        <Row
          label={t('summary.locations')}
          value={
            state.locations.length > 0
              ? t('summary.locationsCount', { count: state.locations.length })
              : t('summary.locationsAll')
          }
        />
        <Row label={t('summary.languages')} value={langNames || '—'} />
        <Row
          label={t('summary.locationMode')}
          value={
            state.locationTargetingMode === 'PRESENCE_OR_INTEREST'
              ? t('settings.locationModePresenceInterest')
              : t('settings.locationModePresenceOnly')
          }
        />
        <Row label={t('summary.euPoliticalDeclaration')} value={euPoliticalLabel} />
      </Section>

      <Section title={t('summary.assetGroupSection')}>
        <Row label={t('summary.assetGroupName')} value={state.assetGroupName || '—'} />
        <Row label={t('summary.businessName')} value={state.businessName || '—'} />
        <Row label={t('summary.headlinesCount')} value={`${hCount} / 15`} />
        <Row label={t('summary.longHeadlinesCount')} value={`${lhCount} / 5`} />
        <Row label={t('summary.descriptionsCount')} value={`${dCount} / 5`} />
        <Row label={t('summary.imageCount')} value={String(state.images.length)} />
        <Row label={t('summary.logoCount')} value={String(state.logos.length)} />
        <Row label={t('summary.videoCount')} value={String(state.videos.length)} />
        <Row label={t('summary.audienceSignalCount')} value={String(state.selectedAudienceSegments.length)} />
        <Row label={t('summary.searchThemeCount')} value={String(searchThemeCount)} />
        {searchThemesList.length > 0 && (
          <Row label={t('summary.searchThemesList')} value={searchThemesList.join(', ')} />
        )}
      </Section>

      {blockingIssues.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">{t('summary.backendPlaceholder')}</p>
        </div>
      )}
    </div>
  )
}
