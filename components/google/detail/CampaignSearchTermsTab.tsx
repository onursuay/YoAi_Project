'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Ban, Plus, ChevronDown, Check } from 'lucide-react'
import type { SearchTerm } from '@/lib/google-ads/reports'
import ViewErrorAlert, { type ViewErrorInfo } from './ViewErrorAlert'

const localeString = 'tr-TR'
const fmtInt = (n: number) => n.toLocaleString(localeString)
const fmtCurrency = (n: number) => n.toLocaleString(localeString, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_LABEL_KEYS: Record<string, string> = {
  ADDED: 'statusAdded',
  EXCLUDED: 'statusExcluded',
  ADDED_EXCLUDED: 'statusAddedExcluded',
  NONE: 'statusAuto',
  UNKNOWN: 'statusUnknown',
}

const MATCH_TYPE_VALUES = ['BROAD', 'PHRASE', 'EXACT'] as const

type MatchType = 'BROAD' | 'PHRASE' | 'EXACT'

interface Props {
  searchTerms: SearchTerm[]
  isLoading: boolean
  error: ViewErrorInfo | null
  onFetch: () => void
  campaignResourceName?: string
  onExclude?: (searchTerm: string, matchType: MatchType) => Promise<void>
  onAddKeyword?: (terms: { text: string; adGroupResourceName: string; matchType: MatchType }[]) => Promise<void>
  onAddNegativeKeyword?: (terms: { text: string; matchType: MatchType }[]) => Promise<void>
}

export default function CampaignSearchTermsTab({
  searchTerms, isLoading, error, onFetch, campaignResourceName,
  onExclude, onAddKeyword, onAddNegativeKeyword,
}: Props) {
  const t = useTranslations('dashboard.google.detail.searchTerms')
  useEffect(() => { onFetch() }, [onFetch])

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMatchType, setActionMatchType] = useState<MatchType>('BROAD')
  const [negMatchType, setNegMatchType] = useState<MatchType>('EXACT')
  const [successTerms, setSuccessTerms] = useState<Set<string>>(new Set())
  const [excludedTerms, setExcludedTerms] = useState<Set<string>>(new Set())

  // Deselect all when data changes
  useEffect(() => { setSelectedRows(new Set()) }, [searchTerms])

  const allSelected = useMemo(() =>
    searchTerms.length > 0 && selectedRows.size === searchTerms.length,
    [searchTerms.length, selectedRows.size]
  )

  const toggleRow = (idx: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) setSelectedRows(new Set())
    else setSelectedRows(new Set(searchTerms.map((_, i) => i)))
  }

  const selectedTerms = useMemo(() =>
    Array.from(selectedRows).map(i => searchTerms[i]).filter(Boolean),
    [selectedRows, searchTerms]
  )

  const handleAddKeyword = async () => {
    if (!onAddKeyword || selectedTerms.length === 0) return
    setActionLoading('add')
    try {
      const terms = selectedTerms.map(st => ({
        text: st.searchTerm,
        adGroupResourceName: st.adGroupResourceName,
        matchType: actionMatchType,
      }))
      await onAddKeyword(terms)
      setSuccessTerms(prev => {
        const next = new Set(prev)
        selectedTerms.forEach(st => next.add(st.searchTerm))
        return next
      })
      setSelectedRows(new Set())
    } finally {
      setActionLoading(null)
    }
  }

  const handleAddNegativeKeyword = async () => {
    if (!onAddNegativeKeyword || selectedTerms.length === 0) return
    setActionLoading('negative')
    try {
      const terms = selectedTerms.map(st => ({
        text: st.searchTerm,
        matchType: negMatchType,
      }))
      await onAddNegativeKeyword(terms)
      setExcludedTerms(prev => {
        const next = new Set(prev)
        selectedTerms.forEach(st => next.add(st.searchTerm))
        return next
      })
      setSelectedRows(new Set())
    } finally {
      setActionLoading(null)
    }
  }

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">{t('loading')}</div>
  }

  if (error) {
    return <ViewErrorAlert error={error} />
  }

  if (searchTerms.length === 0) {
    return <div className="p-6 text-center text-gray-400">{t('empty')}</div>
  }

  const hasSelection = selectedRows.size > 0

  return (
    <div>
      {/* ── Action Bar ── */}
      {hasSelection && (
        <div className="sticky top-0 z-10 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-blue-800">
            {t('selectedCount', { count: selectedRows.size })}
          </span>
          <div className="h-5 w-px bg-blue-200" />

          {/* Add as Keyword */}
          {onAddKeyword && (
            <div className="flex items-center gap-1.5">
              <select
                value={actionMatchType}
                onChange={(e) => setActionMatchType(e.target.value as MatchType)}
                className="px-2 py-1.5 text-xs border border-blue-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {MATCH_TYPE_VALUES.map(v => <option key={v} value={v}>{t(`matchTypes.${v}`)}</option>)}
              </select>
              <button
                onClick={handleAddKeyword}
                disabled={actionLoading === 'add'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'add' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {t('addAsKeyword')}
              </button>
            </div>
          )}

          {/* Add as Negative Keyword */}
          {onAddNegativeKeyword && (
            <div className="flex items-center gap-1.5">
              <select
                value={negMatchType}
                onChange={(e) => setNegMatchType(e.target.value as MatchType)}
                className="px-2 py-1.5 text-xs border border-red-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-red-400"
              >
                {MATCH_TYPE_VALUES.map(v => <option key={v} value={v}>{t(`matchTypes.${v}`)}</option>)}
              </select>
              <button
                onClick={handleAddNegativeKeyword}
                disabled={actionLoading === 'negative'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'negative' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                {t('addAsNegativeKeyword')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-blue-600 w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colSearchTerm')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colStatus')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colAdGroup')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('colClicks')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('colImpressions')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('colCtr')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('colAvgCpc')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('colCost')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('colConversions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {searchTerms.map((st, i) => {
              const isExcluded = excludedTerms.has(st.searchTerm) || st.status === 'EXCLUDED'
              const isAdded = successTerms.has(st.searchTerm) || st.status === 'ADDED'
              const isSelected = selectedRows.has(i)
              return (
                <tr
                  key={`${st.searchTerm}-${i}`}
                  className={`hover:bg-gray-50 cursor-pointer ${isExcluded ? 'opacity-50' : ''} ${isSelected ? 'bg-blue-50/50' : ''}`}
                  onClick={() => toggleRow(i)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(i)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{st.searchTerm}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {isExcluded ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600">{t('excludedDone')}</span>
                    ) : isAdded ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700">{t('statusAdded')}</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100">{STATUS_LABEL_KEYS[st.status] ? t(STATUS_LABEL_KEYS[st.status]) : st.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{st.adGroupName}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{fmtInt(st.clicks)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{fmtInt(st.impressions)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{(st.ctr * 100).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{fmtCurrency(st.averageCpc)} TRY</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{fmtCurrency(st.cost)} TRY</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{st.conversions > 0 ? fmtInt(st.conversions) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
