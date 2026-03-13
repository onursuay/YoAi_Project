'use client'

import { useState, useEffect, useCallback } from 'react'
import GoogleEditOverlay from './GoogleEditOverlay'
import { Loader2 } from 'lucide-react'

interface Keyword { text: string; matchType: string; negative: boolean }

interface GoogleAdGroupEditOverlayProps {
  adGroupId: string
  adGroupName: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
  onToast: (msg: string, type: 'info' | 'success' | 'error') => void
}

export default function GoogleAdGroupEditOverlay({
  adGroupId,
  adGroupName,
  open,
  onClose,
  onSuccess,
  onToast,
}: GoogleAdGroupEditOverlayProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [cpcBid, setCpcBid] = useState('')
  const [adGroupType, setAdGroupType] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [originalName, setOriginalName] = useState('')
  const [originalBid, setOriginalBid] = useState('')

  useEffect(() => {
    if (!open || !adGroupId) return
    setLoading(true)
    fetch(`/api/integrations/google-ads/ad-groups/${adGroupId}/detail`)
      .then((res) => res.json())
      .then((data) => {
        if (data.adGroup) {
          setName(data.adGroup.name ?? '')
          setOriginalName(data.adGroup.name ?? '')
          const bid = data.adGroup.cpcBid != null ? String(data.adGroup.cpcBid) : ''
          setCpcBid(bid)
          setOriginalBid(bid)
          setAdGroupType(data.adGroup.type ?? '')
        }
        if (data.campaign) setCampaignName(data.campaign.name ?? '')
        if (data.keywords) setKeywords(data.keywords)
      })
      .catch(() => onToast('Reklam grubu detaylari yuklenemedi', 'error'))
      .finally(() => setLoading(false))
  }, [open, adGroupId, onToast])

  const hasChanges = name !== originalName || cpcBid !== originalBid

  const handleSave = useCallback(async () => {
    if (saving || !hasChanges) return
    setSaving(true)
    try {
      const payload: any = {}
      if (name !== originalName && name.trim()) payload.name = name.trim()
      if (cpcBid !== originalBid) {
        const bid = parseFloat(cpcBid)
        if (Number.isFinite(bid) && bid >= 0) payload.cpcBid = bid
      }

      const res = await fetch(`/api/integrations/google-ads/ad-groups/${adGroupId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        onToast('Reklam grubu guncellendi', 'success')
        onSuccess()
      } else {
        onToast(data?.message || 'Guncelleme basarisiz', 'error')
      }
    } catch {
      onToast('Guncelleme basarisiz', 'error')
    } finally {
      setSaving(false)
    }
  }, [saving, hasChanges, adGroupId, name, originalName, cpcBid, originalBid, onToast, onSuccess])

  const matchTypeLabel = (mt: string) => {
    switch (mt) {
      case 'EXACT': return '[Tam]'
      case 'PHRASE': return '"Ifade"'
      case 'BROAD': return 'Genis'
      default: return mt
    }
  }

  const positiveKws = keywords.filter((k) => !k.negative)
  const negativeKws = keywords.filter((k) => k.negative)

  return (
    <GoogleEditOverlay
      open={open}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={loading || !hasChanges}
      title="Reklam Grubu Duzenle"
      subtitle={`${adGroupName} · ${campaignName}`}
    >
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="p-8">
          <div className="grid grid-cols-3 gap-8">
            {/* Left: editable fields */}
            <div className="col-span-2 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reklam Grubu Adi</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={256}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* CPC Bid */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maks. CPC Teklif (TRY)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cpcBid}
                  onChange={(e) => setCpcBid(e.target.value)}
                  placeholder="Orn: 2.50"
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Keywords (read-only) */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Anahtar Kelimeler ({positiveKws.length})
                </h3>
                {positiveKws.length === 0 ? (
                  <p className="text-sm text-gray-400">Anahtar kelime yok</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {positiveKws.map((kw, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        <span className="text-blue-400">{matchTypeLabel(kw.matchType)}</span>
                        {kw.text}
                      </span>
                    ))}
                  </div>
                )}

                {negativeKws.length > 0 && (
                  <>
                    <h4 className="text-xs font-medium text-gray-500 mt-4 mb-2">
                      Negatif Anahtar Kelimeler ({negativeKws.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {negativeKws.map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-red-50 text-red-600 border border-red-200"
                        >
                          {matchTypeLabel(kw.matchType)} {kw.text}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <p className="mt-3 text-xs text-gray-400">Anahtar kelime ekleme/silme yakin zamanda eklenecek.</p>
              </div>
            </div>

            {/* Right: summary */}
            <div className="col-span-1">
              <div className="sticky top-8 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Ozet</h3>
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Kampanya</p>
                    <p className="text-sm text-gray-900">{campaignName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Grup Tipi</p>
                    <p className="text-sm text-gray-900">{adGroupType.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Anahtar Kelime</p>
                    <p className="text-sm text-gray-900">{positiveKws.length} pozitif, {negativeKws.length} negatif</p>
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
