'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Globe, Layers,
  Wallet, Calendar,
  Users, UserPlus, UserMinus, Target, MapPin,
  LayoutGrid, Sparkles, Settings2,
  Zap,
  Lock, Plus, X, Search, ChevronDown,
  Smartphone, MessageCircle, Camera, Phone,
  Info,
} from 'lucide-react'
import { getTrafficI18n, type TrafficI18n } from './i18n'
import { useMetaTargetingSearch, useMetaDetailedTargetingSearch, useMetaAudiences } from './useAudienceSearch'
import TWCreateAudienceModal from './TWCreateAudienceModal'
import type { TrafficWizardState } from './types'

interface TWStepAdSetProps {
  state: TrafficWizardState
  onChange: (updates: Partial<TrafficWizardState>) => void
}

/* ── Destination → Optimization Goal mapping (matches real Meta) ── */

const DESTINATION_OPTIONS: {
  value: TrafficWizardState['adset']['destination']
  icon: typeof Globe
  labelKey: keyof TrafficI18n
  descKey: keyof TrafficI18n
}[] = [
  { value: 'WEBSITE', icon: Globe, labelKey: 'destinationWebsite', descKey: 'destinationWebsiteDesc' },
  { value: 'APP', icon: Smartphone, labelKey: 'destinationApp', descKey: 'destinationAppDesc' },
  { value: 'MESSAGING', icon: MessageCircle, labelKey: 'destinationMessaging', descKey: 'destinationMessagingDesc' },
  { value: 'INSTAGRAM_PROFILE', icon: Camera, labelKey: 'destinationInstagramProfile', descKey: 'destinationInstagramProfileDesc' },
  { value: 'PHONE_CALL', icon: Phone, labelKey: 'destinationPhoneCall', descKey: 'destinationPhoneCallDesc' },
]

const DESTINATION_GOALS: Record<string, { value: string; labelKey: keyof TrafficI18n }[]> = {
  WEBSITE: [
    { value: 'LINK_CLICKS', labelKey: 'optimizationGoalLinkClicks' },
    { value: 'LANDING_PAGE_VIEWS', labelKey: 'optimizationGoalLandingPageViews' },
    { value: 'IMPRESSIONS', labelKey: 'optimizationGoalImpressions' },
    { value: 'REACH', labelKey: 'optimizationGoalReach' },
  ],
  APP: [
    { value: 'LINK_CLICKS', labelKey: 'optimizationGoalLinkClicks' },
    { value: 'APP_INSTALLS', labelKey: 'optimizationGoalAppInstalls' },
  ],
  MESSAGING: [
    { value: 'CONVERSATIONS', labelKey: 'optimizationGoalConversations' },
    { value: 'LINK_CLICKS', labelKey: 'optimizationGoalLinkClicks' },
  ],
  INSTAGRAM_PROFILE: [
    { value: 'VISIT_INSTAGRAM_PROFILE', labelKey: 'optimizationGoalProfileVisits' },
  ],
  PHONE_CALL: [
    { value: 'QUALITY_CALL', labelKey: 'optimizationGoalCalls' },
  ],
}

const MESSAGING_PLATFORMS = [
  { value: 'MESSENGER' as const, label: 'Messenger' },
  { value: 'WHATSAPP' as const, label: 'WhatsApp' },
  { value: 'INSTAGRAM' as const, label: 'Instagram Direct' },
]

