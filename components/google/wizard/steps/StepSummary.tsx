'use client'

import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import type { StepProps, WizardState } from '../shared/WizardTypes'
import { LANGUAGE_OPTIONS } from '../shared/WizardTypes'
import { parseKeywords } from '../shared/WizardHelpers'
import { getBudgetRecommendation } from '../shared/WizardValidation'

const LOW_KEYWORDS_THRESHOLD = 5
const WEAK_HEADLINES_THRESHOLD = 5
const WEAK_DESCRIPTIONS_THRESHOLD = 4

// UI-only: run same checks as step validation for defensive review
function getBlockingIssues(state: WizardState, t: StepProps['t']): string[] {
  const issues: string[] = []
  if (!state.campaignName.trim()) issues.push(t('validation.campaignNameRequired'))
  if (state.biddingStrategy === 'TARGET_CPA' && (!state.targetCpa || parseFloat(state.targetCpa) <= 0))
    issues.push(t('validation.targetCpaRequired'))
  if (state.biddingStrategy === 'TARGET_ROAS' && (!state.targetRoas || parseFloat(state.targetRoas) <= 0))
    issues.push(t('validation.targetRoasRequired'))
  if (state.languageIds.length === 0) issues.push(t('validation.languageRequired'))
  if (!state.adGroupName.trim()) issues.push(t('validation.adGroupNameRequired'))
  if (state.campaignType === 'SEARCH' && !state.keywordsRaw.trim()) issues.push(t('validation.keywordsRequired'))
  if (!state.finalUrl.startsWith('http')) issues.push(t('validation.urlRequired'))
  if (state.campaignType === 'SEARCH') {
    const h = state.headlines.map(x => x.trim()).filter(Boolean)
    const d = state.descriptions.map(x => x.trim()).filter(Boolean)
    if (h.length < 3) issues.push(t('validation.minHeadlines'))
    if (d.length < 2) issues.push(t('validation.minDescriptions'))
  }
  if (!state.dailyBudget || parseFloat(state.dailyBudget) < 1) issues.push(t('validation.minBudget'))
  return issues
}

