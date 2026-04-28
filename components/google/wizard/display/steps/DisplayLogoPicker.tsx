'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Check, Search, Upload, FolderOpen, Globe } from 'lucide-react'
import { useLocale } from 'next-intl'
import type { DisplayAsset, DisplayAssetKind } from '../../shared/WizardTypes'
import { inputCls } from '../../shared/WizardTypes'
import { IMAGE_SPECS, validateImageForKind, readImageDimensions, MAX_IMAGE_BYTES } from './displayImageSpecs'
import { pickImageFromGoogleDrive, isGoogleDriveConfigured } from './googleDrivePicker'

type LogoKind = 'LOGO' | 'SQUARE_LOGO'
type TabId = 'library' | 'web' | 'upload'

interface LibraryAsset {
  resourceName: string
  name: string
  url: string
  width: number
  height: number
  fileSize: number
}
interface WebImage { url: string; source: string }

interface Props {
  isOpen: boolean
  onClose: () => void
  existing: DisplayAsset[]
  onAdd: (asset: DisplayAsset) => void
  /** Reklamın ulaşılacak URL'si — Web scrape default'u */
  defaultWebUrl?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}

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

function kindForLogoBySize(width: number, height: number): LogoKind | null {
  const ratio = width / height
  const landscape = IMAGE_SPECS.LOGO
  const square = IMAGE_SPECS.SQUARE_LOGO
  const dLandscape = Math.abs(ratio - landscape.ratio) / landscape.ratio
  const dSquare = Math.abs(ratio - square.ratio) / square.ratio
  if (dLandscape <= landscape.tolerance && width >= landscape.minWidth && height >= landscape.minHeight) {
    return 'LOGO'
  }
  if (dSquare <= square.tolerance && width >= square.minWidth && height >= square.minHeight) {
    return 'SQUARE_LOGO'
  }
  return null
}

