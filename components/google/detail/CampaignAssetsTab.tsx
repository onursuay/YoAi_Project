'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Plus, Trash2, Loader2, X, Pause, Play } from 'lucide-react'
import ViewErrorAlert, { type ViewErrorInfo } from './ViewErrorAlert'

/* ── Types ── */

export interface CampaignAsset {
  id: string
  name: string
  type: string
  fieldType: string
  status: string
  resourceName: string
  source: string
  text?: string
  sitelink?: { linkText: string; description1: string; description2: string; finalUrls: string[] }
  callout?: string
  structuredSnippet?: { header: string; values: string[] }
  image?: { url: string; mimeType: string }
  call?: { countryCode: string; phoneNumber: string }
  promotion?: { target: string; percentOff?: number; moneyOff?: string }
  price?: { type: string; offerings: any[] }
  leadForm?: { businessName: string; callToAction: string; headline: string; description: string }
  businessName?: string
  logoUrl?: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
}

/* ── Constants ── */

const TYPE_LABELS: Record<string, string> = {
  ALL: 'Tümü',
  SITELINK: 'Site bağlantısı',
  CALLOUT: 'Açıklama metni',
  STRUCTURED_SNIPPET: 'Ek açıklamalı snippet',
  TEXT: 'Metin',
  IMAGE: 'Görsel',
  LEAD_FORM: 'Potansiyel müşteri formu',
  CALL: 'Telefon',
  PROMOTION: 'Promosyon',
  PRICE: 'Fiyat',
  BOOK_ON_GOOGLE: 'Google\'da Rezervasyon',
  HOTEL_CALLOUT: 'Otel Açıklama Metni',
  DYNAMIC_EDUCATION: 'Dinamik Eğitim',
  BUSINESS_NAME: 'İşletme adı',
  LOGO: 'İşletme logosu',
}

const SOURCE_LABELS: Record<string, string> = {
  ADVERTISER: 'Reklamveren',
  AUTOMATICALLY_CREATED: 'Otomatik',
  UNKNOWN: 'Bilinmiyor',
}

const STATUS_LABELS: Record<string, string> = {
  ENABLED: 'Uygun',
  PAUSED: 'Duraklatıldı',
  REMOVED: 'Kaldırıldı',
}

const EDITABLE_TYPES = ['SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET']

/* ── Props ── */

interface Props {
  assets: CampaignAsset[]
  isLoading: boolean
  error: ViewErrorInfo | null
  onFetch: () => void
  onAddAsset?: (payload: any) => Promise<void>
  onRemoveAsset?: (assetId: string) => Promise<void>
  onBulkRemove?: (resourceNames: string[]) => Promise<void>
  onUpdateStatus?: (resourceNames: string[], status: 'ENABLED' | 'PAUSED') => Promise<void>
  entityType?: 'campaign' | 'adGroup'
  onToast?: (msg: string, type: 'success' | 'error') => void
}

/* ── Number formatting ── */

function fmtNum(n: number): string {
  if (!n) return '—'
  return n.toLocaleString('tr-TR')
}

