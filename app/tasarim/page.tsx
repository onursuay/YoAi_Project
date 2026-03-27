'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Topbar from '@/components/Topbar'
import { Image, Video, Loader2, Sparkles, Download, Coins, Upload, RefreshCw, Trash2, Clock, ImageIcon, Film, Share2, Wand2 } from 'lucide-react'
import { useCredits } from '@/components/providers/CreditProvider'
import { COST_PER_GENERATION } from '@/lib/subscription/types'
import PublishModal from '@/components/tasarim/PublishModal'
import { ToastContainer, type Toast, type ToastType } from '@/components/Toast'
const LIBRARY_STORAGE_KEY = 'yoai-tasarim-library'

type Mode = 'gorsel' | 'video'
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3'
type Tab = 'tasarim' | 'kutuphane'

interface GeneratedItem {
  id: string
  url: string
  type: 'gorsel' | 'video'
  prompt: string
  ratio: AspectRatio
  createdAt: Date
}

const ANIMATIONS = ['animate-gallery-float', 'animate-gallery-zoom', 'animate-gallery-drift']

const SAMPLE_GALLERY_PROMPTS: Record<string, { tr: string; en: string }> = {
  '1': { tr: 'Parfüm şişesi', en: 'Perfume bottle' },
  '2': { tr: 'Burger', en: 'Burger' },
  '3': { tr: 'Modern koltuk', en: 'Modern sofa' },
  '4': { tr: 'Kol saati', en: 'Wristwatch' },
  '5': { tr: 'Pırlanta yüzük', en: 'Diamond ring' },
  '6': { tr: 'Kozmetik ürünleri', en: 'Cosmetic products' },
}

function buildSampleGallery(locale: string): GeneratedItem[] {
  const lang = locale === 'en' ? 'en' : 'tr'
  return [
    { id: '1', url: '/gallery/parfum.jpg', type: 'gorsel', prompt: SAMPLE_GALLERY_PROMPTS['1'][lang], ratio: '1:1', createdAt: new Date() },
    { id: '2', url: '/gallery/hamburger.jpg', type: 'gorsel', prompt: SAMPLE_GALLERY_PROMPTS['2'][lang], ratio: '1:1', createdAt: new Date() },
    { id: '3', url: '/gallery/modern-koltuk.jpg', type: 'gorsel', prompt: SAMPLE_GALLERY_PROMPTS['3'][lang], ratio: '1:1', createdAt: new Date() },
    { id: '4', url: '/gallery/kol-saati.jpg', type: 'gorsel', prompt: SAMPLE_GALLERY_PROMPTS['4'][lang], ratio: '1:1', createdAt: new Date() },
    { id: '5', url: '/gallery/pirlanta-yuzuk.jpg', type: 'gorsel', prompt: SAMPLE_GALLERY_PROMPTS['5'][lang], ratio: '1:1', createdAt: new Date() },
    { id: '6', url: '/gallery/kozmetik-urunleri.jpg', type: 'gorsel', prompt: SAMPLE_GALLERY_PROMPTS['6'][lang], ratio: '1:1', createdAt: new Date() },
  ]
}

