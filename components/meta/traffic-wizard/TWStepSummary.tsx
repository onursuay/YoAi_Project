'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Target, Layers, Image as ImageIcon, AlertCircle, CheckCircle2,
  AlertTriangle, Rocket, ChevronRight, ArrowRight, Check,
  Globe, Film, XCircle, PartyPopper,
} from 'lucide-react'
import { getTrafficI18n, getLocale } from './i18n'
import { getCtaLabel } from '@/lib/meta/ctaLabels'
import type { TrafficWizardState } from './types'

interface TWStepSummaryProps {
  state: TrafficWizardState
  onGoToStep: (step: 1 | 2 | 3 | 4) => void
  onClose?: () => void
}

// ── Validation ──

interface ValidationIssue {
  message: string
  step: 1 | 2 | 3
}

function validate(
  state: TrafficWizardState,
  t: ReturnType<typeof getTrafficI18n>,
  minDailyBudgetTry: number | null
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const c = state.campaign
  const a = state.adset
  const ad = state.ad
  const isCbo = c.budgetOptimization === 'campaign'

  // Campaign
  if (!c.name.trim()) errors.push({ message: t.valCampaignName, step: 1 })

  // Ad Set
  if (!a.name.trim()) errors.push({ message: t.valAdSetName, step: 2 })
  if (a.destination === 'WEBSITE') {
    if (!ad.destinationUrl?.trim())
      errors.push({ message: t.valWebsiteUrl, step: 3 })
    else if (!ad.destinationUrl.startsWith('http://') && !ad.destinationUrl.startsWith('https://'))
      errors.push({ message: t.valWebsiteUrlInvalid, step: 3 })
  }
  if (a.destination === 'PHONE_CALL' && !a.phoneNumber?.trim())
    errors.push({ message: t.valPhoneNumber ?? 'Telefon numarası boş', step: 2 })
  if (!isCbo && (!a.budget || Number(a.budget) <= 0))
    errors.push({ message: t.valBudget, step: 2 })
  if (isCbo && (!c.campaignBudget || Number(c.campaignBudget) <= 0))
    errors.push({ message: t.valBudget, step: 1 })

  // Min budget (inline, before request)
  if (minDailyBudgetTry != null && minDailyBudgetTry > 0) {
    if (isCbo && c.campaignBudgetType !== 'lifetime') {
      const val = Number(c.campaignBudget ?? 0)
      if (val > 0 && val < minDailyBudgetTry) {
        errors.push({
          message: t.valMinBudget?.replace('{min}', String(Math.ceil(minDailyBudgetTry))) ??
            `Minimum günlük bütçe: ${Math.ceil(minDailyBudgetTry)} TRY (≈ 1 USD)`,
          step: 1,
        })
      }
    }
    if (!isCbo && a.budgetType !== 'lifetime') {
      const val = Number(a.budget ?? 0)
      if (val > 0 && val < minDailyBudgetTry) {
        errors.push({
          message: t.valMinBudget?.replace('{min}', String(Math.ceil(minDailyBudgetTry))) ??
            `Minimum günlük bütçe: ${Math.ceil(minDailyBudgetTry)} TRY (≈ 1 USD)`,
          step: 2,
        })
      }
    }
  }

  // Creative
  if (!ad.name.trim()) errors.push({ message: t.valAdName, step: 3 })
  if (!ad.pageId) errors.push({ message: t.valPageId, step: 3 })
  if (!ad.imageHash && !ad.videoId)
    errors.push({ message: t.valMedia, step: 3 })
  if (!ad.primaryText.trim())
    errors.push({ message: t.valPrimaryText, step: 3 })
  if (!ad.headline.trim()) errors.push({ message: t.valHeadline, step: 3 })
  if (!ad.destinationUrl.trim())
    errors.push({ message: t.valDestUrl, step: 3 })
  if (
    ad.destinationUrl.trim() &&
    !ad.destinationUrl.startsWith('http://') &&
    !ad.destinationUrl.startsWith('https://')
  )
    errors.push({ message: t.valDestUrlInvalid, step: 3 })

  // Warnings
  if (a.locations.length === 0)
    warnings.push({ message: t.warnNoLocations, step: 2 })
  if (!ad.description.trim())
    warnings.push({ message: t.warnNoDescription, step: 3 })

  return { errors, warnings }
}

