'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Eye } from 'lucide-react'
import MetaEditOverlay from './MetaEditOverlay'
import type { TreeCampaign, TreeAdset, TreeAd } from './CampaignTreeSidebar'

interface EditCapabilities {
  canEditName: boolean
  canEditCreative: boolean
  reason?: string
}

interface AdEditDrawerProps {
  adId: string
  adName: string
  relatedCampaignId?: string
  open: boolean
  onClose: () => void
  onSuccess: (data?: { adId: string; name: string; status?: string; effective_status?: string }) => void
  onToast: (msg: string, type: 'success' | 'error') => void
  campaigns: TreeCampaign[]
  adsets: TreeAdset[]
  ads: TreeAd[]
  onEntitySelect: (type: 'campaign' | 'adset' | 'ad', id: string, name: string) => void
}

const CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: 'Daha Fazla Bilgi' },
  { value: 'SHOP_NOW', label: 'Hemen Alışveriş Yap' },
  { value: 'SIGN_UP', label: 'Kaydol' },
  { value: 'CONTACT_US', label: 'Bize Ulaşın' },
  { value: 'APPLY_NOW', label: 'Şimdi Başvur' },
  { value: 'SUBSCRIBE', label: 'Abone Ol' },
  { value: 'GET_OFFER', label: 'Teklif Al' },
  { value: 'BOOK_TRAVEL', label: 'Seyahat Rezervasyonu' },
]

