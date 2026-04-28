'use client'

import { useEffect, useRef, useState } from 'react'
import {
  X, Loader2, Search, Upload, FolderOpen, Globe, Sparkles, ChevronLeft, ChevronRight, Check, Crop,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import type { DisplayAsset, DisplayAssetKind } from '../../shared/WizardTypes'
import { inputCls } from '../../shared/WizardTypes'
import { IMAGE_SPECS, detectBestKind, readImageDimensions, MAX_IMAGE_BYTES } from './displayImageSpecs'
import { pickImageFromGoogleDrive, isGoogleDriveConfigured } from './googleDrivePicker'

type ImageKind = Exclude<DisplayAssetKind, 'YOUTUBE_VIDEO' | 'LOGO' | 'SQUARE_LOGO'>
type TabId = 'recommendations' | 'library' | 'web' | 'upload' | 'stock'

interface LibraryAsset { resourceName: string; name: string; url: string; width: number; height: number }
interface WebImage { url: string; source: string }
interface PexelsPhoto {
  id: number; width: number; height: number
  previewUrl: string; downloadUrl: string
  photographer: string; photographerUrl: string; alt: string
}
interface PendingPick {
  previewUrl: string; width?: number; height?: number
  source:
    | { type: 'library'; resourceName: string; name: string }
    | { type: 'web'; imageUrl: string; name: string }
    | { type: 'stock'; imageUrl: string; photographer: string; name: string }
    | { type: 'upload'; file: File }
}
interface CropOption {
  kind: ImageKind; previewUrl: string; croppedBlob: Blob; width: number; height: number
}

interface Props {
  isOpen: boolean; onClose: () => void
  existing: DisplayAsset[]; onAdd: (asset: DisplayAsset) => void
  defaultWebUrl?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}

const IMAGE_KINDS: ImageKind[] = ['MARKETING_IMAGE', 'SQUARE_MARKETING_IMAGE', 'PORTRAIT_MARKETING_IMAGE']
const RATIO_LABEL: Record<ImageKind, string> = {
  MARKETING_IMAGE: '1.91:1', SQUARE_MARKETING_IMAGE: '1:1', PORTRAIT_MARKETING_IMAGE: '4:5',
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

function compatibleKindsFor(width: number, height: number): ImageKind[] {
  return IMAGE_KINDS.filter(k => {
    const spec = IMAGE_SPECS[k]; const ratio = width / height
    const diff = Math.abs(ratio - spec.ratio) / spec.ratio
    return diff <= spec.tolerance && width >= spec.minWidth && height >= spec.minHeight
  })
}

/** Canvas center-crop — returns null if result is smaller than minW×minH */
function cropImageToRatio(
  file: File, ratio: number, minW: number, minH: number,
): Promise<{ previewUrl: string; croppedBlob: Blob; width: number; height: number } | null> {
  return new Promise(resolve => {
    const img = new Image()
    const srcUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(srcUrl)
      const srcW = img.naturalWidth; const srcH = img.naturalHeight
      let cropW: number, cropH: number
      if (srcW / srcH > ratio) { cropH = srcH; cropW = Math.round(srcH * ratio) }
      else { cropW = srcW; cropH = Math.round(srcW / ratio) }
      if (cropW < minW || cropH < minH) { resolve(null); return }
      const canvas = document.createElement('canvas')
      canvas.width = cropW; canvas.height = cropH
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, Math.floor((srcW - cropW) / 2), Math.floor((srcH - cropH) / 2), cropW, cropH, 0, 0, cropW, cropH)
      canvas.toBlob(blob => {
        if (!blob) { resolve(null); return }
        resolve({ previewUrl: URL.createObjectURL(blob), croppedBlob: blob, width: cropW, height: cropH })
      }, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92)
    }
    img.onerror = () => { URL.revokeObjectURL(srcUrl); resolve(null) }
    img.src = srcUrl
  })
}

async function buildCropOptions(file: File): Promise<CropOption[]> {
  const results: CropOption[] = []
  for (const kind of IMAGE_KINDS) {
    const spec = IMAGE_SPECS[kind]
    try {
      const r = await cropImageToRatio(file, spec.ratio, spec.minWidth, spec.minHeight)
      if (r) results.push({ kind, ...r })
    } catch { /* skip */ }
  }
  return results
}