function fmtCurrency(n: number): string {
  if (!n) return '—'
  return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(n: number): string {
  if (!n) return '—'
  return `%${n.toFixed(2).replace('.', ',')}`
}

/* ── Component ── */

export default function CampaignAssetsTab({
  assets, isLoading, error, onFetch, onAddAsset, onRemoveAsset,
  onBulkRemove, onUpdateStatus, entityType = 'campaign', onToast,
}: Props) {
  useEffect(() => { onFetch() }, [onFetch])

  const [filterType, setFilterType] = useState('ALL')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [addType, setAddType] = useState<'SITELINK' | 'CALLOUT' | 'STRUCTURED_SNIPPET'>('SITELINK')
  const [addLoading, setAddLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)

  // Sitelink form
  const [slLinkText, setSlLinkText] = useState('')
  const [slDesc1, setSlDesc1] = useState('')
  const [slDesc2, setSlDesc2] = useState('')
  const [slUrl, setSlUrl] = useState('')

  // Callout form
  const [coText, setCoText] = useState('')

  // Structured Snippet form
  const [ssHeader, setSsHeader] = useState('')
  const [ssValues, setSsValues] = useState('')

  // Clear selection when assets change
  useEffect(() => { setSelectedIds(new Set()) }, [assets])

  const typeGroups = useMemo(() => {
    const types = new Set<string>()
    for (const a of assets) types.add(a.type || 'OTHER')
    return Array.from(types)
  }, [assets])

  const filtered = useMemo(() => {
    if (filterType === 'ALL') return assets
    return assets.filter(a => (a.type || 'OTHER') === filterType)
  }, [assets, filterType])

  const selectedAssets = useMemo(() =>
    filtered.filter(a => selectedIds.has(a.id)),
    [filtered, selectedIds]
  )

  const allSelected = filtered.length > 0 && filtered.every(a => selectedIds.has(a.id))
  const someSelected = selectedIds.size > 0

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(a => a.id)))
    }
  }, [allSelected, filtered])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const resetForm = () => {
    setSlLinkText(''); setSlDesc1(''); setSlDesc2(''); setSlUrl('')
    setCoText('')
    setSsHeader(''); setSsValues('')
  }

  const handleAdd = async () => {
    if (!onAddAsset) return
    setAddLoading(true)
    try {
      let payload: any = { type: addType, fieldType: addType }
      if (addType === 'SITELINK') {
        payload = { ...payload, linkText: slLinkText, description1: slDesc1, description2: slDesc2, finalUrl: slUrl }
      } else if (addType === 'CALLOUT') {
        payload = { ...payload, calloutText: coText }
      } else if (addType === 'STRUCTURED_SNIPPET') {
        payload = { ...payload, header: ssHeader, values: ssValues.split(',').map(v => v.trim()).filter(Boolean) }
      }
      await onAddAsset(payload)
      resetForm()
      setShowAddForm(false)
      onFetch()
    } catch (e: any) {
      onToast?.(e.message || 'Öğe oluşturulamadı', 'error')
    } finally {
      setAddLoading(false)
    }
  }

  // Bulk actions
  const handleBulkAction = async (action: 'pause' | 'enable' | 'remove') => {
    if (!selectedAssets.length) return
    setBulkLoading(true)
    try {
      const rns = selectedAssets.map(a => a.resourceName).filter(Boolean)
      if (rns.length === 0) return

      if (action === 'remove') {
        if (onBulkRemove) {
          await onBulkRemove(rns)
        } else if (onRemoveAsset) {
          for (const a of selectedAssets) await onRemoveAsset(a.id)
        }
        onToast?.(`${rns.length} öğe kaldırıldı`, 'success')
      } else if (action === 'pause' && onUpdateStatus) {
        await onUpdateStatus(rns, 'PAUSED')
        onToast?.(`${rns.length} öğe duraklatıldı`, 'success')
      } else if (action === 'enable' && onUpdateStatus) {
        await onUpdateStatus(rns, 'ENABLED')
        onToast?.(`${rns.length} öğe etkinleştirildi`, 'success')
      }
      setSelectedIds(new Set())
      onFetch()
    } catch (e: any) {
      onToast?.(e.message || 'İşlem başarısız', 'error')
    } finally {
      setBulkLoading(false)
    }
  }

  const getAssetDescription = (asset: CampaignAsset): string => {
    if (asset.sitelink) return asset.sitelink.linkText
    if (asset.callout) return asset.callout
    if (asset.structuredSnippet) return `${asset.structuredSnippet.header}: ${asset.structuredSnippet.values.join(', ')}`
    if (asset.text) return asset.text
    if (asset.call) return asset.call.phoneNumber
    if (asset.image) return asset.name || 'Görsel'
    if (asset.promotion) return asset.promotion.target || 'Promosyon'
    if (asset.price) return `Fiyat — ${asset.price.type || ''}`
    if (asset.leadForm) return asset.leadForm.headline || 'Form'
    if (asset.businessName) return asset.businessName
    return asset.name || `#${asset.id}`
  }

  const getAssetDetail = (asset: CampaignAsset): string | null => {
    if (asset.sitelink) {
      const parts = []
      if (asset.sitelink.description1) parts.push(asset.sitelink.description1)
      if (asset.sitelink.description2) parts.push(asset.sitelink.description2)
      if (asset.sitelink.finalUrls.length > 0) parts.push(asset.sitelink.finalUrls[0])
      return parts.join(' · ') || null
    }
    if (asset.call?.countryCode) return `${asset.call.countryCode} ${asset.call.phoneNumber}`
    if (asset.leadForm?.businessName) return `${asset.leadForm.businessName} — ${asset.leadForm.description || ''}`
    if (asset.leadForm?.description) return asset.leadForm.description
    return null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Öğeler yükleniyor...</span>
      </div>
    )
  }

  if (error) return <ViewErrorAlert error={error} />

  return (
    <div>
      {/* ── Filter chips + Add button ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <FilterChip
            label={`Tümü (${assets.length})`}
            active={filterType === 'ALL'}
            onClick={() => setFilterType('ALL')}
          />
          {typeGroups.map(t => (
            <FilterChip
              key={t}
              label={`${TYPE_LABELS[t] || t} (${assets.filter(a => (a.type || 'OTHER') === t).length})`}
              active={filterType === t}
              onClick={() => setFilterType(t)}
            />
          ))}
        </div>
        {onAddAsset && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0 ml-3"
          >
            {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showAddForm ? 'İptal' : 'Öğe Ekle'}
          </button>
        )}
      </div>

      {/* ── Bulk Action Bar ── */}
      {someSelected && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-800">
            {selectedAssets.length} satır seçildi
          </span>
          <div className="h-4 w-px bg-blue-300 mx-1" />
          {(onBulkRemove || onRemoveAsset) && (
            <BulkButton
              icon={<Trash2 className="w-3.5 h-3.5" />}
              label="Kaldır"
              loading={bulkLoading}
              onClick={() => handleBulkAction('remove')}
              danger
            />
          )}
          {onUpdateStatus && (
            <>
              <BulkButton
                icon={<Pause className="w-3.5 h-3.5" />}
                label="Duraklar"
                loading={bulkLoading}
                onClick={() => handleBulkAction('pause')}
              />
              <BulkButton
                icon={<Play className="w-3.5 h-3.5" />}
                label="Etkinleştir"
                loading={bulkLoading}
                onClick={() => handleBulkAction('enable')}
              />
            </>
          )}
        </div>
      )}

      {/* ── Add Form ── */}
      {showAddForm && onAddAsset && (
        <div className="bg-gray-50/80 rounded-lg border border-gray-200/60 p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs font-medium text-gray-500">Tür:</label>
            <select
              value={addType}
              onChange={(e) => { setAddType(e.target.value as any); resetForm() }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
            >
              <option value="SITELINK">Site bağlantısı</option>
              <option value="CALLOUT">Açıklama metni</option>
              <option value="STRUCTURED_SNIPPET">Ek açıklamalı snippet</option>
            </select>
          </div>

          {addType === 'SITELINK' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Link Metni *</label>
                <input type="text" value={slLinkText} onChange={e => setSlLinkText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Hakkımızda" maxLength={25} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Açıklama 1</label>
                  <input type="text" value={slDesc1} onChange={e => setSlDesc1(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Kısa açıklama" maxLength={35} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Açıklama 2</label>
                  <input type="text" value={slDesc2} onChange={e => setSlDesc2(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="İkinci açıklama" maxLength={35} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">URL *</label>
                <input type="url" value={slUrl} onChange={e => setSlUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="https://example.com/sayfa" />
              </div>
            </div>
          )}

          {addType === 'CALLOUT' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Açıklama Metni *</label>
              <input type="text" value={coText} onChange={e => setCoText(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Ücretsiz Kargo" maxLength={25} />
            </div>
          )}

          {addType === 'STRUCTURED_SNIPPET' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Başlık *</label>
                <input type="text" value={ssHeader} onChange={e => setSsHeader(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Markalar" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Değerler * (virgülle ayırın)</label>
                <input type="text" value={ssValues} onChange={e => setSsValues(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Nike, Adidas, Puma" />
              </div>
            </div>
          )}

          <div className="flex justify-end mt-4">
            <button
              onClick={handleAdd}
              disabled={addLoading || (addType === 'SITELINK' && (!slLinkText.trim() || !slUrl.trim())) ||
                (addType === 'CALLOUT' && !coText.trim()) ||
                (addType === 'STRUCTURED_SNIPPET' && (!ssHeader.trim() || !ssValues.trim()))}
              className="px-4 py-2 text-sm font-medium text-white bg-[#2BB673] rounded-lg hover:bg-[#249E63] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
            >
              {addLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Öğe Oluştur
            </button>
          </div>
        </div>
      )}

      {/* ── Assets Table (Google Ads style) ── */}
      {filtered.length === 0 ? (
        <div className="p-6 text-center text-gray-400">
          {assets.length === 0 ? 'Bu kampanyaya bağlı öğe bulunamadı.' : 'Bu filtreye uygun öğe yok.'}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="w-8 px-1 py-2.5" />
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Öğe</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Öğe türü</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Durum</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Ekleyen</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Tıklamalar</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Göstr.</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">TO</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Ort. TBM</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Maliyet</th>
                <th className="w-12 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((asset) => {
                const isSelected = selectedIds.has(asset.id)
                const detail = getAssetDetail(asset)
                return (
                  <tr
                    key={asset.id}
                    className={`hover:bg-gray-50/80 transition-colors ${isSelected ? 'bg-blue-50/60' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(asset.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>

                    {/* Status dot */}
                    <td className="px-1 py-2.5">
                      <StatusDot status={asset.status} />
                    </td>

                    {/* Asset content */}
                    <td className="px-3 py-2.5 max-w-xs">
                      <p className="text-sm text-gray-900 truncate">{getAssetDescription(asset)}</p>
                      {detail && <p className="text-xs text-gray-400 mt-0.5 truncate">{detail}</p>}
                    </td>

                    {/* Type */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-xs text-gray-600">
                        {TYPE_LABELS[asset.type] || asset.type}
                      </span>
                    </td>

                    {/* Status text */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`text-xs font-medium ${
                        asset.status === 'ENABLED' ? 'text-green-700' :
                        asset.status === 'PAUSED' ? 'text-yellow-600' : 'text-gray-500'
                      }`}>
                        {STATUS_LABELS[asset.status] || asset.status}
                      </span>
                    </td>

                    {/* Source */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-xs text-blue-600">
                        {SOURCE_LABELS[asset.source] || (entityType === 'adGroup' ? 'Reklam grubu' : 'Kampanya')}
                      </span>
                    </td>

                    {/* Metrics */}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className="text-xs text-gray-700 tabular-nums">{fmtNum(asset.clicks)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className="text-xs text-gray-700 tabular-nums">{fmtNum(asset.impressions)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className="text-xs text-gray-700 tabular-nums">{fmtPct(asset.ctr)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className="text-xs text-gray-700 tabular-nums">{fmtCurrency(asset.cpc)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className="text-xs text-gray-700 tabular-nums font-medium">{fmtCurrency(asset.cost)}</span>
                    </td>

                    {/* Row action (delete) */}
                    <td className="px-2 py-2.5 text-center">
                      {onRemoveAsset && EDITABLE_TYPES.includes(asset.type) && (
                        <button
                          onClick={() => { onRemoveAsset(asset.id); onFetch() }}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                          title="Kaldır"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ── */

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
        active
          ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}

function StatusDot({ status }: { status: string }) {
  let color = 'bg-green-500'
  if (status === 'PAUSED') color = 'bg-yellow-500'
  else if (status === 'REMOVED') color = 'bg-gray-400'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
}

function BulkButton({ icon, label, loading, onClick, danger }: {
  icon: React.ReactNode
  label: string
  loading: boolean
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
        danger
          ? 'text-red-700 hover:bg-red-100'
          : 'text-blue-700 hover:bg-blue-100'
      }`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  )
}