export default function AdEditDrawer({ adId, adName, relatedCampaignId, open, onClose, onSuccess, onToast, campaigns, adsets, ads, onEntitySelect }: AdEditDrawerProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [primaryText, setPrimaryText] = useState('')
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [callToAction, setCallToAction] = useState('LEARN_MORE')

  const didInitRef = useRef(false)
  const [editCapabilities, setEditCapabilities] = useState<EditCapabilities>({ canEditName: true, canEditCreative: true })

  const [previewMode, setPreviewMode] = useState('mobile_feed')

  // Fetch ad details
  useEffect(() => {
    if (!open || !adId) return
    didInitRef.current = false
    let cancelled = false

    const fetchDetails = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/meta/ads/details?adId=${adId}`)
        const data = await res.json()
        console.log('[AdsEdit] details ok:', data?.ok, 'form:', data?.form)
        if (!data.ok || cancelled) return

        if (data.form && !didInitRef.current) {
          const f = data.form
          setName(f.adName ?? '')
          setPrimaryText(f.primaryText ?? '')
          setHeadline(f.headline ?? '')
          setDescription(f.description ?? '')
          setWebsiteUrl(f.websiteUrl ?? '')
          setCallToAction(f.cta || 'LEARN_MORE')
          didInitRef.current = true
        }
        if (data.editCapabilities) {
          setEditCapabilities(data.editCapabilities)
        }
      } catch (err) {
        console.error('Ad details fetch error:', err)
        onToast('Reklam bilgileri alınamadı', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDetails()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adId, open])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        adId,
        name: name.trim(),
        creative: {
          primaryText,
          headline,
          description,
          websiteUrl,
          callToAction,
        },
      }

      const res = await fetch('/api/meta/ads/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!json.ok) {
        if (json.error === 'creative_not_editable') {
          onToast(json.message || 'Bu reklam tipi içerik düzenlemesine izin vermiyor.', 'error')
          return
        }
        throw new Error(json.message || 'Güncelleme başarısız')
      }

      const msg = json.warning === 'creative_not_editable'
        ? 'Sadece reklam adı güncellendi (içerik değişikliği desteklenmiyor)'
        : 'Reklam başarıyla güncellendi'
      onToast(msg, 'success')
      onSuccess({ adId, name: name.trim(), status: json.status, effective_status: json.effective_status })
    } catch (err) {
      console.error('Ad update error:', err)
      onToast(err instanceof Error ? err.message : 'Güncelleme başarısız', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <MetaEditOverlay
      open={open}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={!name.trim()}
      title="Reklamı Düzenle"
      subtitle="Reklamınızı buradan düzenleyebilirsiniz."
      campaigns={campaigns}
      adsets={adsets}
      ads={ads}
      editingEntity={{ type: 'ad', id: adId }}
      relatedCampaignId={relatedCampaignId}
      onEntitySelect={onEntitySelect}
    >
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-8 p-8">
            {/* ═══════ LEFT COLUMN ═══════ */}
            <div className="col-span-2 space-y-6">
              {!editCapabilities.canEditCreative && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  {editCapabilities.reason === 'Lead Gen form'
                    ? 'Lead Gen reklam — içerik düzenlemesi desteklenmiyor; sadece reklam adı değişebilir.'
                    : 'Post promoted reklam — organik gönderi içeriği API ile düzenlenemez; sadece reklam adı değişebilir.'}
                </div>
              )}

              {/* Reklam Adı */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Reklam Adı</h3>
                <p className="text-sm text-gray-500 mt-1 mb-3">Reklamınıza bir isim verin.</p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  maxLength={256}
                  placeholder="Reklam adı..."
                />
              </div>

              {/* Reklam İçeriği */}
              <div className="border border-gray-200 rounded-xl bg-white">
                <div className="px-5 pt-5 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Reklam İçeriği</h3>
                  <p className="text-sm text-gray-500 mt-1">Reklamınızın metin ve bağlantı ayarları.</p>
                </div>
                <div className="px-5 pb-5 space-y-4">
                  {/* Ana Metin */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Ana Metin</label>
                    <textarea
                      value={primaryText}
                      onChange={(e) => setPrimaryText(e.target.value)}
                      rows={4}
                      disabled={!editCapabilities.canEditCreative}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm resize-none disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
                      placeholder="Reklamın ana metni..."
                    />
                    <p className="text-xs text-gray-400 mt-0.5">{primaryText.length}/125 karakter önerilen</p>
                  </div>

                  {/* Başlık */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Başlık</label>
                    <input
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      disabled={!editCapabilities.canEditCreative}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
                      placeholder="Dikkat çekici başlık..."
                      maxLength={40}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">{headline.length}/40 karakter önerilen</p>
                  </div>

                  {/* Açıklama */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Açıklama</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={!editCapabilities.canEditCreative}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
                      placeholder="Ek açıklama..."
                      maxLength={30}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">{description.length}/30 karakter önerilen</p>
                  </div>

                  {/* İnternet Sitesi */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">İnternet Sitesi</label>
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      disabled={!editCapabilities.canEditCreative}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
                      placeholder="https://example.com"
                    />
                  </div>

                  {/* Eylem Çağrısı */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Eylem Çağrısı</label>
                    <select
                      value={callToAction}
                      onChange={(e) => setCallToAction(e.target.value)}
                      disabled={!editCapabilities.canEditCreative}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
                    >
                      {CTA_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════ RIGHT COLUMN ═══════ */}
            <div className="col-span-1 space-y-6">
              {/* Önizleme */}
              <div className="border border-gray-200 rounded-xl bg-white">
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-gray-500" />
                    Önizleme
                  </h3>
                  <select
                    value={previewMode}
                    onChange={(e) => setPreviewMode(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-xs text-gray-600"
                  >
                    <option value="mobile_feed">Mobil Akış</option>
                    <option value="desktop_feed">Masaüstü Akış</option>
                    <option value="story">Hikaye</option>
                    <option value="reels">Reels</option>
                  </select>
                </div>
                <div className="px-5 pb-5">
                  <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 min-h-[280px] flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gray-300" />
                      <div>
                        <div className="text-xs font-medium text-gray-700">Sayfa Adı</div>
                        <div className="text-[10px] text-gray-400">Sponsorlu</div>
                      </div>
                    </div>
                    {primaryText && (
                      <p className="text-xs text-gray-700 mb-3 line-clamp-3">{primaryText}</p>
                    )}
                    <div className="flex-1 bg-gray-200 rounded-lg mb-3 min-h-[120px] flex items-center justify-center">
                      <span className="text-xs text-gray-400">Medya Önizleme</span>
                    </div>
                    {(headline || websiteUrl) && (
                      <div className="bg-gray-100 rounded-lg p-2.5">
                        {websiteUrl && <p className="text-[10px] text-gray-400 uppercase truncate">{websiteUrl.replace(/^https?:\/\//, '').split('/')[0]}</p>}
                        {headline && <p className="text-xs font-medium text-gray-800 truncate">{headline}</p>}
                        {description && <p className="text-[10px] text-gray-500 truncate">{description}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </MetaEditOverlay>
  )
}
