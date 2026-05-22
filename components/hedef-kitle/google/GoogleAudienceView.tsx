'use client'

/* ──────────────────────────────────────────────────────────────
   YoAi — Google Hedef Kitle (salt-okunur gerçek veri görünümü)

   Google'da Meta'daki gibi kayıtlı "Detaylı/Benzer/Retargeting kitle
   nesnesi" sistemi yoktur. Bu görünüm bu yüzden iki gerçek veri
   kaynağını salt-okunur gösterir:

   • Detaylı Kitle (SAVED)   → Google kitle segmenti kataloğu
                               (affinity / in-market / demografi / yaşam olayı)
                               GET /api/integrations/google-ads/tools/audience-segments
   • Retargeting (CUSTOM)    → hesaptaki gerçek user list'ler (remarketing /
                               müşteri eşleştirme / kombine)
                               GET /api/integrations/google-ads/tools/audience-manager

   Yeni kitle oluşturma yoktur — Google'da kitleler kampanya kurulumunda
   tanımlanır (kampanya sihirbazlarında zaten mevcut). Entegrasyon koduna
   dokunulmaz; yalnızca mevcut read endpoint'leri tüketilir.
   ────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Heart,
  ShoppingBag,
  Users,
  CalendarHeart,
  UserCheck,
  Link2Off,
} from 'lucide-react'

type SegmentCategory =
  | 'AFFINITY'
  | 'IN_MARKET'
  | 'DETAILED_DEMOGRAPHIC'
  | 'LIFE_EVENT'
  | 'USER_LIST'
  | 'CUSTOM_AUDIENCE'
  | 'COMBINED_AUDIENCE'

interface SegmentItem {
  id: string
  name: string
  category: SegmentCategory
  resourceName: string
  parentId?: string
  sizeRange?: string
  description?: string
}

interface BrowseData {
  affinity: SegmentItem[]
  inMarket: SegmentItem[]
  detailedDemographics: SegmentItem[]
  lifeEvents: SegmentItem[]
  userLists: SegmentItem[]
  customAudiences: SegmentItem[]
  combinedAudiences: SegmentItem[]
  state?: 'ok' | 'data_not_ready'
  data_not_ready?: boolean
}

interface GoogleUserList {
  resourceName: string
  id: string
  name: string
  description?: string
  type: string
  membershipLifeSpan: number
  sizeForDisplay?: number
  sizeRangeForDisplay: string
  accessReason?: string
  eligibleForSearch?: boolean
  eligibleForDisplay?: boolean
}

const CATEGORY_LABELS: Record<SegmentCategory, string> = {
  AFFINITY: 'İlgi Alanı',
  IN_MARKET: 'Satın Alma Niyeti',
  DETAILED_DEMOGRAPHIC: 'Detaylı Demografi',
  LIFE_EVENT: 'Yaşam Olayı',
  USER_LIST: 'Kullanıcı Listesi',
  CUSTOM_AUDIENCE: 'Özel Segment',
  COMBINED_AUDIENCE: 'Kombine Kitle',
}

// Ham Google enum'u UI'da asla görünmez — TR karşılığına çevrilir.
const USER_LIST_TYPE_LABELS: Record<string, string> = {
  REMARKETING: 'Yeniden Pazarlama',
  EXTERNAL_REMARKETING: 'Harici Yeniden Pazarlama',
  RULE_BASED: 'Kural Tabanlı',
  LOGICAL: 'Kombine Liste',
  CRM_BASED: 'Müşteri Eşleştirme (CRM)',
  SIMILAR: 'Benzer (devre dışı)',
  UNKNOWN: 'Kullanıcı Listesi',
}

function userListTypeLabel(type: string): string {
  return USER_LIST_TYPE_LABELS[type] ?? 'Kullanıcı Listesi'
}

// Google UserListSizeRange enum'u UI'da asla ham görünmez — sade TR aralığa çevrilir.
const SIZE_RANGE_LABELS: Record<string, string> = {
  LESS_THAN_FIVE_HUNDRED: "500'den az",
  LESS_THAN_ONE_THOUSAND: "1.000'den az",
  ONE_THOUSAND_TO_TEN_THOUSAND: '1.000 – 10.000',
  TEN_THOUSAND_TO_FIFTY_THOUSAND: '10.000 – 50.000',
  FIFTY_THOUSAND_TO_ONE_HUNDRED_THOUSAND: '50.000 – 100.000',
  ONE_HUNDRED_THOUSAND_TO_THREE_HUNDRED_THOUSAND: '100.000 – 300.000',
  THREE_HUNDRED_THOUSAND_TO_FIVE_HUNDRED_THOUSAND: '300.000 – 500.000',
  FIVE_HUNDRED_THOUSAND_TO_ONE_MILLION: '500.000 – 1 milyon',
  ONE_MILLION_TO_TWO_MILLION: '1 – 2 milyon',
  TWO_MILLION_TO_THREE_MILLION: '2 – 3 milyon',
  THREE_MILLION_TO_FIVE_MILLION: '3 – 5 milyon',
  FIVE_MILLION_TO_TEN_MILLION: '5 – 10 milyon',
  TEN_MILLION_TO_TWENTY_MILLION: '10 – 20 milyon',
  TWENTY_MILLION_TO_THIRTY_MILLION: '20 – 30 milyon',
  THIRTY_MILLION_TO_FIFTY_MILLION: '30 – 50 milyon',
  OVER_FIFTY_MILLION: '50 milyon+',
}

// Bilinmeyen / UNKNOWN / UNSPECIFIED → boş döner (ham enum hiç gösterilmez).
function sizeRangeLabel(raw?: string): string {
  if (!raw) return ''
  return SIZE_RANGE_LABELS[raw] ?? ''
}

type BrowseSectionKey = 'inMarket' | 'affinity' | 'detailedDemographics' | 'lifeEvents'
const BROWSE_SECTIONS: Array<{
  key: BrowseSectionKey
  icon: typeof Heart
  category: SegmentCategory
  label: string
  desc: string
}> = [
  { key: 'inMarket', icon: ShoppingBag, category: 'IN_MARKET', label: 'Satın Alma Niyeti', desc: 'Belirli ürün/hizmeti aktif olarak araştıran kullanıcılar' },
  { key: 'affinity', icon: Heart, category: 'AFFINITY', label: 'İlgi Alanı', desc: 'İlgi alanlarına ve yaşam tarzına göre kullanıcılar' },
  { key: 'detailedDemographics', icon: Users, category: 'DETAILED_DEMOGRAPHIC', label: 'Detaylı Demografi', desc: 'Eğitim, medeni durum, ev sahipliği gibi nitelikler' },
  { key: 'lifeEvents', icon: CalendarHeart, category: 'LIFE_EVENT', label: 'Yaşam Olayı', desc: 'Mezuniyet, taşınma, evlilik gibi önemli dönemeçler' },
]

/* ────────────────────────────────────────────────────────────── */

