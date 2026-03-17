'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/lib/routes'
import Topbar from '@/components/Topbar'
import { Puzzle, AlertCircle, RefreshCw } from 'lucide-react'

interface PlatformStatus {
  connected: boolean
  accountName?: string
  accountId?: string
  hasSelectedAccount?: boolean
}

interface GoogleManagerOrAccount {
  customerId: string
  name: string
  isManager: boolean
}

function EntegrasyonContent() {
  const t = useTranslations('dashboard.entegrasyon')
  const searchParams = useSearchParams()
  const router = useRouter()
  const [metaStatus, setMetaStatus] = useState<PlatformStatus>({ connected: false })
  const [googleStatus, setGoogleStatus] = useState<PlatformStatus>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)
  const [googleConfigMissing, setGoogleConfigMissing] = useState(false)
  const [googleAccountModalOpen, setGoogleAccountModalOpen] = useState(false)
  const [googleManagers, setGoogleManagers] = useState<GoogleManagerOrAccount[]>([])
  const [googleManagersLoading, setGoogleManagersLoading] = useState(false)
  const [googleChildren, setGoogleChildren] = useState<GoogleManagerOrAccount[]>([])
  const [googleChildrenLoading, setGoogleChildrenLoading] = useState(false)
  const [googleAccountStep, setGoogleAccountStep] = useState<'managers' | 'children'>('managers')
  const [selectedGoogleManagerId, setSelectedGoogleManagerId] = useState<string | null>(null)
  const [googleSelectLoading, setGoogleSelectLoading] = useState(false)
  const [googleAccountsError, setGoogleAccountsError] = useState<string | null>(null)

  useEffect(() => {
    const metaParam = searchParams.get('meta')
    const googleParam = searchParams.get('google')
    if (metaParam === 'connected' || metaParam === 'error') {
      window.history.replaceState({}, '', '/dashboard/entegrasyon')
    }
    if (googleParam === 'config_missing') {
      setGoogleConfigMissing(true)
      window.history.replaceState({}, '', '/dashboard/entegrasyon')
    } else if (googleParam === 'connected' || googleParam === 'error') {
      setGoogleConfigMissing(false)
      window.history.replaceState({}, '', '/dashboard/entegrasyon')
    }
    let cancelled = false
    async function load() {
      try {
        // Bootstrap session_id before any OAuth flow (credentials required for cookie)
        await fetch('/api/session', { credentials: 'include' })
        const [metaRes, googleRes] = await Promise.all([
          fetch('/api/meta/status', { credentials: 'include' }),
          fetch('/api/google/status', { credentials: 'include' }),
        ])
        if (!cancelled && metaRes.ok) {
          const data = await metaRes.json()
          setMetaStatus({
            connected: data.connected,
            accountName: data.adAccountName,
            accountId: data.adAccountId,
          })
        }
        if (!cancelled && googleRes.ok) {
          const data = await googleRes.json().catch(() => ({}))
          setGoogleStatus({
            connected: Boolean(data?.connected),
            accountName: data?.accountName ?? undefined,
            accountId: data?.accountId ?? undefined,
            hasSelectedAccount: Boolean(data?.hasSelectedAccount ?? data?.accountId),
          })
        }
      } catch (error) {
        if (!cancelled) console.error('Failed to check connection status:', error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [searchParams])

  const handleMetaToggle = async (enable: boolean) => {
    if (enable) {
      router.push('/connect/meta')
    } else {
      if (confirm(t('meta.disconnect'))) {
        await fetch('/api/meta/disconnect', { method: 'POST' })
        setMetaStatus({ connected: false })
      }
    }
  }

  const handleChangeAccount = () => {
    router.push('/connect/meta')
  }

  const handleGoogleConnect = () => {
    window.location.href = '/api/integrations/google-ads/start'
  }

  const openGoogleAccountModal = async () => {
    setGoogleAccountModalOpen(true)
    setGoogleAccountsError(null)
    setGoogleManagers([])
    setGoogleChildren([])
    setGoogleAccountStep('managers')
    setSelectedGoogleManagerId(null)
    setGoogleManagersLoading(true)
    try {
      const res = await fetch('/api/integrations/google-ads/accounts')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGoogleAccountsError(data?.message || data?.error || 'Failed to load accounts')
        return
      }
      setGoogleManagers(data.customers || [])
      if (!(data.customers?.length > 0)) {
        setGoogleAccountsError(t('google.noAccounts'))
      }
    } catch (e) {
      setGoogleAccountsError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setGoogleManagersLoading(false)
    }
  }

  const selectGoogleAccount = async (loginCustomerId: string, customerId: string, customerName?: string) => {
    setGoogleSelectLoading(true)
    setGoogleAccountsError(null)
    try {
      const res = await fetch('/api/integrations/google-ads/select-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginCustomerId, customerId, customerName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGoogleAccountsError(data?.message || data?.error || 'Failed to select account')
        return
      }
      setGoogleStatus({
        connected: true,
        accountId: data.customerId,
        accountName: data.customerName ?? data.descriptiveName,
        hasSelectedAccount: true,
      })
      setGoogleAccountModalOpen(false)
      setGoogleAccountStep('managers')
      setSelectedGoogleManagerId(null)
    } catch (e) {
      setGoogleAccountsError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setGoogleSelectLoading(false)
    }
  }

  const onGoogleManagerOrAccountClick = async (item: GoogleManagerOrAccount) => {
    if (item.isManager) {
      setGoogleAccountsError(null)
      setGoogleChildren([])
      setSelectedGoogleManagerId(item.customerId)
      setGoogleChildrenLoading(true)
      try {
        const res = await fetch(
          `/api/integrations/google-ads/children?loginCustomerId=${encodeURIComponent(item.customerId)}`
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setGoogleAccountsError(data?.message || data?.error || 'Failed to load child accounts')
          return
        }
        setGoogleChildren(data.children || [])
        if (!(data.children?.length > 0)) setGoogleAccountsError(t('google.noChildren'))
        setGoogleAccountStep('children')
      } catch (e) {
        setGoogleAccountsError(e instanceof Error ? e.message : 'Network error')
      } finally {
        setGoogleChildrenLoading(false)
      }
    } else {
      await selectGoogleAccount(item.customerId, item.customerId, item.name)
    }
  }

  const onGoogleChildClick = (child: GoogleManagerOrAccount) => {
    if (selectedGoogleManagerId) selectGoogleAccount(selectedGoogleManagerId, child.customerId, child.name)
  }

  const backToGoogleManagers = () => {
    setGoogleAccountStep('managers')
    setSelectedGoogleManagerId(null)
    setGoogleChildren([])
    setGoogleAccountsError(null)
  }

  return (
    <>
      <Topbar 
        title={t('title')} 
        description={t('description')}
      />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Puzzle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  {t('intro.title')}
                </h2>
                <p className="text-gray-600">
                  {t('intro.content')}
                </p>
              </div>
            </div>
          </div>

          {googleConfigMissing && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
              {t('google.configMissing')}
            </div>
          )}

          {/* Reklam Platformları */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('adPlatforms')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Meta Ads */}
              <div className={`bg-white rounded-xl border-2 cardPad transition-all ${
                metaStatus.connected ? 'border-primary' : 'border-gray-200'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-transparent flex items-center justify-center">
                      <img src="/integration-icons/meta.svg" alt="" className="h-6 w-6 object-contain" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{t('meta.name')}</h4>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                        metaStatus.connected ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>
                        {metaStatus.connected ? t('meta.connected') : t('meta.notConnected')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleMetaToggle(!metaStatus.connected)}
                    disabled={isLoading}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${metaStatus.connected ? 'bg-green-500' : 'bg-gray-300'}
                      ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${metaStatus.connected ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>

                {metaStatus.connected && metaStatus.accountName && (
                  <div className="mb-3 p-3 bg-green-50 rounded-lg">
                    <p className="text-caption text-green-900 font-medium mb-1">{t('meta.account')}</p>
                    <p className="text-sm text-green-800">{metaStatus.accountName}</p>
                  </div>
                )}

                <button
                  onClick={() => metaStatus.connected ? handleChangeAccount() : handleMetaToggle(true)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    metaStatus.connected 
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                >
                  {metaStatus.connected ? (
                    <RefreshCw className="w-4 h-4" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  {metaStatus.connected ? t('meta.changeAccount') : t('meta.connectAccount')}
                </button>
              </div>

              {/* Google Ads */}
              <div className={`bg-white rounded-xl border-2 cardPad transition-all ${
                googleStatus.connected ? 'border-primary' : 'border-gray-200'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-transparent flex items-center justify-center">
                      <img src="/integration-icons/google-ads.svg" alt="" className="h-6 w-6 object-contain" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{t('google.name')}</h4>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                        googleStatus.connected ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>
                        {googleStatus.connected ? t('google.connected') : t('google.notConnected')}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (googleStatus.connected) {
                        if (confirm(t('google.disconnect'))) {
                          try {
                            await fetch('/api/integrations/google-ads/disconnect', { method: 'POST' })
                            setGoogleStatus({ connected: false })
                          } catch (e) {
                            console.error('Google Ads disconnect failed:', e)
                          }
                        }
                      } else {
                        handleGoogleConnect()
                      }
                    }}
                    disabled={isLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      googleStatus.connected ? 'bg-green-500' : 'bg-gray-300'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      googleStatus.connected ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {googleStatus.connected && googleStatus.hasSelectedAccount && (googleStatus.accountName || googleStatus.accountId) && (
                  <div className="mb-3 p-3 bg-green-50 rounded-lg">
                    <p className="text-caption text-green-900 font-medium mb-1">{t('google.account')}</p>
                    <p className="text-sm text-green-800">{googleStatus.accountName || googleStatus.accountId}</p>
                  </div>
                )}

                {googleStatus.connected && googleStatus.hasSelectedAccount && (
                  <button
                    onClick={openGoogleAccountModal}
                    disabled={isLoading}
                    type="button"
                    className="w-full flex items-center justify-center gap-2 btn-h-sm px-4 rounded-lg font-medium text-ui bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('google.changeAccount')}
                  </button>
                )}

                {googleStatus.connected && !googleStatus.hasSelectedAccount && (
                  <button
                    onClick={openGoogleAccountModal}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 btn-h-sm px-4 rounded-lg font-medium text-ui bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    {t('google.selectAccount')}
                  </button>
                )}

                {!googleStatus.connected && (
                  <button
                    onClick={handleGoogleConnect}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-primary text-white hover:bg-primary/90 transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {t('google.connectButton')}
                  </button>
                )}
              </div>

              {/* TikTok Ads */}
              <div className="bg-white rounded-xl border-2 border-gray-200 cardPad opacity-50">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-transparent flex items-center justify-center">
                      <img src="/integration-icons/tiktok.svg" alt="" className="h-6 w-6 object-contain" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{t('tiktok.name')}</h4>
                      <p className="text-sm text-gray-500">{t('tiktok.comingSoon')}</p>
                    </div>
                  </div>
                  <button disabled className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                  </button>
                </div>
                <div className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-400 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>{t('tiktok.comingSoon')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Google Ads account selection modal */}
          {googleAccountModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !googleSelectLoading && setGoogleAccountModalOpen(false)}>
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">{t('google.selectAccountTitle')}</h3>
                  <button
                    type="button"
                    onClick={() => !googleSelectLoading && setGoogleAccountModalOpen(false)}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
                    disabled={googleSelectLoading}
                  >
                    <span className="sr-only">Close</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                  {googleAccountStep === 'children' && (
                    <button type="button" onClick={backToGoogleManagers} className="mb-3 text-sm text-primary hover:underline flex items-center gap-1">
                      ← {t('google.selectAccountTitle')}
                    </button>
                  )}
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    {googleAccountStep === 'managers' ? t('google.selectAccountTitle') : t('google.selectChildAccountTitle')}
                  </h4>
                  {(googleAccountStep === 'managers' ? googleManagersLoading : googleChildrenLoading) && (
                    <p className="text-gray-600 text-center py-4">{t('google.selecting')}</p>
                  )}
                  {googleAccountsError && (
                    <p className="text-red-600 text-sm py-2">{googleAccountsError}</p>
                  )}
                  {googleAccountStep === 'managers' && !googleManagersLoading && googleManagers.length > 0 && (
                    <ul className="space-y-2">
                      {googleManagers.map((m) => (
                        <li key={m.customerId} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <span className="font-medium text-gray-900">
                            {m.name} (ID: {m.customerId}){' '}
                            <span className={`inline-flex items-center px-2 py-0.5 text-caption font-medium rounded ${m.isManager ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                              {m.isManager ? t('google.managerBadge') : t('google.accountBadge')}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => onGoogleManagerOrAccountClick(m)}
                            disabled={googleSelectLoading}
                            className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                          >
                            {googleSelectLoading ? t('google.selecting') : t('google.selectLabel')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {googleAccountStep === 'managers' && !googleManagersLoading && !googleAccountsError && googleManagers.length === 0 && (
                    <p className="text-gray-600 text-sm">{t('google.noAccounts')}</p>
                  )}
                  {googleAccountStep === 'children' && !googleChildrenLoading && googleChildren.length > 0 && (
                    <ul className="space-y-2">
                      {googleChildren.map((c) => (
                        <li key={c.customerId} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <span className="font-medium text-gray-900">{c.name} (ID: {c.customerId})</span>
                          <button
                            type="button"
                            onClick={() => onGoogleChildClick(c)}
                            disabled={googleSelectLoading}
                            className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                          >
                            {googleSelectLoading ? t('google.selecting') : t('google.selectLabel')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {googleAccountStep === 'children' && !googleChildrenLoading && !googleAccountsError && googleChildren.length === 0 && (
                    <p className="text-gray-600 text-sm">{t('google.noChildren')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Raporlama Platformları */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('reportingPlatforms')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Google Analytics */}
              <div className="bg-white rounded-xl border-2 border-gray-200 cardPad opacity-50">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-transparent flex items-center justify-center">
                      <img src="/integration-icons/google-analytics.svg" alt="" className="h-6 w-6 object-contain" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{t('googleAnalytics.name')}</h4>
                      <p className="text-sm text-gray-500">{t('googleAnalytics.notConnected')}</p>
                    </div>
                  </div>
                  <button disabled className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                  </button>
                </div>
                <button disabled className="w-full px-4 py-2 bg-gray-100 text-gray-400 rounded-lg font-medium text-sm cursor-not-allowed">
                  {t('googleAnalytics.comingSoon')}
                </button>
              </div>

              {/* Google Search Console */}
              <div className="bg-white rounded-xl border-2 border-gray-200 cardPad opacity-50">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-transparent flex items-center justify-center">
                      <img src="/integration-icons/google-search-console.svg" alt="" className="h-6 w-6 object-contain" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{t('googleSearchConsole.name')}</h4>
                      <p className="text-sm text-gray-500">{t('googleSearchConsole.comingSoon')}</p>
                    </div>
                  </div>
                  <button disabled className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                  </button>
                </div>
                <div className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-400 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>{t('googleSearchConsole.comingSoon')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function EntegrasyonPage() {
  return (
    <Suspense fallback={
      <>
        <Topbar 
          title="Entegrasyon" 
          description="Reklam ve raporlama platformlarınızı bağlayın"
        />
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-12">
              <p className="text-gray-600">Yükleniyor...</p>
            </div>
          </div>
        </div>
      </>
    }>
      <EntegrasyonContent />
    </Suspense>
  )
}