export default function DisplayImagePicker({ isOpen, onClose, existing, onAdd, defaultWebUrl, t }: Props) {
  const [tab, setTab] = useState<TabId>('recommendations')

  // Recommendations
  const [recUrl, setRecUrl] = useState(defaultWebUrl ?? '')
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [recImages, setRecImages] = useState<WebImage[]>([])
  const [recLoaded, setRecLoaded] = useState(false)

  // Library
  const [libLoading, setLibLoading] = useState(false)
  const [libError, setLibError] = useState<string | null>(null)
  const [libDetails, setLibDetails] = useState<string | null>(null)
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
  const [cropBuilding, setCropBuilding] = useState(false)
  const [cropSource, setCropSource] = useState<{ file: File; options: CropOption[] } | null>(null)

  // Stock (Pexels)
  const [stockQuery, setStockQuery] = useState('')
  const [stockPage, setStockPage] = useState(1)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockNotConfigured, setStockNotConfigured] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)
  const [stockPhotos, setStockPhotos] = useState<PexelsPhoto[]>([])
  const [stockHasNext, setStockHasNext] = useState(false)

  // Pending pick
  const [pending, setPending] = useState<PendingPick | null>(null)
  const [pendingKind, setPendingKind] = useState<ImageKind | null>(null)
  const [importing, setImporting] = useState(false)
  const [importErr, setImportErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setPending(null); setPendingKind(null); setImportErr(null)
      setCropSource(null); setUploadErr(null)
    }
  }, [isOpen])

  // Sync recUrl when defaultWebUrl changes (e.g. user filled finalUrl before opening picker)
  useEffect(() => {
    if (defaultWebUrl && defaultWebUrl !== 'https://') setRecUrl(defaultWebUrl)
  }, [defaultWebUrl])

  const loadRecommendations = async (urlOverride?: string) => {
    const url = (urlOverride ?? recUrl).trim()
    if (!url || url === 'https://') return
    if (recLoaded && !urlOverride) return
    setRecLoading(true); setRecError(null)
    try {
      const res = await fetch(`/api/integrations/google-ads/assets/scrape?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (!res.ok) { setRecError(json.error ?? t('display.imagePicker.scrapeError')); return }
      setRecImages(json.images ?? []); setRecLoaded(true)
    } catch { setRecError(t('display.imagePicker.scrapeError')) }
    finally { setRecLoading(false) }
  }

  const loadLibrary = async (force = false) => {
    if (libLoading) return
    if (libLoaded && !force) return
    setLibLoading(true); setLibError(null); setLibDetails(null)
    try {
      const res = await fetch('/api/integrations/google-ads/assets/library?type=IMAGE')
      const json = await res.json()
      if (!res.ok) {
        setLibError(json.error ?? t('display.imagePicker.libraryError'))
        if (json.details) setLibDetails(String(json.details))
        return
      }
      const filtered = (json.assets as LibraryAsset[]).filter(a => {
        if (!a.width || !a.height) return false
        return compatibleKindsFor(a.width, a.height).length > 0
      })
      setLibAssets(filtered); setLibLoaded(true)
    } catch (e) {
      setLibError(t('display.imagePicker.libraryError'))
      setLibDetails(e instanceof Error ? e.message : String(e))
    }
    finally { setLibLoading(false) }
  }

  const doWebScrape = async () => {
    const url = webUrl.trim(); if (!url) return
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
    const q = stockQuery.trim(); if (!q) return
    setStockLoading(true); setStockError(null); setStockNotConfigured(false)
    try {
      const res = await fetch(`/api/integrations/google-ads/assets/stock?q=${encodeURIComponent(q)}&page=${nextPage}`)
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 503) setStockNotConfigured(true)
        else setStockError(json.error ?? t('display.imagePicker.stockError'))
        setStockPhotos([]); setStockHasNext(false); return
      }
      setStockPhotos(json.photos ?? []); setStockHasNext(Boolean(json.hasNext)); setStockPage(json.page ?? nextPage)
    } catch { setStockError(t('display.imagePicker.stockError')) }
    finally { setStockLoading(false) }
  }

  const onFilePick = async (file: File) => {
    setUploadErr(null); setCropSource(null)
    if (!/^image\/(jpeg|png|gif)$/i.test(file.type)) { setUploadErr(t('display.uploadErrorType')); return }
    if (file.size > MAX_IMAGE_BYTES) { setUploadErr(t('display.uploadErrorSize')); return }
    let dims: { width: number; height: number }
    try { dims = await readImageDimensions(file) }
    catch { setUploadErr(t('display.uploadErrorType')); return }

    const suggested = detectBestKind(dims.width, dims.height)
    const isImageKind = (k: string | null): k is ImageKind => !!k && IMAGE_KINDS.includes(k as ImageKind)

    if (isImageKind(suggested)) {
      // Oran uyumlu — direkt PendingPane'e gönder
      const previewUrl = URL.createObjectURL(file)
      setPending({ previewUrl, width: dims.width, height: dims.height, source: { type: 'upload', file } })
      setPendingKind(suggested); setImportErr(null)
    } else {
      // Uyumsuz oran → kırpma seçenekleri oluştur (Google Ads davranışı)
      setCropBuilding(true)
      try {
        const options = await buildCropOptions(file)
        if (options.length === 0) {
          setUploadErr('Görsel tüm oranlar için çok küçük. En az 300×300 px gerekli.')
        } else {
          setCropSource({ file, options }); setImportErr(null)
        }
      } catch { setUploadErr(t('display.uploadErrorType')) }
      finally { setCropBuilding(false) }
    }
  }

  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)

  const onMultiFilesPick = async (files: File[]) => {
    setUploadErr(null); setCropSource(null); setPending(null); setPendingKind(null)
    const errors: string[] = []
    setBulkBusy(true); setBulkProgress({ done: 0, total: files.length })
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        if (!/^image\/(jpeg|png|gif)$/i.test(file.type)) { errors.push(`${file.name}: ${t('display.uploadErrorType')}`); continue }
        if (file.size > MAX_IMAGE_BYTES) { errors.push(`${file.name}: ${t('display.uploadErrorSize')}`); continue }
        let dims: { width: number; height: number }
        try { dims = await readImageDimensions(file) } catch { errors.push(`${file.name}: ${t('display.uploadErrorType')}`); continue }
        const suggested = detectBestKind(dims.width, dims.height)
        let uploadFile: File = file
        let kind: ImageKind
        let previewUrl: string
        if (suggested && IMAGE_KINDS.includes(suggested as ImageKind)) {
          kind = suggested as ImageKind
          previewUrl = URL.createObjectURL(file)
        } else {
          // Oran uyumsuz — ilk crop seçeneğini otomatik uygula
          let options: CropOption[] = []
          try { options = await buildCropOptions(file) } catch { errors.push(`${file.name}: ${t('display.uploadErrorType')}`); continue }
          if (options.length === 0) { errors.push(`${file.name}: ${t('display.imagePicker.notImageCompatible')}`); continue }
          const opt = options[0]
          uploadFile = new File([opt.croppedBlob], file.name, { type: opt.croppedBlob.type || 'image/jpeg' })
          kind = opt.kind
          previewUrl = opt.previewUrl
        }
        const data = await fileToBase64(uploadFile)
        const res = await fetch('/api/integrations/google-ads/assets/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, name: file.name, data }),
        })
        const json = await res.json()
        if (!res.ok) { errors.push(`${file.name}: ${json.error ?? t('display.imagePicker.importError')}`); continue }
        onAdd({ resourceName: json.resourceName, kind, previewUrl, name: file.name })
      } catch {
        errors.push(`${file.name}: ${t('display.imagePicker.importError')}`)
      } finally {
        setBulkProgress({ done: i + 1, total: files.length })
      }
    }
    setBulkBusy(false); setBulkProgress(null)
    if (errors.length > 0) setUploadErr(errors.join('\n'))
  }

  const selectCropOption = (opt: CropOption) => {
    if (!cropSource) return
    const croppedFile = new File([opt.croppedBlob], cropSource.file.name, { type: opt.croppedBlob.type || 'image/jpeg' })
    setPending({ previewUrl: opt.previewUrl, width: opt.width, height: opt.height, source: { type: 'upload', file: croppedFile } })
    setPendingKind(opt.kind); setImportErr(null); setCropSource(null)
  }

  const pickLibrary = (a: LibraryAsset) => {
    const suggested = detectBestKind(a.width, a.height)
    setPending({ previewUrl: a.url, width: a.width, height: a.height, source: { type: 'library', resourceName: a.resourceName, name: a.name || `library_${a.width}x${a.height}` } })
    setPendingKind((suggested && IMAGE_KINDS.includes(suggested as ImageKind)) ? suggested as ImageKind : null)
    setImportErr(null)
  }

  const pickWeb = (img: WebImage) => {
    const tmp = new Image()
    tmp.onload = () => {
      const w = tmp.naturalWidth; const h = tmp.naturalHeight
      const suggested = detectBestKind(w, h)
      setPending({ previewUrl: img.url, width: w, height: h, source: { type: 'web', imageUrl: img.url, name: `web_${new URL(img.url).hostname}` } })
      setPendingKind((suggested && IMAGE_KINDS.includes(suggested as ImageKind)) ? suggested as ImageKind : null)
      setImportErr(null)
    }
    tmp.onerror = () => {
      setPending({ previewUrl: img.url, source: { type: 'web', imageUrl: img.url, name: `web_${new URL(img.url).hostname}` } })
      setPendingKind(null); setImportErr(null)
    }
    tmp.src = img.url
  }

  const pickStock = (p: PexelsPhoto) => {
    const suggested = detectBestKind(p.width, p.height)
    setPending({ previewUrl: p.previewUrl, width: p.width, height: p.height, source: { type: 'stock', imageUrl: p.downloadUrl, photographer: p.photographer, name: p.alt || `pexels_${p.id}` } })
    setPendingKind((suggested && IMAGE_KINDS.includes(suggested as ImageKind)) ? suggested as ImageKind : null)
    setImportErr(null)
  }

  const handleImport = async () => {
    if (!pending || !pendingKind) return
    if (pending.width && pending.height) {
      const spec = IMAGE_SPECS[pendingKind]
      const diff = Math.abs((pending.width / pending.height) - spec.ratio) / spec.ratio
      if (diff > spec.tolerance) { setImportErr(t('display.validation.wrongRatio', { expected: RATIO_LABEL[pendingKind], actual: `${pending.width}×${pending.height}` })); return }
      if (pending.width < spec.minWidth || pending.height < spec.minHeight) { setImportErr(t('display.validation.tooSmall', { min: `${spec.minWidth}×${spec.minHeight}` })); return }
    }
    setImporting(true); setImportErr(null)
    try {
      if (pending.source.type === 'library') {
        onAdd({ resourceName: pending.source.resourceName, kind: pendingKind, previewUrl: pending.previewUrl, name: pending.source.name })
      } else if (pending.source.type === 'upload') {
        const data = await fileToBase64(pending.source.file)
        const res = await fetch('/api/integrations/google-ads/assets/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: pendingKind, name: pending.source.file.name, data }) })
        const json = await res.json()
        if (!res.ok) { setImportErr(json.error ?? t('display.imagePicker.importError')); return }
        onAdd({ resourceName: json.resourceName, kind: pendingKind, previewUrl: pending.previewUrl, name: pending.source.file.name })
      } else if (pending.source.type === 'web') {
        const res = await fetch('/api/integrations/google-ads/assets/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: pending.source.imageUrl, kind: pendingKind, name: pending.source.name }) })
        const json = await res.json()
        if (!res.ok) { setImportErr(json.error ?? t('display.imagePicker.importError')); return }
        onAdd({ resourceName: json.resourceName, kind: pendingKind, previewUrl: pending.previewUrl, name: pending.source.name })
      } else if (pending.source.type === 'stock') {
        const res = await fetch('/api/integrations/google-ads/assets/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: pending.source.imageUrl, kind: pendingKind, name: pending.source.name }) })
        const json = await res.json()
        if (!res.ok) { setImportErr(json.error ?? t('display.imagePicker.importError')); return }
        onAdd({ resourceName: json.resourceName, kind: pendingKind, previewUrl: pending.previewUrl, name: pending.source.name })
      }
      setPending(null); setPendingKind(null)
    } catch { setImportErr(t('display.imagePicker.importError')) }
    finally { setImporting(false) }
  }

  if (!isOpen) return null

  // Determine what to show in main pane
  const showCrop = !pending && cropSource !== null
  const showPending = !!pending
  const showTabs = !pending && !cropSource

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('display.imagePicker.title')}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        {/* Tab bar — only when not in pending/crop mode */}
        {showTabs && (
          <div className="border-b border-gray-200 px-6">
            <div className="flex gap-1 overflow-x-auto">
              <Tab active={tab === 'recommendations'} onClick={() => { setTab('recommendations'); void loadRecommendations() }} icon={<Sparkles className="w-4 h-4" />} label={t('display.imagePicker.tabRec')} />
              <Tab active={tab === 'library'} onClick={() => { setTab('library'); void loadLibrary() }} icon={<FolderOpen className="w-4 h-4" />} label={t('display.imagePicker.tabLibrary')} />
              <Tab active={tab === 'web'} onClick={() => setTab('web')} icon={<Globe className="w-4 h-4" />} label={t('display.imagePicker.tabWeb')} />
              <Tab active={tab === 'upload'} onClick={() => setTab('upload')} icon={<Upload className="w-4 h-4" />} label={t('display.imagePicker.tabUpload')} />
              <Tab active={tab === 'stock'} onClick={() => setTab('stock')} icon={<Search className="w-4 h-4" />} label={t('display.imagePicker.tabStock')} />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {/* Crop seçim paneli */}
          {showCrop && (
            <CropSelectionPane
              options={cropSource.options}
              onSelect={selectCropOption}
              onBack={() => setCropSource(null)}
              t={t}
            />
          )}
          {/* Kırpma oluşturuluyor */}
          {cropBuilding && !showCrop && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Kırpma seçenekleri hazırlanıyor…</p>
            </div>
          )}
          {/* PendingPane */}
          {showPending && (
            <PendingPane
              pending={pending!} kind={pendingKind} setKind={setPendingKind} existing={existing}
              onBack={() => { setPending(null); setPendingKind(null); setImportErr(null) }}
              onImport={handleImport} importing={importing} importErr={importErr} t={t}
            />
          )}
          {/* Tab içerikleri */}
          {showTabs && !cropBuilding && (
            <>
              {tab === 'recommendations' && (
                <RecPane
                  url={recUrl} setUrl={setRecUrl}
                  loading={recLoading} error={recError} images={recImages}
                  onScan={() => void loadRecommendations(recUrl)}
                  onPick={pickWeb} t={t}
                />
              )}
              {tab === 'library' && (
                <LibraryPane
                  loading={libLoading}
                  error={libError}
                  details={libDetails}
                  assets={libAssets}
                  onPick={pickLibrary}
                  onRetry={() => void loadLibrary(true)}
                  t={t}
                />
              )}
              {tab === 'web' && (
                <WebPane url={webUrl} setUrl={setWebUrl} loading={webLoading} error={webError} images={webImages} onScrape={doWebScrape} onPick={pickWeb} t={t} />
              )}
              {tab === 'upload' && (
                <UploadPane uploadRef={uploadRef} error={uploadErr} onPick={onFilePick} onPickMultiple={onMultiFilesPick} bulkBusy={bulkBusy} bulkProgress={bulkProgress} setErr={setUploadErr} t={t} />
              )}
              {tab === 'stock' && (
                <StockPane
                  query={stockQuery} setQuery={setStockQuery}
                  loading={stockLoading} error={stockError} notConfigured={stockNotConfigured}
                  photos={stockPhotos} hasNext={stockHasNext} page={stockPage}
                  onSearch={() => void doStockSearch(1)}
                  onNext={() => void doStockSearch(stockPage + 1)}
                  onPrev={() => void doStockSearch(Math.max(1, stockPage - 1))}
                  onPick={pickStock} t={t}
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
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
      {icon}{label}
    </button>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RecPane({ url, setUrl, loading, error, images, onScan, onPick, t }: { url: string; setUrl: (v: string) => void; loading: boolean; error: string | null; images: WebImage[]; onScan: () => void; onPick: (i: WebImage) => void; t: (k: string, p?: any) => string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('display.imagePicker.recHintUrl') || 'Reklamınızın Nihai URL\'sini girin — sayfa görsellerini otomatik tarayalım.'}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className={`${inputCls} pl-9`} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onScan() }} placeholder="https://example.com" />
        </div>
        <button type="button" onClick={onScan} disabled={loading || !url.trim() || url === 'https://'} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('display.imagePicker.scan') || 'Tara')}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {!loading && !error && images.length === 0 && url && url !== 'https://' && (
        <p className="text-sm text-gray-400 text-center py-8">{t('display.imagePicker.recEmpty') || 'Bu URL\'de görsel bulunamadı.'}</p>
      )}
      {!loading && images.length > 0 && <ImageGrid images={images} onPick={onPick} />}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LibraryPane({ loading, error, details, assets, onPick, onRetry, t }: { loading: boolean; error: string | null; details: string | null; assets: LibraryAsset[]; onPick: (a: LibraryAsset) => void; onRetry: () => void; t: (k: string, p?: any) => string }) {
  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
  if (error) return (
    <div className="space-y-3 py-8 px-4 text-center">
      <p className="text-sm font-medium text-red-600">{error}</p>
      {details && (
        <p className="text-[11px] text-gray-500 break-words font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 max-w-xl mx-auto">
          {details}
        </p>
      )}
      <p className="text-xs text-gray-500">Bu Google Ads hesabında asset kitaplığına erişim yok olabilir. &quot;Yükle&quot; sekmesinden görsel ekleyebilirsiniz.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Tekrar dene
      </button>
    </div>
  )
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

function WebPane({ url, setUrl, loading, error, images, onScrape, onPick, t }: {
  url: string; setUrl: (v: string) => void; loading: boolean; error: string | null;
  images: WebImage[]; onScrape: () => void; onPick: (i: WebImage) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: string, p?: any) => string
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

function UploadPane({ uploadRef, error, onPick, onPickMultiple, bulkBusy, bulkProgress, setErr, t }: {
  uploadRef: React.MutableRefObject<HTMLInputElement | null>
  error: string | null
  onPick: (f: File) => void
  onPickMultiple: (files: File[]) => void
  bulkBusy: boolean
  bulkProgress: { done: number; total: number } | null
  setErr: (s: string | null) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: string, p?: any) => string
}) {
  const locale = useLocale()
  const [driveBusy, setDriveBusy] = useState(false)
  const [driveAvailable, setDriveAvailable] = useState<boolean | null>(null)

  useEffect(() => { isGoogleDriveConfigured().then(setDriveAvailable).catch(() => setDriveAvailable(false)) }, [])

  const onDriveClick = async () => {
    setErr(null); setDriveBusy(true)
    try { const file = await pickImageFromGoogleDrive(locale === 'en' ? 'en' : 'tr'); if (file) onPick(file) }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setDriveBusy(false) }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">JPG/PNG/GIF formatında resim yükleyin (min 300×300, max 5 MB). Farklı oranlı görseller için otomatik kırpma seçenekleri sunulur.</p>
      <div
        className={`border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-12 text-center transition-colors ${bulkBusy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
        onClick={() => { if (!bulkBusy) uploadRef.current?.click() }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          if (bulkBusy) return
          const files = Array.from(e.dataTransfer.files ?? [])
          if (files.length === 0) return
          if (files.length === 1) onPick(files[0])
          else onPickMultiple(files)
        }}
      >
        {bulkBusy ? (
          <>
            <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-gray-700">
              {bulkProgress ? `${bulkProgress.done} / ${bulkProgress.total} yükleniyor…` : 'Yükleniyor…'}
            </p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-700">{t('display.logoPicker.dropHere')}</p>
            <p className="text-xs text-gray-400 mt-1">JPG / PNG / GIF · max 5 MB · birden fazla seçilebilir</p>
          </>
        )}
        <input
          ref={uploadRef} type="file" accept="image/jpeg,image/png,image/gif" multiple className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files ?? [])
            if (files.length === 1) onPick(files[0])
            else if (files.length > 1) onPickMultiple(files)
            e.target.value = ''
          }}
        />
      </div>
      {driveAvailable && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{t('display.uploadCloudLabel')}</span>
          <button type="button" onClick={onDriveClick} disabled={driveBusy}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium border border-gray-200 hover:border-blue-400 hover:text-blue-600 rounded-lg text-gray-700 transition-colors disabled:opacity-50">
            {driveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            )}
            Google Drive
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500 whitespace-pre-line">{error}</p>}
    </div>
  )
}

