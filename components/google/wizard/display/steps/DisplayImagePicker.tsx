'use client'

import { useEffect, useRef, useState } from 'react'
import {
  X, Loader2, Search, Upload, FolderOpen, Globe, Sparkles, ChevronLeft, ChevronRight, Check,
} from 'lucide-react'
import type { DisplayAsset, DisplayAssetKind } from '../../shared/WizardTypes'
import { inputCls } from '../../shared/WizardTypes'
import { IMAGE_SPECS, detectBestKind, validateImageForKind, readImageDimensions, MAX_IMAGE_BYTES } from './displayImageSpecs'

type ImageKind = Exclude<DisplayAssetKind, 'YOUTUBE_VIDEO' | 'LOGO' | 'SQUARE_LOGO'>
type TabId = 'recommendations' | 'library' | 'web' | 'upload' | 'stock'

interface LibraryAsset { resourceName: string; name: string; url: string; width: number; height: number }
interface WebImage { url: string; source: string }
interface PexelsPhoto {
  id: number
  width: number
  height: number
  previewUrl: string
  downloadUrl: string
  photographer: string
  photographerUrl: string
  alt: string
}

/** Preview + kategorize edilebilir görsel — geçici seçim */
interface PendingPick {
  previewUrl: string
  width?: number
  height?: number
  /** Bu kaynaktan Google Ads asset oluşturmak için gerekli bilgi */
  source:
    | { type: 'library'; resourceName: string; name: string }
    | { type: 'web'; imageUrl: string; name: string }
    | { type: 'stock'; imageUrl: string; photographer: string; name: string }
    | { type: 'upload'; file: File }
}

interface Props {
  isOpen: boolean
  onClose: () => void
  existing: DisplayAsset[]
  onAdd: (asset: DisplayAsset) => void
  defaultWebUrl?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}

const IMAGE_KINDS: ImageKind[] = ['MARKETING_IMAGE', 'SQUARE_MARKETING_IMAGE', 'PORTRAIT_MARKETING_IMAGE']

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function compatibleKindsFor(width: number, height: number): ImageKind[] {
  return IMAGE_KINDS.filter(k => {
    const spec = IMAGE_SPECS[k]
    const ratio = width / height
    const diff = Math.abs(ratio - spec.ratio) / spec.ratio
    return diff <= spec.tolerance && width >= spec.minWidth && height >= spec.minHeight
  })
}

