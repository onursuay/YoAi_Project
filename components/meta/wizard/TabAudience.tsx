'use client'

import { useState, useEffect, useRef } from 'react'
import type { WizardState } from './types'
import { X, Search, ChevronDown, Plus, Users, UserPlus, UserMinus, Target, MapPin } from 'lucide-react'
import { getLocaleFromCookie } from '@/lib/i18n/wizardTranslations'
import { useMetaTargetingSearch, useMetaDetailedTargetingSearch, useMetaAudiences } from '../traffic-wizard/useAudienceSearch'
import TWCreateAudienceModal from '../traffic-wizard/TWCreateAudienceModal'

/* ── i18n ── */
const LABELS = {
  tr: {
    sectionAudience: 'Hedef Kitle',
    sectionAudienceDesc: 'Reklamınızı görecek kitleyi tanımlayın.',
    audienceNewAudienceTab: 'Yeni Hedef Kitle Oluştur',
    audienceUseSavedTab: 'Kaydedilen hedef kitleyi kullan',
    audienceCustomLabel: 'Özel Hedef Kitleler',
    audienceCustomSearchPlaceholder: 'Mevcut hedef kitleleri arayın',
    audienceAddExclusions: 'Hariç tutulacakları ekle',
    audienceExcludedTitle: 'Hariç Tutulan Özel Kitleler',
    audienceExcludedSearchPlaceholder: 'Hariç tutulacak kitle arayın...',
    audienceCustomNoResults: 'Kitle bulunamadı.',
    audienceCreateNew: 'Yeni Oluştur',
    audienceCreateCustom: 'Özel Kitle Oluştur',
    audienceCreateCustomDesc: 'İşletmenizle zaten etkileşimde bulunmuş olan kişilere erişin.',
    audienceCreateLookalike: 'Benzer Kitle Oluştur',
    audienceCreateLookalikeDesc: 'Meta teknolojilerinde, en değerli hedef kitlelerinize benzeyen yeni kişilere erişin.',
    audienceLocations: 'Konumlar',
    audienceLocationsPlaceholder: 'Ülke, şehir veya bölge arayın...',
    audienceLocationsNone: 'Henüz konum eklenmedi.',
    audienceIncludedLocation: 'Dahil edilen konum:',
    audienceAge: 'Yaş Aralığı',
    audienceGender: 'Cinsiyet',
    audienceGenderAll: 'Tümü',
    audienceGenderMale: 'Erkek',
    audienceGenderFemale: 'Kadın',
    audienceAdvantageDetailed: 'Advantage+ detaylı hedefleme',
    audienceIncludeMatching: 'Şunlarla eşleşen kişileri dahil et:',
    audienceDetailedSearchPlaceholder: 'Demografik bilgiler, ilgi alanları veya davranışlar ekleyin',
    audienceDetailedNoResults: 'Sonuç bulunamadı.',
    audienceBrowse: 'Göz At',
    audienceLanguages: 'Diller',
    audienceLanguagesSearchPlaceholder: 'Dil arayın...',
    audienceAllLanguages: 'Tüm diller',
    audienceAbTestLabel: 'Advantage+ hedef kitlesi özelliğini kullanmanın sonuçlarını görmek için bir A/B testi yayınlayın',
    audienceSaveAudience: 'Hedef kitleyi kaydet',
    audienceSaveNamePlaceholder: 'Kitle adı girin...',
    audienceSaveSuccess: 'Hedef kitle kaydedildi!',
    audienceSaveError: 'Hedef kitle kaydedilemedi.',
    audienceSaving: 'Kaydediliyor...',
    audienceNoSavedAudiences: 'Kaydedilmiş kitle yok',
    cancel: 'İptal',
  },
  en: {
    sectionAudience: 'Audience',
    sectionAudienceDesc: 'Define who will see your ads.',
    audienceNewAudienceTab: 'Create New Audience',
    audienceUseSavedTab: 'Use a saved audience',
    audienceCustomLabel: 'Custom Audiences',
    audienceCustomSearchPlaceholder: 'Search existing audiences',
    audienceAddExclusions: 'Add exclusions',
    audienceExcludedTitle: 'Excluded Custom Audiences',
    audienceExcludedSearchPlaceholder: 'Search audiences to exclude...',
    audienceCustomNoResults: 'No audiences found.',
    audienceCreateNew: 'Create New',
    audienceCreateCustom: 'Create Custom Audience',
    audienceCreateCustomDesc: 'Reach people who have already interacted with your business.',
    audienceCreateLookalike: 'Create Lookalike Audience',
    audienceCreateLookalikeDesc: 'Reach new people on Meta technologies who are similar to your most valuable audiences.',
    audienceLocations: 'Locations',
    audienceLocationsPlaceholder: 'Search for countries, cities, or regions...',
    audienceLocationsNone: 'No locations added yet.',
    audienceIncludedLocation: 'Included location:',
    audienceAge: 'Age Range',
    audienceGender: 'Gender',
    audienceGenderAll: 'All',
    audienceGenderMale: 'Male',
    audienceGenderFemale: 'Female',
    audienceAdvantageDetailed: 'Advantage+ detailed targeting',
    audienceIncludeMatching: 'Include people who match:',
    audienceDetailedSearchPlaceholder: 'Add demographics, interests or behaviors',
    audienceDetailedNoResults: 'No results found.',
    audienceBrowse: 'Browse',
    audienceLanguages: 'Languages',
    audienceLanguagesSearchPlaceholder: 'Search languages...',
    audienceAllLanguages: 'All languages',
    audienceAbTestLabel: 'Run an A/B test to see the results of using the Advantage+ audience feature',
    audienceSaveAudience: 'Save audience',
    audienceSaveNamePlaceholder: 'Enter audience name...',
    audienceSaveSuccess: 'Audience saved successfully!',
    audienceSaveError: 'Failed to save audience.',
    audienceSaving: 'Saving...',
    audienceNoSavedAudiences: 'No saved audiences',
    cancel: 'Cancel',
  },
}

