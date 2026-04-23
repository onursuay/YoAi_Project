'use client'

import { useState } from 'react'
import { X, Search, Loader2, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import type { DisplayAsset, DisplayAssetKind } from '../../shared/WizardTypes'
import { inputCls } from '../../shared/WizardTypes'
import { IMAGE_SPECS, detectBestKind } from './displayImageSpecs'

interface PexelsResultPhoto {
  id: number
  width: number
  height: number
  previewUrl: string
  downloadUrl: string
  photographer: string
  photographerUrl: string
  alt: string
  sourceUrl: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  existing: DisplayAsset[]
  onAdd: (asset: DisplayAsset) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}

const IMPORTABLE_KINDS: Array<Exclude<DisplayAssetKind, 'YOUTUBE_VIDEO'>> = [
  'MARKETING_IMAGE',
  'SQUARE_MARKETING_IMAGE',
  'PORTRAIT_MARKETING_IMAGE',
  'LOGO',
  'SQUARE_LOGO',
]

export default function DisplayStockImagePicker({ isOpen, onClose, existing, onAdd, t }: Props) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [photos, setPhotos] = useState<PexelsResultPhoto[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [searchErr, setSearchErr] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const [selected, setSelected] = useState<PexelsResultPhoto | null>(null)
  const [chosenKind, setChosenKind] = useState<Exclude<DisplayAssetKind, 'YOUTUBE_VIDEO'> | null>(null)
  const [importing, setImporting] = useState(false)
  const [importErr, setImportErr] = useState<string | null>(null)

  const doSearch = async (nextPage = 1) => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setSearchErr(null)
    setNotConfigured(false)
    try {
      const res = await fetch(`/api/integrations/google-ads/assets/stock?q=${encodeURIComponent(q)}&page=${nextPage}`)
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 503) setNotConfigured(true)
        else setSearchErr(json.error ?? t('display.stockNoResults'))
        setPhotos([])
        setHasNext(false)
        return
      }
      setPhotos(json.photos ?? [])
      setHasNext(Boolean(json.hasNext))
      setPage(json.page ?? nextPage)
    } catch {
      setSearchErr(t('display.stockError'))
    } finally {
      setLoading(false)
    }
  }

  const openSelection = (photo: PexelsResultPhoto) => {
    setSelected(photo)
    const suggested = detectBestKind(photo.width, photo.height)
    setChosenKind(suggested)
    setImportErr(null)
  }

  const handleImport = async () => {
    if (!selected || !chosenKind) return
    const spec = IMAGE_SPECS[chosenKind]
    const actualRatio = selected.width / selected.height
    const diff = Math.abs(actualRatio - spec.ratio) / spec.ratio
    if (diff > spec.tolerance) {
      setImportErr(t('display.validation.wrongRatio', {
        expected: `${spec.ratio.toFixed(2)}:1`,
        actual: `${selected.width}×${selected.height}`,
      }))
      return
    }
    if (selected.width < spec.minWidth || selected.height < spec.minHeight) {
      setImportErr(t('display.validation.tooSmall', { min: `${spec.minWidth}×${spec.minHeight}` }))
      return
    }
    setImporting(true)
    setImportErr(null)
    try {
      const res = await fetch('/api/integrations/google-ads/assets/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: selected.downloadUrl,
          kind: chosenKind,
          name: selected.alt,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setImportErr(json.error ?? t('display.stockError'))
        return
      }
      const newAsset: DisplayAsset = {
        resourceName: json.resourceName,
        kind: chosenKind,
        previewUrl: selected.previewUrl,
        name: selected.alt,
      }
      onAdd(newAsset)
      setSelected(null)
      setChosenKind(null)
    } catch {
      setImportErr(t('display.stockError'))
    } finally {
      setImporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('display.stockTabTitle')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t('display.stockPoweredBy')}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                className={`${inputCls} pl-9`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void doSearch(1) }}
                placeholder={t('display.stockSearchPlaceholder')}
              />
            </div>
            <button
              type="button"
              onClick={() => void doSearch(1)}
              disabled={loading || !query.trim()}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('display.stockSearch')}
            </button>
          </div>
          {searchErr && <p className="text-xs text-red-500 mt-2">{searchErr}</p>}
          {notConfigured && <p className="text-xs text-red-500 mt-2">{t('display.stockNoApiKey')}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!selected && (
            <>
              {loading && photos.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : photos.length === 0 ? (
                <div className="text-center py-16 text-gray-500 text-sm">
                  {query.trim() ? t('display.stockNoResults') : t('display.stockStartHint')}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map(p => {
                      const added = existing.some(a => a.resourceName && a.name === p.alt)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => openSelection(p)}
                          className="group relative rounded-lg overflow-hidden border border-gray-200 hover:border-blue-500 bg-gray-50 transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.previewUrl} alt={p.alt} className="w-full h-36 object-cover" />
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                            <p className="text-[11px] text-white truncate">
                              {t('display.stockPhotoBy', { name: p.photographer })}
                            </p>
                            <p className="text-[10px] text-white/70">{p.width}×{p.height}</p>
                          </div>
                          {added && (
                            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => void doSearch(Math.max(1, page - 1))}
                      disabled={page <= 1 || loading}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600">{t('display.stockPage', { page })}</span>
                    <button
                      type="button"
                      onClick={() => void doSearch(page + 1)}
                      disabled={!hasNext || loading}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {selected && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.previewUrl}
                  alt={selected.alt}
                  className="w-56 h-56 object-cover rounded-lg border border-gray-200"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{selected.alt}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{selected.width}×{selected.height} px</p>
                  <a
                    href={selected.photographerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    {t('display.stockPhotoBy', { name: selected.photographer })}
                  </a>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('display.stockSelectKind')}
                    </label>
                    <div className="space-y-1.5">
                      {IMPORTABLE_KINDS.map(k => {
                        const spec = IMAGE_SPECS[k]
                        const actualRatio = selected.width / selected.height
                        const diff = Math.abs(actualRatio - spec.ratio) / spec.ratio
                        const tooSmall = selected.width < spec.minWidth || selected.height < spec.minHeight
                        const compatible = diff <= spec.tolerance && !tooSmall
                        return (
                          <label
                            key={k}
                            className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-[13px] ${
                              chosenKind === k ? 'border-blue-400 bg-blue-50/60' : 'border-gray-200'
                            } ${!compatible ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="radio"
                              name="stockKind"
                              disabled={!compatible}
                              checked={chosenKind === k}
                              onChange={() => setChosenKind(k)}
                              className="text-blue-600"
                            />
                            <span className="flex-1">{t(`display.kind.${k}`)}</span>
                            <span className="text-[11px] text-gray-400">
                              {spec.ratio === 1 ? '1:1' : spec.ratio === 1.91 ? '1.91:1' : spec.ratio === 4 ? '4:1' : '4:5'}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  {importErr && <p className="text-xs text-red-500 mt-2">{importErr}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {selected && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => { setSelected(null); setChosenKind(null); setImportErr(null) }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
            >
              {t('display.stockBack')}
            </button>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={!chosenKind || importing}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {importing ? t('display.stockImporting') : t('display.stockAdd')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
