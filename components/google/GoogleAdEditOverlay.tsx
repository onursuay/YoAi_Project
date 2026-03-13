'use client'

import { useState, useEffect, useCallback } from 'react'
import GoogleEditOverlay from './GoogleEditOverlay'
import { Plus, X, Loader2 } from 'lucide-react'

interface Headline { text: string; pinnedField?: string | null }
interface Description { text: string; pinnedField?: string | null }

interface GoogleAdEditOverlayProps {
  adId: string
  adName: string
  adGroupId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
  onToast: (msg: string, type: 'info' | 'success' | 'error') => void
}

export default function GoogleAdEditOverlay({
  adId,
  adName,
  adGroupId,
  open,
  onClose,
  onSuccess,
  onToast,
}: GoogleAdEditOverlayProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adType, setAdType] = useState('')
  const [headlines, setHeadlines] = useState<Headline[]>([])
  const [descriptions, setDescriptions] = useState<Description[]>([])
  const [finalUrl, setFinalUrl] = useState('')
  const [path1, setPath1] = useState('')
  const [path2, setPath2] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [adGroupName, setAdGroupName] = useState('')

  // Fetch ad details on open
  useEffect(() => {
    if (!open || !adId) return
    setLoading(true)
    fetch(`/api/integrations/google-ads/ads/${adId}/detail?adGroupId=${adGroupId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ad) {
          setAdType(data.ad.type ?? '')
          setFinalUrl(data.ad.finalUrls?.[0] ?? '')
          if (data.ad.rsa) {
            setHeadlines(data.ad.rsa.headlines?.length > 0 ? data.ad.rsa.headlines : [{ text: '' }])
            setDescriptions(data.ad.rsa.descriptions?.length > 0 ? data.ad.rsa.descriptions : [{ text: '' }])
            setPath1(data.ad.rsa.path1 ?? '')
            setPath2(data.ad.rsa.path2 ?? '')
          }
        }
        if (data.campaign) setCampaignName(data.campaign.name ?? '')
        if (data.adGroup) setAdGroupName(data.adGroup.name ?? '')
      })
      .catch(() => onToast('Reklam detayları yüklenemedi', 'error'))
      .finally(() => setLoading(false))
  }, [open, adId, adGroupId, onToast])

  const isRsa = adType === 'RESPONSIVE_SEARCH_AD'

  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      const payload: any = { adGroupId }
      if (isRsa) {
        const validHeadlines = headlines.filter((h) => h.text.trim() !== '')
        const validDescriptions = descriptions.filter((d) => d.text.trim() !== '')
        if (validHeadlines.length < 3) {
          onToast('En az 3 başlık gerekli', 'error')
          return
        }
        if (validDescriptions.length < 2) {
          onToast('En az 2 açıklama gerekli', 'error')
          return
        }
        payload.headlines = validHeadlines
        payload.descriptions = validDescriptions
        payload.path1 = path1
        payload.path2 = path2
      }
      if (finalUrl.trim()) {
        payload.finalUrls = [finalUrl.trim()]
      }

      const res = await fetch(`/api/integrations/google-ads/ads/${adId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        onToast('Reklam guncellendi', 'success')
        onSuccess()
      } else {
        onToast(data?.message || 'Guncelleme basarisiz', 'error')
      }
    } catch {
      onToast('Guncelleme basarisiz', 'error')
    } finally {
      setSaving(false)
    }
  }, [saving, adId, adGroupId, isRsa, headlines, descriptions, finalUrl, path1, path2, onToast, onSuccess])

  const addHeadline = () => {
    if (headlines.length < 15) setHeadlines([...headlines, { text: '' }])
  }
  const removeHeadline = (idx: number) => {
    if (headlines.length > 3) setHeadlines(headlines.filter((_, i) => i !== idx))
  }
  const updateHeadline = (idx: number, text: string) => {
    setHeadlines(headlines.map((h, i) => (i === idx ? { ...h, text } : h)))
  }

  const addDescription = () => {
    if (descriptions.length < 4) setDescriptions([...descriptions, { text: '' }])
  }
  const removeDescription = (idx: number) => {
    if (descriptions.length > 2) setDescriptions(descriptions.filter((_, i) => i !== idx))
  }
  const updateDescription = (idx: number, text: string) => {
    setDescriptions(descriptions.map((d, i) => (i === idx ? { ...d, text } : d)))
  }

  // Build preview
  const previewHeadline = headlines
    .filter((h) => h.text.trim())
    .slice(0, 3)
    .map((h) => h.text.trim())
    .join(' | ')
  const previewDesc = descriptions
    .filter((d) => d.text.trim())
    .slice(0, 2)
    .map((d) => d.text.trim())
    .join(' ')
  const previewUrl = finalUrl || 'www.example.com'
  const displayPath = [path1, path2].filter(Boolean).join('/')

  return (
    <GoogleEditOverlay
      open={open}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={loading || !isRsa}
      title="Reklam Duzenle"
      subtitle={`${adName} · ${adGroupName} · ${campaignName}`}
    >
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : !isRsa ? (
        <div className="p-8 max-w-2xl">
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            Bu reklam tipi ({adType}) duzenlenemez. Sadece Responsive Search Ad (RSA) reklamlari duzenlenebilir.
          </div>
        </div>
      ) : (
        <div className="p-8">
          <div className="grid grid-cols-3 gap-8">
            {/* Left: editable fields */}
            <div className="col-span-2 space-y-6">
              {/* Ad name (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reklam Adi</label>
                <input
                  type="text"
                  value={adName}
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">Google Ads API uzerinden reklam adi degistirilemez.</p>
              </div>

              {/* Headlines */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Basliklar ({headlines.length}/15)</h3>
                  {headlines.length < 15 && (
                    <button onClick={addHeadline} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Ekle
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {headlines.map((h, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 text-right shrink-0">{idx + 1}</span>
                      <input
                        type="text"
                        value={h.text}
                        onChange={(e) => updateHeadline(idx, e.target.value)}
                        maxLength={30}
                        placeholder="Baslik metni (maks 30 karakter)"
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-300"
                      />
                      <span className={`text-xs shrink-0 ${h.text.length > 25 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {h.text.length}/30
                      </span>
                      {headlines.length > 3 && (
                        <button onClick={() => removeHeadline(idx)} className="text-gray-400 hover:text-red-500 shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">En az 3, en fazla 15 baslik. Her biri maks 30 karakter.</p>
              </div>

              {/* Descriptions */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Aciklamalar ({descriptions.length}/4)</h3>
                  {descriptions.length < 4 && (
                    <button onClick={addDescription} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Ekle
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {descriptions.map((d, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 text-right shrink-0">{idx + 1}</span>
                      <input
                        type="text"
                        value={d.text}
                        onChange={(e) => updateDescription(idx, e.target.value)}
                        maxLength={90}
                        placeholder="Aciklama metni (maks 90 karakter)"
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-300"
                      />
                      <span className={`text-xs shrink-0 ${d.text.length > 80 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {d.text.length}/90
                      </span>
                      {descriptions.length > 2 && (
                        <button onClick={() => removeDescription(idx)} className="text-gray-400 hover:text-red-500 shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">En az 2, en fazla 4 aciklama. Her biri maks 90 karakter.</p>
              </div>

              {/* URL & Paths */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">URL ve Yollar</h3>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Son URL</label>
                  <input
                    type="url"
                    value={finalUrl}
                    onChange={(e) => setFinalUrl(e.target.value)}
                    placeholder="https://www.example.com/sayfa"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Yol 1 (opsiyonel)</label>
                    <input
                      type="text"
                      value={path1}
                      onChange={(e) => setPath1(e.target.value)}
                      maxLength={15}
                      placeholder="ornek"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Yol 2 (opsiyonel)</label>
                    <input
                      type="text"
                      value={path2}
                      onChange={(e) => setPath2(e.target.value)}
                      maxLength={15}
                      placeholder="sayfa"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-300"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Preview */}
            <div className="col-span-1">
              <div className="sticky top-8">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Onizleme</h3>
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <p className="text-xs text-gray-500 mb-2">Google Arama Sonucu</p>
                  <div className="space-y-1">
                    <p className="text-xs text-green-700 truncate">
                      {previewUrl}{displayPath ? `/${displayPath}` : ''}
                    </p>
                    <p className="text-base text-blue-700 font-medium leading-snug line-clamp-2">
                      {previewHeadline || 'Baslik onizlemesi'}
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {previewDesc || 'Aciklama onizlemesi'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </GoogleEditOverlay>
  )
}
