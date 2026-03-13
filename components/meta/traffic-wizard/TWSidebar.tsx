'use client'

import { Target, Layers, Image, FileText, Globe, Check, Sparkles, CheckCircle2, XCircle } from 'lucide-react'
import { getTrafficI18n, getLocale } from './i18n'
import { CTA_LABEL_TR } from '@/lib/meta/ctaLabels'
import type { TrafficWizardState } from './types'

interface TWSidebarProps {
  state: TrafficWizardState
  currentStep: 1 | 2 | 3 | 4
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

export default function TWSidebar({ state, currentStep }: TWSidebarProps) {
  const t = getTrafficI18n()
  const c = state.campaign
  const a = state.adset
  const locale = getLocale()

  // Campaign displays
  const isCbo = c.budgetOptimization === 'campaign'
  const budgetStrategyLabel = isCbo ? t.sidebarBudgetCbo : t.sidebarBudgetAbo
  const budgetAmountDisplay = isCbo && c.campaignBudget
    ? `${c.campaignBudget.toLocaleString('tr-TR')} ${t.cboCurrency}`
    : null
  const budgetTypeDisplay = isCbo && c.campaignBudget
    ? (c.campaignBudgetType === 'lifetime' ? t.cboBudgetLifetime : t.cboBudgetDaily)
    : null
  const bidStrategyDisplay = isCbo
    ? BID_STRATEGY_LABELS[c.campaignBidStrategy ?? 'MAX_VOLUME']?.[locale] ?? c.campaignBidStrategy
    : null
  const hasCategories = c.specialAdCategories.length > 0
  const categoryDisplay = hasCategories
    ? c.specialAdCategories
        .map(cat => {
          const keyMap: Record<string, string> = {
            CREDIT: t.categoryCredit,
            EMPLOYMENT: t.categoryEmployment,
            HOUSING: t.categoryHousing,
            ISSUES_ELECTIONS_POLITICS: t.categorySocialIssues,
          }
          return keyMap[cat] ?? cat
        })
        .join(', ')
    : t.sidebarCategoriesNone
  const campaignComplete = c.name.trim().length > 0

  // Ad Set displays
  const destLabel = DEST_LABELS[a.destination]?.[locale] ?? a.destination
  const adsetBudgetDisplay = !isCbo && a.budget
    ? `${a.budget.toLocaleString('tr-TR')} TRY / ${a.budgetType === 'lifetime' ? t.adsetBudgetLifetime : t.adsetBudgetDaily}`
    : !isCbo ? t.sidebarNotSet : t.managedByCbo
  const scheduleDisplay = (() => {
    const start = a.startType === 'now' ? t.sidebarScheduleNow : (a.startTime || t.scheduleSelectDate)
    const end = a.endType === 'unlimited' ? t.sidebarScheduleOngoing : (a.endTime || t.scheduleEndDate)
    return `${start} → ${end}`
  })()
  // Audience details
  const hasCustomAudiences = a.customAudiences.length > 0
  const hasExcludedAudiences = a.excludedCustomAudiences.length > 0
  const hasDetailedTargeting = a.detailedTargeting.length > 0
  const hasLocations = a.locations.length > 0
  const hasAgeChange = a.ageMin !== 18 || a.ageMax !== 65
  const hasGenderFilter = a.genders.length > 0
  const hasLanguages = a.locales.length > 0
  const hasAnyAudience = hasCustomAudiences || hasExcludedAudiences || hasDetailedTargeting || hasLocations || hasAgeChange || hasGenderFilter || hasLanguages
  const genderLabel = a.genders.length === 0 ? t.audienceGenderAll
    : a.genders.length === 1 && a.genders[0] === 1 ? t.audienceGenderMale
    : a.genders.length === 1 && a.genders[0] === 2 ? t.audienceGenderFemale
    : t.audienceGenderAll
  const placementsDisplay = a.placementsMode === 'advantage' ? t.placementsAdvantage : t.placementsManual
  const optGoalDisplay = OPT_GOAL_LABELS[a.optimizationGoal]?.[locale] ?? a.optimizationGoal

  // Creative displays
  const ad = state.ad
  const FORMAT_LABELS: Record<string, string> = {
    single_image: locale === 'tr' ? 'Tek Görsel' : 'Single Image',
    single_video: locale === 'tr' ? 'Tek Video' : 'Single Video',
    carousel: locale === 'tr' ? 'Carousel' : 'Carousel',
  }
  const formatLabel = FORMAT_LABELS[ad.format] ?? ad.format
  const hasCreativeMedia = !!(ad.imageHash || ad.videoId)
  const textComplete = !!(ad.primaryText && ad.headline)
  const creativeComplete = !!(ad.pageName && hasCreativeMedia && textComplete && ad.destinationUrl)
  const adsetHasBudget = isCbo ? !!(c.campaignBudget && Number(c.campaignBudget) > 0) : !!(a.budget && Number(a.budget) > 0)
  const allReady = campaignComplete && adsetHasBudget && creativeComplete

  return (
    <div className="sticky top-8 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.sidebarTitle}</h3>

      {/* ── Campaign ── */}
      <SidebarCard
        icon={<Target className="w-4 h-4" />}
        title={t.sidebarCampaign}
        active={currentStep === 1}
        complete={campaignComplete}
      >
        <Row label={t.campaignName} value={c.name || t.sidebarNotSet} muted={!c.name} />
        <div className="flex justify-between items-center text-xs mt-1">
          <span className="text-gray-500">{t.sidebarObjective}</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-[11px] font-semibold">
            <Globe className="w-3 h-3" />
            {t.trafficObjective}
          </span>
        </div>
        <Row label={t.sidebarBudget} value={budgetStrategyLabel} />
        {budgetAmountDisplay && (
          <>
            <Row label={t.sidebarBudgetAmount} value={`${budgetAmountDisplay} / ${budgetTypeDisplay}`} />
            {bidStrategyDisplay && <Row label={t.sidebarBidStrategy} value={bidStrategyDisplay} />}
          </>
        )}
        <Row label={t.sidebarCategories} value={categoryDisplay} muted={!hasCategories} />
      </SidebarCard>

      {/* ── Ad Set ── */}
      <SidebarCard
        icon={<Layers className="w-4 h-4" />}
        title={t.sidebarAdSet}
        active={currentStep === 2}
      >
        <Row label={t.adsetNameLabel} value={a.name || t.sidebarNotSet} muted={!a.name} />
        <Row label={t.sidebarDestination} value={destLabel} />
        <Row label={t.sidebarAdSetBudget} value={adsetBudgetDisplay} muted={!isCbo && !a.budget} />
        <Row label={t.sidebarSchedule} value={scheduleDisplay} />
        {hasAnyAudience ? (
          <>
            {hasCustomAudiences && (
              <Row label={t.sidebarCustomAudiences} value={`${a.customAudiences.length}`} />
            )}
            {hasExcludedAudiences && (
              <Row label={t.sidebarExcludedAudiences} value={`${a.excludedCustomAudiences.length}`} />
            )}
            {hasDetailedTargeting && (
              <Row label={t.sidebarDetailedTargeting} value={`${a.detailedTargeting.length}`} />
            )}
            {hasLocations && (
              <Row label={t.sidebarLocations} value={a.locations.map(l => l.name).join(', ')} />
            )}
            <Row label={t.sidebarAge} value={`${a.ageMin}–${a.ageMax}+`} muted={!hasAgeChange} />
            <Row label={t.sidebarGender} value={genderLabel} muted={!hasGenderFilter} />
            {hasLanguages && (
              <Row label={t.sidebarLanguages} value={a.locales.map(l => l.name).join(', ')} />
            )}
          </>
        ) : (
          <Row label={t.sidebarAudience} value={t.sidebarAudienceDefault} muted />
        )}
        <div className="flex justify-between items-center text-xs mt-1">
          <span className="text-gray-500">{t.sidebarPlacements}</span>
          <span className="inline-flex items-center gap-1 text-gray-900 font-medium">
            {a.placementsMode === 'advantage' && <Sparkles className="w-3 h-3 text-primary" />}
            <span className="truncate">{placementsDisplay}</span>
          </span>
        </div>
        <Row label={t.sidebarOptimization} value={optGoalDisplay} />
      </SidebarCard>

      {/* ── Creative ── */}
      <SidebarCard
        icon={<Image className="w-4 h-4" />}
        title={t.sidebarCreative}
        active={currentStep === 3}
        complete={creativeComplete}
      >
        <Row label={t.adNameLabel} value={ad.name || t.sidebarNotSet} muted={!ad.name} />
        <Row label={t.sidebarCreativeIdentity} value={ad.pageName || t.sidebarNotSet} muted={!ad.pageName} />
        <Row label={t.sidebarCreativeFormat} value={formatLabel} />
        <Row label={t.sidebarCreativeMedia} value={hasCreativeMedia ? t.sidebarMediaAttached : t.sidebarMediaNone} muted={!hasCreativeMedia} />
        <Row label={t.sidebarCreativeText} value={textComplete ? t.sidebarTextComplete : t.sidebarTextIncomplete} muted={!textComplete} />
        <Row label={t.sidebarCreativeCta} value={CTA_LABEL_TR[ad.callToAction] ?? ad.callToAction} />
        <Row label={t.sidebarCreativeDestUrl} value={ad.destinationUrl ? truncateUrl(ad.destinationUrl) : t.sidebarNotSet} muted={!ad.destinationUrl} />
      </SidebarCard>

      {/* ── Summary (step 4 only) ── */}
      {currentStep === 4 && (
        <SidebarCard
          icon={<FileText className="w-4 h-4" />}
          title={t.summaryTitle}
          active
        >
          <Row label={t.sidebarCampaign} value={campaignComplete ? '✓' : '—'} muted={!campaignComplete} />
          <Row label={t.sidebarAdSet} value={adsetHasBudget ? '✓' : '—'} muted={!adsetHasBudget} />
          <Row label={t.sidebarCreative} value={creativeComplete ? '✓' : '—'} muted={!creativeComplete} />
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              {allReady ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-medium text-emerald-700">{t.summaryValidationPass?.split('—')[0]?.trim() || 'Hazır'}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-[11px] font-medium text-red-600">{t.publishDisabled}</span>
                </>
              )}
            </div>
          </div>
        </SidebarCard>
      )}
    </div>
  )
}

/* ── Helpers ── */

function SidebarCard({
  icon,
  title,
  active,
  complete,
  children,
}: {
  icon: React.ReactNode
  title: string
  active: boolean
  complete?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        active
          ? 'border-primary/30 bg-primary/[0.03] shadow-sm'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={active ? 'text-primary' : 'text-gray-400'}>{icon}</span>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex-1">{title}</h4>
        {complete && !active && (
          <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="w-3 h-3 text-primary" />
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function truncateUrl(url: string, max = 28): string {
  try {
    const u = new URL(url)
    const display = u.hostname + u.pathname
    return display.length > max ? display.slice(0, max) + '…' : display
  } catch {
    return url.length > max ? url.slice(0, max) + '…' : url
  }
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`font-medium text-right truncate ${muted ? 'text-gray-400 italic' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  )
}