// UI-only: advisory recommendations
function getAdvisoryRecommendations(state: WizardState, t: StepProps['t']): string[] {
  const recs: string[] = []
  const kwCount = parseKeywords(state.keywordsRaw, state.defaultMatchType).length
  const hCount = state.headlines.map(h => h.trim()).filter(Boolean).length
  const dCount = state.descriptions.map(d => d.trim()).filter(Boolean).length
  const budgetNum = parseFloat(state.dailyBudget) || 0
  const recommended = getBudgetRecommendation(state.biddingStrategy)

  if (state.campaignType === 'SEARCH' && kwCount > 0 && kwCount < LOW_KEYWORDS_THRESHOLD)
    recs.push(t('review.lowKeywords'))
  if (state.campaignType === 'SEARCH' && hCount >= 3 && hCount < WEAK_HEADLINES_THRESHOLD)
    recs.push(t('review.weakHeadlines'))
  if (state.campaignType === 'SEARCH' && dCount >= 2 && dCount < WEAK_DESCRIPTIONS_THRESHOLD)
    recs.push(t('review.weakDescriptions'))
  if (budgetNum > 0 && budgetNum < recommended) recs.push(t('review.lowBudget'))
  if (!state.aiMax.enabled) recs.push(t('review.aiMaxDisabled'))
  return recs
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
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

export default function StepSummary({ state, t }: StepProps) {
  const budgetNum = parseFloat(state.dailyBudget) || 0
  const recommended = getBudgetRecommendation(state.biddingStrategy)
  const showBudgetWarning = budgetNum > 0 && budgetNum < recommended

  const positiveLocations = state.locations.filter(l => !l.isNegative)
  const negativeLocations = state.locations.filter(l => l.isNegative)
  const langNames = state.languageIds.map(id =>
    (t(`summary.languageNames.${id}`) || LANGUAGE_OPTIONS.find(l => l.id === id)?.name) ?? id
  ).join(', ')
  const kwCount = parseKeywords(state.keywordsRaw, state.defaultMatchType).length
  const hCount = state.headlines.filter(h => h.trim()).length
  const dCount = state.descriptions.filter(d => d.trim()).length

  const campaignTypeLabel = t(`summary.campaignTypeLabels.${state.campaignType}`) || state.campaignType

  const networks: string[] = []
  if (state.campaignType === 'SEARCH') {
    if (state.networkSettings.targetGoogleSearch) networks.push(t('summary.networkLabels.googleSearch'))
    if (state.networkSettings.targetSearchNetwork) networks.push(t('summary.networkLabels.searchPartners'))
    if (state.networkSettings.targetContentNetwork) networks.push(t('summary.networkLabels.contentNetwork'))
  }

  const blockingIssues = getBlockingIssues(state, t)
  const advisoryRecs = getAdvisoryRecommendations(state, t)

  return (
    <div className="space-y-5">
      {/* Yayın Kontrolü — at top */}
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">{t('review.title')}</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="px-4 py-3">
            <p className="text-xs font-medium text-gray-600 mb-2">{t('review.blockingTitle')}</p>
            {blockingIssues.length > 0 ? (
              <ul className="space-y-1">
                {blockingIssues.map((issue, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {t('review.blockingEmpty')}
              </p>
            )}
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-medium text-gray-600 mb-2">{t('review.advisoryTitle')}</p>
            {advisoryRecs.length > 0 ? (
              <ul className="space-y-1">
                {advisoryRecs.map((rec, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-amber-800">
                    <Info className="w-4 h-4 shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {t('review.advisoryEmpty')}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
        <span>{t('review.uiOnlyFieldsNote')}</span>
      </div>

      {showBudgetWarning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t('summary.budgetWarning', { budget: state.dailyBudget, recommended })}</span>
        </div>
      )}

      {/* Kampanya Özeti */}
      <Section title={t('review.sectionCampaign')}>
        <Row label={t('summary.rowCampaignGoal')} value={t(`summary.goalLabels.${state.campaignGoal}`) || state.campaignGoal} />
        <Row label={t('summary.rowCampaignType')} value={campaignTypeLabel} />
        <Row label={t('summary.campaign')} value={state.campaignName} />
      </Section>

      {/* Dönüşüm Hedefleri */}
      <Section title={t('review.sectionConversion')}>
        {state.selectedConversionGoalIds.length > 0 ? (
          <Row
            label={t('conversion.title')}
            value={state.selectedConversionGoalIds
              .map(rn => state.conversionActions.find(a => a.resourceName === rn)?.name ?? rn)
              .join(', ')}
          />
        ) : (
          <Row label={t('conversion.title')} value="—" />
        )}
      </Section>

      {/* Teklif Verme */}
      <Section title={t('review.sectionBidding')}>
        <Row label={t('summary.dailyBudget')} value={`${state.dailyBudget} TRY`} />
        <Row label={t('summary.biddingStrategy')} value={t(`summary.biddingLabels.${state.biddingStrategy}`) || state.biddingStrategy} />
        {state.biddingFocus && <Row label={t('bidding.focusTitle')} value={t(`summary.biddingFocusLabels.${state.biddingFocus}`) || state.biddingFocus} />}
        {state.bidOnlyForNewCustomers && (
          <Row label={t('bidding.acquisitionTitle')} value={t('bidding.newCustomersOnly')} />
        )}
        {state.targetCpa && <Row label={t('summary.targetCpa')} value={`${state.targetCpa} TRY`} />}
        {state.targetRoas && <Row label={t('summary.targetRoas')} value={state.targetRoas} />}
      </Section>

      {/* Kampanya Ayarları */}
      <Section title={t('review.sectionSettings')}>
        {networks.length > 0 && <Row label={t('summary.rowNetworks')} value={networks.join(', ')} />}
        {state.startDate && <Row label={t('summary.startDate')} value={state.startDate} />}
        {state.endDate && <Row label={t('summary.endDate')} value={state.endDate} />}
        {state.locationTargetingMode === 'PRESENCE_ONLY' && (
          <Row label={t('settings.locationModeTitle')} value={t('settings.locationModePresenceOnly')} />
        )}
        <Row
          label={t('summary.locations')}
          value={positiveLocations.length > 0
            ? positiveLocations.map(l => l.name).join(', ')
            : t('summary.locationAllWorld')}
        />
        {negativeLocations.length > 0 && (
          <Row label={t('summary.rowExcludedLocations')} value={negativeLocations.map(l => l.name).join(', ')} />
        )}
        <Row label={t('summary.rowLanguages')} value={langNames || '-'} />
        {state.euPoliticalAdsDeclaration === 'POLITICAL' && (
          <Row label={t('settings.euPoliticalTitle')} value={t('settings.euPoliticalPolitical')} />
        )}
        <Row
          label={t('summary.rowAdSchedule')}
          value={state.adSchedule.length > 0
            ? t('summary.scheduleSlots', { count: state.adSchedule.length })
            : t('summary.scheduleAllDay')}
        />
        {state.adSchedule.length > 0 && (
          <div className="flex flex-wrap gap-1 py-2">
            {state.adSchedule.map((e, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                {t(`summary.dayLabelsShort.${e.dayOfWeek}`)} {String(e.startHour).padStart(2, '0')}:00–{String(e.endHour).padStart(2, '0')}:00
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* AI Max */}
      <Section title={t('review.sectionAiMax')}>
        {state.aiMax.enabled ? (
          <Row
            label={t('aiMax.title')}
            value={[
              t('aiMax.summaryEnabled'),
              ...(state.aiMax.broadMatchWithAI ? [t('aiMax.broadMatchWithAI')] : []),
              ...(state.aiMax.targetingExpansion ? [t('aiMax.targetingExpansion')] : []),
              ...(state.aiMax.creativeOptimization ? [t('aiMax.creativeOptimization')] : []),
            ].join(' · ')}
          />
        ) : (
          <Row label={t('aiMax.title')} value={t('aiMax.disabled')} />
        )}
      </Section>

      {/* Anahtar Kelimeler & Reklam */}
      <Section title={t('review.sectionKeywords')}>
        <Row label={t('summary.adGroup')} value={state.adGroupName || `${state.campaignName} - ${t('adgroup.defaultNameFallback')}`} />
        {kwCount > 0 && <Row label={t('adgroup.keywords')} value={t('summary.keywordCount', { count: kwCount })} />}
        <Row label={t('summary.finalUrl')} value={state.finalUrl} />
        {hCount > 0 && <Row label={t('ad.headlines')} value={t('summary.headlineCount', { count: hCount })} />}
        {dCount > 0 && <Row label={t('ad.descriptions')} value={t('summary.descriptionCount', { count: dCount })} />}
      </Section>

      {/* Bütçe */}
      <Section title={t('review.sectionBudget')}>
        <Row label={t('summary.dailyBudget')} value={`${state.dailyBudget} TRY`} />
        {state.startDate && <Row label={t('summary.startDate')} value={state.startDate} />}
        {state.endDate && <Row label={t('summary.endDate')} value={state.endDate} />}
      </Section>

      {/* Protected audience section — text localized only */}
      <Section title={t('review.sectionAudience')}>
        {state.selectedAudienceSegments.length > 0 ? (
          <>
            <Row label={t('summary.audienceSegmentsLabel')} value={t('summary.audienceSegmentsSelected', { count: state.selectedAudienceSegments.length })} />
            <Row label={t('summary.audienceModeLabel')} value={t(`summary.audienceModeLabels.${state.audienceMode}`) || state.audienceMode} />
            <div className="flex flex-wrap gap-1 py-1">
              {state.selectedAudienceSegments.map(seg => (
                <span key={`${seg.category}-${seg.id}`} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                  {seg.name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <Row label={t('summary.audienceSegmentsLabel')} value={t('summary.audienceNone')} />
        )}
      </Section>

      <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
        {t('summary.publishNote')}
      </div>
    </div>
  )
}