const BID_STRATEGY_LABELS: Record<string, { tr: string; en: string }> = {
  MAX_VOLUME: { tr: 'En Yüksek Hacim', en: 'Highest Volume' },
  BID_CAP: { tr: 'Teklif Üst Sınırı', en: 'Bid Cap' },
  COST_CAP: { tr: 'Maliyet Üst Sınırı', en: 'Cost Cap' },
}

const OPT_GOAL_LABELS: Record<string, { tr: string; en: string }> = {
  LINK_CLICKS: { tr: 'Bağlantı Tıklamaları', en: 'Link Clicks' },
  LANDING_PAGE_VIEWS: { tr: 'Açılış Sayfası Görüntülemeleri', en: 'Landing Page Views' },
  IMPRESSIONS: { tr: 'Gösterimler', en: 'Impressions' },
  REACH: { tr: 'Erişim', en: 'Reach' },
  APP_INSTALLS: { tr: 'Uygulama Yüklemeleri', en: 'App Installs' },
  CONVERSATIONS: { tr: 'Sohbetler', en: 'Conversations' },
  VISIT_INSTAGRAM_PROFILE: { tr: 'Profil Ziyaretleri', en: 'Profile Visits' },
  QUALITY_CALL: { tr: 'Aramalar', en: 'Calls' },
}

const DEST_LABELS: Record<string, { tr: string; en: string }> = {
  WEBSITE: { tr: 'İnternet Sitesi', en: 'Website' },
  APP: { tr: 'Uygulama', en: 'App' },
  MESSAGING: { tr: 'Mesaj Yönlendirme', en: 'Messaging' },
  INSTAGRAM_PROFILE: { tr: 'Instagram / Facebook', en: 'Instagram / Facebook' },
  PHONE_CALL: { tr: 'Aramalar', en: 'Calls' },
}

const FORMAT_LABELS: Record<string, { tr: string; en: string }> = {
  single_image: { tr: 'Tek Görsel', en: 'Single Image' },
  single_video: { tr: 'Tek Video', en: 'Single Video' },
  carousel: { tr: 'Carousel', en: 'Carousel' },
}

// ── Publish state ──

type PublishStatus = 'idle' | 'publishing' | 'success' | 'error'

interface PublishResult {
  campaignId?: string
  adsetId?: string
  adId?: string
}

// ══════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════