/* ── Props ── */
interface TabAudienceProps {
  state: WizardState['adset']
  onChange: (updates: Partial<WizardState['adset']>) => void
  onToast?: (msg: string, type: 'success' | 'error') => void
}

export default function TabAudience({ state, onChange }: TabAudienceProps) {
  const locale = getLocaleFromCookie() as 'tr' | 'en'
  const t = LABELS[locale] || LABELS.tr
  const targeting = state.targeting

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
  const [audienceTab, setAudienceTab] = useState<'new' | 'saved'>(state.savedAudienceId ? 'saved' : 'new')
  const [savedListOpen, setSavedListOpen] = useState(!state.savedAudienceId)
  const [savedAudienceSearch, setSavedAudienceSearch] = useState('')
  const [showExcluded, setShowExcluded] = useState(targeting.excluded_custom_audiences.length > 0)
  const [saveAudienceOpen, setSaveAudienceOpen] = useState(false)
  const [saveAudienceName, setSaveAudienceName] = useState('')
  const [saveAudienceLoading, setSaveAudienceLoading] = useState(false)
  const [saveAudienceMsg, setSaveAudienceMsg] = useState('')
  const [locationMode, setLocationMode] = useState<'include' | 'exclude'>('include')
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const locationDropdownRef = useRef<HTMLDivElement>(null)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [browseCategory, setBrowseCategory] = useState<'countries' | 'regions' | 'saved'>('countries')
  const [browseSearch, setBrowseSearch] = useState('')
  const browseRef = useRef<HTMLDivElement>(null)

  // ── Detailed targeting browse panel ──
  const [detailedBrowseOpen, setDetailedBrowseOpen] = useState(false)
  const [detailedBrowseData, setDetailedBrowseData] = useState<{ id: string; name: string; type?: string; path?: string[]; audience_size_lower_bound?: number; audience_size_upper_bound?: number }[]>([])
  const [detailedBrowseLoading, setDetailedBrowseLoading] = useState(false)
  const [detailedBrowseSearch, setDetailedBrowseSearch] = useState('')
  const detailedBrowseRef = useRef<HTMLDivElement>(null)

  const normalizeLoc = (name: string) =>
    name.replace(/\s*\(.*?\)\s*$/, '').trim().toLowerCase()

  // ── Locales local objects (WizardState only stores number[]) ──
  const [localeObjects, setLocaleObjects] = useState<{ id: number; name: string }[]>([])

  // ── Saved audience selected object (for display) ──
  const selectedSaved = savedAudiences.find(a => a.id === state.savedAudienceId)

  // ── Close create menu on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false)
      }
    }
    if (createMenuOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [createMenuOpen])

  // ── Close location dropdown on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setLocationDropdownOpen(false)
      }
    }
    if (locationDropdownOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [locationDropdownOpen])

  // ── Close browse panel on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (browseRef.current && !browseRef.current.contains(e.target as Node)) {
        setBrowseOpen(false)
      }
    }
    if (browseOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [browseOpen])

  // ── Close detailed browse panel on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (detailedBrowseRef.current && !detailedBrowseRef.current.contains(e.target as Node)) {
        setDetailedBrowseOpen(false)
      }
    }
    if (detailedBrowseOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [detailedBrowseOpen])

  // ── Fetch detailed targeting browse data ──
  const fetchDetailedBrowse = async () => {
    if (detailedBrowseData.length > 0) return // already fetched
    setDetailedBrowseLoading(true)
    try {
      const loc = locale === 'tr' ? 'tr_TR' : 'en_US'
      const res = await fetch(`/api/meta/targeting/browse?locale=${loc}`)
      const json = await res.json()
      if (json.ok && Array.isArray(json.data)) {
        setDetailedBrowseData(json.data)
      }
    } catch {
      // silently fail
    } finally {
      setDetailedBrowseLoading(false)
    }
  }

  // ── Save audience handler ──
  const handleSaveAudience = async () => {
    if (!saveAudienceName.trim() || saveAudienceLoading) return
    setSaveAudienceLoading(true)
    setSaveAudienceMsg('')
    try {
      const tgt: Record<string, unknown> = {}
      if (targeting.locations.length > 0) {
        const countries = targeting.locations.filter(l => l.type === 'country').map(l => l.key)
        const cities = targeting.locations.filter(l => l.type === 'city').map(l => ({ key: l.key }))
        const regions = targeting.locations.filter(l => l.type === 'region').map(l => ({ key: l.key }))
        tgt.geo_locations = {
          ...(countries.length > 0 ? { countries } : {}),
          ...(cities.length > 0 ? { cities } : {}),
          ...(regions.length > 0 ? { regions } : {}),
        }
      }
      tgt.age_min = targeting.ageMin
      tgt.age_max = targeting.ageMax
      if (targeting.genders.length > 0) tgt.genders = targeting.genders
      if (localeObjects.length > 0) tgt.locales = localeObjects.map(l => l.id)
      if (targeting.interests.length > 0) {
        const interests = targeting.interests.map(d => ({ id: d.id, name: d.name }))
        if (interests.length > 0) {
          tgt.flexible_spec = [{ interests }]
        }
      }
      if (targeting.custom_audiences.length > 0) {
        tgt.custom_audiences = targeting.custom_audiences.map(c => ({ id: c.id }))
      }
      if (targeting.excluded_custom_audiences.length > 0) {
        tgt.excluded_custom_audiences = targeting.excluded_custom_audiences.map(c => ({ id: c.id }))
      }

      const res = await fetch('/api/meta/audiences/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveAudienceName.trim(), targeting: tgt }),
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

  // ── Transform API results ──
  const filteredDetailedTargeting = rawDetailedTargeting
    .filter(i => !targeting.interests.find(x => x.id === i.id))
    .map(i => ({
      id: i.id,
      name: i.name,
      subtitle: [
        i.path?.[0],
        i.audience_size_lower_bound != null
          ? `${formatAudienceSize(i.audience_size_lower_bound)} – ${formatAudienceSize(i.audience_size_upper_bound)}`
          : undefined,
      ].filter(Boolean).join(' · ') || undefined,
    }))

  const filteredLocations = rawLocations
    .filter(l => !targeting.locations.find(x => x.key === l.key))
    .map(l => ({
      id: l.key,
      name: l.name,
      subtitle: [l.type, l.country_name].filter(Boolean).join(' · '),
    }))

  const filteredLanguages = rawLocales
    .filter(l => !localeObjects.find(x => x.id === l.key))
    .map(l => ({ id: String(l.key), name: l.name }))

  const filteredCustomAudiences = searchAudiences(customSearch, targeting.custom_audiences.map(x => x.id))
    .map(aud => ({ id: aud.id, name: aud.name, subtitle: aud.subtype || aud.type }))

  const filteredExcludedAudiences = searchAudiences(excludedSearch, targeting.excluded_custom_audiences.map(x => x.id))
    .map(aud => ({ id: aud.id, name: aud.name, subtitle: aud.subtype || aud.type }))

  return (
    <div className="space-y-6">

      {/* ── Top tabs ── */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => { setAudienceTab('new'); onChange({ savedAudienceId: undefined }) }}
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
          onClick={() => { setAudienceTab('saved'); setSavedListOpen(!state.savedAudienceId) }}
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
          {savedListOpen ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={savedAudienceSearch}
                  onChange={(e) => setSavedAudienceSearch(e.target.value)}
                  placeholder={t.audienceCustomSearchPlaceholder}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
              <div className="max-h-[320px] overflow-y-auto space-y-1">
                {savedAudiences.length > 0 ? (
                  savedAudiences
                    .filter(sa => !savedAudienceSearch || sa.name.toLowerCase().includes(savedAudienceSearch.toLowerCase()))
                    .map(sa => {
                      const isSelected = state.savedAudienceId === sa.id
                      return (
                        <button
                          key={sa.id}
                          type="button"
                          onClick={() => {
                            onChange({ savedAudienceId: isSelected ? undefined : sa.id })
                            if (!isSelected) setSavedListOpen(false)
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
            </>
          ) : selectedSaved ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 text-primary text-sm rounded-full font-medium">
                {selectedSaved.name}
                <button
                  type="button"
                  onClick={() => { onChange({ savedAudienceId: undefined }); setSavedListOpen(true) }}
                  className="hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
              <button
                type="button"
                onClick={() => setSavedListOpen(true)}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {locale === 'tr' ? 'Değiştir' : 'Change'}
              </button>
            </div>
          ) : null}
        </div>
      )}

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
                  <span className="text-xs text-gray-500 block mt-0.5">{t.audienceCreateCustomDesc}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setCreateMenuOpen(false); setCreateModalMode('lookalike'); setCreateModalOpen(true) }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors rounded-b-lg border-t border-gray-100"
                >
                  <span className="text-sm font-semibold text-gray-900 block">{t.audienceCreateLookalike}</span>
                  <span className="text-xs text-gray-500 block mt-0.5">{t.audienceCreateLookalikeDesc}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <AudienceSearchInput
          value={customSearch}
          onChange={setCustomSearch}
          placeholder={t.audienceCustomSearchPlaceholder}
          results={filteredCustomAudiences}
          noResultsText={t.audienceCustomNoResults}
          loading={audiencesLoading}
          onSelect={(item) => {
            if (!targeting.custom_audiences.find(x => x.id === item.id)) {
              onChange({ targeting: { ...targeting, custom_audiences: [...targeting.custom_audiences, { id: item.id, name: item.name }] } })
            }
            setCustomSearch('')
          }}
        />
        {targeting.custom_audiences.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {targeting.custom_audiences.map(aud => (
              <Chip
                key={aud.id}
                label={aud.name}
                onRemove={() => onChange({ targeting: { ...targeting, custom_audiences: targeting.custom_audiences.filter(x => x.id !== aud.id) } })}
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
                onClick={() => { setShowExcluded(false); if (targeting.excluded_custom_audiences.length === 0) setExcludedSearch('') }}
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
                if (!targeting.excluded_custom_audiences.find(x => x.id === item.id)) {
                  onChange({ targeting: { ...targeting, excluded_custom_audiences: [...targeting.excluded_custom_audiences, { id: item.id, name: item.name }] } })
                }
                setExcludedSearch('')
              }}
            />
            {targeting.excluded_custom_audiences.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {targeting.excluded_custom_audiences.map(aud => (
                  <Chip
                    key={aud.id}
                    label={aud.name}
                    variant="danger"
                    onRemove={() => onChange({ targeting: { ...targeting, excluded_custom_audiences: targeting.excluded_custom_audiences.filter(x => x.id !== aud.id) } })}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Konumlar ── */}
      <div ref={locationDropdownRef}>
        <label className="text-sm font-semibold text-gray-800 mb-1.5 flex items-center gap-1 block">
          <span className="text-red-500">*</span> {t.audienceLocations}
        </label>

        {/* Seçili konumlar listesi */}
        {targeting.locations.length > 0 && (
          <div className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
            {targeting.locations.map(loc => (
              <div key={loc.key} className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-b-0">
                <MapPin className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-sm text-gray-800 flex-1">{loc.name}</span>
                <button
                  type="button"
                  onClick={() => onChange({ targeting: { ...targeting, locations: targeting.locations.filter(x => x.key !== loc.key), excluded_locations: (targeting.excluded_locations ?? []).filter(x => x.key !== loc.key && normalizeLoc(x.name) !== normalizeLoc(loc.name)) } })}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hariç tutulan konumlar listesi */}
        {(targeting.excluded_locations ?? []).length > 0 && (
          <div className="border border-red-100 rounded-lg mb-2 overflow-hidden">
            {(targeting.excluded_locations ?? []).map(loc => (
              <div key={loc.key} className="flex items-center gap-2 px-3 py-2.5 border-b border-red-50 last:border-b-0">
                <MapPin className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-sm text-red-700 flex-1 line-through">{loc.name}</span>
                <button
                  type="button"
                  onClick={() => onChange({ targeting: { ...targeting, locations: targeting.locations.filter(x => x.key !== loc.key && normalizeLoc(x.name) !== normalizeLoc(loc.name)), excluded_locations: (targeting.excluded_locations ?? []).filter(x => x.key !== loc.key) } })}
                  className="text-red-300 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Arama satırı: include/exclude toggle + input + Göz At */}
        <div className="flex items-stretch gap-0 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
          {/* Include/Exclude dropdown */}
          <div className="relative shrink-0">
            <select
              value={locationMode}
              onChange={e => setLocationMode(e.target.value as 'include' | 'exclude')}
              className="appearance-none h-full pl-3 pr-7 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50 border-r border-gray-300 focus:outline-none cursor-pointer rounded-l-lg"
            >
              <option value="include">{locale === 'tr' ? 'Şunlar dahil' : 'Include'}</option>
              <option value="exclude">{locale === 'tr' ? 'Şunlar hariç:' : 'Exclude'}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          </div>

          {/* Arama input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={locationSearch}
              onChange={(e) => { setLocationSearch(e.target.value); setLocationDropdownOpen(true) }}
              onFocus={() => { if (locationSearch.length > 0) setLocationDropdownOpen(true) }}
              placeholder={t.audienceLocationsPlaceholder}
              className="w-full pl-9 pr-3 py-2.5 text-sm focus:outline-none bg-white"
            />
            {locationLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
            )}
          </div>

          {/* Göz At */}
          <div ref={browseRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setBrowseOpen(!browseOpen)}
              className="h-full px-3 py-2.5 text-sm font-medium text-gray-600 bg-gray-50 border-l border-gray-300 hover:bg-gray-100 transition-colors flex items-center gap-1 rounded-r-lg"
            >
              {locale === 'tr' ? 'Göz At' : 'Browse'}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {browseOpen && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-20">
                {/* Kategori tab'ları */}
                <div className="flex border-b border-gray-100">
                  {(['countries', 'regions', 'saved'] as const).map(cat => {
                    const labels = { countries: locale === 'tr' ? 'Ülkeler' : 'Countries', regions: locale === 'tr' ? 'Bölgeler' : 'Regions', saved: locale === 'tr' ? 'Kaydedilen' : 'Saved' }
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setBrowseCategory(cat); setBrowseSearch('') }}
                        className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${browseCategory === cat ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {labels[cat]}
                      </button>
                    )
                  })}
                </div>

                {/* Arama */}
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={browseSearch}
                      onChange={e => setBrowseSearch(e.target.value)}
                      placeholder={locale === 'tr' ? 'Ara...' : 'Search...'}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Liste */}
                <div className="max-h-56 overflow-y-auto">
                  {browseCategory === 'countries' && BROWSE_COUNTRIES
                    .filter(c => !browseSearch || c.name.toLowerCase().includes(browseSearch.toLowerCase()))
                    .map(c => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          if (locationMode === 'exclude') {
                            if (!(targeting.excluded_locations ?? []).find(x => x.key === c.key)) {
                              onChange({ targeting: { ...targeting, locations: targeting.locations.filter(x => x.key !== c.key && normalizeLoc(x.name) !== normalizeLoc(c.name)), excluded_locations: [...(targeting.excluded_locations ?? []), { type: 'country', key: c.key, name: c.name }] } })
                            }
                          } else {
                            if (!targeting.locations.find(x => x.key === c.key)) {
                              onChange({ targeting: { ...targeting, excluded_locations: (targeting.excluded_locations ?? []).filter(x => x.key !== c.key && normalizeLoc(x.name) !== normalizeLoc(c.name)), locations: [...targeting.locations, { type: 'country', key: c.key, name: c.name }] } })
                            }
                          }
                          setBrowseOpen(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-primary/5 transition-colors"
                      >
                        {c.name}
                      </button>
                    ))
                  }
                  {browseCategory === 'regions' && (
                    <p className="px-3 py-4 text-xs text-gray-400 text-center italic">
                      {locale === 'tr' ? 'Bölge aramak için arama kutusunu kullanın' : 'Use search box to find regions'}
                    </p>
                  )}
                  {browseCategory === 'saved' && (
                    <p className="px-3 py-4 text-xs text-gray-400 text-center italic">
                      {locale === 'tr' ? 'Kaydedilen konum yok' : 'No saved locations'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dropdown sonuçlar */}
        {locationDropdownOpen && locationSearch.length > 0 && (
          <div className="mt-1 border border-gray-200 rounded-lg shadow-lg bg-white max-h-48 overflow-y-auto z-10 relative">
            {locationLoading ? (
              <div className="px-3 py-3 text-xs text-gray-400">...</div>
            ) : filteredLocations.length > 0 ? (
              filteredLocations.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const raw = rawLocations.find(l => l.key === item.id)
                    if (!raw) return
                    if (locationMode === 'exclude') {
                      if (!(targeting.excluded_locations ?? []).find(x => x.key === raw.key)) {
                        onChange({ targeting: { ...targeting, locations: targeting.locations.filter(x => x.key !== raw.key && normalizeLoc(x.name) !== normalizeLoc(raw.name)), excluded_locations: [...(targeting.excluded_locations ?? []), { type: raw.type, key: raw.key, name: raw.name }] } })
                      }
                    } else {
                      if (!targeting.locations.find(x => x.key === raw.key)) {
                        const parentCountryKey = (raw as any).country_code ?? null
                        const filteredExisting = parentCountryKey
                          ? targeting.locations.filter(x => !(x.type === 'country' && x.key === parentCountryKey))
                          : targeting.locations
                        onChange({ targeting: { ...targeting, excluded_locations: (targeting.excluded_locations ?? []).filter(x => x.key !== raw.key && normalizeLoc(x.name) !== normalizeLoc(raw.name)), locations: [...filteredExisting.filter(x => x.key !== raw.key), { type: raw.type, key: raw.key, name: raw.name }] } })
                      }
                    }
                    setLocationSearch('')
                    setLocationDropdownOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-primary/5 transition-colors"
                >
                  <span className="text-sm text-gray-700">{item.name}</span>
                  {item.subtitle && <span className="block text-[11px] text-gray-400 mt-0.5">{item.subtitle}</span>}
                </button>
              ))
            ) : (
              <p className="px-3 py-2.5 text-xs text-gray-400 italic">{t.audienceDetailedNoResults}</p>
            )}
          </div>
        )}

        {targeting.locations.length === 0 && (targeting.excluded_locations ?? []).length === 0 && (
          <p className="mt-1.5 text-xs text-gray-400 italic">{t.audienceLocationsNone}</p>
        )}
      </div>

      {/* ── Yaş + Cinsiyet ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Yaş */}
        <div>
          <label className="text-sm font-semibold text-gray-800 block">{t.audienceAge}</label>
          <p className="text-xs text-gray-400 mb-2">{locale === 'tr' ? 'Yaş aralığını seçin' : 'Select age range'}</p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={targeting.ageMin}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  onChange({ targeting: { ...targeting, ageMin: v, ...(v > targeting.ageMax ? { ageMax: v } : {}) } })
                }}
                className="w-full appearance-none px-3.5 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-7"
              >
                {Array.from({ length: 48 }, (_, i) => 18 + i).map(age => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <span className="text-gray-400 shrink-0">–</span>
            <div className="relative flex-1">
              <select
                value={targeting.ageMax}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  onChange({ targeting: { ...targeting, ageMax: v, ...(v < targeting.ageMin ? { ageMin: v } : {}) } })
                }}
                className="w-full appearance-none px-3.5 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-7"
              >
                {Array.from({ length: 48 }, (_, i) => 18 + i).map(age => (
                  <option key={age} value={age}>{age === 65 ? '65+' : age}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Cinsiyet */}
        <div>
          <label className="text-sm font-semibold text-gray-800 block">{t.audienceGender}</label>
          <p className="text-xs text-gray-400 mb-2">{locale === 'tr' ? 'Cinsiyet hedefi seçin.' : 'Select gender target.'}</p>
          <div className="relative">
            <select
              value={targeting.genders.length === 0 ? 'all' : targeting.genders[0] === 1 ? 'male' : 'female'}
              onChange={(e) => {
                const v = e.target.value
                onChange({ targeting: { ...targeting, genders: v === 'all' ? [] : v === 'male' ? [1] : [2] } })
              }}
              className="w-full appearance-none px-3.5 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-7"
            >
              <option value="all">{t.audienceGenderAll}</option>
              <option value="male">{t.audienceGenderMale}</option>
              <option value="female">{t.audienceGenderFemale}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
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
              placeholder={t.audienceDetailedSearchPlaceholder}
              results={filteredDetailedTargeting}
              noResultsText={t.audienceDetailedNoResults}
              loading={detailedLoading}
              onSelect={(item) => {
                if (!targeting.interests.find(x => x.id === item.id)) {
                  onChange({ targeting: { ...targeting, interests: [...targeting.interests, { id: item.id, name: item.name }] } })
                }
                setInterestSearch('')
              }}
            />
          </div>
          <div ref={detailedBrowseRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => { setDetailedBrowseOpen(!detailedBrowseOpen); fetchDetailedBrowse() }}
              className="text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-1"
            >
              {t.audienceBrowse}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {detailedBrowseOpen && (
              <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                {/* Search */}
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={detailedBrowseSearch}
                      onChange={e => setDetailedBrowseSearch(e.target.value)}
                      placeholder={t.audienceDetailedSearchPlaceholder}
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>
                {/* List */}
                <div className="max-h-64 overflow-y-auto">
                  {detailedBrowseLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <span className="w-5 h-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : (() => {
                    const searchLower = detailedBrowseSearch.toLowerCase()
                    const filtered = detailedBrowseData.filter(item =>
                      !targeting.interests.find(x => x.id === item.id) &&
                      (!searchLower || item.name.toLowerCase().includes(searchLower) || item.path?.some(p => p.toLowerCase().includes(searchLower)))
                    )
                    // Group by first path element
                    const groups = new Map<string, typeof filtered>()
                    for (const item of filtered) {
                      const category = item.path?.[0] || (locale === 'tr' ? 'Diğer' : 'Other')
                      if (!groups.has(category)) groups.set(category, [])
                      groups.get(category)!.push(item)
                    }
                    if (groups.size === 0) {
                      return <p className="px-3 py-4 text-xs text-gray-400 italic text-center">{t.audienceDetailedNoResults}</p>
                    }
                    return Array.from(groups.entries()).map(([category, items]) => (
                      <div key={category}>
                        <div className="px-3 py-1.5 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide sticky top-0">
                          {category}
                        </div>
                        {items.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (!targeting.interests.find(x => x.id === item.id)) {
                                onChange({ targeting: { ...targeting, interests: [...targeting.interests, { id: item.id, name: item.name }] } })
                              }
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-primary/5 transition-colors flex items-center justify-between"
                          >
                            <div>
                              <span className="text-sm text-gray-700">{item.name}</span>
                              {item.audience_size_lower_bound != null && (
                                <span className="block text-[10px] text-gray-400 mt-0.5">
                                  {formatAudienceSize(item.audience_size_lower_bound)} – {formatAudienceSize(item.audience_size_upper_bound)}
                                </span>
                              )}
                            </div>
                            <Plus className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          </button>
                        ))}
                      </div>
                    ))
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
        {targeting.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {targeting.interests.map(dt => (
              <Chip
                key={dt.id}
                label={dt.name}
                onRemove={() => onChange({ targeting: { ...targeting, interests: targeting.interests.filter(x => x.id !== dt.id) } })}
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
            if (!localeObjects.find(x => x.id === langId)) {
              const newLocales = [...localeObjects, { id: langId, name: item.name }]
              setLocaleObjects(newLocales)
              onChange({ targeting: { ...targeting, locales: newLocales.map(l => l.id) } })
            }
            setLanguageSearch('')
          }}
        />
        {localeObjects.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {localeObjects.map(lang => (
              <Chip
                key={lang.id}
                label={lang.name}
                onRemove={() => {
                  const newLocales = localeObjects.filter(x => x.id !== lang.id)
                  setLocaleObjects(newLocales)
                  onChange({ targeting: { ...targeting, locales: newLocales.map(l => l.id) } })
                }}
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
          className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
            className="w-full px-3 py-2 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
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
              {t.cancel}
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

      {/* ── TWCreateAudienceModal ── */}
      <TWCreateAudienceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialMode={createModalMode}
        audiences={allAudiences}
        onCreated={(newAud) => {
          if (!targeting.custom_audiences.find(x => x.id === newAud.id)) {
            onChange({ targeting: { ...targeting, custom_audiences: [...targeting.custom_audiences, { id: newAud.id, name: newAud.name }] } })
          }
          refreshAudiences()
        }}
      />
    </div>
  )
}

/* ── Helper Components ── */

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
          className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4">
            <span className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin block" />
          </span>
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

function Chip({
  label,
  onRemove,
  variant = 'default',
}: {
  label: string
  onRemove: () => void
  variant?: 'default' | 'danger'
}) {
  const colors = variant === 'danger'
    ? 'bg-red-50 text-red-600 border-red-200'
    : 'bg-primary/10 text-primary border-primary/20'

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${colors}`}>
      {label}
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

function formatAudienceSize(n?: number): string {
  if (n == null) return '?'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

const BROWSE_COUNTRIES = [
  { key: 'TR', name: 'Türkiye' },
  { key: 'US', name: 'Amerika Birleşik Devletleri' },
  { key: 'GB', name: 'Birleşik Krallık' },
  { key: 'DE', name: 'Almanya' },
  { key: 'FR', name: 'Fransa' },
  { key: 'IT', name: 'İtalya' },
  { key: 'ES', name: 'İspanya' },
  { key: 'NL', name: 'Hollanda' },
  { key: 'BE', name: 'Belçika' },
  { key: 'AT', name: 'Avusturya' },
  { key: 'CH', name: 'İsviçre' },
  { key: 'SE', name: 'İsveç' },
  { key: 'NO', name: 'Norveç' },
  { key: 'DK', name: 'Danimarka' },
  { key: 'FI', name: 'Finlandiya' },
  { key: 'PL', name: 'Polonya' },
  { key: 'CZ', name: 'Çekya' },
  { key: 'PT', name: 'Portekiz' },
  { key: 'GR', name: 'Yunanistan' },
  { key: 'RO', name: 'Romanya' },
  { key: 'BG', name: 'Bulgaristan' },
  { key: 'HU', name: 'Macaristan' },
  { key: 'IE', name: 'İrlanda' },
  { key: 'RU', name: 'Rusya' },
  { key: 'UA', name: 'Ukrayna' },
  { key: 'SA', name: 'Suudi Arabistan' },
  { key: 'AE', name: 'Birleşik Arap Emirlikleri' },
  { key: 'JP', name: 'Japonya' },
  { key: 'AU', name: 'Avustralya' },
  { key: 'CA', name: 'Kanada' },
]
