'use client'

import { useState, useEffect, useCallback } from 'react'
import GoogleEditOverlay from './GoogleEditOverlay'
import { Loader2 } from 'lucide-react'

const BIDDING_STRATEGIES = [
  { value: 'MAXIMIZE_CLICKS', label: 'Tiklamalari En Ust Duzeye Cikar' },
  { value: 'MAXIMIZE_CONVERSIONS', label: 'Donusumleri En Ust Duzeye Cikar' },
  { value: 'TARGET_CPA', label: 'Hedef EBM (CPA)' },
  { value: 'TARGET_ROAS', label: 'Hedef ROAS' },
  { value: 'MANUAL_CPC', label: 'Manuel TBM (CPC)' },
  { value: 'TARGET_IMPRESSION_SHARE', label: 'Hedef Gosterim Payi' },
]

interface GoogleCampaignEditOverlayProps {
  campaignId: string
  campaignName: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
  onToast: (msg: string, type: 'info' | 'success' | 'error') => void
}

export default function GoogleCampaignEditOverlay({
  campaignId,
  campaignName,
  open,
  onClose,
  onSuccess,
  onToast,
}: GoogleCampaignEditOverlayProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('')
  const [biddingStrategy, setBiddingStrategy] = useState('')
  const [targetCpa, setTargetCpa] = useState('')
  const [targetRoas, setTargetRoas] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [targetSearchNetwork, setTargetSearchNetwork] = useState(true)
  const [targetContentNetwork, setTargetContentNetwork] = useState(false)

  // Original values for change detection
  const [orig, setOrig] = useState<Record<string, any>>({})

  // Read-only display
  const [metrics, setMetrics] = useState<any>(null)
  const [status, setStatus] = useState('')
  const [servingStatus, setServingStatus] = useState('')
  const [optScore, setOptScore] = useState<number | null>(null)
  const [budgetShared, setBudgetShared] = useState(false)

  useEffect(() => {
    if (!open || !campaignId) return
    setLoading(true)
    fetch(`/api/integrations/google-ads/campaigns/${campaignId}/detail`)
      .then((res) => res.json())
      .then((data) => {
        if (data.campaign) {
          const c = data.campaign
          setName(c.name ?? '')
          setBudget(c.budget != null ? String(c.budget) : '')
          setStatus(c.status ?? '')
          setServingStatus(c.servingStatus ?? '')
          setOptScore(c.optimizationScore ?? null)
          setBudgetShared(c.budgetShared ?? false)

          // Map bidding strategy type to our dropdown value
          const stratMap: Record<string, string> = {
            'MAXIMIZE_CLICKS': 'MAXIMIZE_CLICKS',
            'TARGET_SPEND': 'MAXIMIZE_CLICKS',
            'MAXIMIZE_CONVERSIONS': 'MAXIMIZE_CONVERSIONS',
            'TARGET_CPA': 'TARGET_CPA',
            'TARGET_ROAS': 'TARGET_ROAS',
            'MANUAL_CPC': 'MANUAL_CPC',
            'ENHANCED_CPC': 'MANUAL_CPC',
            'TARGET_IMPRESSION_SHARE': 'TARGET_IMPRESSION_SHARE',
          }
          const bs = stratMap[c.biddingStrategyType] || c.biddingStrategyType || ''
          setBiddingStrategy(bs)

          setOrig({
            name: c.name ?? '',
            budget: c.budget != null ? String(c.budget) : '',
            biddingStrategy: bs,
          })
        }
        if (data.metrics) setMetrics(data.metrics)
      })
      .catch(() => onToast('Kampanya detaylari yuklenemedi', 'error'))
      .finally(() => setLoading(false))
  }, [open, campaignId, onToast])

  const hasChanges =
    name !== orig.name ||
    budget !== orig.budget ||
    biddingStrategy !== orig.biddingStrategy ||
    startDate !== '' ||
    endDate !== ''

  const handleSave = useCallback(async () => {
    if (saving || !hasChanges) return
    setSaving(true)
    try {
      const payload: any = {}
      if (name !== orig.name && name.trim()) payload.name = name.trim()
      if (budget !== orig.budget) {
        const b = parseFloat(budget)
        if (Number.isFinite(b) && b >= 0) payload.budget = b
      }
      if (biddingStrategy !== orig.biddingStrategy) {
        payload.biddingStrategy = biddingStrategy
        if (biddingStrategy === 'TARGET_CPA' && targetCpa) {
          payload.targetCpaMicros = Math.round(parseFloat(targetCpa) * 1_000_000)
        }
        if (biddingStrategy === 'TARGET_ROAS' && targetRoas) {
          payload.targetRoas = parseFloat(targetRoas)
        }
      }
      if (startDate) payload.startDate = startDate
      if (endDate) payload.endDate = endDate

      // Network settings only if changed
      payload.networkSettings = { targetSearchNetwork, targetContentNetwork }

      const res = await fetch(`/api/integrations/google-ads/campaigns/${campaignId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        onToast('Kampanya guncellendi', 'success')
        onSuccess()
      } else {
        onToast(data?.message || 'Guncelleme basarisiz', 'error')
      }
    } catch {
      onToast('Guncelleme basarisiz', 'error')
    } finally {
      setSaving(false)
    }
  }, [saving, hasChanges, campaignId, name, budget, biddingStrategy, targetCpa, targetRoas, startDate, endDate, targetSearchNetwork, targetContentNetwork, orig, onToast, onSuccess])

  const fmtNum = (n: number) => n.toLocaleString('tr-TR')
  const fmtMoney = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TRY'

  return (
    <GoogleEditOverlay
      open={open}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={loading || !hasChanges}
      title="Kampanya Duzenle"
      subtitle={campaignName}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Kampanya Adi</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={256}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Budget */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Butce</h3>
                {budgetShared && (
                  <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    Bu kampanya paylasilan butce kullaniyor. Degisiklik ayni butceyi paylasan diger kampanyalari da etkiler.
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gunluk Butce (TRY)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="Orn: 1000.00"
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Bidding Strategy */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Teklif Stratejisi</h3>
                <select
                  value={biddingStrategy}
                  onChange={(e) => setBiddingStrategy(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">Sec...</option>
                  {BIDDING_STRATEGIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                {biddingStrategy === 'TARGET_CPA' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hedef EBM (TRY)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={targetCpa}
                      onChange={(e) => setTargetCpa(e.target.value)}
                      placeholder="Orn: 25.00"
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}

                {biddingStrategy === 'TARGET_ROAS' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hedef ROAS</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={targetRoas}
                      onChange={(e) => setTargetRoas(e.target.value)}
                      placeholder="Orn: 4.0"
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Tarihler</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Baslangic Tarihi</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Bitis Tarihi</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Network Settings */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Ag Ayarlari</h3>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={targetSearchNetwork}
                    onChange={(e) => setTargetSearchNetwork(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 accent-green-600"
                  />
                  Arama Agi ortaklarini dahil et
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={targetContentNetwork}
                    onChange={(e) => setTargetContentNetwork(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 accent-green-600"
                  />
                  Goruntulu Reklam Agini dahil et
                </label>
              </div>
            </div>

            {/* Right: metrics summary */}
            <div className="col-span-1">
              <div className="sticky top-8 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Kampanya Metrikleri</h3>
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Durum</p>
                    <p className="text-sm text-gray-900">{status} · {servingStatus}</p>
                  </div>
                  {optScore != null && (
                    <div>
                      <p className="text-xs text-gray-500">Optimizasyon Skoru</p>
                      <p className="text-sm text-gray-900">%{optScore.toFixed(0)}</p>
                    </div>
                  )}
                  {metrics && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500">Harcama</p>
                        <p className="text-sm text-gray-900">{fmtMoney(metrics.cost)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Gosterim</p>
                        <p className="text-sm text-gray-900">{fmtNum(metrics.impressions)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Tiklama</p>
                        <p className="text-sm text-gray-900">{fmtNum(metrics.clicks)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">CTR</p>
                        <p className="text-sm text-gray-900">{metrics.ctr?.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">CPC</p>
                        <p className="text-sm text-gray-900">{fmtMoney(metrics.cpc)}</p>
                      </div>
                      {metrics.roas != null && metrics.roas > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">ROAS</p>
                          <p className="text-sm text-gray-900">{metrics.roas.toFixed(1)}x</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </GoogleEditOverlay>
  )
}
