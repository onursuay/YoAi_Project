'use client'

import { useState, useRef, useCallback } from 'react'
import ToggleSwitch from '@/components/ToggleSwitch'
import { Lightbulb, Info, Edit } from 'lucide-react'

export interface MetaTableRealProps {
  columns: { key: string; label: string }[]
  data: any[]
  activeTab: string
  getRecommendationCount: (itemId: string) => number
  loadingCampaignStatus: Record<string, boolean>
  loadingAdSetStatus: Record<string, boolean>
  loadingAdStatus: Record<string, boolean>
  loadingCampaignBudget: Record<string, boolean>
  onPublishToggle: (type: 'campaign' | 'adset' | 'ad', id: string, status: string) => void
  displayOptScore: number | null
  performanceRecommendations: { summary?: { byCampaignId?: Record<string, number> } } | null
  recommendationsEnabled: boolean
  recsLoading: boolean
  onRecommendationClick: (item: any) => void
  t: (key: string) => string
  onEditBudgetAdset: (adset: any) => void
  onEditCampaignBudgetClick: (campaign: any) => void
  localeString: string
  num: (n: number) => number
  fmtInt: (n: number) => string
  fmtFixed: (n: number, d: number) => string
  isStatusToggleable: (status: string) => boolean
  selectedCampaignId: string | null
  onCampaignSelect: (id: string | null) => void
  selectedAdsetId: string | null
  onAdsetSelect: (id: string | null) => void
  selectedAdId: string | null
  onAdSelect: (id: string | null) => void
  onDuplicate: (type: 'campaign' | 'adset' | 'ad', id: string) => void
  onDelete: (type: 'campaign' | 'adset' | 'ad', item: any) => void
  onEdit: (type: 'campaign' | 'adset' | 'ad', item: any) => void
}