export default function GoogleAudienceView({ activeTab }: { activeTab: 'SAVED' | 'CUSTOM' }) {
  return (
    <div className="space-y-4">
      <GoogleContextNote tab={activeTab} />
      {activeTab === 'SAVED' ? <SegmentBrowser /> : <UserListView />}
    </div>
  )
}

/* ── Bağlam notu (sahte değil, gerçek davranışı anlatır) ── */
function GoogleContextNote({ tab }: { tab: 'SAVED' | 'CUSTOM' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
      {tab === 'SAVED' ? (
        <>
          Google&apos;ın hazır <span className="font-medium text-gray-900">kitle segmentleri</span> kataloğu.
          Bu segmentleri kampanya kurarken hedefleme olarak ekleyebilirsiniz; Google&apos;da Meta&apos;daki gibi ayrı
          &quot;kayıtlı kitle&quot; nesnesi tutulmaz.
        </>
      ) : (
        <>
          Google Ads hesabınızdaki gerçek <span className="font-medium text-gray-900">kullanıcı listeleri</span>
          {' '}(yeniden pazarlama, müşteri eşleştirme, kombine). Yeni liste, web etiketi/kuralı gerektirdiği için
          Google Ads üzerinden tanımlanır.
        </>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Detaylı Kitle → Google segment kataloğu (browse + search)
   ════════════════════════════════════════════════════════════════ */
function SegmentBrowser() {
  const [browseData, setBrowseData] = useState<BrowseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notReady, setNotReady] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['inMarket']))
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SegmentItem[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  const loadBrowse = useCallback(async () => {
    setLoading(true)
    setNotReady(false)
    try {
      const res = await fetch('/api/integrations/google-ads/tools/audience-segments?mode=browse')
      const data = (await res.json()) as BrowseData
      if (!res.ok || data.data_not_ready || data.state === 'data_not_ready') {
        setNotReady(true)
        setBrowseData(null)
        return
      }
      setBrowseData(data)
    } catch {
      setNotReady(true)
      setBrowseData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBrowse()
  }, [loadBrowse])

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/integrations/google-ads/tools/audience-segments?mode=search&q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSearchResults(res.ok ? (data.results ?? []) : [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearchInput = (val: string) => {
    setSearchQuery(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => doSearch(val), 400)
  }

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleParent = (id: string) =>
    setExpandedParents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const isSearching = searchQuery.trim().length >= 2

  if (loading) return <LoadingBox />
  if (notReady) return <NotConnectedBox />

  return (
    <div className="space-y-3">
      {/* Arama */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Google kitle segmentlerinde arayın..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
        />
      </div>

      {/* Arama sonuçları */}
      {isSearching ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {searching ? (
            <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Aranıyor...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Eşleşen segment bulunamadı.</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
              {searchResults.map((item) => (
                <SegmentRow key={`${item.category}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Browse — kategori bölümleri */
        <div className="space-y-2">
          {BROWSE_SECTIONS.map((section) => {
            const items = browseData?.[section.key] ?? []
            if (items.length === 0) return null
            const isExpanded = expandedSections.has(section.key)
            const Icon = section.icon

            const roots = items.filter((i) => !i.parentId)
            const childMap = new Map<string, SegmentItem[]>()
            items.filter((i) => i.parentId).forEach((i) => {
              const arr = childMap.get(i.parentId!) ?? []
              arr.push(i)
              childMap.set(i.parentId!, arr)
            })
            const hasHierarchy = childMap.size > 0

            return (
              <div key={section.key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 text-left"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Icon className="w-[18px] h-[18px] text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{section.label}</p>
                    <p className="text-xs text-gray-500 truncate">{section.desc}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{items.length}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 max-h-80 overflow-y-auto">
                    {hasHierarchy
                      ? roots.map((root) => {
                          const children = childMap.get(root.id) ?? []
                          const hasChildren = children.length > 0
                          const isParentExpanded = expandedParents.has(root.id)
                          return (
                            <div key={`${root.category}-${root.id}`}>
                              <div className="flex items-center">
                                {hasChildren ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleParent(root.id)}
                                    className="p-2 hover:bg-gray-100"
                                  >
                                    {isParentExpanded
                                      ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                      : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                  </button>
                                ) : (
                                  <span className="w-8 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <SegmentRow item={root} />
                                </div>
                              </div>
                              {hasChildren && isParentExpanded && (
                                <div className="pl-8">
                                  {children.map((child) => (
                                    <SegmentRow key={`${child.category}-${child.id}`} item={child} />
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })
                      : items.map((item) => (
                          <SegmentRow key={`${item.category}-${item.id}`} item={item} />
                        ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SegmentRow({ item }: { item: SegmentItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            {CATEGORY_LABELS[item.category]}
          </span>
          {sizeRangeLabel(item.sizeRange) && (
            <span className="text-[10px] text-gray-400">{sizeRangeLabel(item.sizeRange)}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Retargeting → Google user list'leri (salt-okunur)
   ════════════════════════════════════════════════════════════════ */
function UserListView() {
  const [lists, setLists] = useState<GoogleUserList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/integrations/google-ads/tools/audience-manager')
      const data = await res.json()
      if (!res.ok) {
        setError(true)
        setLists([])
        return
      }
      setLists(data.userLists ?? [])
    } catch {
      setError(true)
      setLists([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingBox />
  if (error) return <NotConnectedBox />

  const filtered = searchQuery.trim()
    ? lists.filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : lists

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Kullanıcı listesi arayın..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">
            {searchQuery.trim()
              ? 'Aramanızla eşleşen liste bulunamadı.'
              : 'Google Ads hesabınızda henüz kullanıcı listesi yok.'}
          </p>
          {!searchQuery.trim() && (
            <p className="text-xs text-gray-500 mt-1">
              Yeniden pazarlama listeleri web sitenize Google etiketi eklendiğinde otomatik dolar.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((list) => (
            <UserListCard key={list.id} list={list} />
          ))}
        </div>
      )}
    </div>
  )
}

function UserListCard({ list }: { list: GoogleUserList }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <UserCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{list.name}</p>
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {userListTypeLabel(list.type)}
            </span>
          </div>
          {list.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{list.description}</p>
          )}
          <div className="flex items-center gap-x-4 gap-y-1 mt-2 flex-wrap text-xs text-gray-500">
            {sizeRangeLabel(list.sizeRangeForDisplay) && (
              <span>
                Boyut: <span className="text-gray-700 font-medium">{sizeRangeLabel(list.sizeRangeForDisplay)}</span>
              </span>
            )}
            <span>
              Üyelik süresi: <span className="text-gray-700 font-medium">{list.membershipLifeSpan} gün</span>
            </span>
            {(list.eligibleForSearch || list.eligibleForDisplay) && (
              <span className="inline-flex items-center gap-1">
                Uygun:
                <span className="text-gray-700 font-medium">
                  {[list.eligibleForSearch && 'Arama', list.eligibleForDisplay && 'Görüntülü']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Ortak durum kutuları ── */
function LoadingBox() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-12">
      <div className="flex items-center justify-center gap-3 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm">Yükleniyor...</span>
      </div>
    </div>
  )
}

function NotConnectedBox() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Link2Off className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700">Google Ads bağlı değil</h3>
      <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto">
        Google kitle verilerini görmek için Google Ads hesabınızı bağlamanız gerekir.
      </p>
      <a
        href="/entegrasyon"
        className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Entegrasyona Git
      </a>
    </div>
  )
}
