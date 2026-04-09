'use client'

import { Target, Layers, Image, FileText, Check, Sparkles, CheckCircle2, XCircle } from 'lucide-react'
import { getLocaleFromCookie } from '@/lib/i18n/wizardTranslations'
import { requiresWebsiteUrl } from '@/lib/meta/spec/objectiveSpec'
import { getCtaLabel } from '@/lib/meta/ctaLabels'
import type { WizardState } from './types'

interface WizardSidebarProps {
  state: WizardState
  currentStep: 1 | 2 | 3 | 4
}

const OBJECTIVE_LABELS: Record<string, { tr: string; en: string }> = {
  OUTCOME_AWARENESS:     { tr: 'Bilinirlik',          en: 'Awareness' },
  OUTCOME_TRAFFIC:       { tr: 'Trafik',              en: 'Traffic' },
  OUTCOME_ENGAGEMENT:    { tr: 'Etkileşim',          en: 'Engagement' },
  OUTCOME_LEADS:         { tr: 'Potansiyel Müşteri', en: 'Leads' },
  OUTCOME_APP_PROMOTION: { tr: 'Uygulama',           en: 'App Promotion' },
  OUTCOME_SALES:         { tr: 'Satış',              en: 'Sales' },
}

const CONV_LOCATION_LABELS: Record<string, { tr: string; en: string }> = {
  WEBSITE:          { tr: 'İnternet Sitesi',   en: 'Website' },
  APP:              { tr: 'Uygulama',          en: 'App' },
  MESSENGER:        { tr: 'Messenger',         en: 'Messenger' },
  WHATSAPP:         { tr: 'WhatsApp',          en: 'WhatsApp' },
  INSTAGRAM_DIRECT: { tr: 'Instagram DM',      en: 'Instagram DM' },
  ON_AD:            { tr: 'Reklam Üzerinde',   en: 'On Ad' },
  ON_PAGE:          { tr: 'Sayfa Üzerinde',    en: 'On Page' },
  CALL:             { tr: 'Arama',             en: 'Call' },
  CATALOG:          { tr: 'Katalog',           en: 'Catalog' },
}

const OPT_GOAL_LABELS: Record<string, { tr: string; en: string }> = {
  LINK_CLICKS:             { tr: 'Bağlantı Tıklamaları',            en: 'Link Clicks' },
  LANDING_PAGE_VIEWS:      { tr: 'Açılış Sayfası Görüntülemeleri', en: 'Landing Page Views' },
  IMPRESSIONS:             { tr: 'Gösterimler',                     en: 'Impressions' },
  REACH:                   { tr: 'Erişim',                         en: 'Reach' },
  APP_INSTALLS:            { tr: 'Uygulama Yüklemeleri',           en: 'App Installs' },
  CONVERSATIONS:           { tr: 'Sohbetler',                      en: 'Conversations' },
  VISIT_INSTAGRAM_PROFILE: { tr: 'Profil Ziyaretleri',             en: 'Profile Visits' },
  QUALITY_CALL:            { tr: 'Aramalar',                       en: 'Calls' },
  OFFSITE_CONVERSIONS:     { tr: 'Dönüşümler',                     en: 'Conversions' },
  LEAD_GENERATION:         { tr: 'Form Doldurma',                  en: 'Lead Generation' },
  POST_ENGAGEMENT:         { tr: 'Gönderi Etkileşimi',             en: 'Post Engagement' },
  PAGE_LIKES:              { tr: 'Sayfa Beğenileri',               en: 'Page Likes' },
}