export default function MetaTableReal({
  columns,
  data,
  activeTab,
  getRecommendationCount,
  loadingCampaignStatus,
  loadingAdSetStatus,
  loadingAdStatus,
  onPublishToggle,
  performanceRecommendations,
  recommendationsEnabled,
  recsLoading,
  onRecommendationClick,
  t,
  onEditBudgetAdset,
  onEditCampaignBudgetClick,
  localeString,
  num,
  fmtInt,
  fmtFixed,
  isStatusToggleable,
  selectedCampaignId,
  onCampaignSelect,
  selectedAdsetId,
  onAdsetSelect,
  selectedAdId,
  onAdSelect,
}: MetaTableRealProps) {
  const rightAlignKeys = ['budget', 'spent', 'impressions', 'clicks', 'ctr', 'cpc']

  // ── Column resize state ──────────────────────────────────────
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const tableRef = useRef<HTMLTableElement>(null)
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null)

  const onResizeStart = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault()
    // Capture ALL column widths on first drag so tableLayout:fixed doesn't collapse them
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

  const STANDARD_PILL = 'bg-gray-50 text-gray-600 border-gray-200'
  const ACTIVE_PILL = 'bg-green-50 text-green-600 border-green-200'

  const getStatusDisplay = (effStatus: string, tab: string, tr: (key: string) => string): { label: string; pill: string } => {
    // Map Meta effective_status to user-friendly labels
    switch (effStatus) {
      case 'ACTIVE':
        return { label: tr('table.statusActive'), pill: ACTIVE_PILL }
      case 'PENDING_REVIEW':
      case 'PREAPPROVED':
        return { label: tr('table.statusInReview'), pill: STANDARD_PILL }
      case 'IN_PROCESS':
      case 'PROCESSING':
        return { label: tr('table.statusProcessing'), pill: STANDARD_PILL }
      case 'WITH_ISSUES':
        return { label: tr('table.statusError'), pill: STANDARD_PILL }
      case 'DISAPPROVED':
        return { label: tr('table.statusError'), pill: STANDARD_PILL }
      case 'PAUSED':
        return { label: tr('table.statusPaused'), pill: STANDARD_PILL }
      case 'CAMPAIGN_PAUSED':
        return { label: tab === 'kampanyalar' ? tr('table.statusPaused') : tr('table.statusCampaignOff'), pill: STANDARD_PILL }
      case 'ADSET_PAUSED':
        return { label: tab === 'reklam-setleri' ? tr('table.statusPaused') : tr('table.statusAdsetOff'), pill: STANDARD_PILL }
      case 'ARCHIVED':
        return { label: tr('table.statusCompleted'), pill: STANDARD_PILL }
      case 'DELETED':
        return { label: tr('table.deleted'), pill: STANDARD_PILL }
      case 'LEARNING':
        return { label: tr('table.statusLearning'), pill: STANDARD_PILL }
      case 'LEARNING_LIMITED':
        return { label: tr('table.statusLimited'), pill: STANDARD_PILL }
      case 'NOT_DELIVERING':
        return { label: tr('table.statusNotDelivering'), pill: STANDARD_PILL }
      case 'PENDING':
      case 'SCHEDULED':
        return { label: tr('table.statusScheduled'), pill: STANDARD_PILL }
      default:
        return { label: effStatus || '—', pill: STANDARD_PILL }
    }
  }

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
                    <input type="checkbox" disabled className="w-4 h-4 rounded border-gray-300 accent-blue-600 opacity-50" />
                  ) : col.label}
                  {/* Resize handle between columns */}
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
              const recCount = getRecommendationCount(item.id)
              const isSelectedRow =
                (activeTab === 'kampanyalar' && item.id === selectedCampaignId) ||
                (activeTab === 'reklam-setleri' && item.id === selectedAdsetId) ||
                (activeTab === 'reklamlar' && item.id === selectedAdId)
              return (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 ${isSelectedRow ? 'bg-blue-50' : ''}`}
                >
                  {columns.map((col) => {
                    // ── Checkbox (seçim) ─────────────────────────────────────
                    if (col.key === 'checkbox') {
                      const selectHandler = activeTab === 'kampanyalar' ? onCampaignSelect
                        : activeTab === 'reklam-setleri' ? onAdsetSelect : onAdSelect
                      const selectedId = activeTab === 'kampanyalar' ? selectedCampaignId
                        : activeTab === 'reklam-setleri' ? selectedAdsetId : selectedAdId
                      const isSelected = item.id === selectedId
                      return (
                        <td key={col.key} className="pl-4 pr-1 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => selectHandler(isSelected ? null : item.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
                          />
                        </td>
                      )
                    }

                    // ── Toggle (Durum) ───────────────────────────────────────
                    if (col.key === 'publish') {
                      const status = item.status ?? ''
                      const toggleable = isStatusToggleable(status)
                      const checked = status === 'ACTIVE'

                      const loadingMap = activeTab === 'kampanyalar' ? loadingCampaignStatus
                        : activeTab === 'reklam-setleri' ? loadingAdSetStatus : loadingAdStatus
                      const isLoading = loadingMap[item.id] || false

                      const toggleType = activeTab === 'kampanyalar' ? 'campaign' as const
                        : activeTab === 'reklam-setleri' ? 'adset' as const : 'ad' as const

                      return (
                        <td key={col.key} className="px-3 py-3">
                          <ToggleSwitch enabled={checked} onChange={() => onPublishToggle(toggleType, item.id, item.status)} disabled={isLoading || !toggleable} />
                        </td>
                      )
                    }

                    // ── Tavsiyeler ───────────────────────────────────────────
                    if (col.key === 'recommendations' && recommendationsEnabled) {
                      const perfRecCount = performanceRecommendations?.summary?.byCampaignId?.[item.id] || 0
                      const totalCount = perfRecCount > 0 ? perfRecCount : recCount
                      return (
                        <td key={col.key} className="px-4 py-4 text-sm">
                          {recsLoading && totalCount === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : totalCount === 0 ? (
                            <span className="text-gray-400">{t('recommendations.none')}</span>
                          ) : (
                            <button
                              onClick={() => onRecommendationClick(item)}
                              className="inline-flex items-center gap-1.5 text-green-600 hover:text-green-700 transition-colors"
                            >
                              <Lightbulb className="w-4 h-4" />
                              <span className="text-sm font-medium">{totalCount}</span>
                              <span className="text-caption text-gray-500">tavsiye</span>
                            </button>
                          )}
                        </td>
                      )
                    }

                    // ── Etkinlik (effective status) ──────────────────────────
                    if (col.key === 'effectiveStatus') {
                      const effStatus = item.effective_status || item.status || ''
                      const { label: statusLabel, pill } = getStatusDisplay(effStatus, activeTab, t)
                      return (
                        <td key={col.key} className="px-4 py-4 text-sm">
                          <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full border ${pill}`}>
                            {statusLabel}
                          </span>
                        </td>
                      )
                    }

                    // ── İsim sütunları (sadece metin) ────────────────────────
                    if (col.key === 'campaign' || col.key === 'adset' || col.key === 'ad') {
                      return (
                        <td key={col.key} className="px-4 py-4 text-sm">
                          <span className="text-ui text-gray-900">{item.name}</span>
                        </td>
                      )
                    }

                    // ── Bütçe ────────────────────────────────────────────────
                    if (col.key === 'budget') {
                      if (activeTab === 'reklam-setleri') {
                        const hasAdsetBudget = item.daily_budget || item.lifetime_budget
                        if (hasAdsetBudget) {
                          const budgetValue = item.daily_budget || item.lifetime_budget || 0
                          return (
                            <td key={col.key} className="px-4 py-4 text-sm">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-gray-900">{num(budgetValue).toLocaleString(localeString, { minimumFractionDigits: 2 })} TRY</span>
                                <button onClick={(e) => { e.stopPropagation(); onEditBudgetAdset(item) }} className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title={t('actions.editBudget')}>
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )
                        }
                        return (
                          <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-500">
                            <div className="flex items-center justify-end gap-1.5">
                              <span>{t('labels.campaignBudgetCbo')}</span>
                              <div className="group relative">
                                <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                                <div className="absolute right-0 top-6 w-48 p-2 bg-gray-900 text-white text-caption rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                  {t('tooltips.campaignBudgetCbo')}
                                </div>
                              </div>
                            </div>
                          </td>
                        )
                      }
                      if (activeTab === 'kampanyalar') {
                        const hasBudget = item.budget !== null && item.budget !== undefined && item.budget > 0
                        return (
                          <td key={col.key} className="px-4 py-4 text-sm">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-gray-900">{hasBudget ? `${num(item.budget).toLocaleString(localeString, { minimumFractionDigits: 2 })} TRY` : '-'}</span>
                              {hasBudget && (
                                <button onClick={(e) => { e.stopPropagation(); onEditCampaignBudgetClick(item) }} className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title={t('actions.editBudget')}>
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )
                      }
                      return <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">-</td>
                    }

                    // ── Diğer sayısal sütunlar ───────────────────────────────
                    if (col.key === 'spent') {
                      return (
                        <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">
                          {num(item.spent).toLocaleString(localeString, { minimumFractionDigits: 2 })} TRY
                        </td>
                      )
                    }
                    if (col.key === 'impressions') {
                      return <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">{fmtInt(item.impressions)}</td>
                    }
                    if (col.key === 'clicks') {
                      return <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">{fmtInt(item.clicks)}</td>
                    }
                    if (col.key === 'ctr') {
                      return <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">{fmtFixed(item.ctr, 2)}%</td>
                    }
                    if (col.key === 'cpc') {
                      return <td key={col.key} className="px-4 py-4 text-sm text-right text-gray-900">{fmtFixed(item.cpc, 2)} TRY</td>
                    }

                    return <td key={col.key} className="px-4 py-4 text-sm"></td>
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