export default function DisplayImagePicker({ isOpen, onClose, existing, onAdd, defaultWebUrl, t }: Props) {
  const [tab, setTab] = useState<TabId>('recommendations')

  // Recommendations (auto-scrape finalUrl)
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [recImages, setRecImages] = useState<WebImage[]>([])
  const [recLoaded, setRecLoaded] = useState(false)

  // Library
  const [libLoading, setLibLoading] = useState(false)
  const [libError, setLibError] = useState<string | null>(null)
  const [libAssets, setLibAssets] = useState<LibraryAsset[]>([])
  const [libLoaded, setLibLoaded] = useState(false)

  // Web
  const [webUrl, setWebUrl] = useState(defaultWebUrl ?? '')
  const [webLoading, setWebLoading] = useState(false)
  const [webError, setWebError] = useState<string | null>(null)
  const [webImages, setWebImages] = useState<WebImage[]>([])

  // Upload
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const [uploadErr, setUploadErr] = useState<string | null>(null)

  // Stock (Pexels)
  const [stockQuery, setStockQuery] = useState('')
  const [stockPage, setStockPage] = useState(1)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockNotConfigured, setStockNotConfigured] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)
  const [stockPhotos, setStockPhotos] = useState<PexelsPhoto[]>([])
  const [stockHasNext, setStockHasNext] = useState(false)

  // Pending pick (select → categorize → import)
  const [pending, setPending] = useState<PendingPick | null>(null)
  const [pendingKind, setPendingKind] = useState<ImageKind | null>(null)
  const [importing, setImporting] = useState(false)
  const [importErr, setImportErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setPending(null); setPendingKind(null); setImportErr(null)
    }
  }, [isOpen])

  const loadRecommendations = async () => {
    if (recLoaded || recLoading) return
    const url = defaultWebUrl?.trim()
    if (!url || url === 'https://') {
      setRecError(t('display.imagePicker.recNoUrl'))
      setRecLoaded(true)
      return
    }
    setRecLoading(true)
    setRecError(null)
    try {
      const res = await fetch(`/api/integrations/google-ads/assets/scrape?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (!res.ok) {
        setRecError(json.error ?? t('display.imagePicker.scrapeError'))
        return
      }
      setRecImages(json.images ?? [])
      setRecLoaded(true)
    } catch {
      setRecError(t('display.imagePicker.scrapeError'))
    } finally {
      setRecLoading(false)
    }
  }

  const loadLibrary = async () => {
    if (libLoaded || libLoading) return
    setLibLoading(true); setLibError(null)
    try {
      const res = await fetch('/api/integrations/google-ads/assets/library?type=IMAGE')
      const json = await res.json()
      if (!res.ok) { setLibError(json.error ?? t('display.imagePicker.libraryError')); return }
      const filtered = (json.assets as LibraryAsset[]).filter(a => {
        if (!a.width || !a.height) return false
        return compatibleKindsFor(a.width, a.height).length > 0
      })
      setLibAssets(filtered)
      setLibLoaded(true)
    } catch { setLibError(t('display.imagePicker.libraryError')) }
    finally { setLibLoading(false) }
  }

  const doWebScrape = async () => {
    const url = webUrl.trim()
    if (!url) return
    setWebLoading(true); setWebError(null); setWebImages([])
    try {
      const res = await fetch(`/api/integrations/google-ads/assets/scrape?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (!res.ok) { setWebError(json.error ?? t('display.imagePicker.scrapeError')); return }
      setWebImages(json.images ?? [])
    } catch { setWebError(t('display.imagePicker.scrapeError')) }
    finally { setWebLoading(false) }
  }

  const doStockSearch = async (nextPage = 1) => {
    const q = stockQuery.trim()
    if (!q) return
    setStockLoading(true); setStockError(null); setStockNotConfigured(false)
    try {
      const res = await fetch(`/api/integrations/google-ads/assets/stock?q=${encodeURIComponent(q)}&page=${nextPage}`)
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 503) setStockNotConfigured(true)
        else setStockError(json.error ?? t('display.imagePicker.stockError'))
        setStockPhotos([]); setStockHasNext(false); return
      }
      setStockPhotos(json.photos ?? [])
      setStockHasNext(Boolean(json.hasNext))
      setStockPage(json.page ?? nextPage)
    } catch { setStockError(t('display.imagePicker.stockError')) }
    finally { setStockLoading(false) }
  }

  const onFilePick = async (file: File) => {
    setUploadErr(null)
    if (!/^image\/(jpeg|png|gif)$/i.test(file.type)) { setUploadErr(t('display.uploadErrorType')); return }
    if (file.size > MAX_IMAGE_BYTES) { setUploadErr(t('display.uploadErrorSize')); return }
    let dims: { width: number; height: number }
    try { dims = await readImageDimensions(file) }
    catch { setUploadErr(t('display.uploadErrorType')); return }
    const suggested = detectBestKind(dims.width, dims.height)
    if (!suggested || (suggested !== 'MARKETING_IMAGE' && suggested !== 'SQUARE_MARKETING_IMAGE' && suggested !== 'PORTRAIT_MARKETING_IMAGE')) {
      setUploadErr(t('display.imagePicker.notImageCompatible'))
      return
    }
    const previewUrl = URL.createObjectURL(file)
    setPending({ previewUrl, width: dims.width, height: dims.height, source: { type: 'upload', file } })
    setPendingKind(suggested as ImageKind)
    setImportErr(null)
  }

  // Select from non-upload source: click image → set pending with auto-detected kind (if possible)
  const pickLibrary = (a: LibraryAsset) => {
    const suggested = detectBestKind(a.width, a.height)
    setPending({
      previewUrl: a.url, width: a.width, height: a.height,
      source: { type: 'library', resourceName: a.resourceName, name: a.name || `library_${a.width}x${a.height}` },
    })
    setPendingKind((suggested && IMAGE_KINDS.includes(suggested as ImageKind)) ? suggested as ImageKind : null)
    setImportErr(null)
  }

  const pickWeb = (img: WebImage) => {
    // Boyutu istemci tarafında yüklemeyi dene (CORS'a bağlı)
    const tmp = new Image()
    tmp.onload = () => {
      const w = tmp.naturalWidth
      const h = tmp.naturalHeight
      const suggested = detectBestKind(w, h)
      setPending({
        previewUrl: img.url, width: w, height: h,
        source: { type: 'web', imageUrl: img.url, name: `web_${new URL(img.url).hostname}` },
      })
      setPendingKind((suggested && IMAGE_KINDS.includes(suggested as ImageKind)) ? suggested as ImageKind : null)
      setImportErr(null)
    }
    tmp.onerror = () => {
      // Boyut bulunamadı — yine de seç, kullanıcı elle kategori seçsin
      setPending({
        previewUrl: img.url,
        source: { type: 'web', imageUrl: img.url, name: `web_${new URL(img.url).hostname}` },
      })
      setPendingKind(null)
      setImportErr(null)
    }
    tmp.src = img.url
  }

  const pickStock = (p: PexelsPhoto) => {
    const suggested = detectBestKind(p.width, p.height)
    setPending({
      previewUrl: p.previewUrl, width: p.width, height: p.height,
      source: { type: 'stock', imageUrl: p.downloadUrl, photographer: p.photographer, name: p.alt || `pexels_${p.id}` },
    })
    setPendingKind((suggested && IMAGE_KINDS.includes(suggested as ImageKind)) ? suggested as ImageKind : null)
    setImportErr(null)
  }

  const handleImport = async () => {
    if (!pending || !pendingKind) return
    // Son bir oran check'i
    if (pending.width && pending.height) {
      const spec = IMAGE_SPECS[pendingKind]
      const diff = Math.abs((pending.width / pending.height) - spec.ratio) / spec.ratio
      if (diff > spec.tolerance) {
        setImportErr(t('display.validation.wrongRatio', { expected: spec.ratio === 1 ? '1:1' : spec.ratio === 1.91 ? '1.91:1' : '4:5', actual: `${pending.width}×${pending.height}` }))
        return
      }
      if (pending.width < spec.minWidth || pending.height < spec.minHeight) {
        setImportErr(t('display.validation.tooSmall', { min: `${spec.minWidth}×${spec.minHeight}` }))
        return
      }
    }
    setImporting(true); setImportErr(null)
    try {
      if (pending.source.type === 'library') {
        // Zaten Google Ads'te var — direkt ekle
        onAdd({
          resourceName: pending.source.resourceName,
          kind: pendingKind,
          previewUrl: pending.previewUrl,
          name: pending.source.name,
        })
      } else if (pending.source.type === 'upload') {
        const data = await fileToBase64(pending.source.file)
        const res = await fetch('/api/integrations/google-ads/assets/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: pendingKind, name: pending.source.file.name, data }),
        })
        const json = await res.json()
        if (!res.ok) { setImportErr(json.error ?? t('display.imagePicker.importError')); return }
        onAdd({ resourceName: json.resourceName, kind: pendingKind, previewUrl: pending.previewUrl, name: pending.source.file.name })
      } else if (pending.source.type === 'web') {
        const res = await fetch('/api/integrations/google-ads/assets/scrape', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: pending.source.imageUrl, kind: pendingKind, name: pending.source.name }),
        })
        const json = await res.json()
        if (!res.ok) { setImportErr(json.error ?? t('display.imagePicker.importError')); return }
        onAdd({ resourceName: json.resourceName, kind: pendingKind, previewUrl: pending.previewUrl, name: pending.source.name })
      } else if (pending.source.type === 'stock') {
        const res = await fetch('/api/integrations/google-ads/assets/stock', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: pending.source.imageUrl, kind: pendingKind, name: pending.source.name }),
        })
        const json = await res.json()
        if (!res.ok) { setImportErr(json.error ?? t('display.imagePicker.importError')); return }
        onAdd({ resourceName: json.resourceName, kind: pendingKind, previewUrl: pending.previewUrl, name: pending.source.name })
      }
      setPending(null); setPendingKind(null)
    } catch { setImportErr(t('display.imagePicker.importError')) }
    finally { setImporting(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('display.imagePicker.title')}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-1 overflow-x-auto">
            <Tab active={tab === 'recommendations'} onClick={() => { setTab('recommendations'); void loadRecommendations() }} icon={<Sparkles className="w-4 h-4" />} label={t('display.imagePicker.tabRec')} />
            <Tab active={tab === 'library'} onClick={() => { setTab('library'); void loadLibrary() }} icon={<FolderOpen className="w-4 h-4" />} label={t('display.imagePicker.tabLibrary')} />
            <Tab active={tab === 'web'} onClick={() => setTab('web')} icon={<Globe className="w-4 h-4" />} label={t('display.imagePicker.tabWeb')} />
            <Tab active={tab === 'upload'} onClick={() => setTab('upload')} icon={<Upload className="w-4 h-4" />} label={t('display.imagePicker.tabUpload')} />
            <Tab active={tab === 'stock'} onClick={() => setTab('stock')} icon={<Search className="w-4 h-4" />} label={t('display.imagePicker.tabStock')} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Pending preview/categorize */}
          {pending ? (
            <PendingPane
              pending={pending}
              kind={pendingKind}
              setKind={setPendingKind}
              existing={existing}
              onBack={() => { setPending(null); setPendingKind(null); setImportErr(null) }}
              onImport={handleImport}
              importing={importing}
              importErr={importErr}
              t={t}
            />
          ) : (
            <>
              {tab === 'recommendations' && (
                <RecPane loading={recLoading} error={recError} images={recImages} onPick={pickWeb} defaultWebUrl={defaultWebUrl} t={t} />
              )}
              {tab === 'library' && (
                <LibraryPane loading={libLoading} error={libError} assets={libAssets} onPick={pickLibrary} t={t} />
              )}
              {tab === 'web' && (
                <WebPane url={webUrl} setUrl={setWebUrl} loading={webLoading} error={webError} images={webImages} onScrape={doWebScrape} onPick={pickWeb} t={t} />
              )}
              {tab === 'upload' && (
                <UploadPane uploadRef={uploadRef} error={uploadErr} onPick={onFilePick} t={t} />
              )}
              {tab === 'stock' && (
                <StockPane
                  query={stockQuery} setQuery={setStockQuery}
                  loading={stockLoading} error={stockError} notConfigured={stockNotConfigured}
                  photos={stockPhotos} hasNext={stockHasNext} page={stockPage}
                  onSearch={() => void doStockSearch(1)}
                  onNext={() => void doStockSearch(stockPage + 1)}
                  onPrev={() => void doStockSearch(Math.max(1, stockPage - 1))}
                  onPick={pickStock}
                  t={t}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
        active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}{label}
    </button>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RecPane({ loading, error, images, onPick, defaultWebUrl, t }: { loading: boolean; error: string | null; images: WebImage[]; onPick: (i: WebImage) => void; defaultWebUrl?: string; t: (k: string, p?: any) => string }) {
  if (!defaultWebUrl || defaultWebUrl === 'https://') {
    return <p className="text-sm text-gray-500 text-center py-16">{t('display.imagePicker.recNoUrl')}</p>
  }
  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
  if (error) return <p className="text-sm text-red-500">{error}</p>
  if (images.length === 0) return <p className="text-sm text-gray-500 text-center py-16">{t('display.imagePicker.recEmpty')}</p>
  return (
    <>
      <p className="text-xs text-gray-500 mb-3">{t('display.imagePicker.recHint', { url: defaultWebUrl })}</p>
      <ImageGrid images={images} onPick={onPick} />
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LibraryPane({ loading, error, assets, onPick, t }: { loading: boolean; error: string | null; assets: LibraryAsset[]; onPick: (a: LibraryAsset) => void; t: (k: string, p?: any) => string }) {
  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
  if (error) return <p className="text-sm text-red-500">{error}</p>
  if (assets.length === 0) return <p className="text-sm text-gray-500 text-center py-16">{t('display.imagePicker.libraryEmpty')}</p>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {assets.map(a => (
        <button key={a.resourceName} type="button" onClick={() => onPick(a)} className="relative rounded-lg overflow-hidden border border-gray-200 hover:border-blue-500 bg-white transition-colors">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.url} alt={a.name} className="w-full h-32 object-cover" />
          <div className="px-2 py-1.5 border-t border-gray-100 bg-white">
            <p className="text-[11px] text-gray-700 truncate">{a.name || '—'}</p>
            <p className="text-[10px] text-gray-400">{a.width}×{a.height}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function WebPane({
  url, setUrl, loading, error, images, onScrape, onPick, t,
}: {
  url: string; setUrl: (v: string) => void; loading: boolean; error: string | null;
  images: WebImage[]; onScrape: () => void; onPick: (i: WebImage) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: string, p?: any) => string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('display.imagePicker.webHint')}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className={`${inputCls} pl-9`} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onScrape() }} placeholder="https://example.com" />
        </div>
        <button type="button" onClick={onScrape} disabled={loading || !url.trim()} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('display.imagePicker.scan')}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {!loading && !error && images.length > 0 && <ImageGrid images={images} onPick={onPick} />}
    </div>
  )
}

function ImageGrid({ images, onPick }: { images: WebImage[]; onPick: (i: WebImage) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {images.map((img, idx) => (
        <button key={idx} type="button" onClick={() => onPick(img)} className="relative rounded-lg overflow-hidden border border-gray-200 hover:border-blue-500 bg-white transition-colors">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt="" className="w-full h-28 object-contain bg-gray-50" referrerPolicy="no-referrer" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          <div className="px-2 py-1 border-t border-gray-100 bg-white">
            <p className="text-[10px] text-gray-500 truncate">{img.source}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function UploadPane({
  uploadRef, error, onPick, t,
}: {
  uploadRef: React.MutableRefObject<HTMLInputElement | null>;
  error: string | null;
  onPick: (f: File) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: string, p?: any) => string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('display.imagePicker.uploadHint')}</p>
      <div
        className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-12 text-center transition-colors cursor-pointer"
        onClick={() => uploadRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onPick(f) }}
      >
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-700">{t('display.logoPicker.dropHere')}</p>
        <p className="text-xs text-gray-400 mt-1">JPG / PNG / GIF · max 5 MB</p>
        <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f) }} />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function StockPane({
  query, setQuery, loading, error, notConfigured, photos, hasNext, page,
  onSearch, onNext, onPrev, onPick, t,
}: {
  query: string; setQuery: (v: string) => void; loading: boolean; error: string | null; notConfigured: boolean;
  photos: PexelsPhoto[]; hasNext: boolean; page: number;
  onSearch: () => void; onNext: () => void; onPrev: () => void; onPick: (p: PexelsPhoto) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: string, p?: any) => string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{t('display.stockPoweredBy')}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className={`${inputCls} pl-9`} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onSearch() }} placeholder={t('display.stockSearchPlaceholder')} />
        </div>
        <button type="button" onClick={onSearch} disabled={loading || !query.trim()} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('display.stockSearch')}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {notConfigured && <p className="text-xs text-red-500">{t('display.stockNoApiKey')}</p>}
      {!loading && photos.length === 0 && query && !error && !notConfigured && (
        <p className="text-sm text-gray-500 text-center py-8">{t('display.stockNoResults')}</p>
      )}
      {photos.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map(p => (
              <button key={p.id} type="button" onClick={() => onPick(p)} className="group relative rounded-lg overflow-hidden border border-gray-200 hover:border-blue-500 bg-gray-50 transition-colors">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt={p.alt} className="w-full h-28 object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                  <p className="text-[10px] text-white truncate">{t('display.stockPhotoBy', { name: p.photographer })}</p>
                  <p className="text-[9px] text-white/70">{p.width}×{p.height}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={onPrev} disabled={page <= 1 || loading} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm text-gray-600">{t('display.stockPage', { page })}</span>
            <button type="button" onClick={onNext} disabled={!hasNext || loading} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </>
      )}
    </div>
  )
}

function PendingPane({
  pending, kind, setKind, existing, onBack, onImport, importing, importErr, t,
}: {
  pending: PendingPick; kind: ImageKind | null; setKind: (k: ImageKind) => void;
  existing: DisplayAsset[];
  onBack: () => void; onImport: () => void;
  importing: boolean; importErr: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: string, p?: any) => string;
}) {
  void existing
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" />{t('display.imagePicker.back')}
      </button>
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pending.previewUrl} alt="" className="w-60 h-60 object-contain rounded-lg border border-gray-200 bg-gray-50" />
        <div className="flex-1">
          {pending.width && pending.height && (
            <p className="text-xs text-gray-500 mb-3">{pending.width}×{pending.height} px</p>
          )}
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('display.imagePicker.selectKind')}</label>
          <div className="space-y-1.5">
            {IMAGE_KINDS.map(k => {
              const spec = IMAGE_SPECS[k]
              const label = spec.ratio === 1 ? '1:1' : spec.ratio === 1.91 ? '1.91:1' : '4:5'
              let disabled = false
              if (pending.width && pending.height) {
                const diff = Math.abs((pending.width / pending.height) - spec.ratio) / spec.ratio
                const tooSmall = pending.width < spec.minWidth || pending.height < spec.minHeight
                disabled = diff > spec.tolerance || tooSmall
              }
              return (
                <label key={k} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-[13px] ${
                  kind === k ? 'border-blue-400 bg-blue-50/60' : 'border-gray-200'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input type="radio" name="imgKind" disabled={disabled} checked={kind === k} onChange={() => setKind(k)} className="text-blue-600" />
                  <span className="flex-1">{t(`display.kind.${k}`)}</span>
                  <span className="text-[11px] text-gray-400">{label}</span>
                </label>
              )
            })}
          </div>
          {importErr && <p className="text-xs text-red-500 mt-2">{importErr}</p>}
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onImport} disabled={!kind || importing} className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {importing ? t('display.stockImporting') : t('display.stockAdd')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
