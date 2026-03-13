'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Users, Calendar, Wallet, Plus } from 'lucide-react'

/* ── Types ── */

interface DemographicCriterion {
  resourceName: string
  criterionId: string
  type: 'GENDER' | 'AGE_RANGE' | 'INCOME_RANGE'
  value: string
  status: 'ENABLED' | 'REMOVED'
  bidModifier: number | null
  negative: boolean
}

interface LocalRow {
  resourceName: string
  value: string
  type: 'GENDER' | 'AGE_RANGE' | 'INCOME_RANGE'
  enabled: boolean
  bidModifier: string
  originalEnabled: boolean
  originalBidModifier: string
  isNew: boolean // true = needs to be created via POST
}

/* ── Constants ── */

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Erkek',
  FEMALE: 'Kadın',
  UNDETERMINED: 'Bilinmiyor',
}
const GENDER_ORDER = ['MALE', 'FEMALE', 'UNDETERMINED']

const AGE_RANGE_LABELS: Record<string, string> = {
  AGE_RANGE_18_24: '18-24',
  AGE_RANGE_25_34: '25-34',
  AGE_RANGE_35_44: '35-44',
  AGE_RANGE_45_54: '45-54',
  AGE_RANGE_55_64: '55-64',
  AGE_RANGE_65_UP: '65+',
  AGE_RANGE_UNDETERMINED: 'Bilinmiyor',
}
const AGE_ORDER = ['AGE_RANGE_18_24', 'AGE_RANGE_25_34', 'AGE_RANGE_35_44', 'AGE_RANGE_45_54', 'AGE_RANGE_55_64', 'AGE_RANGE_65_UP', 'AGE_RANGE_UNDETERMINED']

const INCOME_RANGE_LABELS: Record<string, string> = {
  INCOME_RANGE_0_50: 'Alt 50%',
  INCOME_RANGE_50_60: '50-60%',
  INCOME_RANGE_60_70: '60-70%',
  INCOME_RANGE_70_80: '70-80%',
  INCOME_RANGE_80_90: '80-90%',
  INCOME_RANGE_90_100: 'Üst 10%',
  INCOME_RANGE_UNDETERMINED: 'Bilinmiyor',
}
const INCOME_ORDER = ['INCOME_RANGE_0_50', 'INCOME_RANGE_50_60', 'INCOME_RANGE_60_70', 'INCOME_RANGE_70_80', 'INCOME_RANGE_80_90', 'INCOME_RANGE_90_100', 'INCOME_RANGE_UNDETERMINED']

function bidModifierDisplay(bm: number | null): string {
  if (bm == null || bm === 0) return ''
  const pct = Math.round((bm - 1) * 100)
  return pct >= 0 ? `+${pct}` : String(pct)
}

/* ── Props ── */

interface Props {
  open: boolean
  onClose: () => void
  entityType: 'campaign' | 'adGroup'
  entityId: string
  campaignId: string
  onSaved: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}

/* ── Helper: build full rows from existing + fill missing ── */

function buildFullRows(
  existing: DemographicCriterion[],
  type: 'GENDER' | 'AGE_RANGE' | 'INCOME_RANGE',
  order: string[],
): LocalRow[] {
  const existingMap = new Map<string, DemographicCriterion>()
  for (const d of existing) {
    if (d.type === type) existingMap.set(d.value, d)
  }

  return order.map(value => {
    const d = existingMap.get(value)
    if (d) {
      return {
        resourceName: d.resourceName,
        value: d.value,
        type,
        enabled: d.status === 'ENABLED' && !d.negative,
        bidModifier: bidModifierDisplay(d.bidModifier),
        originalEnabled: d.status === 'ENABLED' && !d.negative,
        originalBidModifier: bidModifierDisplay(d.bidModifier),
        isNew: false,
      }
    }
    // Not yet created — show as available to add
    return {
      resourceName: '',
      value,
      type,
      enabled: false,
      bidModifier: '',
      originalEnabled: false,
      originalBidModifier: '',
      isNew: true,
    }
  })
}

/* ── Component ── */