export default function DisplayLogoPicker({ isOpen, onClose, existing, onAdd, defaultWebUrl, t }: Props) {
  const [tab, setTab] = useState<TabId>('library')

  // Library state
  const [libLoading, setLibLoading] = useState(false)
  const [libError, setLibError] = useState<string | null>(null)
  const [libAssets, setLibAssets] = useState<LibraryAsset[]>([])
  const [libLoaded, setLibLoaded] = useState(false)

  // Web state
  const [webUrl, setWebUrl] = useState(defaultWebUrl ?? '')
  const [webLoading, setWebLoading] = useState(false)
  const [webError, setWebError] = useState<string | null>(null)
  const [webImages, setWebImages] = useState<WebImage[]>([])

  // Upload state
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)

  // Shared import state
  const [importing, setImporting] = useState(false)
  const [importErr, setImportErr] = useState<string | null>(null)

  const loadLibrary = async () => {
    if (libLoaded || libLoading) return
    setLibLoading(true)
    setLibError(null)
    try {
      const res = await fetch('/api/integrations/google-ads/assets/library')
      const json = await res.json()
      if (!res.ok) {
        setLibError(json.error ?? t('display.logoPicker.libraryError'))
        return
      }
      // Yalnızca logo-uygun oranlara filtrele (4:1 LOGO veya 1:1 SQUARE_LOGO)
      const filtered = (json.assets as LibraryAsset[]).filter(a => {
        if (!a.width || !a.height) return false
        return kindForLogoBySize(a.width, a.height) !== null
      })
      setLibAssets(filtered)
      setLibLoaded(true)
    } catch {
      setLibError(t('display.logoPicker.libraryError'))
    } finally {
      setLibLoading(false)
    }
  }

  const doScrape = async () => {
    const url = webUrl.trim()
    if (!url) return
    setWebLoading(true)
    setWebError(null)
    setWebImages([])
    try {
      const res = await fetch(`/api/integrations/google-ads/assets/scrape?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (!res.ok) {
        setWebError(json.error ?? t('display.logoPicker.scrapeError'))
        return
      }
      setWebImages(json.images ?? [])
    } catch {
      setWebError(t('display.logoPicker.scrapeError'))
    } finally {
      setWebLoading(false)
    }
  }

  const importFromLibrary = (a: LibraryAsset) => {
    const kind = kindForLogoBySize(a.width, a.height)
    if (!kind) {
      setImportErr(t('display.logoPicker.notLogoCompatible'))
      return
    }
    onAdd({
      resourceName: a.resourceName,
      kind,
      previewUrl: a.url,
      name: a.name || `logo_${a.width}x${a.height}`,
    })
    setImportErr(null)
  }

  const importFromWeb = async (img: WebImage) => {
    setImporting(true)
    setImportErr(null)
    try {
      // Önce client-side boyut/oran check'i yapmak için görseli önizle
      const tmp = new Image()
      tmp.crossOrigin = 'anonymous'
      const dims = await new Promise<{ w: number; h: number } | null>(resolve => {
        tmp.onload = () => resolve({ w: tmp.naturalWidth, h: tmp.naturalHeight })
        tmp.onerror = () => resolve(null)
        tmp.src = img.url
      })
      let chosen: LogoKind | null = null
      if (dims) chosen = kindForLogoBySize(dims.w, dims.h)
      if (!chosen) {
        // Client yükleyemedi (CORS) — backend'e POST'la ve yapsın; kind default LOGO deneriz.
        chosen = 'LOGO'
      }
      const res = await fetch('/api/integrations/google-ads/assets/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: img.url, kind: chosen, name: `web_logo_${Date.now()}` }),
      })
      const json = await res.json()
      if (!res.ok) {
        setImportErr(json.error ?? t('display.logoPicker.importError'))
        return
      }
      onAdd({
        resourceName: json.resourceName,
        kind: chosen,
        previewUrl: img.url,
        name: img.source,
      })
    } catch {
      setImportErr(t('display.logoPicker.importError'))
    } finally {
      setImporting(false)
    }
  }

  const onFilePick = async (file: File) => {
    setUploadErr(null)
    if (!/^image\/(jpeg|png|gif)$/i.test(file.type)) {
      setUploadErr(t('display.uploadErrorType'))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadErr(t('display.uploadErrorSize'))
      return
    }
    let dims: { width: number; height: number }
    try {
      dims = await readImageDimensions(file)
    } catch {
      setUploadErr(t('display.uploadErrorType'))
      return
    }
    const kind = kindForLogoBySize(dims.width, dims.height)
    if (!kind) {
      setUploadErr(t('display.logoPicker.notLogoCompatible'))
      return
    }
    const validation = validateImageForKind(dims.width, dims.height, file.size, kind)
    if (!validation.ok) {
      const spec = IMAGE_SPECS[kind]
      if (validation.code === 'tooSmall') {
        setUploadErr(t('display.validation.tooSmall', { min: `${spec.minWidth}×${spec.minHeight}` }))
      } else if (validation.code === 'tooBig') {
        setUploadErr(t('display.validation.tooBig', { max: `${spec.maxWidth}×${spec.maxHeight}` }))
      } else {
        setUploadErr(t('display.uploadErrorGeneric'))
      }
      return
    }
    setUploading(true)
    try {
      const data = await fileToBase64(file)
      const res = await fetch('/api/integrations/google-ads/assets/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name: file.name, data }),
      })
      const json = await res.json()
      if (!res.ok) {
        setUploadErr(json.error ?? t('display.uploadErrorGeneric'))
        return
      }
      onAdd({
        resourceName: json.resourceName,
        kind,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
      })
    } catch {
      setUploadErr(t('display.uploadErrorGeneric'))
    } finally {
      setUploading(false)
      if (uploadRef.current) uploadRef.current.value = ''
    }
  }

  if (!isOpen) return null

  const logosCount = existing.filter(a => a.kind === 'LOGO' || a.kind === 'SQUARE_LOGO').length
  const remaining = Math.max(0, 5 - logosCount)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('display.logoPicker.title')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('display.logoPicker.subtitle', { remaining })}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-1">
            <TabButton
              active={tab === 'library'}
              onClick={() => { setTab('library'); void loadLibrary() }}
              icon={<FolderOpen className="w-4 h-4" />}
              label={t('display.logoPicker.tabLibrary')}
            />
            <TabButton
              active={tab === 'web'}
              onClick={() => setTab('web')}
              icon={<Globe className="w-4 h-4" />}
              label={t('display.logoPicker.tabWeb')}
            />
            <TabButton
              active={tab === 'upload'}
              onClick={() => setTab('upload')}
              icon={<Upload className="w-4 h-4" />}
              label={t('display.logoPicker.tabUpload')}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'library' && (
            <LibraryPane
              loading={libLoading}
              error={libError}
              assets={libAssets}
              onPick={importFromLibrary}
              t={t}
            />
          )}
          {tab === 'web' && (
            <WebPane
              url={webUrl}
              setUrl={setWebUrl}
              loading={webLoading}
              error={webError}
              images={webImages}
              onScrape={doScrape}
              onPick={importFromWeb}
              importing={importing}
              importErr={importErr}
              t={t}
            />
          )}
          {tab === 'upload' && (
            <UploadPane
              uploadRef={uploadRef}
              uploading={uploading}
              error={uploadErr}
              setErr={setUploadErr}
              onPick={onFilePick}
              t={t}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LibraryPane({ loading, error, assets, onPick, t }: { loading: boolean; error: string | null; assets: LibraryAsset[]; onPick: (a: LibraryAsset) => void; t: (k: string, p?: any) => string }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }
  if (error) return <p className="text-sm text-red-500">{error}</p>
  if (assets.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-16">{t('display.logoPicker.libraryEmpty')}</p>
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {assets.map(a => (
        <button
          key={a.resourceName}
          type="button"
          onClick={() => onPick(a)}
          className="group relative rounded-lg overflow-hidden border border-gray-200 hover:border-blue-500 bg-gray-50 transition-colors"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.url} alt={a.name} className="w-full h-32 object-contain bg-white" />
          <div className="px-2 py-1.5 bg-white border-t border-gray-100">
            <p className="text-[11px] text-gray-700 truncate">{a.name || '—'}</p>
            <p className="text-[10px] text-gray-400">{a.width}×{a.height}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function WebPane({
  url, setUrl, loading, error, images, onScrape, onPick, importing, importErr, t,
}: {
  url: string; setUrl: (v: string) => void; loading: boolean; error: string | null;
  images: WebImage[]; onScrape: () => void; onPick: (i: WebImage) => void;
  importing: boolean; importErr: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: string, p?: any) => string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('display.logoPicker.webHint')}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            className={`${inputCls} pl-9`}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onScrape() }}
            placeholder="https://example.com"
          />
        </div>
        <button
          type="button"
          onClick={onScrape}
          disabled={loading || !url.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('display.logoPicker.scrape')}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {importErr && <p className="text-xs text-red-500">{importErr}</p>}
      {!loading && !error && images.length === 0 && url && (
        <p className="text-xs text-gray-500 italic">{t('display.logoPicker.scrapeHint')}</p>
      )}
      {images.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onPick(img)}
              disabled={importing}
              className="group relative rounded-lg overflow-hidden border border-gray-200 hover:border-blue-500 bg-white transition-colors disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className="w-full h-28 object-contain bg-gray-50"
                referrerPolicy="no-referrer"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
              <div className="px-2 py-1 bg-white border-t border-gray-100">
                <p className="text-[10px] text-gray-500 truncate">{img.source}</p>
              </div>
              {importing && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UploadPane({
  uploadRef, uploading, error, onPick, setErr, t,
}: {
  uploadRef: React.MutableRefObject<HTMLInputElement | null>;
  uploading: boolean; error: string | null;
  onPick: (f: File) => void;
  setErr: (s: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (k: string, p?: any) => string;
}) {
  const locale = useLocale()
  const [driveBusy, setDriveBusy] = useState(false)
  const [driveAvailable, setDriveAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    isGoogleDriveConfigured().then(setDriveAvailable).catch(() => setDriveAvailable(false))
  }, [])

  const onDriveClick = async () => {
    setErr(null)
    setDriveBusy(true)
    try {
      const file = await pickImageFromGoogleDrive(locale === 'en' ? 'en' : 'tr')
      if (file) onPick(file)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setDriveBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('display.logoPicker.uploadHint')}</p>
      <div
        className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-12 text-center transition-colors cursor-pointer"
        onClick={() => uploadRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) onPick(f)
        }}
      >
        {uploading ? (
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-700">{t('display.logoPicker.dropHere')}</p>
            <p className="text-xs text-gray-400 mt-1">JPG / PNG / GIF · max 5 MB</p>
          </>
        )}
        <input
          ref={uploadRef}
          type="file"
          accept="image/jpeg,image/png,image/gif"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) onPick(f)
          }}
        />
      </div>
      {driveAvailable && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{t('display.uploadCloudLabel')}</span>
          <button
            type="button"
            onClick={onDriveClick}
            disabled={driveBusy}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium border border-gray-200 hover:border-blue-400 hover:text-blue-600 rounded-lg text-gray-700 transition-colors disabled:opacity-50"
          >
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
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