export default function TasarimPage() {
  const t = useTranslations('dashboard.tasarim')
  const locale = useLocale()
  const sampleGallery = useMemo(() => buildSampleGallery(locale), [locale])
  const router = useRouter()
  const { credits, spendCredits, refundCredits, hasEnoughCredits } = useCredits()
  const [mode, setMode] = useState<Mode>('gorsel')
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [ratio, setRatio] = useState<AspectRatio>('1:1')
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [gallery, setGallery] = useState<GeneratedItem[]>(sampleGallery)
  const [activeItem, setActiveItem] = useState<GeneratedItem | null>(sampleGallery[0])
  const [activeTab, setActiveTab] = useState<Tab>('tasarim')

  // Library: user-generated items persisted in localStorage (sync init to prevent data loss)
  const [library, setLibrary] = useState<GeneratedItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(LIBRARY_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored).map((item: GeneratedItem) => ({ ...item, createdAt: new Date(item.createdAt) }))
      }
    } catch { /* ignore */ }
    return []
  })

  // Track if user has a pinned item (generated or clicked) — prevents auto-rotation override
  const [pinnedItem, setPinnedItem] = useState<GeneratedItem | null>(null)

  // Publish modal
  const [publishItem, setPublishItem] = useState<GeneratedItem | null>(null)

  // Library video playback
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(7)
    setToasts(prev => [...prev, { id, message, type }])
  }
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const saveToLibrary = useCallback((item: GeneratedItem) => {
    setLibrary(prev => {
      const updated = [item, ...prev]
      try { localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
      return updated
    })
  }, [])

  const removeFromLibrary = useCallback((id: string) => {
    setLibrary(prev => {
      const updated = prev.filter(item => item.id !== id)
      try { localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
      return updated
    })
  }, [])

  // Shuffle gallery + rotate main preview every 3 seconds
  const [activeIndex, setActiveIndex] = useState(0)

  const shuffleGallery = useCallback(() => {
    setGallery(prev => {
      const arr = [...prev]
      const i = Math.floor(Math.random() * arr.length)
      let j = Math.floor(Math.random() * arr.length)
      while (j === i) j = Math.floor(Math.random() * arr.length)
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return arr
    })
    setActiveIndex(prev => {
      const nextIdx = prev + 1
      return nextIdx >= sampleGallery.length ? 0 : nextIdx
    })
  }, [sampleGallery])

  useEffect(() => {
    const interval = setInterval(shuffleGallery, 3000)
    return () => clearInterval(interval)
  }, [shuffleGallery])

  // Sync activeItem with rotating index (only when no pinned item)
  useEffect(() => {
    if (gallery.length > 0 && !isGenerating && !pinnedItem) {
      setActiveItem(gallery[activeIndex % gallery.length])
    }
  }, [activeIndex, gallery, isGenerating, pinnedItem])

  const [error, setError] = useState<string | null>(null)
  const [isEnhancing, setIsEnhancing] = useState(false)

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return
    setIsEnhancing(true)
    try {
      const res = await fetch('/api/tasarim/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode, hasReferenceImage: !!referenceImage, locale: document.documentElement.lang || 'tr' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enhancement failed')
      setPrompt(data.enhanced)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('enhanceFailed')
      addToast(message, 'error')
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    if (!hasEnoughCredits()) return

    setIsGenerating(true)
    setError(null)
    spendCredits()

    try {
      const endpoint = mode === 'gorsel'
        ? '/api/tasarim/generate-image'
        : '/api/tasarim/generate-video'

      const body: Record<string, unknown> = {
        prompt,
        aspect_ratio: ratio,
      }

      // Add reference image if available (both gorsel and video modes)
      if (referenceImage) {
        body.image_url = referenceImage
      }

      // Add duration for video mode
      if (mode === 'video') {
        body.duration = '5'
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        const errMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
        throw new Error(errMsg || t('generationFailed'))
      }

      const newItem: GeneratedItem = {
        id: Date.now().toString(),
        url: data.url,
        type: mode,
        prompt,
        ratio,
        createdAt: new Date(),
      }

      setGallery(prev => [newItem, ...prev])
      setActiveItem(newItem)
      setPinnedItem(newItem)
      saveToLibrary(newItem)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errorOccurred')
      setError(message)
      refundCredits() // Refund credits on error
    } finally {
      setIsGenerating(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setReferenceImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <>
      <Topbar title={t('title')} description={t('description')} />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="flex h-full">
          {/* Left Panel */}
          <div className="w-[320px] shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
            {/* Mode Toggle */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('gorsel')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'gorsel' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Image className="w-4 h-4" />
                  {t('modeImage')}
                </button>
                <button
                  onClick={() => setMode('video')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'video' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  {t('modeVideo')}
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 p-4 space-y-4">
              {/* Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('promptLabel')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={mode === 'gorsel'
                    ? t('promptPlaceholderImage')
                    : t('promptPlaceholderVideo')
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows={5}
                />
                {prompt.trim() && (
                  <button
                    onClick={handleEnhancePrompt}
                    disabled={isEnhancing}
                    className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    {isEnhancing ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('enhancing')}</>
                    ) : (
                      <><Wand2 className="w-3.5 h-3.5" /> {t('enhanceWithAi')}</>
                    )}
                  </button>
                )}
              </div>

              {/* Reference Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {mode === 'gorsel' ? t('addImage') : t('referenceImage')}
                </label>
                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {referenceImage ? t('imageSelected') : mode === 'gorsel' ? t('productImage') : t('animateImage')}
                  </span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('aspectRatio')}
                </label>
                <div className="flex gap-2">
                  {(['16:9', '9:16', '4:3', '1:1'] as AspectRatio[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setRatio(r)}
                      className={`flex-1 py-1.5 text-caption rounded-lg border transition-colors ${
                        ratio === r
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title - only for gorsel */}
              {mode === 'gorsel' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('titleLabel')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder={t('titleLabel')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <p className="text-caption text-gray-500 text-right mt-1">{title.length} / 300</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('sloganLabel')}</label>
                    <input
                      type="text"
                      placeholder="--"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Generate Button */}
            <div className="p-4 border-t border-gray-100 space-y-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim() || !hasEnoughCredits()}
                className="w-full py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {mode === 'gorsel' ? t('generateImage') : t('generateVideo')}
                  </>
                )}
              </button>
              {error && (
                <p className="text-sm text-center text-red-500">{error}</p>
              )}
              <p className="text-caption text-center text-gray-500">
                {mode === 'gorsel' ? t('creditInfoImage', { cost: COST_PER_GENERATION }) : t('creditInfoVideo', { cost: COST_PER_GENERATION })}
              </p>
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar with tabs + credits */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('tasarim')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'tasarim' ? 'text-gray-900 bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t('tabDesign')}
                </button>
                <button
                  onClick={() => setActiveTab('kutuphane')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'kutuphane' ? 'text-gray-900 bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t('tabLibrary')} {library.length > 0 && <span className="ml-1 text-caption text-primary">({library.length})</span>}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-700">{credits} {t('credits')}</span>
                </div>
                <button
                  onClick={() => router.push('/abonelik#krediler')}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                >
                  {t('buyCredits')}
                </button>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-hidden flex">
              {activeTab === 'tasarim' ? (
                <>
                  {/* Preview */}
                  <div className={`flex-1 flex flex-col items-center justify-center relative ${isGenerating ? '' : 'p-10 bg-gray-50'}`}>
                    {isGenerating ? (
                      /* Full-area AI generating animation */
                      <div className="absolute inset-0 ai-generating-bg flex items-center justify-center">
                        {/* Orbiting particles */}
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <div className="relative w-[160px] h-[160px]">
                            {[0, 1, 2, 3, 4, 5].map(i => (
                              <div
                                key={i}
                                className="absolute top-1/2 left-1/2 w-2.5 h-2.5 -ml-1 -mt-1 rounded-full"
                                style={{
                                  background: i % 2 === 0 ? '#818cf8' : '#a78bfa',
                                  animation: `ai-orbit ${3 + i * 0.5}s linear infinite`,
                                  animationDelay: `${i * -0.5}s`,
                                  opacity: 0.8 - i * 0.1,
                                  boxShadow: `0 0 8px ${i % 2 === 0 ? '#818cf8' : '#a78bfa'}`,
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Pulse rings */}
                        <div className="absolute inset-0 flex items-center justify-center z-0">
                          {[0, 1, 2].map(i => (
                            <div
                              key={i}
                              className="absolute w-24 h-24 rounded-full border border-indigo-400/20"
                              style={{
                                animation: 'ai-pulse-ring 3s ease-out infinite',
                                animationDelay: `${i}s`,
                              }}
                            />
                          ))}
                        </div>

                        {/* Center content */}
                        <div className="relative z-20 text-center">
                          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/20 backdrop-blur-sm flex items-center justify-center">
                            <Sparkles className="w-9 h-9 text-indigo-300 animate-pulse" />
                          </div>
                          <p className="text-base font-medium text-white/90 mb-1">
                            {mode === 'gorsel' ? t('creatingImage') : t('creatingVideo')}
                          </p>
                          <p className="text-sm text-white/40 mb-5">{t('aiWorking')}</p>

                          {/* Progress bar */}
                          <div className="w-56 mx-auto h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full"
                              style={{ animation: `ai-progress ${mode === 'video' ? '60s' : '20s'} ease-out forwards` }}
                            />
                          </div>
                        </div>

                        {/* Shimmer overlay */}
                        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
                          <div
                            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"
                            style={{ animation: 'ai-shimmer 3s ease-in-out infinite' }}
                          />
                        </div>
                      </div>
                    ) : activeItem ? (
                      <div className="flex flex-col items-center gap-4 w-full max-w-xl">
                        <div className="relative bg-white rounded-2xl overflow-hidden shadow-xl ring-1 ring-gray-200 w-full aspect-square max-h-[480px]">
                          {activeItem.type === 'video' ? (
                            <video
                              src={activeItem.url}
                              controls
                              autoPlay
                              loop
                              muted
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={activeItem.url}
                              alt={activeItem.prompt}
                              className="w-full h-full object-cover animate-gallery-zoom"
                            />
                          )}
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {activeItem.prompt.slice(0, 40) || t('untitledDesign')}
                            </p>
                            <p className="text-caption text-gray-500">{activeItem.ratio}</p>
                          </div>
                          <div className="flex gap-2">
                            <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">{t('noDesignsYet')}</p>
                        <p className="text-sm text-gray-400 mt-1">{t('noDesignsHint')}</p>
                      </div>
                    )}
                  </div>

                  {/* Gallery sidebar — hidden during generation so AI animation fills full area */}
                  {!isGenerating && <div className="w-[280px] shrink-0 border-l border-gray-200 bg-white overflow-y-auto p-3">
                    <p className="text-caption font-medium text-gray-500 mb-3 px-1">{t('recentDesigns')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {gallery.map((item, idx) => (
                        <button
                          key={`${item.id}-${idx}`}
                          onClick={() => { setActiveItem(item); setPinnedItem(item) }}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors gallery-thumb ${
                            activeItem?.id === item.id ? 'border-primary' : 'border-transparent hover:border-gray-300'
                          }`}
                        >
                          <img
                            src={item.url}
                            alt={item.prompt}
                            className={`w-full h-full object-cover ${ANIMATIONS[idx % ANIMATIONS.length]}`}
                            style={{ animationDelay: `${idx * 0.7}s` }}
                          />
                          {item.type === 'video' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Video className="w-5 h-5 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>}
                </>
              ) : (
                /* Kütüphane View */
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                  {library.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <ImageIcon className="w-16 h-16 text-gray-300 mb-4" />
                      <p className="text-gray-500 font-medium">{t('libraryEmpty')}</p>
                      <p className="text-sm text-gray-400 mt-1">{t('libraryEmptyHint')}</p>
                      <button
                        onClick={() => setActiveTab('tasarim')}
                        className="mt-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
                      >
                        {t('createDesign')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium text-gray-700">
                          {t('designCount', { count: library.length })}
                        </p>
                        <div className="flex gap-2 text-caption text-gray-500">
                          <span className="flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            {t('imageCount', { count: library.filter(i => i.type === 'gorsel').length })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Film className="w-3 h-3" />
                            {t('videoCount', { count: library.filter(i => i.type === 'video').length })}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {library.map(item => (
                          <div key={item.id} className="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                            <div className="aspect-square relative">
                              {item.type === 'video' ? (
                                <>
                                  <video
                                    src={item.url}
                                    className="w-full h-full object-cover"
                                    muted={playingVideoId !== item.id}
                                    loop
                                    controls={playingVideoId === item.id}
                                    autoPlay={playingVideoId === item.id}
                                    ref={el => {
                                      if (el) {
                                        if (playingVideoId === item.id) { el.play() }
                                        else { el.pause(); el.currentTime = 0 }
                                      }
                                    }}
                                  />
                                  {/* Play button — center, only when not playing */}
                                  {playingVideoId !== item.id && (
                                    <button
                                      onClick={() => setPlayingVideoId(item.id)}
                                      className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors group/play"
                                    >
                                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover/play:scale-110 transition-transform">
                                        <svg className="w-5 h-5 text-gray-800 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M8 5v14l11-7z" />
                                        </svg>
                                      </div>
                                    </button>
                                  )}
                                  {/* Video badge + action buttons top-right — only when not playing */}
                                  {playingVideoId !== item.id && (
                                    <>
                                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-xs text-white font-medium flex items-center gap-1 pointer-events-none">
                                        <Film className="w-3 h-3" /> Video
                                      </div>
                                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a
                                          href={item.url}
                                          download={`tasarim-${item.id}.mp4`}
                                          onClick={e => e.stopPropagation()}
                                          className="p-1.5 bg-white/90 rounded-lg shadow hover:bg-white transition-colors"
                                          title={t('download')}
                                        >
                                          <Download className="w-3.5 h-3.5 text-gray-700" />
                                        </a>
                                        <button
                                          onClick={e => { e.stopPropagation(); setPublishItem(item) }}
                                          className="p-1.5 bg-white/90 rounded-lg shadow hover:bg-blue-50 transition-colors"
                                          title={t('publish')}
                                        >
                                          <Share2 className="w-3.5 h-3.5 text-blue-600" />
                                        </button>
                                        <button
                                          onClick={e => { e.stopPropagation(); removeFromLibrary(item.id) }}
                                          className="p-1.5 bg-white/90 rounded-lg shadow hover:bg-red-50 transition-colors"
                                          title={t('delete')}
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </>
                              ) : (
                                <>
                                  <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                                  {/* Image hover overlay */}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                    <a
                                      href={item.url}
                                      download={`tasarim-${item.id}.jpg`}
                                      className="p-2 bg-white rounded-lg shadow hover:bg-gray-100 transition-colors"
                                      title={t('download')}
                                    >
                                      <Download className="w-4 h-4 text-gray-700" />
                                    </a>
                                    <button
                                      onClick={() => setPublishItem(item)}
                                      className="p-2 bg-white rounded-lg shadow hover:bg-blue-50 transition-colors"
                                      title={t('publish')}
                                    >
                                      <Share2 className="w-4 h-4 text-blue-600" />
                                    </button>
                                    <button
                                      onClick={() => removeFromLibrary(item.id)}
                                      className="p-2 bg-white rounded-lg shadow hover:bg-red-50 transition-colors"
                                      title={t('delete')}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-caption font-medium text-gray-800 truncate">{item.prompt}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-gray-500">{item.ratio}</span>
                                <div className="flex items-center gap-1.5">
                                  {item.type === 'video' && playingVideoId === item.id && (
                                    <button
                                      onClick={() => setPlayingVideoId(null)}
                                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-0.5"
                                      title={t('stop')}
                                    >
                                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                      {t('stop')}
                                    </button>
                                  )}
                                  <span className="text-xs text-gray-500 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {new Date(item.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'tr-TR')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Publish Modal */}
      <PublishModal
        isOpen={!!publishItem}
        onClose={() => setPublishItem(null)}
        item={publishItem}
        onToast={(message, type) => addToast(message, type)}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
