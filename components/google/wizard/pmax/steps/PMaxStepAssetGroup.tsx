'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type DragEvent } from 'react'
import {
  ChevronUp, ChevronDown, ChevronRight, Image as ImageIcon, Type, Users, X, Plus, Link2, Video,
  Upload, Search, Loader2, Heart, ShoppingBag, UserCheck, Layers, Info, Globe,
} from 'lucide-react'
import type {
  PMaxStepProps, PMaxSitelink, PMaxCallToAction, PMaxAssetImage,
  PMaxSelectedAudienceSegment,
} from '../shared/PMaxWizardTypes'
import { inputCls, PMaxCallToActionOptions } from '../shared/PMaxWizardTypes'

/* ------------------------------------------------------------------ */
/*  Shared UI helpers                                                   */
/* ------------------------------------------------------------------ */

function Field({ label, required, children, hint, counter }: {
  label: string; required?: boolean; hint?: string; counter?: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[13px] font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {counter && <span className="text-xs text-gray-400">{counter}</span>}
      </div>
      {hint && <p className="text-[12px] text-gray-500 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function CollapsibleSection({ title, count, defaultOpen = true, icon, children }: {
  title: string; count?: number; defaultOpen?: boolean; icon?: React.ReactNode; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center justify-between w-full px-5 py-4 text-left">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="text-[15px] font-semibold text-gray-900">{title}</h4>
          {count !== undefined && (
            <span className="text-xs text-gray-400 ml-1">({count})</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-0 border-t border-gray-100">{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Image/Logo Upload Dialog (Google Ads style)                        */
/* ------------------------------------------------------------------ */

type UploadTab = 'upload'

function ImageUploadDialog({ assets, onAdd, onRemove, maxCount, role, t }: {
  assets: PMaxAssetImage[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  maxCount: number
  role: 'image' | 'logo'
  t: PMaxStepProps['t']
}) {
  const [showDialog, setShowDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length) onAdd(files.slice(0, maxCount - assets.length))
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'))
    if (files.length) onAdd(files.slice(0, maxCount - assets.length))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const dialogTitle = role === 'image'
    ? t('assetGroup.imageDialogTitle')
    : t('assetGroup.logoDialogTitle')

  const sizeHint = role === 'image'
    ? t('assetGroup.imageUploadSizeHint')
    : t('assetGroup.logoUploadSizeHint')

  const IMAGE_TABS: { key: string; label: string }[] = [
    { key: 'recommendations', label: t('assetGroup.imageTabRecommendations') },
    { key: 'library', label: t('assetGroup.imageTabLibrary') },
    { key: 'website', label: t('assetGroup.imageTabWebsite') },
    { key: 'upload', label: t('assetGroup.imageTabUpload') },
    { key: 'stock', label: t('assetGroup.imageTabStock') },
  ]

  return (
    <div className="space-y-3">
      {/* Existing previews */}
      {assets.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {assets.map(asset => (
            <div key={asset.id} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              {(asset.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.url}
                  alt={asset.name || role}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(asset.id)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {assets.length < maxCount && (
        <button
          type="button"
          onClick={() => setShowDialog(true)}
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> {role === 'image' ? t('assetGroup.addImage') : t('assetGroup.addLogo')}
        </button>
      )}

      {/* Google Ads style dialog */}
      {showDialog && (
        <div className="border border-gray-300 rounded-lg bg-white shadow-sm overflow-hidden">
          {/* Dialog header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowDialog(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
              <span className="text-[13px] font-medium text-gray-900">{dialogTitle}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {IMAGE_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as 'upload')}
                className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4 min-h-[200px]">
            {activeTab === 'upload' ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">{t('assetGroup.uploadDragDrop')}</p>
                <p className="text-[12px] text-gray-400 mt-1">{sizeHint}</p>
                <button type="button" className="mt-2 text-sm text-blue-600 hover:underline font-medium">
                  {t('assetGroup.uploadBrowseFiles')}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple={maxCount > 1}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              /* Placeholder for non-upload tabs */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 mb-3 text-gray-300">
                  <ImageIcon className="w-full h-full" />
                </div>
                <p className="text-[13px] font-medium text-gray-900">{t('assetGroup.noSuggestionsYet')}</p>
                <p className="text-[12px] text-gray-500 mt-1 max-w-md">{t('assetGroup.noSuggestionsHint')}</p>
              </div>
            )}
          </div>

          {/* Dialog footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-[11px] text-gray-400 flex-1 pr-4">{t('assetGroup.imageLegalNote')}</p>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => setShowDialog(false)} className="px-3 py-1.5 text-[13px] text-gray-600 hover:text-gray-800">
                {t('assetGroup.imageCancel')}
              </button>
              <button type="button" onClick={() => setShowDialog(false)} className="px-3 py-1.5 text-[13px] font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
                {t('assetGroup.imageSave')}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[12px] text-gray-400">{assets.length}/{maxCount}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Video Upload Dialog (Google Ads style tabs)                        */
/* ------------------------------------------------------------------ */

type VideoTab = 'youtube' | 'upload'

function VideoUploadSection({ videos, onAdd, onAddYouTube, onRemove, maxCount, t }: {
  videos: PMaxAssetImage[]
  onAdd: (files: File[]) => void
  onAddYouTube: (url: string) => void
  onRemove: (id: string) => void
  maxCount: number
  t: PMaxStepProps['t']
}) {
  const [showDialog, setShowDialog] = useState(false)
  const [videoTab, setVideoTab] = useState<VideoTab>('youtube')
  const [ytUrl, setYtUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('video/'))
    if (files.length) onAdd(files.slice(0, maxCount - videos.length))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleYouTubeAdd = () => {
    if (ytUrl.trim()) {
      onAddYouTube(ytUrl)
      setYtUrl('')
    }
  }

  const VIDEO_TABS: { key: VideoTab; label: string; beta?: boolean }[] = [
    { key: 'youtube', label: t('assetGroup.videoTabYouTube') },
    { key: 'upload', label: t('assetGroup.videoTabUpload') },
  ]

  return (
    <CollapsibleSection
      title={t('assetGroup.videosTitle')}
      count={videos.length}
      icon={<div className={`w-2 h-2 rounded-full ${videos.length > 0 ? 'bg-blue-500' : 'bg-gray-300'}`} />}
    >
      <div className="space-y-3">
        {/* Existing videos */}
        {videos.length > 0 && (
          <div className="space-y-2">
            {videos.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg">
                <Video className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-gray-900 truncate">{v.name || v.url || 'Video'}</p>
                  {v.url && <p className="text-[12px] text-gray-400 truncate">{v.url}</p>}
                </div>
                <button type="button" onClick={() => onRemove(v.id)} className="text-gray-400 hover:text-red-600 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add video button */}
        {videos.length < maxCount && (
          <button
            type="button"
            onClick={() => setShowDialog(true)}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> {t('assetGroup.addVideo')}
          </button>
        )}

        {videos.length === 0 && !showDialog && (
          <p className="text-[12px] text-gray-400 italic">{t('assetGroup.noVideoNote')}</p>
        )}

        {/* Video dialog — Google Ads style */}
        {showDialog && (
          <div className="border border-gray-300 rounded-lg bg-white shadow-sm overflow-hidden">
            {/* Dialog header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowDialog(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
                <span className="text-[13px] font-medium text-gray-900">
                  {t('assetGroup.videoDialogTitle')}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {VIDEO_TABS.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setVideoTab(tab.key)}
                  className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                    videoTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {tab.beta && <span className="ml-1 px-1 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-100 rounded">BETA</span>}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-4">
              {videoTab === 'youtube' && (
                <div className="space-y-3">
                  <p className="text-[12px] text-gray-500">{t('assetGroup.videoYouTubeHint')}</p>
                  <div className="flex gap-2">
                    <input
                      className={`${inputCls} flex-1`}
                      value={ytUrl}
                      onChange={e => setYtUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleYouTubeAdd())}
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                    <button
                      type="button"
                      onClick={handleYouTubeAdd}
                      disabled={!ytUrl.trim()}
                      className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {t('assetGroup.videoAdd')}
                    </button>
                  </div>
                </div>
              )}

              {videoTab === 'upload' && (
                <div className="space-y-3">
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">{t('assetGroup.videoUploadDragDrop')}</p>
                    <p className="text-[12px] text-gray-400 mt-1">{t('assetGroup.videoUploadHint')}</p>
                    <button type="button" className="mt-2 text-sm text-blue-600 hover:underline font-medium">
                      {t('assetGroup.uploadBrowseFiles')}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Dialog footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-[11px] text-gray-400 flex-1 pr-4">{t('assetGroup.videoLegalNote')}</p>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => setShowDialog(false)} className="px-3 py-1.5 text-[13px] text-gray-600 hover:text-gray-800">
                  {t('assetGroup.videoCancel')}
                </button>
                <button type="button" onClick={() => setShowDialog(false)} className="px-3 py-1.5 text-[13px] font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
                  {t('assetGroup.videoSave')}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-[12px] text-gray-400">{videos.length}/{maxCount}</p>
      </div>
    </CollapsibleSection>
  )
}

/* ------------------------------------------------------------------ */
/*  Audience Signal — dynamic (Search + Browse)                        */
/* ------------------------------------------------------------------ */

interface AudienceItem {
  id: string
  name: string
  category: string
  resourceName: string
  parentId?: string
  subType?: string
  sizeRange?: string
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

const CATEGORY_COLORS: Record<string, string> = {
  AFFINITY: 'bg-purple-50 text-purple-700',
  IN_MARKET: 'bg-green-50 text-green-700',
  DETAILED_DEMOGRAPHIC: 'bg-orange-50 text-orange-700',
  LIFE_EVENT: 'bg-pink-50 text-pink-700',
  USER_LIST: 'bg-blue-50 text-blue-700',
  CUSTOM_AUDIENCE: 'bg-teal-50 text-teal-700',
  COMBINED_AUDIENCE: 'bg-indigo-50 text-indigo-700',
}

const BROWSE_SECTIONS: Array<{ key: BrowseSectionKey; label: string; icon: typeof Users }> = [
  { key: 'userLists', label: 'Web sitesini ziyaret eden kullanıcılar', icon: UserCheck },
  { key: 'inMarket', label: 'Pazardaki kitleler', icon: ShoppingBag },
  { key: 'affinity', label: 'Yakınlık', icon: Heart },
  { key: 'detailedDemographics', label: 'Ayrıntılı demografik veriler', icon: Users },
  { key: 'lifeEvents', label: 'Yaşam olayları', icon: Users },
  { key: 'customAudiences', label: 'Özel kitleler', icon: Layers },
  { key: 'combinedAudiences', label: 'Birleştirilmiş kitleler', icon: Layers },
]

function AudienceSignalsPanel({ state, update, t }: PMaxStepProps) {
  const [tab, setTab] = useState<'search' | 'browse'>('browse')
  const [browseData, setBrowseData] = useState<BrowseData | null>(null)
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AudienceItem[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  const [audienceNameInput, setAudienceNameInput] = useState('')

  const loadBrowse = useCallback(async () => {
    if (browseData) return
    setBrowseLoading(true)
    setBrowseError(null)
    try {
      const res = await fetch('/api/integrations/google-ads/tools/audience-segments?mode=browse')
      const data = await res.json()
      if (!res.ok) { setBrowseError(data.error ?? 'Yüklenemedi'); return }
      setBrowseData(data)
    } catch {
      setBrowseError('Kitle verileri yüklenemedi')
    } finally {
      setBrowseLoading(false)
    }
  }, [browseData])

  useEffect(() => {
    if (tab === 'browse') loadBrowse()
  }, [tab, loadBrowse])

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

  const toggleSegment = (item: AudienceItem) => {
    const segments = state.selectedAudienceSegments
    const exists = segments.find(s => s.id === item.id && s.category === item.category)
    if (exists) {
      update({
        selectedAudienceSegments: segments.filter(s => !(s.id === item.id && s.category === item.category)),
        selectedAudienceIds: state.selectedAudienceIds.filter(id => id !== item.id),
      })
    } else {
      const newSeg: PMaxSelectedAudienceSegment = {
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            {t('signals.audienceDescription')}
          </p>
        </div>
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline font-medium whitespace-nowrap"
          onClick={() => {
            // "Kayıtlı kitle sinyali ekle" — toggle browse
            if (tab !== 'browse') setTab('browse')
            loadBrowse()
          }}
        >
          {t('signals.addSavedSignal')}
        </button>
      </div>

      {/* Verileriniz — Your Data section */}
      <CollapsibleSection title={t('signals.yourData')} defaultOpen={true}>
        <p className="text-[12px] text-gray-500 mb-3">{t('signals.yourDataDesc')}</p>

        {/* Tabs: Arama / Göz at */}
        <div className="flex border-b border-gray-200 mb-3">
          <button
            type="button"
            onClick={() => setTab('search')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'search' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('signals.tabSearch')}
          </button>
          <button
            type="button"
            onClick={() => setTab('browse')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'browse' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('signals.tabBrowse')}
          </button>
          <div className="flex-1" />
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
                placeholder={t('signals.searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />}
            </div>
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">{t('signals.noResults')}</p>
            )}
            {searchResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {searchResults.map(item => (
                  <AudienceRow key={`${item.category}-${item.id}`} item={item} selected={isSelected(item)} onToggle={() => toggleSegment(item)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Browse Tab */}
        {tab === 'browse' && (
          <div className="space-y-1">
            {browseLoading && (
              <div className="flex items-center justify-center py-6 gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t('signals.loading')}</span>
              </div>
            )}
            {browseError && <p className="text-sm text-red-500">{browseError}</p>}
            {browseData?.state === 'data_not_ready' && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                {t('signals.dataNotReady')}
              </div>
            )}
            {browseData && browseData.state !== 'data_not_ready' && BROWSE_SECTIONS.map(section => {
              const items = browseData[section.key]
              if (!items || items.length === 0) return null
              const isExpanded = expandedSections.has(section.key)
              const Icon = section.icon
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
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                    <Icon className="w-4 h-4 text-gray-500 shrink-0" />
                    <p className="text-sm font-medium text-gray-900 flex-1">{section.label}</p>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-100 max-h-52 overflow-y-auto">
                      {childMap.size > 0 ? (
                        roots.map(root => {
                          const children = childMap.get(root.id) ?? []
                          const hasChildren = children.length > 0
                          const isParentExpanded = expandedParents.has(root.id)
                          return (
                            <div key={`${root.category}-${root.id}`}>
                              <div className="flex items-center">
                                {hasChildren && (
                                  <button type="button" onClick={() => toggleParent(root.id)} className="p-2 hover:bg-gray-100">
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
                        items.map(item => (
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
      </CollapsibleSection>

      {/* Ek sinyaller — İlgi alanları ve demografik veriler (from browse API) */}
      <CollapsibleSection title={t('signals.additionalSignals')} defaultOpen={false}>
        <div className="space-y-3">
          <p className="text-[12px] text-gray-500">{t('signals.interestsDesc')}</p>
          {browseLoading && (
            <div className="flex items-center gap-2 py-4 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">{t('signals.loading')}</span>
            </div>
          )}
          {!browseLoading && !browseData && (
            <button type="button" onClick={loadBrowse} className="text-sm text-blue-600 hover:underline">
              {t('signals.loadInterests')}
            </button>
          )}
          {browseData && (() => {
            const interestSections: Array<{ key: BrowseSectionKey; label: string; icon: typeof Users }> = [
              { key: 'affinity', label: 'Yakınlık', icon: Heart },
              { key: 'detailedDemographics', label: 'Ayrıntılı demografik veriler', icon: Users },
              { key: 'lifeEvents', label: 'Yaşam olayları', icon: Users },
            ]
            return interestSections.map(section => {
              const items = browseData[section.key]
              if (!items || items.length === 0) return null
              const isExp = expandedSections.has(`extra-${section.key}`)
              const Icon = section.icon
              return (
                <div key={section.key} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedSections(prev => {
                        const next = new Set(prev)
                        const k = `extra-${section.key}`
                        if (next.has(k)) next.delete(k); else next.add(k)
                        return next
                      })
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                  >
                    {isExp ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                    <Icon className="w-4 h-4 text-gray-500 shrink-0" />
                    <p className="text-sm font-medium text-gray-900 flex-1">{section.label}</p>
                  </button>
                  {isExp && (
                    <div className="border-t border-gray-100 max-h-52 overflow-y-auto">
                      {items.map(item => (
                        <AudienceRow key={`${item.category}-${item.id}`} item={item} selected={isSelected(item)} onToggle={() => toggleSegment(item)} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      </CollapsibleSection>

      {/* Kitle adı */}
      <CollapsibleSection title={t('signals.audienceNameTitle')} defaultOpen={true}>
        <p className="text-[12px] text-gray-500 mb-2">{t('signals.audienceNameDesc')}</p>
        <input
          className={inputCls}
          value={audienceNameInput}
          onChange={e => setAudienceNameInput(e.target.value)}
          placeholder={t('signals.audienceNamePlaceholder')}
        />
      </CollapsibleSection>

      {/* Selected segments summary */}
      {state.selectedAudienceSegments.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium text-blue-600">
            {t('signals.audienceCount', { count: state.selectedAudienceSegments.length })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {state.selectedAudienceSegments.map(seg => (
              <span
                key={`${seg.category}-${seg.id}`}
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${CATEGORY_COLORS[seg.category] ?? 'bg-gray-100 text-gray-700'}`}
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

function AudienceRow({ item, selected, onToggle }: {
  item: AudienceItem; selected: boolean; onToggle: () => void
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
        {item.category && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-600'}`}>
            {item.category.replace(/_/g, ' ').toLowerCase()}
          </span>
        )}
      </div>
    </label>
  )
}

/* ------------------------------------------------------------------ */
/*  Ad Preview (Google Ads style)                                      */
/* ------------------------------------------------------------------ */

function AdPreview({ state, t }: { state: PMaxStepProps['state']; t: PMaxStepProps['t'] }) {
  const headline1 = state.headlines.find(h => h.trim()) || t('assetGroup.previewHeadline')
  const headline2 = state.longHeadlines.find(h => h.trim()) || ''
  const desc = state.descriptions.find(d => d.trim()) || ''
  const businessName = state.businessName || t('assetGroup.previewBusiness')
  const url = state.finalUrl || 'https://example.com'
  const logoPreview = state.logos[0]?.url

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white max-w-[280px]">
      <p className="text-[10px] text-gray-400 mb-2">{t('assetGroup.previewLabel')}</p>
      <div className="space-y-2">
        {/* Logo + Business name */}
        <div className="flex items-center gap-2">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
              <Globe className="w-3 h-3 text-gray-400" />
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-900">{businessName}</p>
            <p className="text-[10px] text-gray-500 truncate max-w-[200px]">{url}</p>
          </div>
        </div>
        {/* Headlines */}
        <p className="text-sm font-semibold text-blue-700 leading-tight">{headline1}</p>
        {headline2 && <p className="text-sm font-semibold text-blue-700 leading-tight">{headline2}</p>}
        {/* Description */}
        {desc && <p className="text-xs text-gray-600 line-clamp-2">{desc}</p>}
        {/* Sitelinks preview */}
        {state.sitelinks.filter(sl => sl.title.trim()).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {state.sitelinks.filter(sl => sl.title.trim()).slice(0, 4).map((sl, i) => (
              <span key={i} className="text-[10px] text-blue-600 px-2 py-0.5 border border-blue-200 rounded-full">{sl.title}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function PMaxStepAssetGroup({ state, update, t }: PMaxStepProps) {
  const [searchThemeInput, setSearchThemeInput] = useState('')

  // --- Asset helpers ---
  const addHeadline = () => { if (state.headlines.length < 15) update({ headlines: [...state.headlines, ''] }) }
  const removeHeadline = (i: number) => { if (state.headlines.length > 3) update({ headlines: state.headlines.filter((_, idx) => idx !== i) }) }

  const addLongHeadline = () => { if (state.longHeadlines.length < 5) update({ longHeadlines: [...state.longHeadlines, ''] }) }
  const removeLongHeadline = (i: number) => { if (state.longHeadlines.length > 1) update({ longHeadlines: state.longHeadlines.filter((_, idx) => idx !== i) }) }

  const addDescription = () => { if (state.descriptions.length < 5) update({ descriptions: [...state.descriptions, ''] }) }
  const removeDescription = (i: number) => { if (state.descriptions.length > 3) update({ descriptions: state.descriptions.filter((_, idx) => idx !== i) }) }

  // Image upload
  const addImages = (files: File[]) => {
    const newImages: PMaxAssetImage[] = files.map(f => ({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      url: URL.createObjectURL(f),
    }))
    update({ images: [...state.images, ...newImages].slice(0, 20) })
  }
  const removeImage = (id: string) => {
    const img = state.images.find(i => i.id === id)
    if (img?.url?.startsWith?.('blob:')) URL.revokeObjectURL(img.url)
    update({ images: state.images.filter(i => i.id !== id) })
  }

  // Logo upload
  const addLogos = (files: File[]) => {
    const newLogos: PMaxAssetImage[] = files.map(f => ({
      id: `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      url: URL.createObjectURL(f),
    }))
    update({ logos: [...state.logos, ...newLogos].slice(0, 5) })
  }
  const removeLogo = (id: string) => {
    const logo = state.logos.find(l => l.id === id)
    if (logo?.url?.startsWith?.('blob:')) URL.revokeObjectURL(logo.url)
    update({ logos: state.logos.filter(l => l.id !== id) })
  }

  // Sitelinks
  const addSitelink = () => {
    if (state.sitelinks.length < 8) update({ sitelinks: [...state.sitelinks, { title: '', description1: '', description2: '', finalUrl: '' }] })
  }
  const removeSitelink = (i: number) => { update({ sitelinks: state.sitelinks.filter((_, idx) => idx !== i) }) }
  const updateSitelink = (i: number, field: keyof PMaxSitelink, val: string) => {
    const next = [...state.sitelinks]
    next[i] = { ...next[i], [field]: val }
    update({ sitelinks: next })
  }

  // Videos (YouTube URL — this is correct per Google Ads)
  const addVideo = () => {
    if (state.videos.length < 5) update({ videos: [...state.videos, { id: `vid-${Date.now()}`, url: '' }] })
  }
  const removeVideo = (i: number) => { update({ videos: state.videos.filter((_, idx) => idx !== i) }) }

  // Search themes
  const addSearchTheme = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (state.searchThemes.some(st => st.text.trim().toLowerCase() === trimmed.toLowerCase())) return
    if (state.searchThemes.length >= 25) return
    update({ searchThemes: [...state.searchThemes, { text: trimmed }] })
    setSearchThemeInput('')
  }
  const removeSearchTheme = (i: number) => { update({ searchThemes: state.searchThemes.filter((_, idx) => idx !== i) }) }

  const filledHeadlines = state.headlines.filter(h => h.trim()).length
  const filledLongHeadlines = state.longHeadlines.filter(h => h.trim()).length
  const filledDescriptions = state.descriptions.filter(d => d.trim()).length

  return (
    <div className="space-y-4 pt-2">
      {/* Asset Group Name */}
      <CollapsibleSection title={t('assetGroup.assetGroupName')} defaultOpen={true}>
        <input
          className={inputCls}
          value={state.assetGroupName}
          onChange={e => update({ assetGroupName: e.target.value })}
          placeholder={t('assetGroup.assetGroupNamePlaceholder')}
        />
      </CollapsibleSection>

      {/* Öğeler (Assets) — main section with ad preview */}
      <div className="border border-gray-200 rounded-lg bg-white">
        <div className="px-5 py-4 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900">{t('assetGroup.assetsSection')}</h4>
        </div>
        <div className="flex">
          {/* Left: asset inputs */}
          <div className="flex-1 px-5 py-4 space-y-5 min-w-0">
            {/* Asset strength indicator tabs */}
            <div className="flex items-center gap-4 text-xs text-gray-500 border-b border-gray-100 pb-3">
              <span className="flex items-center gap-1"><Type className="w-3.5 h-3.5" /> {t('assetGroup.tabHeadlines')}</span>
              <span className="flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> {t('assetGroup.tabImages')}</span>
              <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5" /> {t('assetGroup.tabVideos')}</span>
              <span className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> {t('assetGroup.tabSitelinks')}</span>
            </div>

            {/* Final URL */}
            <Field label={t('conversion.finalUrl')} required>
              <input className={inputCls} value={state.finalUrl} onChange={e => update({ finalUrl: e.target.value })} placeholder="https://example.com" />
            </Field>

            {/* Aramalar / Call extensions — functional */}
            <CollapsibleSection title={t('assetGroup.callsTitle')} defaultOpen={state.phoneNumber.length > 0}>
              <p className="text-[12px] text-gray-500 mb-2">{t('assetGroup.callsHint')}</p>
              <div className="flex gap-2 items-center max-w-md">
                <select
                  className={`${inputCls} w-20`}
                  value={state.phoneCountryCode}
                  onChange={e => update({ phoneCountryCode: e.target.value })}
                >
                  <option value="TR">+90</option>
                  <option value="US">+1</option>
                  <option value="DE">+49</option>
                  <option value="GB">+44</option>
                  <option value="FR">+33</option>
                </select>
                <input
                  className={`${inputCls} flex-1`}
                  value={state.phoneNumber}
                  onChange={e => update({ phoneNumber: e.target.value.replace(/[^0-9 ]/g, '') })}
                  placeholder={t('assetGroup.callsPlaceholder')}
                  maxLength={15}
                />
              </div>
              {state.phoneNumber.trim() && (
                <p className="text-[12px] text-gray-400 mt-1">{t('assetGroup.callsPreview')}: +{state.phoneCountryCode === 'TR' ? '90' : state.phoneCountryCode === 'US' ? '1' : state.phoneCountryCode === 'DE' ? '49' : state.phoneCountryCode === 'GB' ? '44' : '33'} {state.phoneNumber}</p>
              )}
            </CollapsibleSection>

            {/* Headlines (3-15, max 30 chars) */}
            <CollapsibleSection
              title={t('assetGroup.headlinesTitle')}
              count={filledHeadlines}
              icon={<div className={`w-2 h-2 rounded-full ${filledHeadlines >= 3 ? 'bg-blue-500' : 'bg-gray-300'}`} />}
            >
              <div className="space-y-2">
                {state.headlines.map((h, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className={`${inputCls} flex-1`}
                      value={h}
                      onChange={e => { const next = [...state.headlines]; next[i] = e.target.value.slice(0, 30); update({ headlines: next }) }}
                      placeholder={`${t('assetGroup.headlinePlaceholder')} ${i + 1}`}
                      maxLength={30}
                    />
                    <span className="text-xs text-gray-400 w-10 text-right shrink-0">{h.length}/30</span>
                    <button type="button" onClick={() => removeHeadline(i)} disabled={state.headlines.length <= 3} className="px-1 text-gray-400 hover:text-red-600 disabled:opacity-30 shrink-0">×</button>
                  </div>
                ))}
                {state.headlines.length < 15 && (
                  <button type="button" onClick={addHeadline} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <Plus className="w-3.5 h-3.5" /> {t('assetGroup.addHeadline')}
                  </button>
                )}
              </div>
            </CollapsibleSection>

            {/* Long Headlines (1-5, max 90 chars) */}
            <CollapsibleSection
              title={t('assetGroup.longHeadlinesTitle')}
              count={filledLongHeadlines}
              icon={<div className={`w-2 h-2 rounded-full ${filledLongHeadlines >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`} />}
            >
              <div className="space-y-2">
                {state.longHeadlines.map((h, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className={`${inputCls} flex-1`}
                      value={h}
                      onChange={e => { const next = [...state.longHeadlines]; next[i] = e.target.value.slice(0, 90); update({ longHeadlines: next }) }}
                      placeholder={`${t('assetGroup.longHeadlinePlaceholder')} ${i + 1}`}
                      maxLength={90}
                    />
                    <span className="text-xs text-gray-400 w-10 text-right shrink-0">{h.length}/90</span>
                    <button type="button" onClick={() => removeLongHeadline(i)} disabled={state.longHeadlines.length <= 1} className="px-1 text-gray-400 hover:text-red-600 disabled:opacity-30 shrink-0">×</button>
                  </div>
                ))}
                {state.longHeadlines.length < 5 && (
                  <button type="button" onClick={addLongHeadline} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <Plus className="w-3.5 h-3.5" /> {t('assetGroup.addLongHeadline')}
                  </button>
                )}
              </div>
            </CollapsibleSection>

            {/* Descriptions (3-5, max 90 chars) */}
            <CollapsibleSection
              title={t('assetGroup.descriptionsTitle')}
              count={filledDescriptions}
              icon={<div className={`w-2 h-2 rounded-full ${filledDescriptions >= 3 ? 'bg-blue-500' : 'bg-gray-300'}`} />}
            >
              <p className="text-[12px] text-gray-500 mb-2">{t('assetGroup.descriptionsHint')}</p>
              <div className="space-y-2">
                {state.descriptions.map((d, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <textarea
                      className={`${inputCls} flex-1 min-h-[56px]`}
                      value={d}
                      onChange={e => { const next = [...state.descriptions]; next[i] = e.target.value.slice(0, 90); update({ descriptions: next }) }}
                      placeholder={`${t('assetGroup.descriptionPlaceholder')} ${i + 1}`}
                      maxLength={90}
                      rows={2}
                    />
                    <span className="text-xs text-gray-400 w-10 text-right shrink-0 mt-2">{d.length}/90</span>
                    <button type="button" onClick={() => removeDescription(i)} disabled={state.descriptions.length <= 3} className="px-1 text-gray-400 hover:text-red-600 disabled:opacity-30 shrink-0 mt-2">×</button>
                  </div>
                ))}
                {state.descriptions.length < 5 && (
                  <button type="button" onClick={addDescription} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <Plus className="w-3.5 h-3.5" /> {t('assetGroup.addDescription')}
                  </button>
                )}
              </div>
            </CollapsibleSection>

            {/* Images (max 20) — FILE UPLOAD */}
            <CollapsibleSection
              title={t('assetGroup.imagesTitle')}
              count={state.images.length}
              icon={<div className={`w-2 h-2 rounded-full ${state.images.length >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`} />}
            >
              <ImageUploadDialog
                assets={state.images}
                onAdd={addImages}
                onRemove={removeImage}
                maxCount={20}
                role="image"
                t={t}
              />
            </CollapsibleSection>

            {/* Logos (max 5) — FILE UPLOAD */}
            <CollapsibleSection
              title={t('assetGroup.logosTitle')}
              count={state.logos.length}
              icon={<div className={`w-2 h-2 rounded-full ${state.logos.length >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`} />}
            >
              <ImageUploadDialog
                assets={state.logos}
                onAdd={addLogos}
                onRemove={removeLogo}
                maxCount={5}
                role="logo"
                t={t}
              />
            </CollapsibleSection>

            {/* Business Name */}
            <CollapsibleSection title={t('assetGroup.businessName')} defaultOpen={true}>
              <input
                className={inputCls}
                value={state.businessName}
                onChange={e => update({ businessName: e.target.value.slice(0, 25) })}
                placeholder={t('assetGroup.businessNamePlaceholder')}
                maxLength={25}
              />
              <p className="text-[12px] text-gray-400 mt-1">{state.businessName.length}/25</p>
            </CollapsibleSection>

            {/* Videos (0-5) — Google Ads style dialog */}
            <VideoUploadSection
              videos={state.videos}
              onAdd={(files) => {
                const newVideos: PMaxAssetImage[] = files.map(f => ({
                  id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  name: f.name,
                  url: URL.createObjectURL(f),
                }))
                update({ videos: [...state.videos, ...newVideos].slice(0, 5) })
              }}
              onAddYouTube={(url) => {
                if (state.videos.length < 5 && url.trim()) {
                  update({ videos: [...state.videos, { id: `vid-${Date.now()}`, url: url.trim(), name: url.trim() }] })
                }
              }}
              onRemove={(id) => {
                const vid = state.videos.find(v => v.id === id)
                if (vid?.url?.startsWith?.('blob:')) URL.revokeObjectURL(vid.url)
                update({ videos: state.videos.filter(v => v.id !== id) })
              }}
              maxCount={5}
              t={t}
            />

            {/* Sitelinks (0-8) */}
            <CollapsibleSection
              title={t('assetGroup.sitelinksTitle')}
              count={state.sitelinks.filter(sl => sl.title.trim()).length}
              defaultOpen={true}
            >
              <p className="text-[12px] text-gray-500 mb-3">{t('assetGroup.sitelinksHint')}</p>
              <div className="space-y-3">
                {state.sitelinks.length === 0 && (
                  <div className="space-y-1">
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <div key={n} className="flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-lg">
                        <div>
                          <p className="text-sm text-gray-400">{t('assetGroup.sitelinkLabel')} {n}</p>
                          <p className="text-xs text-gray-300">{t('assetGroup.sitelinkDesc')}</p>
                        </div>
                        <button type="button" onClick={addSitelink} className="text-gray-400 hover:text-blue-600">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {state.sitelinks.map((sl, i) => (
                  <div key={i} className="p-3 border border-gray-200 rounded-lg space-y-2 relative">
                    <button type="button" onClick={() => removeSitelink(i)} className="absolute top-2 right-2 text-gray-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inputCls} value={sl.title} onChange={e => updateSitelink(i, 'title', e.target.value.slice(0, 25))} placeholder={`${t('assetGroup.sitelinkTitle')} (max 25)`} maxLength={25} />
                      <input className={inputCls} value={sl.finalUrl} onChange={e => updateSitelink(i, 'finalUrl', e.target.value)} placeholder={t('assetGroup.sitelinkUrl')} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inputCls} value={sl.description1} onChange={e => updateSitelink(i, 'description1', e.target.value.slice(0, 35))} placeholder={`${t('assetGroup.sitelinkDesc')} 1 (max 35)`} maxLength={35} />
                      <input className={inputCls} value={sl.description2} onChange={e => updateSitelink(i, 'description2', e.target.value.slice(0, 35))} placeholder={`${t('assetGroup.sitelinkDesc')} 2 (max 35)`} maxLength={35} />
                    </div>
                  </div>
                ))}
                {state.sitelinks.length > 0 && state.sitelinks.length < 8 && (
                  <button type="button" onClick={addSitelink} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <Plus className="w-3.5 h-3.5" /> {t('assetGroup.addSitelink')}
                  </button>
                )}
              </div>
            </CollapsibleSection>

            {/* Call to Action */}
            <CollapsibleSection title={t('assetGroup.ctaTitle')} defaultOpen={true}>
              <select
                className={`${inputCls} max-w-[240px]`}
                value={state.callToAction}
                onChange={e => update({ callToAction: e.target.value as PMaxCallToAction })}
              >
                {PMaxCallToActionOptions.map(cta => (
                  <option key={cta} value={cta}>{t(`assetGroup.ctaOptions.${cta}`)}</option>
                ))}
              </select>
            </CollapsibleSection>

            {/* Diğer öğe türleri (Other Asset Types) — collapsed toggle */}
            <div className="text-sm text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
              <ChevronDown className="w-3.5 h-3.5" />
              {t('assetGroup.otherAssetTypes')}
            </div>

            {/* Display URL Paths */}
            <div className="pl-4 space-y-3">
              <p className="text-xs font-medium text-gray-500">{t('assetGroup.otherOptions')}</p>

              {/* Display paths */}
              <Field label={t('assetGroup.displayPathTitle')} hint={t('assetGroup.displayPathHint')}>
                <div className="flex items-center gap-1 max-w-sm">
                  <span className="text-sm text-gray-500 shrink-0">example.com/</span>
                  <input
                    className={`${inputCls} w-28`}
                    value={state.displayPaths[0]}
                    onChange={e => update({ displayPaths: [e.target.value.slice(0, 15), state.displayPaths[1]] })}
                    placeholder={t('assetGroup.displayPath')}
                    maxLength={15}
                  />
                  <span className="text-sm text-gray-400">/</span>
                  <input
                    className={`${inputCls} w-28`}
                    value={state.displayPaths[1]}
                    onChange={e => update({ displayPaths: [state.displayPaths[0], e.target.value.slice(0, 15)] })}
                    placeholder={t('assetGroup.displayPath')}
                    maxLength={15}
                  />
                </div>
              </Field>
            </div>
          </div>

          {/* Right: Ad Preview (Google Ads style) */}
          <div className="w-[300px] shrink-0 border-l border-gray-100 p-4 hidden lg:block">
            <p className="text-[12px] text-gray-500 mb-3">{t('assetGroup.previewTitle')}</p>
            <AdPreview state={state} t={t} />
            <div className="mt-4 text-xs text-gray-400 space-y-1">
              <p>{t('assetGroup.previewStrengthLabel')}</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>{filledHeadlines} {t('assetGroup.previewHeadlines')}</li>
                <li>{filledLongHeadlines} {t('assetGroup.previewLongHeadlines')}</li>
                <li>{filledDescriptions} {t('assetGroup.previewDescriptions')}</li>
                <li>{state.images.length} {t('assetGroup.previewImages')}</li>
                <li>1 {t('assetGroup.previewFinalUrl')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Optimization */}
      <CollapsibleSection title={t('assetGroup.optimizationTitle')} defaultOpen={false}>
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={state.textCustomizationEnabled} onChange={e => update({ textCustomizationEnabled: e.target.checked })} className="rounded border-gray-300 text-blue-600" />
            <div>
              <span className="text-[13px] font-medium text-gray-700">{t('assetGroup.textCustomization')}</span>
              <p className="text-[12px] text-gray-500">{t('assetGroup.textCustomizationDesc')}</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={state.finalUrlExpansionEnabled} onChange={e => update({ finalUrlExpansionEnabled: e.target.checked })} className="rounded border-gray-300 text-blue-600" />
            <div>
              <span className="text-[13px] font-medium text-gray-700">{t('assetGroup.finalUrlExpansion')}</span>
              <p className="text-[12px] text-gray-500">{t('assetGroup.finalUrlExpansionDesc')}</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={state.imageEnhancementEnabled} onChange={e => update({ imageEnhancementEnabled: e.target.checked })} className="rounded border-gray-300 text-blue-600" />
            <div>
              <span className="text-[13px] font-medium text-gray-700">{t('assetGroup.imageEnhancement')}</span>
              <p className="text-[12px] text-gray-500">{t('assetGroup.imageEnhancementDesc')}</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={state.videoEnhancementEnabled} onChange={e => update({ videoEnhancementEnabled: e.target.checked })} className="rounded border-gray-300 text-blue-600" />
            <div>
              <span className="text-[13px] font-medium text-gray-700">{t('assetGroup.videoEnhancement')}</span>
              <p className="text-[12px] text-gray-500">{t('assetGroup.videoEnhancementDesc')}</p>
            </div>
          </label>
        </div>
      </CollapsibleSection>

      {/* ===== SINYALLER section ===== */}
      <div className="border-t-2 border-gray-200 pt-6 mt-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">{t('signals.title')}</h3>
        <p className="text-sm text-gray-500 mb-4">{t('signals.description')}</p>
      </div>

      {/* Search Themes */}
      <CollapsibleSection title={t('signals.searchThemesTitle')} defaultOpen={true}>
        <div className="space-y-3">
          <p className="text-[12px] text-gray-500">{t('signals.searchThemesHint')}</p>
          <div className="flex gap-2">
            <input
              className={`${inputCls} flex-1`}
              value={searchThemeInput}
              onChange={e => setSearchThemeInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSearchTheme(searchThemeInput))}
              placeholder={t('signals.searchThemePlaceholder')}
            />
          </div>
          {state.searchThemes.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {state.searchThemes.map((st, i) => (
                <span key={`${st.text}-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 text-sm border border-blue-200">
                  {st.text}
                  <button type="button" onClick={() => removeSearchTheme(i)} className="hover:text-red-600 p-0.5 rounded-full hover:bg-blue-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-[12px] text-gray-400">{state.searchThemes.length}/25</p>
        </div>
      </CollapsibleSection>

      {/* Audience Signals — DYNAMIC */}
      <CollapsibleSection title={t('signals.audienceTitle')} defaultOpen={true}>
        <AudienceSignalsPanel state={state} update={update} t={t} />
      </CollapsibleSection>
    </div>
  )
}
