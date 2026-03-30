'use client'

import { useState, useRef, useCallback } from 'react'
import ToggleSwitch from '@/components/ToggleSwitch'
import { Edit } from 'lucide-react'
import Link from 'next/link'
import type { GoogleCampaign, GoogleAdGroup, GoogleAd } from '@/hooks/google/useGoogleAdsCampaigns'

const localeString = 'tr-TR'
const fmtInt = (n: number) => (Number.isFinite(n) ? n.toLocaleString(localeString) : '0')
const fmtFixed = (n: number, d: number) => (Number.isFinite(n) ? n.toFixed(d) : '0')
const num = (n: number | null | undefined) => (n != null && Number.isFinite(n) ? n : 0)

export interface GoogleTableRealProps {
  columns: { key: string; label: string }[]
  data: any[]
  activeTab: string
  loadingCampaignStatus: Record<string, boolean>
  loadingCampaignBudget: Record<string, boolean>
  loadingAdGroupStatus: Record<string, boolean>
  loadingAdStatus: Record<string, boolean>
  onPublishToggle: (campaign: GoogleCampaign) => void
  onAdGroupToggle: (adGroup: GoogleAdGroup) => void
  onAdToggle: (ad: GoogleAd) => void
  onEditBudget: (campaign: GoogleCampaign) => void
  onEditCampaign?: (campaignId: string) => void
  t: (key: string) => string
  selectedId: string | null
  onSelect: (id: string | null) => void
  selectedIds?: string[]
  onSelectAll?: (ids: string[]) => void
  onDeselectAll?: () => void
  onRowSelect?: (id: string, checked: boolean) => void
}

const rightAlignKeys = ['budget', 'spent', 'impressions', 'clicks', 'ctr', 'cpc', 'roas']
const STANDARD_PILL = 'bg-gray-50 text-gray-600 border-gray-200'
const ACTIVE_PILL = 'bg-green-50 text-green-600 border-green-200'

function getStatusDisplay(status: string, t: (key: string) => string): { label: string; pill: string } {
  switch (status) {
    case 'ENABLED':
      return { label: t('table.statusActive'), pill: ACTIVE_PILL }
    case 'PAUSED':
      return { label: t('table.statusPaused'), pill: STANDARD_PILL }
    case 'REMOVED':
      return { label: t('table.deleted'), pill: STANDARD_PILL }
    default:
      return { label: status || '—', pill: STANDARD_PILL }
  }
}

function getItemId(item: any, activeTab: string): string {
  if (activeTab === 'kampanyalar') return (item as GoogleCampaign).campaignId
  if (activeTab === 'reklam-gruplari') return (item as GoogleAdGroup).adGroupId
  return (item as GoogleAd).adId
}

function getItemName(item: any, activeTab: string): string {
  if (activeTab === 'kampanyalar') return (item as GoogleCampaign).campaignName
  if (activeTab === 'reklam-gruplari') return (item as GoogleAdGroup).adGroupName
  return (item as GoogleAd).adName
}