function CropSelectionPane({ options, onSelect, onBack, t }: {
  options: CropOption[]; onSelect: (o: CropOption) => void; onBack: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: string, p?: any) => string
}) {
  return (
    <div className="space-y-5">
      <div>
        <button type="button" onClick={onBack} className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mb-3">
          <ChevronLeft className="w-4 h-4" /> Geri
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Crop className="w-4 h-4 text-gray-600" />
          <p className="text-sm font-semibold text-gray-800">Kırpma oranını seçin</p>
        </div>
        <p className="text-xs text-gray-500">Görseliniz Google Ads oran gereksinimlerine göre otomatik kırpıldı. Kullanmak istediğiniz oranı seçin ve ekleyin.</p>
      </div>
      <div className={`grid gap-4 ${options.length === 1 ? 'grid-cols-1 max-w-xs' : options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {options.map(opt => (
          <button
            key={opt.kind}
            type="button"
            onClick={() => onSelect(opt)}
            className="flex flex-col border-2 border-gray-200 hover:border-blue-500 rounded-xl overflow-hidden transition-all hover:shadow-md group"
          >
            {/* Başlık */}
            <div className="px-3 py-2 text-center border-b border-gray-100 bg-gray-50 group-hover:bg-blue-50 transition-colors">
              <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">{t(`display.kind.${opt.kind}`)}</p>
            </div>
            {/* Önizleme */}
            <div className="flex-1 flex items-center justify-center p-3 bg-white min-h-[120px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={opt.previewUrl} alt={RATIO_LABEL[opt.kind]} className="max-w-full max-h-40 object-contain rounded" />
            </div>
            {/* Açıklama */}
            <div className="px-3 py-2 border-t border-gray-100 text-center bg-white">
              <p className="text-[11px] text-gray-500">{RATIO_LABEL[opt.kind]} · {opt.width}×{opt.height}px</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function StockPane({ query, setQuery, loading, error, notConfigured, photos, hasNext, page, onSearch, onNext, onPrev, onPick, t }: {
  query: string; setQuery: (v: string) => void; loading: boolean; error: string | null; notConfigured: boolean
  photos: PexelsPhoto[]; hasNext: boolean; page: number
  onSearch: () => void; onNext: () => void; onPrev: () => void; onPick: (p: PexelsPhoto) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: string, p?: any) => string
}) {
  return (
    <div className="space-y-4">
      {notConfigured ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <p className="text-sm font-medium text-gray-700">Pexels API yapılandırılmamış</p>
          <p className="text-xs text-gray-500 max-w-xs">Ücretsiz stok görseller için sunucu yöneticinizin <code className="bg-gray-100 px-1 rounded">PEXELS_API_KEY</code> ortam değişkenini tanımlaması gerekiyor.</p>
          <p className="text-xs text-gray-400">Alternatif: "Web sitesi" sekmesinden veya "Yükle" sekmesinden görsel ekleyebilirsiniz.</p>
        </div>
      ) : (
        <>
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
          {!loading && photos.length === 0 && query && !error && <p className="text-sm text-gray-500 text-center py-8">{t('display.stockNoResults')}</p>}
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
        </>
      )}
    </div>
  )
}

function PendingPane({ pending, kind, setKind, existing, onBack, onImport, importing, importErr, t }: {
  pending: PendingPick; kind: ImageKind | null; setKind: (k: ImageKind) => void
  existing: DisplayAsset[]; onBack: () => void; onImport: () => void
  importing: boolean; importErr: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: string, p?: any) => string
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
          {pending.width && pending.height && <p className="text-xs text-gray-500 mb-3">{pending.width}×{pending.height} px</p>}
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('display.imagePicker.selectKind')}</label>
          <div className="space-y-1.5">
            {IMAGE_KINDS.map(k => {
              const spec = IMAGE_SPECS[k]
              const label = RATIO_LABEL[k]
              let disabled = false
              if (pending.width && pending.height) {
                const diff = Math.abs((pending.width / pending.height) - spec.ratio) / spec.ratio
                disabled = diff > spec.tolerance || pending.width < spec.minWidth || pending.height < spec.minHeight
              }
              return (
                <label key={k} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-[13px] ${kind === k ? 'border-blue-400 bg-blue-50/60' : 'border-gray-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
