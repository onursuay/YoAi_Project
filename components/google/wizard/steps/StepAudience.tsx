'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, Search, ChevronRight, ChevronDown, X, Users, Heart, ShoppingBag, UserCheck, Layers, Info } from 'lucide-react'
import type { StepProps, AudienceMode, SelectedAudienceSegment, AudienceSegmentCategory } from '../shared/WizardTypes'

/* ------------------------------------------------------------------ */
/*  Labels & helpers                                                   */
/* ------------------------------------------------------------------ */

// Tüm kategoriler tek tip emerald — proje rengi
const CATEGORY_COLORS: Record<AudienceSegmentCategory, string> = {
  AFFINITY: 'bg-emerald-50 text-emerald-700',
  IN_MARKET: 'bg-emerald-50 text-emerald-700',
  DETAILED_DEMOGRAPHIC: 'bg-emerald-50 text-emerald-700',
  LIFE_EVENT: 'bg-emerald-50 text-emerald-700',
  USER_LIST: 'bg-emerald-50 text-emerald-700',
  CUSTOM_AUDIENCE: 'bg-emerald-50 text-emerald-700',
  COMBINED_AUDIENCE: 'bg-emerald-50 text-emerald-700',
}

interface AudienceItem {
  id: string
  name: string
  category: AudienceSegmentCategory
  resourceName: string
  parentId?: string
  subType?: string
  sizeRange?: string
  description?: string
}

interface BrowseData {
  affinity: AudienceItem[]
  inMarket: AudienceItem[]
  detailedDemographics: AudienceItem[]
  lifeEvents: AudienceItem[]
  userLists: AudienceItem[]
  customAudiences: AudienceItem[]
  combinedAudiences: AudienceItem[]
  state?: 'ok' | 'data_not_ready'
}