export default function GoogleTableReal({
  columns,
  data,
  activeTab,
  loadingCampaignStatus,
  loadingCampaignBudget,
  loadingAdGroupStatus,
  loadingAdStatus,
  onPublishToggle,
  onAdGroupToggle,
  onAdToggle,
  onEditBudget,
  onEditCampaign,
  t,
  selectedId,
  onSelect,
  selectedIds,
  onSelectAll,
  onDeselectAll,
  onRowSelect,
}: GoogleTableRealProps) {
  // ── Column resize state ──────────────────────────────────────
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const tableRef = useRef<HTMLTableElement>(null)
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null)

  const onResizeStart = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault()
    if (tableRef.current) {
      const ths = tableRef.current.querySelectorAll('thead th')
      const snapshot: Record<string, number> = {}
      ths.forEach((th) => {
        const key = (th as HTMLElement).dataset.colkey
        if (key) snapshot[key] = (th as HTMLElement).offsetWidth
      })
      setColWidths(prev => Object.keys(prev).length === 0 ? snapshot : prev)
      resizingRef.current = { key: colKey, startX: e.clientX, startW: snapshot[colKey] ?? (e.currentTarget.parentElement?.offsetWidth ?? 120) }
    }

    const onMouseMove = (ev: MouseEvent) => {
      const r = resizingRef.current
      if (!r) return
      const delta = ev.clientX - r.startX
      const newW = Math.max(60, r.startW + delta)
      setColWidths(prev => ({ ...prev, [r.key]: newW }))
    }
    const onMouseUp = () => {
      resizingRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return (
    <div className="overflow-x-auto">
      <table ref={tableRef} className="w-full" style={{ tableLayout: Object.keys(colWidths).length > 0 ? 'fixed' : 'auto' }}>
        <thead>
          <tr className="bg-green-50/60">
            {columns.map((col, idx) => {
              const w = colWidths[col.key]
              return (
                <th
                  key={col.key}
                  data-colkey={col.key}
                  style={w ? { width: w } : undefined}
                  className={`relative px-4 py-3 text-xs font-semibold text-green-800/70 uppercase whitespace-nowrap select-none ${
                    rightAlignKeys.includes(col.key) ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.key === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={data.length > 0 && selectedIds != null && data.every((item: any) => selectedIds.includes(getItemId(item, activeTab)))}
                      onChange={(e) => (e.target.checked ? onSelectAll?.(data.map((item: any) => getItemId(item, activeTab))) : onDeselectAll?.())}
                      disabled={!onSelectAll || !onDeselectAll}
                      className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer disabled:opacity-50"
                    />
                  ) : col.label}
                  {idx < columns.length - 1 && (
                    <span
                      onMouseDown={(e) => onResizeStart(e, col.key)}
                      className="absolute right-0 top-1/4 bottom-1/4 w-[1px] cursor-col-resize bg-gray-300/50 hover:bg-gray-400/70 transition-colors"
                    />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="animate-pulse">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-4">
                    <div className="h-4 bg-gray-200/60 rounded w-full max-w-[80%]" />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            data.map((item: any) => {
              const itemId = getItemId(item, activeTab)
              const isSelected = itemId === selectedId || (selectedIds?.includes(itemId) ?? false)
              const isCampaign = activeTab === 'kampanyalar'
              const isAdGroup = activeTab === 'reklam-gruplari'
              const isLoadingStatus = isCampaign
                ? (loadingCampaignStatus[itemId] || false)
                : isAdGroup
                  ? (loadingAdGroupStatus[itemId] || false)
                  : (loadingAdStatus[itemId] || false)
              const isLoadingBudget = isCampaign ? (loadingCampaignBudget[itemId] || false) : false
              const itemLoading = isLoadingStatus || isLoadingBudget
              const toggleable = item.status === 'ENABLED' || item.status === 'PAUSED'

              return (
                <tr
                  key={itemId}
                  className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                >
                  {columns.map((col) => {
                    // ── Checkbox ────────────────────────────────────────────
                    if (col.key === 'checkbox') {
                      return (
                        <td key={col.key} className="pl-4 pr-1 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => onRowSelect ? onRowSelect(itemId, e.target.checked) : onSelect(isSelected ? null : itemId)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
                          />
                        </td>
                      )
                    }

                    // ── Toggle ──────────────────────────────────────────────
                    if (col.key === 'publish') {
                      const handleToggle = () => {
                        if (isCampaign) onPublishToggle(item)
                        else if (isAdGroup) onAdGroupToggle(item)
                        else onAdToggle(item)
                      }
                      return (
                        <td key={col.key} className="px-3 py-3">
                          <ToggleSwitch
                            enabled={item.publishEnabled}
                            onChange={handleToggle}
                            disabled={itemLoading || !toggleable}
                          />
                        </td>
                      )
                    }

                    // ── Status badge ────────────────────────────────────────
                    if (col.key === 'effectiveStatus') {
                      const { label, pill } = getStatusDisplay(item.status ?? '', t)
                      return (
                        <td key={col.key} className="px-4 py-4 text-sm">
                          <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full border ${pill}`}>
                            {label}
                          </span>
                        </td>
                      )
                    }

                    // ── Name columns ────────────────────────────────────────
                    if (col.key === 'campaign') {
                      const campaign = item as GoogleCampaign
                      return (
                        <td key={col.key} className="px-4 py-4 text-sm">
                          <div className="flex items-center gap-2 group/name">
                            <Link
                              href={`/google-ads/${campaign.campaignId}`}
                              className="text-ui text-gray-900 hover:text-green-700 hover:underline transition-colors"
                            >
                              {campaign.campaignName}
                            </Link>
                            {onEditCampaign && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onEditCampaign(campaign.campaignId) }}
                                className="shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover/name:opacity-100"
                                title="Düzenle"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )
                    }
                    if (col.key === 'adgroup') {
                      const ag = item as GoogleAdGroup
                      return (
                        <td key={col.key} className="px-4 py-4 text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-ui text-gray-900">{ag.adGroupName}</span>
                            <span className="text-xs text-gray-500">{ag.campaignName}</span>
                          </div>
                        </td>
                      )
                    }
                    if (col.key === 'ad') {
                      const ad = item as GoogleAd
                      return (
                        <td key={col.key} className="px-4 py-4 text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-ui text-gray-900">{ad.adName}</span>
                            <span className="text-xs text-gray-500">{ad.adGroupName} · {ad.campaignName}</span>
                          </div>
                        </td>
                      )
                    }

                    // ── Budget (campaigns only) ─────────────────────────────
                    if (col.key === 'budget') {
                      if (!isCampaign) {
                        return <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-400">—</td>
                      }
                      const campaign = item as GoogleCampaign
                      const hasBudget = campaign.budget != null && campaign.budget > 0
                      return (
                        <td key={col.key} className="px-4 py-4 text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-gray-900">
                              {hasBudget
                                ? `${num(campaign.budget).toLocaleString(localeString, { minimumFractionDigits: 2 })} TRY`
                                : '—'}
                            </span>
                            {campaign.isSharedBudget && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full whitespace-nowrap" title="Paylaşılan bütçe">
                                Paylaşılan
                              </span>
                            )}
                            {hasBudget && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onEditBudget(campaign) }}
                                disabled={itemLoading}
                                className="shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title={t('actions.editBudget')}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )
                    }

                    // ── Spent ───────────────────────────────────────────────
                    if (col.key === 'spent') {
                      return (
                        <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">
                          {num(item.amountSpent).toLocaleString(localeString, { minimumFractionDigits: 2 })} TRY
                        </td>
                      )
                    }

                    // ── Impressions ─────────────────────────────────────────
                    if (col.key === 'impressions') {
                      return <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">{fmtInt(item.impressions)}</td>
                    }

                    // ── Clicks ──────────────────────────────────────────────
                    if (col.key === 'clicks') {
                      return <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">{fmtInt(item.clicks)}</td>
                    }

                    // ── CTR ─────────────────────────────────────────────────
                    if (col.key === 'ctr') {
                      return <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">{fmtFixed(item.ctr, 2)}%</td>
                    }

                    // ── CPC ─────────────────────────────────────────────────
                    if (col.key === 'cpc') {
                      return <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">{fmtFixed(item.cpc, 2)} TRY</td>
                    }

                    // ── ROAS ────────────────────────────────────────────────
                    if (col.key === 'roas') {
                      return (
                        <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">
                          {item.roas != null && item.roas > 0 ? `${fmtFixed(item.roas, 1)}x` : '—'}
                        </td>
                      )
                    }

                    return <td key={col.key} className="px-4 py-4 text-sm" />
                  })}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