export default function TWStepAdSet({ state, onChange }: TWStepAdSetProps) {
  const t = getTrafficI18n()
  const a = state.adset
  const isCbo = state.campaign.budgetOptimization === 'campaign'

  const updateAdSet = (updates: Partial<TrafficWizardState['adset']>) => {
    onChange({ adset: { ...a, ...updates } })
  }

  // ── Local search state ──
  const [customSearch, setCustomSearch] = useState('')
  const [excludedSearch, setExcludedSearch] = useState('')
  const [interestSearch, setInterestSearch] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [languageSearch, setLanguageSearch] = useState('')

  // ── Meta API-backed search hooks ──
  const { results: rawDetailedTargeting, loading: detailedLoading } = useMetaDetailedTargetingSearch(interestSearch)
  const { results: rawLocations, loading: locationLoading } = useMetaTargetingSearch('locations', locationSearch)
  const { results: rawLocales, loading: languageLoading } = useMetaTargetingSearch('locales', languageSearch)
  const { audiences: allAudiences, savedAudiences, search: searchAudiences, loading: audiencesLoading, refresh: refreshAudiences } = useMetaAudiences()

  // ── Create Audience modal state ──
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createModalMode, setCreateModalMode] = useState<'custom' | 'lookalike' | undefined>(undefined)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const createMenuRef = useRef<HTMLDivElement>(null)

  // ── Audience section UI state ──
  const [audienceTab, setAudienceTab] = useState<'new' | 'saved'>('new')
  const [savedAudienceSearch, setSavedAudienceSearch] = useState('')
  const [showExcluded, setShowExcluded] = useState(a.excludedCustomAudiences.length > 0)
  const [savedDropdownOpen, setSavedDropdownOpen] = useState(false)
  const savedDropdownRef = useRef<HTMLDivElement>(null)
  const [saveAudienceOpen, setSaveAudienceOpen] = useState(false)
  const [saveAudienceName, setSaveAudienceName] = useState('')
  const [saveAudienceLoading, setSaveAudienceLoading] = useState(false)
  const [saveAudienceMsg, setSaveAudienceMsg] = useState('')

  // ── Close create menu on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false)
      }
      if (savedDropdownRef.current && !savedDropdownRef.current.contains(e.target as Node)) {
        setSavedDropdownOpen(false)
      }
    }
    if (createMenuOpen || savedDropdownOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [createMenuOpen, savedDropdownOpen])

  // ── Save audience handler ──
  const handleSaveAudience = async () => {
    if (!saveAudienceName.trim() || saveAudienceLoading) return
    setSaveAudienceLoading(true)
    setSaveAudienceMsg('')
    try {
      const targeting: Record<string, unknown> = {}
      // geo_locations
      if (a.locations.length > 0) {
        const countries = a.locations.filter(l => l.type === 'country').map(l => l.key)
        const cities = a.locations.filter(l => l.type === 'city').map(l => ({ key: l.key }))
        const regions = a.locations.filter(l => l.type === 'region').map(l => ({ key: l.key }))
        targeting.geo_locations = {
          ...(countries.length > 0 ? { countries } : {}),
          ...(cities.length > 0 ? { cities } : {}),
          ...(regions.length > 0 ? { regions } : {}),
        }
      }
      targeting.age_min = a.ageMin
      targeting.age_max = a.ageMax
      if (a.genders.length > 0) targeting.genders = a.genders
      if (a.locales.length > 0) targeting.locales = a.locales.map(l => l.id)
      if (a.detailedTargeting.length > 0) {
        const interests = a.detailedTargeting.filter(d => d.type === 'interest').map(d => ({ id: d.id, name: d.name }))
        const behaviors = a.detailedTargeting.filter(d => d.type === 'behavior').map(d => ({ id: d.id, name: d.name }))
        if (interests.length > 0 || behaviors.length > 0) {
          targeting.flexible_spec = [{ ...(interests.length > 0 ? { interests } : {}), ...(behaviors.length > 0 ? { behaviors } : {}) }]
        }
      }
      if (a.customAudiences.length > 0) {
        targeting.custom_audiences = a.customAudiences.map(c => ({ id: c.id }))
      }
      if (a.excludedCustomAudiences.length > 0) {
        targeting.excluded_custom_audiences = a.excludedCustomAudiences.map(c => ({ id: c.id }))
      }

      const res = await fetch('/api/meta/audiences/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveAudienceName.trim(), targeting }),
      })
      const data = await res.json()
      if (data.ok) {
        setSaveAudienceMsg(t.audienceSaveSuccess)
        refreshAudiences()
        setTimeout(() => { setSaveAudienceOpen(false); setSaveAudienceMsg(''); setSaveAudienceName('') }, 1500)
      } else {
        setSaveAudienceMsg(data.message || t.audienceSaveError)
      }
    } catch {
      setSaveAudienceMsg(t.audienceSaveError)
    } finally {
      setSaveAudienceLoading(false)
    }
  }

  // ── Type label helper ──
  const typeLabel = (type: 'interest' | 'behavior' | 'demographic') => {
    if (type === 'interest') return t.audienceTypeInterest
    if (type === 'behavior') return t.audienceTypeBehavior
    return t.audienceTypeDemographic
  }

  const typeBadgeColor = (type: 'interest' | 'behavior' | 'demographic') => {
    if (type === 'interest') return 'bg-blue-50 text-blue-600'
    if (type === 'behavior') return 'bg-purple-50 text-purple-600'
    return 'bg-amber-50 text-amber-600'
  }

  // ── Transform API results for AudienceSearchInput ──
  const filteredDetailedTargeting = rawDetailedTargeting
    .filter(i => !a.detailedTargeting.find(x => x.id === i.id))
    .map(i => ({
      id: i.id,
      name: i.name,
      badge: typeLabel(i.type),
      badgeColor: typeBadgeColor(i.type),
      subtitle: [
        i.path?.[0],
        i.audience_size_lower_bound != null
          ? `${formatAudienceSize(i.audience_size_lower_bound)} – ${formatAudienceSize(i.audience_size_upper_bound)}`
          : undefined,
      ].filter(Boolean).join(' · ') || undefined,
      _type: i.type,
      _path: i.path,
    }))

  const filteredLocations = rawLocations
    .filter(l => !a.locations.find(x => x.key === l.key))
    .map(l => ({
      id: l.key,
      name: l.name,
      subtitle: [l.type, l.country_name].filter(Boolean).join(' · '),
    }))

  const filteredLanguages = rawLocales
    .filter(l => !a.locales.find(x => x.id === l.key))
    .map(l => ({ id: String(l.key), name: l.name }))

  const filteredCustomAudiences = searchAudiences(customSearch, a.customAudiences.map(x => x.id))
    .map(aud => ({ id: aud.id, name: aud.name, subtitle: aud.subtype || aud.type }))

  const filteredExcludedAudiences = searchAudiences(excludedSearch, a.excludedCustomAudiences.map(x => x.id))
    .map(aud => ({ id: aud.id, name: aud.name, subtitle: aud.subtype || aud.type }))

  return (
    <div className="space-y-8">

      {/* ═══════════════════════════════════════════════
          SECTION 0: Ad Set Identity (Name)
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Layers className="w-[18px] h-[18px]" />}
        title={t.sectionAdSetIdentity}
        description={t.sectionAdSetIdentityDesc}
      >
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5">
            {t.adsetNameLabel} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={a.name}
            onChange={(e) => updateAdSet({ name: e.target.value })}
            placeholder={t.adsetNamePlaceholder}
            maxLength={256}
            className={`w-full px-4 py-3 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
              a.name.trim() ? 'border-primary bg-primary/[0.02]' : 'border-gray-300'
            }`}
          />
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 1: Traffic Destination (Radio-style cards)
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Globe className="w-[18px] h-[18px]" />}
        title={t.sectionDestination}
        description={t.sectionDestinationDesc}
      >
        <div className="space-y-4">
          {/* Destination dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              {t.sectionDestination}
            </label>
            <select
              value={a.destination}
              onChange={(e) => {
                const dest = e.target.value as TrafficWizardState['adset']['destination']
                const goals = DESTINATION_GOALS[dest]
                updateAdSet({
                  destination: dest,
                  optimizationGoal: goals?.[0]?.value ?? 'LINK_CLICKS',
                })
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {DESTINATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t[opt.labelKey]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              {t[DESTINATION_OPTIONS.find(o => o.value === a.destination)?.descKey ?? 'destinationWebsiteDesc']}
            </p>
          </div>

          {/* ── Conditional fields per destination ── */}

          {/* Website URL is configured in Step 3 (Ad/Creative) */}

          {/* App → configuration note */}
          {a.destination === 'APP' && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span className="text-xs text-blue-700 font-medium">{t.destinationAppConfig}</span>
            </div>
          )}

          {/* Messaging → platform selection */}
          {a.destination === 'MESSAGING' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                {t.destinationMessagingPlatforms}
              </label>
              <div className="flex gap-2">
                {MESSAGING_PLATFORMS.map((p) => {
                  const selected = a.messagingApps?.includes(p.value) ?? false
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        const current = a.messagingApps ?? []
                        const next = selected
                          ? current.filter(x => x !== p.value)
                          : [...current, p.value]
                        updateAdSet({ messagingApps: next.length > 0 ? next : [p.value] })
                      }}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        selected
                          ? 'bg-primary/10 text-primary border border-primary/30'
                          : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Instagram Profile → note about Step 3 */}
          {a.destination === 'INSTAGRAM_PROFILE' && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span className="text-xs text-blue-700 font-medium">{t.destinationInstagramConfig}</span>
            </div>
          )}

          {/* Phone Call → phone number input */}
          {a.destination === 'PHONE_CALL' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                {t.destinationPhoneLabel}
              </label>
              <input
                type="tel"
                value={a.phoneNumber ?? ''}
                onChange={(e) => updateAdSet({ phoneNumber: e.target.value })}
                placeholder={t.destinationPhonePlaceholder}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          )}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 2: Budget & Schedule
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Wallet className="w-[18px] h-[18px]" />}
        title={t.sectionBudgetSchedule}
        description={isCbo ? t.sectionBudgetScheduleDescCbo : t.sectionBudgetScheduleDesc}
      >
        {/* Budget fields — only shown when ABO */}
        {!isCbo ? (
          <div className="space-y-4">
            {/* Budget type */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                {t.adsetBudgetType}
              </label>
              <div className="flex gap-2">
                <BudgetTypeButton
                  active={a.budgetType === 'daily'}
                  onClick={() => updateAdSet({ budgetType: 'daily' })}
                  label={t.adsetBudgetDaily}
                />
                <BudgetTypeButton
                  active={a.budgetType === 'lifetime'}
                  onClick={() => updateAdSet({ budgetType: 'lifetime' })}
                  label={t.adsetBudgetLifetime}
                />
              </div>
            </div>

            {/* Budget amount */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                {t.adsetBudgetAmount}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={a.budget ?? ''}
                  onChange={(e) => updateAdSet({ budget: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder={t.adsetBudgetPlaceholder}
                  className="w-full px-4 py-3 pr-14 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                  TRY
                </span>
              </div>
            </div>

            <Divider />
          </div>
        ) : (
          <div className="space-y-4 mb-4">
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <Lock className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-xs text-blue-700 font-medium">{t.managedByCbo}</span>
            </div>
            {/* CBO Ad Set Spending Limits (optional) */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                {t.cboSpendingLimitsLabel}
              </label>
              <p className="text-[11px] text-gray-400 mb-2">{t.cboSpendingLimitsDesc}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={a.cboSpendingMin ?? ''}
                    onChange={(e) => updateAdSet({ cboSpendingMin: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={t.cboSpendingMin}
                    className="w-full px-3 py-2.5 pr-14 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">TRY</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={a.cboSpendingMax ?? ''}
                    onChange={(e) => updateAdSet({ cboSpendingMax: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={t.cboSpendingMax}
                    className="w-full px-3 py-2.5 pr-14 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">TRY</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {t.scheduleLabel}
            </div>
          </label>
          <div className="grid grid-cols-2 gap-4">
            {/* Start */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-gray-500">{t.scheduleStart}</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tw-startType"
                  checked={a.startType === 'now'}
                  onChange={() => updateAdSet({ startType: 'now', startTime: '' })}
                  className="text-primary focus:ring-primary/20"
                />
                <span className="text-sm text-gray-700">{t.scheduleNow}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tw-startType"
                  checked={a.startType === 'schedule'}
                  onChange={() => updateAdSet({ startType: 'schedule' })}
                  className="text-primary focus:ring-primary/20"
                />
                <span className="text-sm text-gray-700">{t.scheduleSelectDate}</span>
              </label>
              {a.startType === 'schedule' && (
                <input
                  type="datetime-local"
                  value={a.startTime}
                  onChange={(e) => updateAdSet({ startTime: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              )}
            </div>
            {/* End */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-gray-500">{t.scheduleEnd}</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tw-endType"
                  checked={a.endType === 'unlimited'}
                  onChange={() => updateAdSet({ endType: 'unlimited', endTime: null })}
                  className="text-primary focus:ring-primary/20"
                />
                <span className="text-sm text-gray-700">{t.scheduleUnlimited}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tw-endType"
                  checked={a.endType === 'schedule'}
                  onChange={() => updateAdSet({ endType: 'schedule' })}
                  className="text-primary focus:ring-primary/20"
                />
                <span className="text-sm text-gray-700">{t.scheduleEndDate}</span>
              </label>
              {a.endType === 'schedule' && (
                <input
                  type="datetime-local"
                  value={a.endTime ?? ''}
                  onChange={(e) => updateAdSet({ endTime: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 3: Audience (Meta Ads Manager Parity)
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Users className="w-[18px] h-[18px]" />}
        title={t.sectionAudience}
        description={t.sectionAudienceDesc}
      >
        <div className="space-y-6">

          {/* ── Top tabs ── */}
          <div className="flex items-center gap-1 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setAudienceTab('new')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                audienceTab === 'new'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.audienceNewAudienceTab}
            </button>
            <button
              type="button"
              onClick={() => setAudienceTab('saved')}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors ${
                audienceTab === 'saved'
                  ? 'text-gray-900 border-b-2 border-gray-900 font-semibold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.audienceUseSavedTab}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Saved Audience Tab Content ── */}
          {audienceTab === 'saved' && (
            <div className="space-y-3">
              {/* Search box */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={savedAudienceSearch}
                  onChange={(e) => setSavedAudienceSearch(e.target.value)}
                  placeholder={t.audienceCustomSearchPlaceholder2}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              {/* Audience list */}
              <div className="max-h-[320px] overflow-y-auto space-y-1">
                {savedAudiences.length > 0 ? (
                  savedAudiences
                    .filter(sa => !savedAudienceSearch || sa.name.toLowerCase().includes(savedAudienceSearch.toLowerCase()))
                    .map(sa => {
                      const isSelected = a.savedAudienceId === sa.id
                      return (
                        <button
                          key={sa.id}
                          type="button"
                          onClick={() => {
                            updateAdSet({ savedAudienceId: isSelected ? undefined : sa.id })
                            if (!isSelected && sa.targeting) {
                              const tgt = sa.targeting as Record<string, unknown>
                              const updates: Partial<TrafficWizardState['adset']> = { savedAudienceId: sa.id }
                              if (tgt.age_min) updates.ageMin = tgt.age_min as number
                              if (tgt.age_max) updates.ageMax = tgt.age_max as number
                              if (tgt.genders && Array.isArray(tgt.genders)) updates.genders = tgt.genders as number[]
                              if (tgt.geo_locations) {
                                const geo = tgt.geo_locations as Record<string, unknown>
                                const locs: { type: string; key: string; name: string }[] = []
                                if (Array.isArray(geo.countries)) {
                                  for (const c of geo.countries) locs.push({ type: 'country', key: String(c), name: String(c) })
                                }
                                if (locs.length > 0) updates.locations = locs
                              }
                              updateAdSet(updates)
                            }
                          }}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/[0.03] ring-1 ring-primary/20'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <span className={`text-sm font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                            {sa.name}
                          </span>
                        </button>
                      )
                    })
                ) : (
                  <p className="text-sm text-gray-400 italic py-4 text-center">{t.audienceNoSavedAudiences}</p>
                )}
              </div>
            </div>
          )}

          {/* ── New Audience Tab Content ── */}
          {audienceTab === 'new' && <>

          {/* ── Özel Hedef Kitleler ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-800">{t.audienceCustomLabel}</span>
              <div ref={createMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCreateMenuOpen(!createMenuOpen)}
                  className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  {t.audienceCreateNew}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {createMenuOpen && (
                  <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <button
                      type="button"
                      onClick={() => { setCreateMenuOpen(false); setCreateModalMode('custom'); setCreateModalOpen(true) }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors rounded-t-lg"
                    >
                      <span className="text-sm font-semibold text-gray-900 block">{t.audienceCreateCustom}</span>
                      <span className="text-xs text-gray-500 block mt-0.5">{t.audienceCreateCustomDesc2}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCreateMenuOpen(false); setCreateModalMode('lookalike'); setCreateModalOpen(true) }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors rounded-b-lg border-t border-gray-100"
                    >
                      <span className="text-sm font-semibold text-gray-900 block">{t.audienceCreateLookalike}</span>
                      <span className="text-xs text-gray-500 block mt-0.5">{t.audienceCreateLookalikeDesc2}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <AudienceSearchInput
              value={customSearch}
              onChange={setCustomSearch}
              placeholder={t.audienceCustomSearchPlaceholder2}
              results={filteredCustomAudiences}
              noResultsText={t.audienceCustomNoResults}
              loading={audiencesLoading}
              onSelect={(item) => {
                if (!a.customAudiences.find(x => x.id === item.id)) {
                  updateAdSet({ customAudiences: [...a.customAudiences, { id: item.id, name: item.name }] })
                }
                setCustomSearch('')
              }}
            />
            {a.customAudiences.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {a.customAudiences.map(aud => (
                  <Chip
                    key={aud.id}
                    label={aud.name}
                    onRemove={() => updateAdSet({ customAudiences: a.customAudiences.filter(x => x.id !== aud.id) })}
                  />
                ))}
              </div>
            )}

            {/* Toggle exclusions */}
            {!showExcluded ? (
              <button
                type="button"
                onClick={() => setShowExcluded(true)}
                className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
              >
                {t.audienceAddExclusions}
              </button>
            ) : (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-600">{t.audienceExcludedTitle}</span>
                  <button
                    type="button"
                    onClick={() => { setShowExcluded(false); if (a.excludedCustomAudiences.length === 0) setExcludedSearch('') }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <AudienceSearchInput
                  value={excludedSearch}
                  onChange={setExcludedSearch}
                  placeholder={t.audienceExcludedSearchPlaceholder}
                  results={filteredExcludedAudiences}
                  noResultsText={t.audienceCustomNoResults}
                  loading={audiencesLoading}
                  onSelect={(item) => {
                    if (!a.excludedCustomAudiences.find(x => x.id === item.id)) {
                      updateAdSet({ excludedCustomAudiences: [...a.excludedCustomAudiences, { id: item.id, name: item.name }] })
                    }
                    setExcludedSearch('')
                  }}
                />
                {a.excludedCustomAudiences.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {a.excludedCustomAudiences.map(aud => (
                      <Chip
                        key={aud.id}
                        label={aud.name}
                        variant="danger"
                        onRemove={() => updateAdSet({ excludedCustomAudiences: a.excludedCustomAudiences.filter(x => x.id !== aud.id) })}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── * Konumlar ── */}
          <div>
            <label className="text-sm font-semibold text-gray-800 mb-1.5 block">
              <span className="text-red-500">*</span> {t.audienceLocations}
            </label>
            <AudienceSearchInput
              value={locationSearch}
              onChange={setLocationSearch}
              placeholder={t.audienceLocationsPlaceholder}
              results={filteredLocations}
              noResultsText={t.audienceDetailedNoResults}
              loading={locationLoading}
              onSelect={(item) => {
                const raw = rawLocations.find(l => l.key === item.id)
                if (raw && !a.locations.find(x => x.key === raw.key)) {
                  updateAdSet({ locations: [...a.locations, { type: raw.type, key: raw.key, name: raw.name }] })
                }
                setLocationSearch('')
              }}
            />
            {a.locations.length > 0 ? (
              <div className="mt-2">
                <span className="text-xs text-gray-500">{t.audienceIncludedLocation}</span>
                <ul className="mt-1 space-y-0.5">
                  {a.locations.map(loc => (
                    <li key={loc.key} className="flex items-center gap-2 text-sm text-gray-800">
                      <span className="text-gray-400">•</span>
                      {loc.name}
                      <button
                        type="button"
                        onClick={() => updateAdSet({ locations: a.locations.filter(x => x.key !== loc.key) })}
                        className="text-gray-300 hover:text-gray-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-gray-400 italic">{t.audienceLocationsNone}</p>
            )}
          </div>

          {/* ── Yaş ── */}
          <div>
            <label className="text-sm font-semibold text-gray-800 mb-2 block">{t.audienceAge}</label>
            <div className="flex items-center gap-3">
              <select
                value={a.ageMin}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  updateAdSet({ ageMin: v, ...(v > a.ageMax ? { ageMax: v } : {}) })
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {Array.from({ length: 48 }, (_, i) => 18 + i).map(age => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
              <span className="text-gray-400">-</span>
              <select
                value={a.ageMax}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  updateAdSet({ ageMax: v, ...(v < a.ageMin ? { ageMin: v } : {}) })
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {Array.from({ length: 48 }, (_, i) => 18 + i).map(age => (
                  <option key={age} value={age}>{age === 65 ? '65+' : age}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Cinsiyet ── */}
          <div>
            <label className="text-sm font-semibold text-gray-800 mb-2 block">{t.audienceGender}</label>
            <div className="flex gap-2">
              <GenderButton active={a.genders.length === 0} onClick={() => updateAdSet({ genders: [] })} label={t.audienceGenderAll} />
              <GenderButton active={a.genders.length === 1 && a.genders[0] === 1} onClick={() => updateAdSet({ genders: [1] })} label={t.audienceGenderMale} />
              <GenderButton active={a.genders.length === 1 && a.genders[0] === 2} onClick={() => updateAdSet({ genders: [2] })} label={t.audienceGenderFemale} />
            </div>
          </div>

          {/* ── Advantage+ detaylı hedefleme ── */}
          <div>
            <label className="text-sm font-semibold text-gray-800 mb-1 block">
              {t.audienceAdvantageDetailed} <span className="text-primary font-bold">+</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">{t.audienceIncludeMatching}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <AudienceSearchInput
                  value={interestSearch}
                  onChange={setInterestSearch}
                  placeholder={t.audienceDetailedSearchPlaceholder2}
                  results={filteredDetailedTargeting}
                  noResultsText={t.audienceDetailedNoResults}
                  loading={detailedLoading}
                  onSelect={(item) => {
                    const raw = filteredDetailedTargeting.find(x => x.id === item.id)
                    if (!a.detailedTargeting.find(x => x.id === item.id)) {
                      updateAdSet({
                        detailedTargeting: [...a.detailedTargeting, {
                          id: item.id,
                          name: item.name,
                          type: raw?._type ?? 'interest',
                          path: raw?._path,
                        }],
                      })
                    }
                    setInterestSearch('')
                  }}
                />
              </div>
              <button
                type="button"
                className="text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors shrink-0"
              >
                {t.audienceBrowse}
              </button>
            </div>
            {a.detailedTargeting.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {a.detailedTargeting.map(dt => (
                  <Chip
                    key={dt.id}
                    label={dt.name}
                    badgeText={typeLabel(dt.type)}
                    badgeColor={typeBadgeColor(dt.type)}
                    onRemove={() => updateAdSet({ detailedTargeting: a.detailedTargeting.filter(x => x.id !== dt.id) })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Diller ── */}
          <div>
            <label className="text-sm font-semibold text-gray-800 mb-1.5 block">{t.audienceLanguages}</label>
            <AudienceSearchInput
              value={languageSearch}
              onChange={setLanguageSearch}
              placeholder={t.audienceLanguagesSearchPlaceholder}
              results={filteredLanguages}
              noResultsText={t.audienceDetailedNoResults}
              loading={languageLoading}
              onSelect={(item) => {
                const langId = Number(item.id)
                if (!a.locales.find(x => x.id === langId)) {
                  updateAdSet({ locales: [...a.locales, { id: langId, name: item.name }] })
                }
                setLanguageSearch('')
              }}
            />
            {a.locales.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {a.locales.map(lang => (
                  <Chip
                    key={lang.id}
                    label={lang.name}
                    onRemove={() => updateAdSet({ locales: a.locales.filter(x => x.id !== lang.id) })}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-400">{t.audienceAllLanguages}</p>
            )}
          </div>

          {/* ── A/B Test Checkbox ── */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" disabled className="mt-0.5 w-4 h-4 rounded border-gray-300" />
            <span className="text-xs text-gray-600 leading-relaxed">{t.audienceAbTestLabel}</span>
          </label>

          {/* ── Hedef kitleyi kaydet ── */}
          {!saveAudienceOpen ? (
            <button
              type="button"
              onClick={() => setSaveAudienceOpen(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t.audienceSaveAudience}
            </button>
          ) : (
            <div className="p-3 border border-gray-200 rounded-lg space-y-2">
              <input
                type="text"
                value={saveAudienceName}
                onChange={e => setSaveAudienceName(e.target.value)}
                placeholder={t.audienceSaveNamePlaceholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {saveAudienceMsg && (
                <p className={`text-xs ${saveAudienceMsg.includes('!') ? 'text-green-600' : 'text-red-600'}`}>{saveAudienceMsg}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setSaveAudienceOpen(false); setSaveAudienceName(''); setSaveAudienceMsg('') }}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {t.createBtnCancel}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAudience}
                  disabled={!saveAudienceName.trim() || saveAudienceLoading}
                  className="px-3 py-1.5 text-xs text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveAudienceLoading ? t.audienceSaving : t.audienceSaveAudience}
                </button>
              </div>
            </div>
          )}

          </>}

        </div>
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 4: Placements
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<LayoutGrid className="w-[18px] h-[18px]" />}
        title={t.sectionPlacements}
        description={t.sectionPlacementsDesc}
      >
        <div className="space-y-3">
          {/* Placement mode segmented control */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              {t.sectionPlacements}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateAdSet({ placementsMode: 'advantage' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  a.placementsMode === 'advantage'
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t.placementsAdvantage}
                {a.placementsMode === 'advantage' && (
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-semibold uppercase">
                    {t.placementsAdvantageRecommended}
                  </span>
                )}
              </button>
              <button
                type="button"
                disabled
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed"
              >
                <Settings2 className="w-3.5 h-3.5" />
                {t.placementsManual}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {t.placementsAdvantageDesc}
            </p>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════
          SECTION 5: Optimization & Delivery
          ═══════════════════════════════════════════════ */}
      <Section
        icon={<Zap className="w-[18px] h-[18px]" />}
        title={t.sectionOptimization}
        description={t.sectionOptimizationDesc}
      >
        <div className="space-y-5">
          {/* Optimization Goal — conditional on destination */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              {t.optimizationGoal}
            </label>
            {(() => {
              const goals = DESTINATION_GOALS[a.destination] ?? DESTINATION_GOALS.WEBSITE
              return goals.length === 1 ? (
                /* Single goal — show as locked pill */
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{t[goals[0].labelKey]}</span>
                </div>
              ) : (
                <select
                  value={a.optimizationGoal}
                  onChange={(e) => updateAdSet({ optimizationGoal: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {goals.map(({ value, labelKey }) => (
                    <option key={value} value={value}>{t[labelKey]}</option>
                  ))}
                </select>
              )
            })()}
            <p className="mt-1.5 text-xs text-gray-400">{t.optimizationGoalDesc}</p>
          </div>

          <Divider />

          {/* Bid Strategy */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              {t.bidStrategyLabel}
            </label>
            <select
              value={a.bidStrategy ?? ''}
              onChange={(e) => {
                const v = e.target.value
                if (!v) {
                  updateAdSet({ bidStrategy: undefined, bidAmount: undefined })
                } else {
                  updateAdSet({ bidStrategy: v as 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP' })
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">{t.bidStrategyAuto}</option>
              <option value="LOWEST_COST_WITH_BID_CAP">{t.bidStrategyBidCap}</option>
              <option value="COST_CAP">{t.bidStrategyCostCap}</option>
            </select>
            <p className="mt-1.5 text-xs text-gray-400">{t.bidStrategyAutoDesc}</p>
          </div>

          {/* Bid amount (when cap selected) */}
          {a.bidStrategy && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                {t.bidAmountLabel}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={a.bidAmount ?? ''}
                  onChange={(e) => updateAdSet({ bidAmount: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder={t.bidAmountPlaceholder}
                  className="w-full px-4 py-3 pr-14 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                  TRY
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">{t.bidAmountHelper}</p>
            </div>
          )}
        </div>
      </Section>

      {/* ── Create Audience Modal ── */}
      <TWCreateAudienceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialMode={createModalMode}
        audiences={allAudiences}
        onCreated={(newAud) => {
          // Auto-add created audience to included custom audiences
          if (!a.customAudiences.find(x => x.id === newAud.id)) {
            updateAdSet({ customAudiences: [...a.customAudiences, { id: newAud.id, name: newAud.name }] })
          }
          // Refresh audience list so it appears in future searches
          refreshAudiences()
        }}
      />
    </div>
  )
}

/* ── Reusable sub-components ── */

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="mt-0.5 text-gray-400">{icon}</span>
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function AudienceBlock({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-gray-400">{icon}</span>
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      </div>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      {children}
    </div>
  )
}

function BudgetTypeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-primary/10 text-primary border border-primary/30'
          : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  )
}

function GenderButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-primary/10 text-primary border border-primary/30'
          : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  )
}

function Divider() {
  return <div className="border-t border-gray-100" />
}

function AudienceSearchInput({
  value,
  onChange,
  placeholder,
  results,
  onSelect,
  noResultsText,
  loading,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  results: { id: string; name: string; subtitle?: string; badge?: string; badgeColor?: string }[]
  onSelect?: (item: { id: string; name: string }) => void
  noResultsText: string
  loading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => { if (value.length > 0) setOpen(true) }}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
        )}
      </div>
      {open && value.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-3 flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-primary rounded-full animate-spin shrink-0" />
              <span className="text-xs text-gray-400">...</span>
            </div>
          ) : results.length > 0 ? (
            results.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onSelect?.(item); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">{item.name}</span>
                  {item.badge && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${item.badgeColor || 'bg-gray-100 text-gray-500'}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.subtitle && (
                  <span className="block text-[11px] text-gray-400 mt-0.5">{item.subtitle}</span>
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-xs text-gray-400 italic">{noResultsText}</p>
          )}
        </div>
      )}
    </div>
  )
}

function formatAudienceSize(n?: number): string {
  if (n == null) return '?'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function Chip({
  label,
  onRemove,
  variant = 'default',
  badgeText,
  badgeColor,
}: {
  label: string
  onRemove: () => void
  variant?: 'default' | 'danger'
  badgeText?: string
  badgeColor?: string
}) {
  const colors = variant === 'danger'
    ? 'bg-red-50 text-red-600 border-red-200'
    : 'bg-primary/10 text-primary border-primary/20'

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${colors}`}>
      {label}
      {badgeText && (
        <span className={`px-1 py-0.5 rounded text-[9px] font-semibold leading-none ${badgeColor || 'bg-gray-100 text-gray-500'}`}>
          {badgeText}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="hover:opacity-70 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}