type BrowseSectionKey = Exclude<keyof BrowseData, 'state'>
const BROWSE_SECTIONS: Array<{ key: BrowseSectionKey; icon: typeof Users; category: AudienceSegmentCategory }> = [
  { key: 'inMarket', icon: ShoppingBag, category: 'IN_MARKET' },
  { key: 'affinity', icon: Heart, category: 'AFFINITY' },
  { key: 'detailedDemographics', icon: Users, category: 'DETAILED_DEMOGRAPHIC' },
  { key: 'lifeEvents', icon: Users, category: 'LIFE_EVENT' },
  { key: 'userLists', icon: UserCheck, category: 'USER_LIST' },
  { key: 'customAudiences', icon: Layers, category: 'CUSTOM_AUDIENCE' },
  { key: 'combinedAudiences', icon: Layers, category: 'COMBINED_AUDIENCE' },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StepAudience({ state, update, t }: StepProps) {
  const [tab, setTab] = useState<'search' | 'browse'>('search')
  const [browseData, setBrowseData] = useState<BrowseData | null>(null)
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AudienceItem[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // Browse expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

  // Dropdown davranışı: dış tıklamada kapan
  const [pickerOpen, setPickerOpen] = useState(true)
  const pickerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  // Load browse data
  const loadBrowse = useCallback(async () => {
    if (browseData) return
    setBrowseLoading(true)
    setBrowseError(null)
    try {
      const res = await fetch('/api/integrations/google-ads/tools/audience-segments?mode=browse')
      const data = await res.json()
      if (!res.ok) { setBrowseError(data.error ?? t('audience.browseError')); return }
      setBrowseData(data)
    } catch {
      setBrowseError(t('audience.browseError'))
    } finally {
      setBrowseLoading(false)
    }
  }, [browseData, t])

  // Switch tab
  useEffect(() => {
    if (tab === 'browse') loadBrowse()
  }, [tab, loadBrowse])

  // Search with debounce
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/integrations/google-ads/tools/audience-segments?mode=search&q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (res.ok) setSearchResults(data.results ?? [])
      // data.state === 'data_not_ready' when Edge Config index not yet populated
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }, [])

  const handleSearchInput = (val: string) => {
    setSearchQuery(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => doSearch(val), 400)
  }

  // Toggle audience selection
  const toggleSegment = (item: AudienceItem) => {
    const segments = state.selectedAudienceSegments
    const exists = segments.find(s => s.id === item.id && s.category === item.category)
    if (exists) {
      update({
        selectedAudienceSegments: segments.filter(s => !(s.id === item.id && s.category === item.category)),
        selectedAudienceIds: state.selectedAudienceIds.filter(id => id !== item.id),
      })
    } else {
      const newSeg: SelectedAudienceSegment = {
        id: item.id,
        name: item.name,
        category: item.category,
        resourceName: item.resourceName,
      }
      update({
        selectedAudienceSegments: [...segments, newSeg],
        selectedAudienceIds: [...state.selectedAudienceIds, item.id],
      })
    }
  }

  const isSelected = (item: AudienceItem) =>
    state.selectedAudienceSegments.some(s => s.id === item.id && s.category === item.category)

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const toggleParent = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('audience.segmentTitle')}</h3>
        <p className="text-sm text-gray-500">{t('audience.segmentDescription')}</p>
      </div>

      {/* Audience Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('audience.targetingMode')}</label>
        <div className="grid grid-cols-2 gap-3">
          {(['OBSERVATION', 'TARGETING'] as AudienceMode[]).map(mode => {
            const active = state.audienceMode === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => update({ audienceMode: mode })}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>
                  {mode === 'OBSERVATION' ? t('audience.observation') : t('audience.targeting')}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {mode === 'OBSERVATION'
                    ? t('audience.observationDesc')
                    : t('audience.targetingDesc')}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Kitle segmenti picker — tıklanınca açılır, dış tıklamada kapanır */}
      {!pickerOpen && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 transition-colors"
        >
          <span className="text-gray-700 font-medium">
            {state.selectedAudienceSegments.length > 0
              ? t('audience.segmentsSelected', { count: state.selectedAudienceSegments.length })
              : t('audience.searchPlaceholder')}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      )}

      {pickerOpen && (
      <div ref={pickerRef} className="space-y-4">
      {/* Tabs: Arama / Göz at */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab('search')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'search' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search className="w-3.5 h-3.5 inline mr-1.5" />
          {t('audience.tabSearch')}
        </button>
        <button
          type="button"
          onClick={() => setTab('browse')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'browse' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5 inline mr-1.5" />
          {t('audience.tabBrowse')}
        </button>
      </div>

      {/* Search Tab */}
      {tab === 'search' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder={t('audience.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searching && (
              <div className="absolute right-3 top-0 bottom-0 flex items-center">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              </div>
            )}
          </div>

          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">{t('audience.noResults')}</p>
          )}

          {searchResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {searchResults.map(item => (
                <AudienceRow
                  key={`${item.category}-${item.id}`}
                  item={item}
                  selected={isSelected(item)}
                  onToggle={() => toggleSegment(item)}
                  t={t}
                />
              ))}
            </div>
          )}

          {searchQuery.length < 2 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-600">
                {t('audience.searchHint')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Browse Tab */}
      {tab === 'browse' && (
        <div className="space-y-1">
          {browseLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">{t('audience.loading')}</span>
            </div>
          )}

          {browseError && <p className="text-sm text-red-500">{browseError}</p>}

          {browseData?.state === 'data_not_ready' && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              {t('audience.dataNotReady')}
            </div>
          )}

          {browseData && browseData.state !== 'data_not_ready' && BROWSE_SECTIONS.map(section => {
            const items = browseData[section.key]
            if (!items || items.length === 0) return null
            const isExpanded = expandedSections.has(section.key)
            const Icon = section.icon

            // Build hierarchy: roots (no parentId) and children
            const roots = items.filter(i => !i.parentId)
            const childMap = new Map<string, AudienceItem[]>()
            items.filter(i => i.parentId).forEach(i => {
              const arr = childMap.get(i.parentId!) ?? []
              arr.push(i)
              childMap.set(i.parentId!, arr)
            })

            return (
              <div key={section.key} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  <Icon className="w-4 h-4 text-gray-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{t(`audience.browseSections.${section.key}.label`)}</p>
                    <p className="text-xs text-gray-500">{t(`audience.browseSections.${section.key}.desc`)} ({items.length})</p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 max-h-64 overflow-y-auto">
                    {/* If hierarchical (has children), show tree */}
                    {childMap.size > 0 ? (
                      roots.map(root => {
                        const children = childMap.get(root.id) ?? []
                        const hasChildren = children.length > 0
                        const isParentExpanded = expandedParents.has(root.id)

                        return (
                          <div key={`${root.category}-${root.id}`}>
                            <div className="flex items-center">
                              {hasChildren && (
                                <button
                                  type="button"
                                  onClick={() => toggleParent(root.id)}
                                  className="p-2 hover:bg-gray-100"
                                >
                                  {isParentExpanded
                                    ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                </button>
                              )}
                              <div className={`flex-1 ${!hasChildren ? 'pl-8' : ''}`}>
                                <AudienceRow
                                  item={root}
                                  selected={isSelected(root)}
                                  onToggle={() => toggleSegment(root)}
                                  t={t}
                                />
                              </div>
                            </div>
                            {hasChildren && isParentExpanded && (
                              <div className="pl-8">
                                {children.map(child => (
                                  <AudienceRow
                                    key={`${child.category}-${child.id}`}
                                    item={child}
                                    selected={isSelected(child)}
                                    onToggle={() => toggleSegment(child)}
                                    t={t}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
                    ) : (
                      /* Flat list */
                      items.map(item => (
                        <AudienceRow
                          key={`${item.category}-${item.id}`}
                          item={item}
                          selected={isSelected(item)}
                          onToggle={() => toggleSegment(item)}
                          t={t}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      </div>
      )}

      {/* Selected segments summary */}
      {state.selectedAudienceSegments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-blue-600">
            {t('audience.segmentsSelected', { count: state.selectedAudienceSegments.length })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {state.selectedAudienceSegments.map(seg => (
              <span
                key={`${seg.category}-${seg.id}`}
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${CATEGORY_COLORS[seg.category]}`}
              >
                {seg.name}
                <button
                  type="button"
                  onClick={() => toggleSegment({
                    id: seg.id,
                    name: seg.name,
                    category: seg.category,
                    resourceName: seg.resourceName,
                  })}
                  className="hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Reusable audience row                                              */
/* ------------------------------------------------------------------ */

function AudienceRow({ item, selected, onToggle, t }: {
  item: AudienceItem
  selected: boolean
  onToggle: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  return (
    <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[item.category]}`}>
            {t(`audience.categoryLabels.${item.category}`)}
          </span>
          {item.sizeRange && item.sizeRange !== '' && (
            <span className="text-[10px] text-gray-400">{item.sizeRange}</span>
          )}
        </div>
      </div>
    </label>
  )
}
