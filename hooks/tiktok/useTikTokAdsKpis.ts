'use client'

import { useState, useCallback } from 'react'

export interface TikTokKpisResponse {
  totals: { cost: number; clicks: number; impressions: number; conversions: number; reach: number; avgCtr: number }
  changes: { cost: number; clicks: number; impressions: number; conversions: number; reach: number; ctr: number }
  dates: string[]
  series: { cost: number[]; clicks: number[]; impressions: number[]; conversions: number[]; reach: number[]; ctr: number[] }
}

export function useTikTokAdsKpis() {
  const [kpisData, setKpisData] = useState<TikTokKpisResponse | null>(null)
  const [kpisLoading, setKpisLoading] = useState(false)
  const [kpisError, setKpisError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [datePreset, setDatePreset] = useState<string>('last_30d')

  const fetchKpis = useCallback(async (from?: string, to?: string) => {
    const f = from ?? dateFrom
    const t = to ?? dateTo
    setKpisError(null)
    setKpisLoading(true)
    try {
      const params = new URLSearchParams({ from: f, to: t })
      const res = await fetch(`/api/integrations/tiktok-ads/dashboard-kpis?${params}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.totals && data?.series) {
        setKpisData(data)
      } else {
        setKpisData(null)
        if (!res.ok) setKpisError(data?.error ?? res.statusText)
      }
    } catch (e) {
      setKpisData(null)
      setKpisError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setKpisLoading(false)
    }
  }, [dateFrom, dateTo])

  const setDateRange = useCallback((startDate: string, endDate: string, preset?: string) => {
    setDateFrom(startDate)
    setDateTo(endDate)
    if (preset) setDatePreset(preset)
    setKpisError(null)
  }, [])

  return {
    kpisData, kpisLoading, kpisError, setKpisError,
    dateFrom, dateTo, datePreset,
    fetchKpis, setDateRange,
  }
}