export default function WizardSidebar({ state, currentStep }: WizardSidebarProps) {
  const locale = getLocaleFromCookie() as 'tr' | 'en'
  const c = state.campaign
  const a = state.adset
  const ad = state.ad
  const notSet = locale === 'tr' ? 'Belirtilmedi' : 'Not set'

  const isCbo = c.budgetOptimization === 'campaign'
  const objectiveLabel = OBJECTIVE_LABELS[c.objective]?.[locale] ?? c.objective
  const hasCategories = c.specialAdCategories.length > 0
  const categoryDisplay = hasCategories ? c.specialAdCategories.join(', ') : (locale === 'tr' ? 'Yok' : 'None')
  const campaignComplete = c.name.trim().length > 0
  const budgetStrategyLabel = isCbo
    ? (locale === 'tr' ? 'Kampanya Bütçesi (CBO)' : 'Campaign Budget (CBO)')
    : (locale === 'tr' ? 'Reklam Seti Bütçesi (ABO)' : 'Ad Set Budget (ABO)')
  const cboBudgetDisplay = isCbo && c.campaignBudget
    ? `${c.campaignBudget.toLocaleString('tr-TR')} TRY / ${c.campaignBudgetType === 'lifetime' ? (locale === 'tr' ? 'Toplam' : 'Lifetime') : (locale === 'tr' ? 'Günlük' : 'Daily')}`
    : null

  const targeting = a.targeting
  const convLocLabel = CONV_LOCATION_LABELS[a.conversionLocation]?.[locale] ?? a.conversionLocation
  const adsetBudgetDisplay = !isCbo && a.budget
    ? `${a.budget.toLocaleString('tr-TR')} TRY / ${a.budgetType === 'lifetime' ? (locale === 'tr' ? 'Toplam' : 'Lifetime') : (locale === 'tr' ? 'Günlük' : 'Daily')}`
    : !isCbo ? notSet : (locale === 'tr' ? 'CBO tarafından yönetiliyor' : 'Managed by CBO')
  const scheduleStart = a.startType === 'now' ? (locale === 'tr' ? 'Şimdi' : 'Now') : (a.startTime || (locale === 'tr' ? 'Tarih seç' : 'Select date'))
  const scheduleEnd = a.endType === 'unlimited' ? (locale === 'tr' ? 'Süresiz' : 'Ongoing') : (a.endTime || (locale === 'tr' ? 'Bitiş tarihi' : 'End date'))
  const scheduleDisplay = `${scheduleStart} → ${scheduleEnd}`
  const hasLocations = targeting.locations.length > 0
  const hasAgeChange = targeting.ageMin !== 18 || targeting.ageMax !== 65
  const hasGenderFilter = targeting.genders.length > 0
  const hasCustomAudiences = targeting.custom_audiences.length > 0
  const genderLabel = targeting.genders.length === 0
    ? (locale === 'tr' ? 'Hepsi' : 'All')
    : targeting.genders.length === 1 && targeting.genders[0] === 1
      ? (locale === 'tr' ? 'Erkek' : 'Male')
      : targeting.genders.length === 1 && targeting.genders[0] === 2
        ? (locale === 'tr' ? 'Kadın' : 'Female')
        : (locale === 'tr' ? 'Hepsi' : 'All')
  const placementsDisplay = a.placements === 'advantage'
    ? (locale === 'tr' ? 'Advantage+ Yerleşimleri' : 'Advantage+ Placements')
    : (locale === 'tr' ? 'Manuel Yerleşimler' : 'Manual Placements')
  const optGoalDisplay = OPT_GOAL_LABELS[a.optimizationGoal]?.[locale] ?? a.optimizationGoal

  const hasCreativeMedia = !!(
    ad.media.hash ||
    ad.media.videoId ||
    (ad.format === 'carousel' && Array.isArray(ad.carouselCards) && ad.carouselCards.some((c: any) => c.imageHash || c.videoId))
  )
  // Text complete: for existing posts, check existingPostData; for create mode, check primaryText
  const textComplete = ad.adCreationMode === 'existing'
    ? !!(ad.existingPostData)
    : !!(ad.primaryText)
  const FORMAT_LABELS: Record<string, string> = {
    single_image: locale === 'tr' ? 'Tek Görsel' : 'Single Image',
    single_video: locale === 'tr' ? 'Tek Video' : 'Single Video',
    carousel: 'Carousel',
  }
  const formatLabel = FORMAT_LABELS[ad.format] ?? ad.format
  const adsetHasBudget = isCbo
    ? !!(c.campaignBudget && Number(c.campaignBudget) > 0)
    : !!(a.budget && Number(a.budget) > 0)
  const creativeComplete = ad.adCreationMode === 'existing'
    ? !!(a.pageId && ad.existingPostId)
    : !!(a.pageId && hasCreativeMedia && textComplete)
  const allReady = campaignComplete && adsetHasBudget && creativeComplete

  return (
    <div className="sticky top-8 space-y-4">
      <div className="light-sweep-wrapper rounded-md w-fit">
        <h3 className="text-lg font-semibold text-gray-900">
          {locale === 'tr' ? 'Özet' : 'Summary'}
        </h3>
      </div>

      <SidebarCard icon={<Target className="w-4 h-4" />} title={locale === 'tr' ? 'Kampanya' : 'Campaign'} active={currentStep === 1} complete={campaignComplete}>
        <Row label={locale === 'tr' ? 'İsim' : 'Name'} value={c.name || notSet} muted={!c.name} />
        <Row label={locale === 'tr' ? 'Amaç' : 'Objective'} value={objectiveLabel} />
        <Row label={locale === 'tr' ? 'Bütçe' : 'Budget'} value={budgetStrategyLabel} />
        {cboBudgetDisplay && <Row label={locale === 'tr' ? 'Tutar' : 'Amount'} value={cboBudgetDisplay} />}
        <Row label={locale === 'tr' ? 'Kategoriler' : 'Categories'} value={categoryDisplay} muted={!hasCategories} />
      </SidebarCard>

      <SidebarCard icon={<Layers className="w-4 h-4" />} title={locale === 'tr' ? 'Reklam Seti' : 'Ad Set'} active={currentStep === 2}>
        <Row label={locale === 'tr' ? 'İsim' : 'Name'} value={a.name || notSet} muted={!a.name} />
        <Row label={locale === 'tr' ? 'Konum' : 'Location'} value={convLocLabel} />
        <Row label={locale === 'tr' ? 'Bütçe' : 'Budget'} value={adsetBudgetDisplay} muted={!isCbo && !a.budget} />
        <Row label={locale === 'tr' ? 'Zamanlama' : 'Schedule'} value={scheduleDisplay} />
        {hasLocations && <Row label={locale === 'tr' ? 'Konumlar' : 'Locations'} value={targeting.locations.map(l => l.name).join(', ')} />}
        <Row label={locale === 'tr' ? 'Yaş' : 'Age'} value={`${targeting.ageMin}–${targeting.ageMax}+`} muted={!hasAgeChange} />
        <Row label={locale === 'tr' ? 'Cinsiyet' : 'Gender'} value={genderLabel} muted={!hasGenderFilter} />
        {hasCustomAudiences && <Row label={locale === 'tr' ? 'Özel Kitle' : 'Custom Audiences'} value={`${targeting.custom_audiences.length}`} />}
        <div className="flex justify-between items-center mt-1 gap-2 py-0.5">
          <span className="text-[12px] text-gray-500 shrink-0">{locale === 'tr' ? 'Yerleşimler' : 'Placements'}</span>
          <span className="inline-flex items-center gap-1 text-[12px] text-gray-800 font-medium">
            {a.placements === 'advantage' && <Sparkles className="w-3 h-3 text-primary" />}
            <span className="truncate">{placementsDisplay}</span>
          </span>
        </div>
        <Row label={locale === 'tr' ? 'Optimizasyon' : 'Optimization'} value={optGoalDisplay} />
      </SidebarCard>

      <SidebarCard icon={<Image className="w-4 h-4" />} title={locale === 'tr' ? 'Reklam' : 'Creative'} active={currentStep === 3} complete={creativeComplete}>
        <Row label={locale === 'tr' ? 'İsim' : 'Name'} value={ad.name || notSet} muted={!ad.name} />
        {ad.adCreationMode === 'existing' ? (
          <Row label={locale === 'tr' ? 'Gönderi' : 'Post'} value={ad.existingPostId ? (locale === 'tr' ? 'Seçildi' : 'Selected') : notSet} muted={!ad.existingPostId} />
        ) : (
          <>
            <Row label={locale === 'tr' ? 'Format' : 'Format'} value={formatLabel} />
            <Row label={locale === 'tr' ? 'Medya' : 'Media'} value={hasCreativeMedia ? (locale === 'tr' ? 'Eklendi' : 'Attached') : (locale === 'tr' ? 'Yok' : 'None')} muted={!hasCreativeMedia} />
            <Row label={locale === 'tr' ? 'Metin' : 'Text'} value={textComplete ? (locale === 'tr' ? 'Tamamlandı' : 'Complete') : (locale === 'tr' ? 'Eksik' : 'Incomplete')} muted={!textComplete} />
          </>
        )}
        <Row label="CTA" value={getCtaLabel(ad.callToAction)} />
        {requiresWebsiteUrl(state.campaign.objective, state.adset.conversionLocation, state.adset.optimizationGoal) && state.adset.conversionLocation !== 'ON_AD' && <Row label="URL" value={ad.websiteUrl || notSet} muted={!ad.websiteUrl} />}
      </SidebarCard>

      {currentStep === 4 && (
        <SidebarCard icon={<FileText className="w-4 h-4" />} title={locale === 'tr' ? 'Yayın Durumu' : 'Publish Status'} active>
          <Row label={locale === 'tr' ? 'Kampanya' : 'Campaign'} value={campaignComplete ? '✓' : '—'} muted={!campaignComplete} />
          <Row label={locale === 'tr' ? 'Reklam Seti' : 'Ad Set'} value={adsetHasBudget ? '✓' : '—'} muted={!adsetHasBudget} />
          <Row label={locale === 'tr' ? 'Reklam' : 'Creative'} value={creativeComplete ? '✓' : '—'} muted={!creativeComplete} />
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              {allReady ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span className="text-[12px] font-semibold text-emerald-700">{locale === 'tr' ? 'Yayınlamaya hazır' : 'Ready to publish'}</span></>
              ) : (
                <><XCircle className="w-3.5 h-3.5 text-red-500" /><span className="text-[12px] font-semibold text-red-600">{locale === 'tr' ? 'Eksik alanlar var' : 'Missing required fields'}</span></>
              )}
            </div>
          </div>
        </SidebarCard>
      )}
    </div>
  )
}

function SidebarCard({ icon, title, active, complete, children }: {
  icon: React.ReactNode; title: string; active: boolean; complete?: boolean; children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-200 ${
        active
          ? 'border-primary/40 bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] shadow-[0_2px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]'
          : 'border-gray-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`p-1 rounded-md ${
            active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {icon}
        </span>
        <h4 className="text-[12px] font-semibold text-gray-700 uppercase tracking-wider flex-1">{title}</h4>
        {complete && !active && (
          <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <Check className="w-3 h-3 text-primary" />
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-[12px] text-gray-500 shrink-0">{label}</span>
      <span className={`text-[12px] font-medium text-right truncate ${muted ? 'text-gray-300 italic' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}
