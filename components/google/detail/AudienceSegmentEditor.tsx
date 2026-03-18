'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Loader2, Search, ChevronRight, ChevronDown, Users, Heart, ShoppingBag, UserCheck, Layers, Info, RefreshCw } from 'lucide-react'

/* ── Types ── */

type AudienceSegmentCategory =
  | 'AFFINITY' | 'IN_MARKET' | 'DETAILED_DEMOGRAPHIC' | 'LIFE_EVENT'
  | 'USER_LIST' | 'CUSTOM_AUDIENCE' | 'COMBINED_AUDIENCE'

type AudienceMode = 'OBSERVATION' | 'TARGETING'

interface AudienceItem {
  id: string
  name: string
  category: AudienceSegmentCategory
  resourceName: string
  parentId?: string
  sizeRange?: string
}

interface SelectedSegment {
  id: string
  name: string
  category: AudienceSegmentCategory
  resourceName: string
}

interface ExistingCriterion {
  resourceName: string
  criterionId: string
  type: string
  displayName: string
  status: string
  bidModifier: number | null
  segmentResourceName: string
  /** Taxonomy ID for LIFE_EVENT/EXTENDED_DEMOGRAPHIC; use for matching browse selection */
  segmentId?: string
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

/* ── Constants ── */

const CATEGORY_LABELS: Record<AudienceSegmentCategory, string> = {
  AFFINITY: 'Yakın İlgi Alanı',
  IN_MARKET: 'Pazardaki Kitle',
  DETAILED_DEMOGRAPHIC: 'Ayrıntılı Demografi',
  LIFE_EVENT: 'Yaşam Olayları',
  USER_LIST: 'Verileriniz',
  CUSTOM_AUDIENCE: 'Özel Kitle',
  COMBINED_AUDIENCE: 'Birleşik Segment',
}

const CATEGORY_COLORS: Record<AudienceSegmentCategory, string> = {
  AFFINITY: 'bg-purple-50 text-purple-700',
  IN_MARKET: 'bg-green-50 text-green-700',
  DETAILED_DEMOGRAPHIC: 'bg-orange-50 text-orange-700',
  LIFE_EVENT: 'bg-pink-50 text-pink-700',
  USER_LIST: 'bg-blue-50 text-blue-700',
  CUSTOM_AUDIENCE: 'bg-teal-50 text-teal-700',
  COMBINED_AUDIENCE: 'bg-indigo-50 text-indigo-700',
}

type BrowseSectionKey = Exclude<keyof BrowseData, 'state'>
const BROWSE_SECTIONS: Array<{
  key: BrowseSectionKey
  label: string
  desc: string
  icon: typeof Users
  category: AudienceSegmentCategory
}> = [
  { key: 'inMarket', label: 'Etkin Şekilde Araştırdıkları veya Planladıkları Konular', desc: 'Pazardaki kitle segmentleri', icon: ShoppingBag, category: 'IN_MARKET' },
  { key: 'affinity', label: 'İlgi Alanları ve Alışkanlıkları', desc: 'Yakın ilgi alanı segmentleri', icon: Heart, category: 'AFFINITY' },
  { key: 'detailedDemographics', label: 'Kim Oldukları', desc: 'Ayrıntılı demografi segmentleri', icon: Users, category: 'DETAILED_DEMOGRAPHIC' },
  { key: 'lifeEvents', label: 'Yaşam Olayları', desc: 'Yaşam olayı segmentleri', icon: Users, category: 'LIFE_EVENT' },
  { key: 'userLists', label: 'İşletmenizle Etkileşimde Bulunma Biçimleri', desc: 'Verilerinize göre segmentler', icon: UserCheck, category: 'USER_LIST' },
  { key: 'customAudiences', label: 'Özel Kitleleriniz', desc: 'Anahtar kelime/URL tabanlı özel kitleler', icon: Layers, category: 'CUSTOM_AUDIENCE' },
  { key: 'combinedAudiences', label: 'Birleşik Kitle Segmentleriniz', desc: 'Birleşik segmentler', icon: Layers, category: 'COMBINED_AUDIENCE' },
]

/* Map existing criterion types back to categories */
function inferCategory(type: string): AudienceSegmentCategory {
  if (type === 'USER_LIST') return 'USER_LIST'
  if (type === 'CUSTOM_AUDIENCE') return 'CUSTOM_AUDIENCE'
  if (type === 'COMBINED_AUDIENCE') return 'COMBINED_AUDIENCE'
  if (type === 'LIFE_EVENT') return 'LIFE_EVENT'
  if (type === 'EXTENDED_DEMOGRAPHIC') return 'DETAILED_DEMOGRAPHIC'
  return 'AFFINITY' // USER_INTEREST defaults to AFFINITY (cannot distinguish from criterion alone)
}

/* ── Props ── */

interface Props {
  open: boolean
  onClose: () => void
  entityType: 'campaign' | 'adGroup'
  entityId: string
  entityResourceName: string
  campaignId: string
  onSaved: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}

/* ── Component ── */

export default function AudienceSegmentEditor({
  open, onClose, entityType, entityId, entityResourceName, campaignId, onSaved, onToast,
}: Props) {
  // Existing criteria from API
  const [existingCriteria, setExistingCriteria] = useState<ExistingCriterion[]>([])
  const [initialSegmentIds, setInitialSegmentIds] = useState<Set<string>>(new Set())

  // Selected segments
  const [selectedSegments, setSelectedSegments] = useState<SelectedSegment[]>([])
  const [mode, setMode] = useState<AudienceMode>('OBSERVATION')

  // Loading
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Search
  const [tab, setTab] = useState<'search' | 'browse'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AudienceItem[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // Browse
  const [browseData, setBrowseData] = useState<BrowseData | null>(null)
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Load existing criteria on mount
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    const url = entityType === 'adGroup'
      ? `/api/integrations/google-ads/ad-groups/${entityId}/audience-criteria`
      : `/api/integrations/google-ads/campaigns/${campaignId}/audience-criteria`

    fetch(url, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const criteria: ExistingCriterion[] = data.criteria ?? []
        setExistingCriteria(criteria)
        // Map to selected segments. Use segmentId for LIFE_EVENT/EXTENDED_DEMOGRAPHIC to match browse dataset.
        const sanitize = (n: string) => (!n || n.includes('::') || /^\d+$/.test(n)) ? 'Bilinmeyen Segment' : n
        const segId = (c: ExistingCriterion) => c.segmentId ?? c.criterionId
        const segs: SelectedSegment[] = criteria.map(c => ({
          id: segId(c),
          name: sanitize(c.displayName),
          category: inferCategory(c.type),
          resourceName: c.segmentResourceName,
        }))
        setSelectedSegments(segs)
        setInitialSegmentIds(new Set(criteria.map(c => segId(c))))
        // Infer mode from first criterion
        if (criteria.length > 0 && criteria[0].bidModifier != null) {
          setMode('OBSERVATION')
        }
      })
      .catch(() => setError('Mevcut kitle segmentleri yüklenemedi.'))
      .finally(() => setLoading(false))
  }, [open, entityType, entityId, campaignId])

  // Search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/integrations/google-ads/tools/audience-segments?mode=search&q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (res.ok) setSearchResults(data.results ?? [])
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }, [])

  const handleSearchInput = (val: string) => {
    setSearchQuery(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => doSearch(val), 400)
  }

  // Browse
  const loadBrowse = useCallback(async (force = false) => {
    if (browseData && !force) return
    setBrowseLoading(true)
    setBrowseError(null)
    try {
      const url = force
        ? '/api/integrations/google-ads/tools/audience-segments?mode=browse&refresh=true'
        : '/api/integrations/google-ads/tools/audience-segments?mode=browse'
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok) {
        setBrowseData(data)
      } else {
        setBrowseError(data.error || 'Kitle segmentleri yüklenemedi.')
      }
    } catch {
      setBrowseError('Kitle segmentleri yüklenirken bir bağlantı hatası oluştu.')
    }
    finally { setBrowseLoading(false) }
  }, [browseData])

  useEffect(() => {
    if (tab === 'browse') loadBrowse()
  }, [tab, loadBrowse])

  // Toggle segment
  const toggleSegment = (item: AudienceItem) => {
    const exists = selectedSegments.find(s => s.id === item.id && s.category === item.category)
    if (exists) {
      setSelectedSegments(prev => prev.filter(s => !(s.id === item.id && s.category === item.category)))
    } else {
      setSelectedSegments(prev => [...prev, {
        id: item.id,
        name: item.name,
        category: item.category,
        resourceName: item.resourceName,
      }])
    }
  }

  const isSelected = (item: AudienceItem) =>
    selectedSegments.some(s => s.id === item.id && s.category === item.category)

  // Save
  const handleSave = async () => {
    setSaving(true)
    try {
      const baseUrl = entityType === 'adGroup'
        ? `/api/integrations/google-ads/ad-groups/${entityId}/audience-criteria`
        : `/api/integrations/google-ads/campaigns/${campaignId}/audience-criteria`

      // Find removed: in initial but not in current
      const currentIds = new Set(selectedSegments.map(s => s.id))
      const toRemove = existingCriteria.filter(c => !currentIds.has(c.criterionId))

      // Find added: in current but not in initial
      const toAdd = selectedSegments.filter(s => !initialSegmentIds.has(s.id))

      // Remove
      if (toRemove.length > 0) {
        const res = await fetch(baseUrl, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resourceNames: toRemove.map(c => c.resourceName) }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.userMessage || d.error || 'Segmentler kaldırılamadı')
        }
      }

      // Add
      if (toAdd.length > 0) {
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(entityType === 'adGroup'
              ? { adGroupResourceName: entityResourceName }
              : { campaignResourceName: entityResourceName }),
            segments: toAdd.map(s => ({
              resourceName: s.resourceName,
              category: s.category,
              id: s.id,
            })),
            bidOnly: mode === 'OBSERVATION',
          }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.userMessage || d.error || 'Segmentler eklenemedi')
        }
      }

      onToast('Kitle segmentleri güncellendi', 'success')
      onSaved()
    } catch (e: any) {
      onToast(e.message || 'Bir hata oluştu', 'error')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = (() => {
    const currentIds = new Set(selectedSegments.map(s => s.id))
    if (currentIds.size !== initialSegmentIds.size) return true
    for (const id of currentIds) { if (!initialSegmentIds.has(id)) return true }
    return false
  })()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[55]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer panel */}
      <div className="absolute right-0 inset-y-0 w-full max-w-[600px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Kitle Segmentlerini Düzenle</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {entityType === 'adGroup' ? 'Reklam grubu' : 'Kampanya'} düzeyinde kitle segmentleri
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Mevcut kitle segmentleri yükleniyor...</span>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {!loading && !error && (
            <>
              {/* Audience Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hedefleme Modu</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['OBSERVATION', 'TARGETING'] as AudienceMode[]).map(m => {
                    const active = mode === m
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>
                          {m === 'OBSERVATION' ? 'Gözlem' : 'Hedefleme'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {m === 'OBSERVATION'
                            ? 'Teklifleri ayarlayın ancak erişimi daraltmayın'
                            : 'Reklamları yalnızca bu kitlelere gösterin'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Selected segments summary */}
              {selectedSegments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Seçili Segmentler ({selectedSegments.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSegments.map(seg => (
                      <span
                        key={`${seg.category}-${seg.id}`}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${CATEGORY_COLORS[seg.category] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {seg.name}
                        <button
                          type="button"
                          onClick={() => toggleSegment({ id: seg.id, name: seg.name, category: seg.category, resourceName: seg.resourceName })}
                          className="hover:opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabs: Search / Browse */}
              <div className="flex border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setTab('search')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === 'search' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Search className="w-3.5 h-3.5 inline mr-1.5" />
                  Arama
                </button>
                <button
                  type="button"
                  onClick={() => setTab('browse')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === 'browse' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 inline mr-1.5" />
                  Göz at
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
                      placeholder="Kitle segmenti arayın... (ör: araba, spor, ebeveyn)"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    {searching && (
                      <div className="absolute right-3 top-0 bottom-0 flex items-center">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      </div>
                    )}
                  </div>

                  {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">Sonuç bulunamadı</p>
                  )}

                  {searchResults.length > 0 && (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
                      {searchResults.map(item => (
                        <AudienceRow key={`${item.category}-${item.id}`} item={item} selected={isSelected(item)} onToggle={() => toggleSegment(item)} />
                      ))}
                    </div>
                  )}

                  {searchQuery.length < 2 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-gray-600">
                        Pazardaki kitle, yakın ilgi alanı, demografi ve verilerinize göre segmentler arasında arayın.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Browse Tab */}
              {tab === 'browse' && (
                <div className="space-y-1">
                  {browseLoading && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-500">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Kitle segmentleri yükleniyor ve çevriliyor...</span>
                      </div>
                      <span className="text-xs text-gray-400">İlk yüklemede çeviriler hazırlanır, sonraki açılışlar anlık olur.</span>
                    </div>
                  )}

                  {browseError && !browseLoading && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {browseError}
                      <button
                        type="button"
                        onClick={() => { setBrowseData(null); loadBrowse() }}
                        className="ml-2 underline hover:no-underline"
                      >
                        Tekrar dene
                      </button>
                    </div>
                  )}

                  {browseData && !browseLoading && (
                    <div className="flex items-center justify-end mb-1">
                      <button
                        type="button"
                        onClick={() => { setBrowseData(null); loadBrowse(true) }}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                        title="Verileri yeniden çek ve çevir"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Yenile
                      </button>
                    </div>
                  )}

                  {browseData?.state === 'data_not_ready' && (
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                      Kitle verileri henüz hazır değil. Yönetici tarafından yenilenmesi gerekiyor.
                    </div>
                  )}

                  {browseData && browseData.state !== 'data_not_ready' && BROWSE_SECTIONS.map(section => {
                    const items = browseData[section.key]
                    if (!items || items.length === 0) return null
                    const isExpanded = expandedSections.has(section.key)
                    const Icon = section.icon

                    const roots = items.filter((i: AudienceItem) => !i.parentId)
                    const childMap = new Map<string, AudienceItem[]>()
                    items.filter((i: AudienceItem) => i.parentId).forEach((i: AudienceItem) => {
                      const arr = childMap.get(i.parentId!) ?? []
                      arr.push(i)
                      childMap.set(i.parentId!, arr)
                    })

                    return (
                      <div key={section.key} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedSections(prev => {
                              const next = new Set(prev)
                              if (next.has(section.key)) next.delete(section.key); else next.add(section.key)
                              return next
                            })
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                          <Icon className="w-4 h-4 text-gray-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{section.label}</p>
                            <p className="text-xs text-gray-500">{section.desc} ({items.length})</p>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-gray-100 max-h-64 overflow-y-auto">
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
                                          onClick={() => {
                                            setExpandedParents(prev => {
                                              const next = new Set(prev)
                                              if (next.has(root.id)) next.delete(root.id); else next.add(root.id)
                                              return next
                                            })
                                          }}
                                          className="p-2 hover:bg-gray-100"
                                        >
                                          {isParentExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                        </button>
                                      )}
                                      <div className={`flex-1 ${!hasChildren ? 'pl-8' : ''}`}>
                                        <AudienceRow item={root} selected={isSelected(root)} onToggle={() => toggleSegment(root)} />
                                      </div>
                                    </div>
                                    {hasChildren && isParentExpanded && (
                                      <div className="pl-8">
                                        {children.map(child => (
                                          <AudienceRow key={`${child.category}-${child.id}`} item={child} selected={isSelected(child)} onToggle={() => toggleSegment(child)} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            ) : (
                              items.map((item: AudienceItem) => (
                                <AudienceRow key={`${item.category}-${item.id}`} item={item} selected={isSelected(item)} onToggle={() => toggleSegment(item)} />
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── AudienceRow ── */

function AudienceRow({ item, selected, onToggle }: { item: AudienceItem; selected: boolean; onToggle: () => void }) {
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
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-700'}`}>
            {CATEGORY_LABELS[item.category] ?? item.category}
          </span>
          {item.sizeRange && <span className="text-[10px] text-gray-400">{item.sizeRange}</span>}
        </div>
      </div>
    </label>
  )
}