export default function DemographicEditor({
  open, onClose, entityType, entityId, campaignId, onSaved, onToast,
}: Props) {
  const [genderRows, setGenderRows] = useState<LocalRow[]>([])
  const [ageRows, setAgeRows] = useState<LocalRow[]>([])
  const [incomeRows, setIncomeRows] = useState<LocalRow[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Load demographics on mount
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    const url = entityType === 'adGroup'
      ? `/api/integrations/google-ads/ad-groups/${entityId}/demographics`
      : `/api/integrations/google-ads/campaigns/${campaignId}/demographics`

    fetch(url, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const demographics: DemographicCriterion[] = data.demographics ?? []
        // Always show ALL possible values — existing ones with their state, missing ones as addable
        setGenderRows(buildFullRows(demographics, 'GENDER', GENDER_ORDER))
        setAgeRows(buildFullRows(demographics, 'AGE_RANGE', AGE_ORDER))
        setIncomeRows(buildFullRows(demographics, 'INCOME_RANGE', INCOME_ORDER))
      })
      .catch(() => setError('Demografi verileri yüklenemedi.'))
      .finally(() => setLoading(false))
  }, [open, entityType, entityId, campaignId])

  const toggleRow = (setter: typeof setGenderRows, index: number) => {
    setter(prev => prev.map((r, i) => i === index ? { ...r, enabled: !r.enabled } : r))
  }

  const updateBidModifier = (setter: typeof setGenderRows, index: number, val: string) => {
    setter(prev => prev.map((r, i) => i === index ? { ...r, bidModifier: val } : r))
  }

  const allRows = [...genderRows, ...ageRows, ...incomeRows]
  const hasChanges = allRows.some(
    r => r.enabled !== r.originalEnabled || r.bidModifier !== r.originalBidModifier
  )

  // Save — handles both create (new rows) and update (existing rows)
  const handleSave = async () => {
    setSaving(true)
    try {
      const changedRows = allRows.filter(
        r => r.enabled !== r.originalEnabled || r.bidModifier !== r.originalBidModifier
      )

      // Separate creates (new rows being enabled) from updates (existing rows)
      const creates = changedRows
        .filter(r => r.isNew && r.enabled)
        .map(r => {
          const create: Record<string, any> = { type: r.type, value: r.value }
          if (r.bidModifier) {
            const pct = parseInt(r.bidModifier || '0', 10)
            create.bidModifier = 1 + pct / 100
          }
          return create
        })

      const updates = changedRows
        .filter(r => !r.isNew)
        .map(r => {
          const update: Record<string, any> = { resourceName: r.resourceName }
          if (r.enabled !== r.originalEnabled) {
            update.status = r.enabled ? 'ENABLED' : 'REMOVED'
          }
          if (r.bidModifier !== r.originalBidModifier) {
            const pct = parseInt(r.bidModifier || '0', 10)
            update.bidModifier = 1 + pct / 100
          }
          return update
        })

      if (creates.length === 0 && updates.length === 0) { onClose(); return }

      const baseUrl = entityType === 'adGroup'
        ? `/api/integrations/google-ads/ad-groups/${entityId}/demographics`
        : `/api/integrations/google-ads/campaigns/${campaignId}/demographics`

      // Run creates and updates in parallel
      const promises: Promise<Response>[] = []

      if (creates.length > 0) {
        promises.push(fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creates }),
        }))
      }

      if (updates.length > 0) {
        promises.push(fetch(baseUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        }))
      }

      const results = await Promise.all(promises)
      for (const res of results) {
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.userMessage || d.error || 'Demografi güncellenemedi')
        }
      }

      onToast(`Demografi ayarları güncellendi (${creates.length} yeni, ${updates.length} güncelleme)`, 'success')
      onSaved()
    } catch (e: any) {
      onToast(e.message || 'Bir hata oluştu', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[55]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer panel */}
      <div className="absolute right-0 inset-y-0 w-full max-w-[500px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Demografiyi Düzenle</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {entityType === 'adGroup' ? 'Reklam grubu' : 'Kampanya'} düzeyinde demografi ayarları
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Demografi verileri yükleniyor...</span>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {!loading && !error && (
            <>
              {/* Info banner when there are new (uncreated) demographics */}
              {allRows.some(r => r.isNew) && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Plus className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700">
                    İşaretlenmemiş kriterler henüz oluşturulmamış. Etkinleştirmek istediğiniz kriterleri
                    işaretleyip kaydedin — Google Ads&apos;e otomatik eklenecektir.
                  </p>
                </div>
              )}

              {/* Gender */}
              <DemographicSection
                title="Cinsiyet"
                icon={<Users className="w-4 h-4" />}
                rows={genderRows}
                labels={GENDER_LABELS}
                onToggle={(i) => toggleRow(setGenderRows, i)}
                onBidChange={(i, v) => updateBidModifier(setGenderRows, i, v)}
              />

              {/* Age Range */}
              <DemographicSection
                title="Yaş Aralığı"
                icon={<Calendar className="w-4 h-4" />}
                rows={ageRows}
                labels={AGE_RANGE_LABELS}
                onToggle={(i) => toggleRow(setAgeRows, i)}
                onBidChange={(i, v) => updateBidModifier(setAgeRows, i, v)}
              />

              {/* Income Range */}
              <DemographicSection
                title="Hane Geliri"
                icon={<Wallet className="w-4 h-4" />}
                rows={incomeRows}
                labels={INCOME_RANGE_LABELS}
                onToggle={(i) => toggleRow(setIncomeRows, i)}
                onBidChange={(i, v) => updateBidModifier(setIncomeRows, i, v)}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── DemographicSection ── */

function DemographicSection({
  title, icon, rows, labels, onToggle, onBidChange,
}: {
  title: string
  icon: React.ReactNode
  rows: LocalRow[]
  labels: Record<string, string>
  onToggle: (index: number) => void
  onBidChange: (index: number, value: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-500">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        {rows.map((row, i) => (
          <div key={row.value} className={`flex items-center gap-3 px-4 py-3 ${row.isNew ? 'bg-gray-50/50' : ''}`}>
            <label className="flex items-center gap-3 flex-1 cursor-pointer">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={() => onToggle(i)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className={`text-sm ${row.enabled ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                {labels[row.value] ?? row.value}
              </span>
              {row.isNew && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">YENİ</span>
              )}
            </label>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-gray-400">Teklif:</span>
              <div className="relative">
                <input
                  type="text"
                  value={row.bidModifier}
                  onChange={e => onBidChange(i, e.target.value)}
                  placeholder="0"
                  disabled={!row.enabled}
                  className="w-16 px-2 py-1 text-xs text-right border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-300"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
