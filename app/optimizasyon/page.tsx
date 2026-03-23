'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import Toolbar from '@/components/Toolbar'
import TableShimmer from '@/components/TableShimmer'
import { ToastContainer, type Toast } from '@/components/Toast'
import CampaignCard from '@/components/optimization/CampaignCard'
import DetailPanel from '@/components/optimization/DetailPanel'
import MagicScanResults from '@/components/optimization/MagicScanResults'
import SubscriptionGateModal from '@/components/subscription/SubscriptionGateModal'
import { metaFetch, TOKEN_EXPIRED_EVENT } from '@/lib/meta/clientFetch'
import type { OptimizationCampaign, MagicScanResult } from '@/lib/meta/optimization/types'
import { useSubscription } from '@/components/providers/SubscriptionProvider'

export default function OptimizasyonPage() {
  const t = useTranslations('dashboard.optimizasyon')
  const { canUseOptimizationAI, canDoAiScan, recordAiScan, aiScanDailyLimit, aiScanUsedToday } = useSubscription()

  // Subscription gate state
  const [showGateModal, setShowGateModal] = useState(false)
  const [gateType, setGateType] = useState<'subscription' | 'aiLimit'>('subscription')

  // Data state
  const [campaigns, setCampaigns] = useState<OptimizationCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastGoodRef = useRef<OptimizationCampaign[]>([])

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState('last_30d')
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Magic Scan state
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [scanPhase, setScanPhase] = useState(0)
  const [scanResults, setScanResults] = useState<Record<string, MagicScanResult>>({})

  // Connection state
  const [adAccountName, setAdAccountName] = useState<string | null>(null)
  const [tokenExpired, setTokenExpired] = useState(false)

  // ── Toast helpers ──────────────────────────────────────────────────────
  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = `toast_${Date.now()}`
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Fetch scored campaigns ─────────────────────────────────────────────
  const fetchCampaigns = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    setError(null)

    try {
      const params = new URLSearchParams({
        showInactive: showInactive.toString(),
      })
      if (customSince && customUntil) {
        params.set('since', customSince)
        params.set('until', customUntil)
      } else {
        params.set('datePreset', datePreset)
      }

      const response = await metaFetch(`/api/meta/optimization/score?${params}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          setTokenExpired(true)
          return
        }
        throw new Error(data.message || 'Failed to fetch')
      }

      if (data.ok) {
        setCampaigns(data.data || [])
        lastGoodRef.current = data.data || []
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      // Keep last good data visible
      if (lastGoodRef.current.length > 0) {
        setCampaigns(lastGoodRef.current)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [datePreset, customSince, customUntil, showInactive])

  // ── Check connection + initial fetch ───────────────────────────────────
  useEffect(() => {
    async function checkConnection() {
      try {
        const res = await fetch('/api/meta/status')
        const data = await res.json()
        if (data.connected && data.adAccountName) {
          setAdAccountName(data.adAccountName)
          fetchCampaigns()
        } else {
          setLoading(false)
        }
      } catch {
        setLoading(false)
      }
    }
    checkConnection()
  }, [fetchCampaigns])

  // ── Re-fetch on filter changes ─────────────────────────────────────────
  useEffect(() => {
    if (adAccountName) {
      fetchCampaigns(true)
    }
  }, [datePreset, showInactive, adAccountName, fetchCampaigns])

  // ── Token expiry listener ──────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setTokenExpired(true)
    window.addEventListener(TOKEN_EXPIRED_EVENT, handler)
    return () => window.removeEventListener(TOKEN_EXPIRED_EVENT, handler)
  }, [])

  // ── Date change handler ────────────────────────────────────────────────
  const handleDateChange = useCallback((start: string, end: string, preset?: string) => {
    if (preset === 'custom') {
      setCustomSince(start)
      setCustomUntil(end)
      setDatePreset('custom')
    } else if (preset) {
      setCustomSince('')
      setCustomUntil('')
      setDatePreset(preset)
    }
  }, [])

  // ── Magic Scan handler ─────────────────────────────────────────────────
  const handleMagicScan = useCallback(async (campaign: OptimizationCampaign, useAI: boolean) => {
    // Gate: AI Scan requires paid subscription
    if (useAI && !canUseOptimizationAI) {
      setGateType('subscription')
      setShowGateModal(true)
      return
    }
    // Gate: AI Scan daily limit
    if (useAI && !canDoAiScan) {
      setGateType('aiLimit')
      setShowGateModal(true)
      return
    }
    // Record AI scan usage
    if (useAI) {
      recordAiScan()
    }

    setScanningId(campaign.id)
    setScanPhase(0)

    const phaseInterval = setInterval(() => {
      setScanPhase(prev => (prev + 1) % 4)
    }, 800)

    try {
      const locale = document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || 'tr'
      const response = await metaFetch('/api/meta/optimization/magic-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign, locale, useAI }),
      })
      const data = await response.json()
      if (data.ok) {
        setScanResults(prev => ({ ...prev, [campaign.id]: data.data }))
        setExpandedId(campaign.id)
      } else {
        addToast(data.message || 'Scan failed', 'error')
      }
    } catch {
      addToast('Scan failed', 'error')
    } finally {
      clearInterval(phaseInterval)
      setScanningId(null)
      setScanPhase(0)
    }
  }, [addToast, canUseOptimizationAI, canDoAiScan, recordAiScan])

  // ── Filter campaigns by search ─────────────────────────────────────────
  const filteredCampaigns = searchQuery
    ? campaigns.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : campaigns

  // ── Not connected state ────────────────────────────────────────────────
  if (!loading && !adAccountName) {
    return (
      <>
        <Topbar title={t('title')} description={t('description')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-sm">{t('connectPrompt')}</p>
            <a href="/entegrasyon" className="mt-3 inline-block px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
              Entegrasyon
            </a>
          </div>
        </div>
      </>
    )
  }

  // ── Token expired state ────────────────────────────────────────────────
  if (tokenExpired) {
    return (
      <>
        <Topbar title={t('title')} description={t('description')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 text-sm font-medium">Token expired</p>
            <a href="/entegrasyon" className="mt-3 inline-block px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
              Yeniden Bağlan
            </a>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        title={t('title')}
        description={t('description')}
        adAccountName={adAccountName || undefined}
      />

      <Toolbar
        onDateChange={handleDateChange}
        onShowInactiveChange={setShowInactive}
        onSearch={setSearchQuery}
        showInactive={showInactive}
        searchQuery={searchQuery}
      />

      <div className="flex-1 overflow-auto p-6">
        <TableShimmer isRefreshing={refreshing}>
          {/* Loading state */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/4" />
                    </div>
                    <div className="hidden sm:flex gap-6">
                      <div className="space-y-1">
                        <div className="h-3 bg-gray-100 rounded w-12" />
                        <div className="h-4 bg-gray-200 rounded w-16" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 bg-gray-100 rounded w-12" />
                        <div className="h-4 bg-gray-200 rounded w-16" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && campaigns.length === 0 && (
            <div className="text-center py-12">
              <p className="text-red-500 text-sm">{error}</p>
              <button
                onClick={() => fetchCampaigns()}
                className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
              >
                Tekrar Dene
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredCampaigns.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">
                {searchQuery ? t('noData') : t('noActiveData')}
              </p>
            </div>
          )}

          {/* Campaign list */}
          {!loading && filteredCampaigns.length > 0 && (
            <div className="space-y-3">
              {filteredCampaigns.map(campaign => (
                <div key={campaign.id}>
                  <CampaignCard
                    campaign={campaign}
                    expanded={expandedId === campaign.id}
                    onToggle={() => setExpandedId(expandedId === campaign.id ? null : campaign.id)}
                    onMagicScan={(useAI) => handleMagicScan(campaign, useAI)}
                    scanning={scanningId === campaign.id}
                    scanPhase={scanPhase}
                  />
                  {expandedId === campaign.id && scanResults[campaign.id] ? (
                    <MagicScanResults
                      result={scanResults[campaign.id]}
                      onSuccess={(msg) => {
                        addToast(msg, 'success')
                        setTimeout(() => fetchCampaigns(true), 1500)
                      }}
                      onError={(msg) => addToast(msg, 'error')}
                      onClose={() => setScanResults(prev => {
                        const next = { ...prev }
                        delete next[campaign.id]
                        return next
                      })}
                    />
                  ) : expandedId === campaign.id ? (
                    <DetailPanel
                      campaign={campaign}
                      onSuccess={(msg) => {
                        addToast(msg, 'success')
                        setTimeout(() => fetchCampaigns(true), 1500)
                      }}
                      onError={(msg) => addToast(msg, 'error')}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </TableShimmer>
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
      {showGateModal && (
        <SubscriptionGateModal
          type={gateType}
          onClose={() => setShowGateModal(false)}
        />
      )}
    </>
  )
}