export default function TWStepSummary({
  state,
  onGoToStep,
  onClose,
}: TWStepSummaryProps) {
  const t = getTrafficI18n()
  const locale = getLocale()
  const c = state.campaign
  const a = state.adset
  const ad = state.ad
  const isCbo = c.budgetOptimization === 'campaign'

  const [minDailyBudgetTry, setMinDailyBudgetTry] = useState<number | null>(null)

  // Debug: Log when component mounts to verify fresh state
  useEffect(() => {
    console.log('[TWStepSummary] Component mounted with fresh state')
  }, [])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({
      optimizationGoal: a.optimizationGoal || 'LINK_CLICKS',
      objective: 'OUTCOME_TRAFFIC',
      bidMode:
        a.bidStrategy === 'LOWEST_COST_WITH_BID_CAP' ||
        a.bidStrategy === 'COST_CAP'
          ? 'cap'
          : 'auto',
    })
    fetch(`/api/meta/min-daily-budget-try?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (data.ok && typeof data.minDailyBudgetTry === 'number') {
          setMinDailyBudgetTry(data.minDailyBudgetTry)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [a.optimizationGoal, a.bidStrategy])

  const { errors, warnings } = useMemo(
    () => validate(state, t, minDailyBudgetTry),
    [state, t, minDailyBudgetTry]
  )
  const canPublish = errors.length === 0

  // Publish state — component remounts with new key on wizard reopen
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle')
  const [publishStep, setPublishStep] = useState<
    'campaign' | 'adset' | 'ad' | null
  >(null)
  const [publishResult, setPublishResult] = useState<PublishResult>({})
  const [publishError, setPublishError] = useState('')

  const handlePublish = async () => {
    if (!canPublish || publishStatus === 'publishing') return

    setPublishStatus('publishing')
    setPublishError('')
    setPublishResult({})

    const payload = {
      campaign: c,
      adset: a,
      ad,
    }

    console.log('[TWStepSummary] Publishing with payload:', {
      campaignName: payload.campaign.name,
      adsetName: payload.adset.name,
      adName: payload.ad.name,
      hasStaleIds: {
        // Check for any IDs that shouldn't be present in create flow
        campaignId: 'campaignId' in payload.campaign,
        adsetId: 'adsetId' in payload.adset,
        adId: 'adId' in payload.ad,
        creativeId: 'creativeId' in payload.ad,
      }
    })

    try {
      setPublishStep('campaign')
      // Small delay so user sees the step label
      await new Promise((r) => setTimeout(r, 300))

      setPublishStep('adset')
      await new Promise((r) => setTimeout(r, 200))

      setPublishStep('ad')

      const res = await fetch('/api/meta/traffic-wizard/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (data.ok) {
        console.log('[TWStepSummary] Publish successful:', {
          campaignId: data.campaignId,
          adsetId: data.adsetId,
          adId: data.adId,
        })
        setPublishResult({
          campaignId: data.campaignId,
          adsetId: data.adsetId,
          adId: data.adId,
        })
        setPublishStatus('success')
      } else {
        console.error('[TWStepSummary] Publish failed:', {
          error: data.error,
          message: data.message,
          step: data.step,
          campaignId: data.campaignId,
          adsetId: data.adsetId,
          requiresMinBudget: data.requiresMinBudget,
          fullResponse: data,
        })
        const errMsg =
          data.requiresMinBudget === true && data.message
            ? data.message
            : data.message || data.error || 'Bilinmeyen hata'
        setPublishError(errMsg)
        setPublishStatus('error')
        if (data.requiresMinBudget === true && data.minDailyBudgetTry != null) {
          setMinDailyBudgetTry(data.minDailyBudgetTry)
        }
        // If backend indicates which step failed, redirect user to that step
        if (data.step) {
          const stepMap: Record<string, 1 | 2 | 3> = {
            campaign: 1,
            adset: 2,
            ad: 3,
            creative: 3,
          }
          const targetStep = stepMap[data.step]
          if (targetStep) {
            console.warn(`[TWStepSummary] Redirecting to step ${targetStep} (${data.step}) due to error`)
            setTimeout(() => onGoToStep(targetStep), 1500)
          }
        }
      }
    } catch (err) {
      console.error('[TWStepSummary] Network or parsing error:', err)
      setPublishError('Ağ hatası — bağlantınızı kontrol edin')
      setPublishStatus('error')
    } finally {
      setPublishStep(null)
    }
  }

  // ── Success view ──
  if (publishStatus === 'success') {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <PartyPopper className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {t.publishSuccess}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {t.publishSuccessDesc}
          </p>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2 max-w-sm mx-auto text-left">
            {publishResult.campaignId && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">{t.publishCampaignId}</span>
                <span className="font-mono text-gray-900">
                  {publishResult.campaignId}
                </span>
              </div>
            )}
            {publishResult.adsetId && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">{t.publishAdSetId}</span>
                <span className="font-mono text-gray-900">
                  {publishResult.adsetId}
                </span>
              </div>
            )}
            {publishResult.adId && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">{t.publishAdId}</span>
                <span className="font-mono text-gray-900">
                  {publishResult.adId}
                </span>
              </div>
            )}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mt-6 px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {t.publishClose}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Gender display ──
  const genderLabel =
    a.genders.length === 0
      ? t.summaryAll
      : a.genders.length === 1 && a.genders[0] === 1
      ? t.audienceGenderMale
      : a.genders.length === 1 && a.genders[0] === 2
      ? t.audienceGenderFemale
      : t.summaryAll

  // ── Schedule display ──
  const scheduleDisplay = (() => {
    const start =
      a.startType === 'now' ? t.scheduleNow : a.startTime || '—'
    const end =
      a.endType === 'unlimited'
        ? t.scheduleUnlimited
        : a.endTime || '—'
    return `${start} → ${end}`
  })()

  // ── Budget display ──
  const budgetDisplay = isCbo
    ? c.campaignBudget
      ? `${c.campaignBudget.toLocaleString('tr-TR')} TRY / ${c.campaignBudgetType === 'lifetime' ? t.cboBudgetLifetime : t.cboBudgetDaily}`
      : '—'
    : a.budget
    ? `${a.budget.toLocaleString('tr-TR')} TRY / ${a.budgetType === 'lifetime' ? t.adsetBudgetLifetime : t.adsetBudgetDaily}`
    : '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t.summaryTitle}</h2>
        <p className="text-sm text-gray-500 mt-1">{t.summaryDesc}</p>
      </div>

      {/* ═══ CAMPAIGN SUMMARY ═══ */}
      <SummaryCard
        icon={<Target className="w-[18px] h-[18px]" />}
        title={t.summaryCampaign}
        step={1}
        onGoToStep={onGoToStep}
        goToStepLabel={t.summaryGoToStep}
      >
        <SummaryRow label={t.campaignName} value={c.name || '—'} />
        <SummaryRow label={t.summaryObjective} value={t.trafficObjective} badge badgeIcon={<Globe className="w-3 h-3" />} />
        <SummaryRow
          label={t.summaryBudgetStrategy}
          value={isCbo ? t.cboLabel : t.aboLabel}
        />
        {isCbo && c.campaignBudget && (
          <>
            <SummaryRow
              label={t.summaryBudgetAmount}
              value={`${c.campaignBudget.toLocaleString('tr-TR')} TRY / ${c.campaignBudgetType === 'lifetime' ? t.cboBudgetLifetime : t.cboBudgetDaily}`}
            />
            <SummaryRow
              label={t.summaryBidStrategy}
              value={
                BID_STRATEGY_LABELS[c.campaignBidStrategy ?? 'MAX_VOLUME']?.[locale] ??
                c.campaignBidStrategy ??
                ''
              }
            />
          </>
        )}
        <SummaryRow
          label={t.summaryCategories}
          value={
            c.specialAdCategories.length > 0
              ? c.specialAdCategories
                  .map((cat) => {
                    const keyMap: Record<string, string> = {
                      CREDIT: t.categoryCredit,
                      EMPLOYMENT: t.categoryEmployment,
                      HOUSING: t.categoryHousing,
                      ISSUES_ELECTIONS_POLITICS: t.categorySocialIssues,
                    }
                    return keyMap[cat] ?? cat
                  })
                  .join(', ')
              : t.summaryNone
          }
          muted={c.specialAdCategories.length === 0}
        />
      </SummaryCard>

      {/* ═══ AD SET SUMMARY ═══ */}
      <SummaryCard
        icon={<Layers className="w-[18px] h-[18px]" />}
        title={t.summaryAdSet}
        step={2}
        onGoToStep={onGoToStep}
        goToStepLabel={t.summaryGoToStep}
      >
        <SummaryRow label={t.adsetNameLabel} value={a.name || '—'} muted={!a.name} />
        <SummaryRow
          label={t.summaryDestination}
          value={DEST_LABELS[a.destination]?.[locale] ?? a.destination}
        />
        {a.destination === 'WEBSITE' && ad.destinationUrl && (
          <SummaryRow label={t.summaryTargetUrl} value={ad.destinationUrl} mono />
        )}
        <SummaryRow label={t.summaryBudget} value={budgetDisplay} />
        <SummaryRow label={t.summarySchedule} value={scheduleDisplay} />
        <div className="border-t border-gray-100 my-2" />
        {a.locations.length > 0 ? (
          <SummaryRow
            label={t.summaryLocations}
            value={a.locations.map((l) => l.name).join(', ')}
          />
        ) : (
          <SummaryRow
            label={t.summaryLocations}
            value={t.summaryBroadAudience}
            muted
          />
        )}
        <SummaryRow
          label={t.summaryAgeGender}
          value={`${a.ageMin}–${a.ageMax}+ / ${genderLabel}`}
        />
        {a.locales.length > 0 && (
          <SummaryRow
            label={t.summaryLanguages}
            value={a.locales.map((l) => l.name).join(', ')}
          />
        )}
        {a.customAudiences.length > 0 && (
          <SummaryRow
            label={t.summaryCustomAudiences}
            value={`${a.customAudiences.length} kitle`}
          />
        )}
        {a.excludedCustomAudiences.length > 0 && (
          <SummaryRow
            label={t.summaryExcludedAudiences}
            value={`${a.excludedCustomAudiences.length} kitle`}
          />
        )}
        {a.detailedTargeting.length > 0 && (
          <SummaryRow
            label={t.summaryDetailedTargeting}
            value={`${a.detailedTargeting.length} hedef`}
          />
        )}
        <div className="border-t border-gray-100 my-2" />
        <SummaryRow
          label={t.summaryPlacements}
          value={
            a.placementsMode === 'advantage'
              ? t.placementsAdvantage
              : t.placementsManual
          }
        />
        <SummaryRow
          label={t.summaryOptGoal}
          value={OPT_GOAL_LABELS[a.optimizationGoal]?.[locale] ?? a.optimizationGoal}
        />
        {a.bidStrategy && (
          <SummaryRow
            label={t.summaryBidStrategy}
            value={`${a.bidStrategy}${a.bidAmount ? ` / ${a.bidAmount} TRY` : ''}`}
          />
        )}
      </SummaryCard>

      {/* ═══ CREATIVE SUMMARY ═══ */}
      <SummaryCard
        icon={<ImageIcon className="w-[18px] h-[18px]" />}
        title={t.summaryCreative}
        step={3}
        onGoToStep={onGoToStep}
        goToStepLabel={t.summaryGoToStep}
      >
        <SummaryRow label={t.adNameLabel} value={ad.name || '—'} muted={!ad.name} />
        <SummaryRow
          label={t.summaryIdentity}
          value={ad.pageName || '—'}
          muted={!ad.pageName}
        />
        <SummaryRow
          label={t.summaryFormat}
          value={FORMAT_LABELS[ad.format]?.[locale] ?? ad.format}
        />
        <div className="flex justify-between items-center text-xs gap-2">
          <span className="text-gray-500 shrink-0">{t.summaryMedia}</span>
          <span className="font-medium text-right truncate flex items-center gap-1.5">
            {ad.imageHash ? (
              <>
                <ImageIcon className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700">{t.summaryImageAttached}</span>
              </>
            ) : ad.videoId ? (
              <>
                <Film className="w-3 h-3 text-blue-600" />
                <span className="text-blue-700">{t.summaryVideoAttached}</span>
              </>
            ) : (
              <span className="text-gray-400 italic">{t.summaryNoMedia}</span>
            )}
          </span>
        </div>

        {/* Media thumbnail */}
        {ad.imageUrl && (
          <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
            <img
              src={ad.imageUrl}
              alt=""
              className="w-full max-h-32 object-contain bg-gray-50"
            />
          </div>
        )}
        {ad.videoId && !ad.imageUrl && (
          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-900 h-20 flex items-center justify-center">
            <Film className="w-8 h-8 text-white/30" />
          </div>
        )}

        <div className="border-t border-gray-100 my-2" />
        <SummaryRow
          label={t.summaryPrimaryText}
          value={
            ad.primaryText
              ? ad.primaryText.length > 60
                ? ad.primaryText.slice(0, 60) + '…'
                : ad.primaryText
              : '—'
          }
          muted={!ad.primaryText}
        />
        <SummaryRow
          label={t.summaryHeadline}
          value={ad.headline || '—'}
          muted={!ad.headline}
        />
        <SummaryRow
          label={t.summaryDescription}
          value={ad.description || '—'}
          muted={!ad.description}
        />
        <div className="border-t border-gray-100 my-2" />
        <SummaryRow
          label={t.summaryDestUrl}
          value={ad.destinationUrl || '—'}
          mono={!!ad.destinationUrl}
          muted={!ad.destinationUrl}
        />
        <SummaryRow
          label={t.summaryCta}
          value={getCtaLabel(ad.callToAction)}
        />
      </SummaryCard>

      {/* ═══ VALIDATION ═══ */}
      <div
        className={`rounded-xl border p-5 ${
          errors.length > 0
            ? 'border-red-200 bg-red-50/50'
            : 'border-emerald-200 bg-emerald-50/50'
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          {errors.length > 0 ? (
            <XCircle className="w-5 h-5 text-red-500" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          )}
          <h3 className="text-sm font-semibold text-gray-900">
            {t.summaryValidation}
          </h3>
        </div>

        {errors.length > 0 ? (
          <>
            <p className="text-xs text-red-600 mb-3">{t.summaryValidationFail}</p>
            <div className="space-y-2">
              {errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="text-xs text-red-700 flex-1">{err.message}</span>
                  <button
                    type="button"
                    onClick={() => onGoToStep(err.step)}
                    className="text-[10px] font-semibold text-red-600 hover:text-red-800 flex items-center gap-0.5"
                  >
                    {t.valStep} {err.step}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-emerald-700">
            {t.summaryValidationPass}
          </p>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-200/50">
            <p className="text-xs text-amber-600 mb-2">
              {t.summaryValidationWarnings}
            </p>
            <div className="space-y-1.5">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-700">{w.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ PUBLISH ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Paused notice */}
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg mb-5">
          <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-xs text-blue-700">{t.publishPaused}</p>
        </div>

        {/* Publishing progress */}
        {publishStatus === 'publishing' && (
          <div className="mb-5 space-y-2">
            <PublishStepRow
              label={t.publishStepCampaign}
              active={publishStep === 'campaign'}
              done={publishStep !== 'campaign'}
            />
            <PublishStepRow
              label={t.publishStepAdSet}
              active={publishStep === 'adset'}
              done={publishStep === 'ad'}
            />
            <PublishStepRow
              label={t.publishStepAd}
              active={publishStep === 'ad'}
              done={false}
            />
          </div>
        )}

        {/* Error message */}
        {publishStatus === 'error' && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-5">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {t.publishError}
              </p>
              <p className="text-xs text-red-600 mt-1">{publishError}</p>
              <p className="text-xs text-red-500 mt-2">
                {t.publishErrorDesc}
              </p>
            </div>
          </div>
        )}

        {/* Publish button */}
        <button
          type="button"
          onClick={handlePublish}
          disabled={!canPublish || publishStatus === 'publishing'}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all ${
            !canPublish
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : publishStatus === 'publishing'
              ? 'bg-primary/80 text-white cursor-wait'
              : publishStatus === 'error'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow-md'
          }`}
        >
          {publishStatus === 'publishing' ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t.publishButtonPublishing}
            </>
          ) : publishStatus === 'error' ? (
            <>
              <ArrowRight className="w-4 h-4" />
              {t.publishButtonRetry}
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" />
              {t.publishButton}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function SummaryCard({
  icon,
  title,
  step,
  onGoToStep,
  goToStepLabel,
  children,
}: {
  icon: React.ReactNode
  title: string
  step: 1 | 2 | 3
  onGoToStep: (step: 1 | 2 | 3 | 4) => void
  goToStepLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900 flex-1">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => onGoToStep(step)}
          className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors"
        >
          {goToStepLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <dl className="space-y-2">{children}</dl>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  muted,
  mono,
  badge,
  badgeIcon,
}: {
  label: string
  value: string
  muted?: boolean
  mono?: boolean
  badge?: boolean
  badgeIcon?: React.ReactNode
}) {
  return (
    <div className="flex justify-between items-center text-xs gap-2">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd
        className={`text-right truncate max-w-[65%] ${
          badge
            ? 'inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-[11px] font-semibold'
            : mono
            ? 'font-mono text-gray-900 text-[11px]'
            : muted
            ? 'text-gray-400 italic'
            : 'font-medium text-gray-900'
        }`}
      >
        {badgeIcon}
        {value}
      </dd>
    </div>
  )
}

function PublishStepRow({
  label,
  active,
  done,
}: {
  label: string
  active: boolean
  done: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      {done ? (
        <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="w-3 h-3 text-primary" />
        </span>
      ) : active ? (
        <span className="w-5 h-5 rounded-full border-2 border-primary/30 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        </span>
      ) : (
        <span className="w-5 h-5 rounded-full border-2 border-gray-200" />
      )}
      <span
        className={`text-xs ${
          active
            ? 'text-gray-900 font-medium'
            : done
            ? 'text-gray-500'
            : 'text-gray-400'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
