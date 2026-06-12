'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/lib/routes'
import Topbar from '@/components/Topbar'
import GoogleAccountModal from '@/components/google/GoogleAccountModal'
import { Puzzle, AlertCircle, RefreshCw } from 'lucide-react'

interface PlatformStatus {
  connected: boolean
  accountName?: string
  accountId?: string
  hasSelectedAccount?: boolean
  lastSyncAt?: string
  /** OAuth bağlı kullanıcı/işletme adı (Meta: /me?fields=name; Google: kullanıcı/customer adı). */
  connectedUserName?: string
}

interface GAStatus {
  connected: boolean
  propertyId?: string
  propertyName?: string
  hasSelectedProperty?: boolean
  lastSyncAt?: string
}

interface GSCStatus {
  connected: boolean
  siteUrl?: string
  siteName?: string
  hasSelectedSite?: boolean
  lastSyncAt?: string
}

interface GAProperty {
  propertyId: string
  displayName: string
}

interface GSCSite {
  siteUrl: string
  permissionLevel: string
}

interface GoogleManagerOrAccount {
  customerId: string
  name: string
  isManager: boolean
}

function EntegrasyonContent() {
  const t = useTranslations('dashboard.entegrasyon')
  const tc = useTranslations('common')
  const searchParams = useSearchParams()
  const router = useRouter()
  const [metaStatus, setMetaStatus] = useState<PlatformStatus>({ connected: false })
  const [googleStatus, setGoogleStatus] = useState<PlatformStatus>({ connected: false })
  const [tiktokStatus, setTiktokStatus] = useState<PlatformStatus>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)
  const [googleConfigMissing, setGoogleConfigMissing] = useState(false)
  const [googleAccountModalOpen, setGoogleAccountModalOpen] = useState(false)
  const [googleManagers, setGoogleManagers] = useState<GoogleManagerOrAccount[]>([])
  const [googleManagersLoading, setGoogleManagersLoading] = useState(false)
  const [googleChildren, setGoogleChildren] = useState<GoogleManagerOrAccount[]>([])
  const [googleChildrenLoading, setGoogleChildrenLoading] = useState(false)
  const [googleAccountStep, setGoogleAccountStep] = useState<'managers' | 'children'>('managers')
  const [selectedGoogleManagerId, setSelectedGoogleManagerId] = useState<string | null>(null)
  const [selectingAccountId, setSelectingAccountId] = useState<string | null>(null)
  const [googleAccountsError, setGoogleAccountsError] = useState<string | null>(null)

  // Google Analytics state
  const [gaStatus, setGaStatus] = useState<GAStatus>({ connected: false })
  const [gaPropertyModalOpen, setGaPropertyModalOpen] = useState(false)
  const [gaProperties, setGaProperties] = useState<GAProperty[]>([])
  const [gaPropertiesLoading, setGaPropertiesLoading] = useState(false)
  const [gaPropertiesError, setGaPropertiesError] = useState<string | null>(null)
  const [gaSelectingId, setGaSelectingId] = useState<string | null>(null)

  // Google Search Console state
  const [gscStatus, setGscStatus] = useState<GSCStatus>({ connected: false })
  const [gscSiteModalOpen, setGscSiteModalOpen] = useState(false)
  const [gscSites, setGscSites] = useState<GSCSite[]>([])
  const [gscSitesLoading, setGscSitesLoading] = useState(false)
  const [gscSitesError, setGscSitesError] = useState<string | null>(null)
  const [gscSelectingUrl, setGscSelectingUrl] = useState<string | null>(null)

  useEffect(() => {
    const metaParam = searchParams.get('meta')
    const googleParam = searchParams.get('google')
    const gaParam = searchParams.get('ga')
    const gscParam = searchParams.get('gsc')
    if (metaParam === 'connected' || metaParam === 'error') {
      window.history.replaceState({}, '', '/entegrasyon')
    }
    if (googleParam === 'config_missing') {
      setGoogleConfigMissing(true)
      window.history.replaceState({}, '', '/entegrasyon')
    } else if (googleParam === 'connected' || googleParam === 'error') {
      setGoogleConfigMissing(false)
      window.history.replaceState({}, '', '/entegrasyon')
    }
    if (gaParam === 'connected' || gaParam === 'error' || gaParam === 'config_missing') {
      if (gaParam === 'error') {
        const reason = searchParams.get('reason') || 'unknown'
        const msg = reason === 'no_user_session'
          ? t('errors.gaNoUserSession')
          : reason === 'no_refresh_token'
          ? t('errors.noRefreshToken')
          : reason === 'db_save_failed'
          ? t('errors.dbSaveFailed')
          : t('errors.gaConnectFailed', { reason })
        alert(msg)
      }
      window.history.replaceState({}, '', '/entegrasyon')
    }
    if (gscParam === 'connected' || gscParam === 'error' || gscParam === 'config_missing') {
      if (gscParam === 'error') {
        const reason = searchParams.get('reason') || 'unknown'
        const msg = reason === 'no_user_session'
          ? t('errors.gscNoUserSession')
          : reason === 'no_refresh_token'
          ? t('errors.noRefreshToken')
          : reason === 'db_save_failed'
          ? t('errors.dbSaveFailed')
          : t('errors.gscConnectFailed', { reason })
        alert(msg)
      }
      window.history.replaceState({}, '', '/entegrasyon')
    }
    const tiktokParam = searchParams.get('tiktok')
    if (tiktokParam === 'connected' || tiktokParam === 'error') {
      window.history.replaceState({}, '', '/entegrasyon')
    }
    let cancelled = false
    async function load() {
      try {
        // Bootstrap session_id before any OAuth flow (credentials required for cookie)
        await fetch('/api/session', { credentials: 'include' })
        const [metaRes, googleRes, tiktokRes, gaRes, gscRes] = await Promise.all([
          fetch('/api/meta/status', { credentials: 'include' }),
          fetch('/api/google/status', { credentials: 'include' }),
          fetch('/api/tiktok/status', { credentials: 'include' }),
          fetch('/api/integrations/google-analytics/status', { credentials: 'include' }),
          fetch('/api/integrations/google-search-console/status', { credentials: 'include' }),
        ])
        if (!cancelled && metaRes.ok) {
          const data = await metaRes.json()
          setMetaStatus({
            connected: data.connected,
            accountName: data.adAccountName,
            accountId: data.adAccountId,
            connectedUserName: data.connectedUserName ?? undefined,
          })
        }
        if (!cancelled && googleRes.ok) {
          const data = await googleRes.json().catch(() => ({}))
          setGoogleStatus({
            connected: Boolean(data?.connected),
            accountName: data?.accountName ?? undefined,
            accountId: data?.accountId ?? undefined,
            hasSelectedAccount: Boolean(data?.hasSelectedAccount ?? data?.accountId),
            connectedUserName: data?.connectedUserName ?? undefined,
          })
        }
        if (!cancelled && tiktokRes.ok) {
          const data = await tiktokRes.json().catch(() => ({}))
          setTiktokStatus({
            connected: Boolean(data?.connected),
            accountName: data?.advertiserName ?? undefined,
            accountId: data?.advertiserId ?? undefined,
            hasSelectedAccount: Boolean(data?.advertiserId),
          })
        }
        if (!cancelled && gaRes.ok) {
          const data = await gaRes.json().catch(() => ({}))
          setGaStatus({
            connected: Boolean(data?.connected),
            propertyId: data?.propertyId ?? undefined,
            propertyName: data?.propertyName ?? undefined,
            hasSelectedProperty: Boolean(data?.hasSelectedProperty),
            lastSyncAt: data?.lastSyncAt ?? undefined,
          })
        }
        if (!cancelled && gscRes.ok) {
          const data = await gscRes.json().catch(() => ({}))
          setGscStatus({
            connected: Boolean(data?.connected),
            siteUrl: data?.siteUrl ?? undefined,
            siteName: data?.siteName ?? undefined,
            hasSelectedSite: Boolean(data?.hasSelectedSite),
            lastSyncAt: data?.lastSyncAt ?? undefined,
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
        setGoogleAccountsError(data?.message || data?.error || t('errors.loadAccountsFailed'))
        if (res.status === 401) {
          setGoogleStatus({ connected: false })
          setGoogleAccountModalOpen(false)
        }
        return
      }
      setGoogleManagers(data.customers || [])
      if (!(data.customers?.length > 0)) {
        setGoogleAccountsError(t('google.noAccounts'))
      }
    } catch (e) {
      setGoogleAccountsError(e instanceof Error ? e.message : t('errors.networkError'))
    } finally {
      setGoogleManagersLoading(false)
    }
  }

  const selectGoogleAccount = async (loginCustomerId: string, customerId: string, customerName?: string) => {
    setSelectingAccountId(customerId)
    setGoogleAccountsError(null)
    try {
      const res = await fetch('/api/integrations/google-ads/select-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginCustomerId, customerId, customerName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGoogleAccountsError(data?.message || data?.error || t('errors.selectAccountFailed'))
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
      setGoogleAccountsError(e instanceof Error ? e.message : t('errors.networkError'))
    } finally {
      setSelectingAccountId(null)
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
          setGoogleAccountsError(data?.message || data?.error || t('errors.loadChildAccountsFailed'))
          return
        }
        setGoogleChildren(data.children || [])
        if (!(data.children?.length > 0)) setGoogleAccountsError(t('google.noChildren'))
        setGoogleAccountStep('children')
      } catch (e) {
        setGoogleAccountsError(e instanceof Error ? e.message : t('errors.networkError'))
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

  // --- Google Analytics handlers ---
  const handleGAConnect = () => {
    window.location.href = '/api/integrations/google-analytics/start'
  }

  const handleGADisconnect = async () => {
    if (confirm(t('googleAnalytics.disconnectConfirm'))) {
      await fetch('/api/integrations/google-analytics/disconnect', { method: 'POST', credentials: 'include' })
      setGaStatus({ connected: false })
    }
  }

  const openGAPropertyModal = async () => {
    setGaPropertyModalOpen(true)
    setGaPropertiesError(null)
    setGaProperties([])
    setGaPropertiesLoading(true)
    try {
      const res = await fetch('/api/integrations/google-analytics/properties', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGaPropertiesError(data?.error || t('errors.loadPropertiesFailed'))
        if (res.status === 401) {
          setGaStatus({ connected: false })
          setGaPropertyModalOpen(false)
        }
        return
      }
      setGaProperties(data.properties || [])
      if (!(data.properties?.length > 0)) setGaPropertiesError(t('googleAnalytics.noProperties'))
    } catch (e) {
      setGaPropertiesError(e instanceof Error ? e.message : t('errors.networkError'))
    } finally {
      setGaPropertiesLoading(false)
    }
  }

  const selectGAProperty = async (propertyId: string, displayName: string) => {
    setGaSelectingId(propertyId)
    setGaPropertiesError(null)
    try {
      const res = await fetch('/api/integrations/google-analytics/select-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, propertyName: displayName }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setGaPropertiesError(data?.error || t('errors.selectPropertyFailed'))
        return
      }
      setGaStatus({ connected: true, propertyId, propertyName: displayName, hasSelectedProperty: true })
      setGaPropertyModalOpen(false)
    } catch (e) {
      setGaPropertiesError(e instanceof Error ? e.message : t('errors.networkError'))
    } finally {
      setGaSelectingId(null)
    }
  }

  // --- Google Search Console handlers ---
  const handleGSCConnect = () => {
    window.location.href = '/api/integrations/google-search-console/start'
  }

  const handleGSCDisconnect = async () => {
    if (confirm(t('googleSearchConsole.disconnectConfirm'))) {
      await fetch('/api/integrations/google-search-console/disconnect', { method: 'POST', credentials: 'include' })
      setGscStatus({ connected: false })
    }
  }

  const openGSCSiteModal = async () => {
    setGscSiteModalOpen(true)
    setGscSitesError(null)
    setGscSites([])
    setGscSitesLoading(true)
    try {
      const res = await fetch('/api/integrations/google-search-console/sites', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGscSitesError(data?.error || t('errors.loadSitesFailed'))
        if (res.status === 401) {
          setGscStatus({ connected: false })
          setGscSiteModalOpen(false)
        }
        return
      }
      setGscSites(data.sites || [])
      if (!(data.sites?.length > 0)) setGscSitesError(t('googleSearchConsole.noSites'))
    } catch (e) {
      setGscSitesError(e instanceof Error ? e.message : t('errors.networkError'))
    } finally {
      setGscSitesLoading(false)
    }
  }

  const selectGSCSite = async (siteUrl: string) => {
    setGscSelectingUrl(siteUrl)
    setGscSitesError(null)
    try {
      const res = await fetch('/api/integrations/google-search-console/select-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, siteName: siteUrl }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setGscSitesError(data?.error || t('errors.selectSiteFailed'))
        return
      }
      setGscStatus({ connected: true, siteUrl, siteName: siteUrl, hasSelectedSite: true })
      setGscSiteModalOpen(false)
    } catch (e) {
      setGscSitesError(e instanceof Error ? e.message : t('errors.networkError'))
    } finally {
      setGscSelectingUrl(null)
    }
  }

  const formatSyncTime = (iso?: string) => {
    if (!iso) return null
    const d = new Date(iso)
    return d.toLocaleString()
  }

  const formatSiteUrl = (url: string) => {
    return url.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '')
  }

  return (
    <>
      <Topbar 
        title={t('title')} 
        description={t('description')}
      />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
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
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
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
              <div className={`bg-white rounded-xl border-2 cardPad transition-all hover:shadow-md ${
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
                      {metaStatus.connected && metaStatus.connectedUserName && (
                        <p className="mt-1.5 text-sm text-gray-700 font-medium">{metaStatus.connectedUserName}</p>
                      )}
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

                {/* Hesap detayı + hesap değiştir kaldırıldı — hesap seçimi /meta-ads sayfasındaki slot selector'da yapılır. */}
                {!metaStatus.connected && (
                  <button
                    onClick={() => handleMetaToggle(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {t('meta.connectAccount')}
                  </button>
                )}
              </div>

              {/* Google Ads */}
              <div className={`bg-white rounded-xl border-2 cardPad transition-all hover:shadow-md ${
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
                      {googleStatus.connected && googleStatus.connectedUserName && (
                        <p className="mt-1.5 text-sm text-gray-700 font-medium">{googleStatus.connectedUserName}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (googleStatus.connected) {
                        if (confirm(t('google.disconnect'))) {
                          try {
                            await fetch('/api/integrations/google-ads/disconnect', { method: 'POST', credentials: 'include' })
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

                {/* Hesap detayı + hesap seç/değiştir kaldırıldı — hesap seçimi /google-ads sayfasındaki slot selector'da yapılır. */}
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

              {/* TikTok Ads — lansmanda gizli (entegrasyon onayı sonrası açılacak) */}
              <div className="bg-white rounded-xl border-2 border-gray-200 cardPad opacity-80">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-transparent flex items-center justify-center grayscale">
                      <img src="/integration-icons/tiktok.svg" alt="" className="h-6 w-6 object-contain" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{t('tiktok.name')}</h4>
                      <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-medium rounded-full border bg-gray-100 text-gray-600 border-gray-200">
                        {t('tiktok.comingSoon')}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-gray-500">{t('tiktok.comingSoonDesc')}</p>
              </div>
            </div>
          </div>

          {/* Google Ads account selection modal (çoklu hesap destekli — Madde 2) */}
          <GoogleAccountModal
            isOpen={googleAccountModalOpen}
            onClose={() => setGoogleAccountModalOpen(false)}
            managers={googleManagers}
            managersLoading={googleManagersLoading}
            children={googleChildren}
            childrenLoading={googleChildrenLoading}
            accountStep={googleAccountStep}
            selectingKey={selectingAccountId ? `account:${selectingAccountId}` : null}
            accountsError={googleAccountsError}
            onManagerOrAccountClick={onGoogleManagerOrAccountClick}
            onChildClick={onGoogleChildClick}
            backToManagers={backToGoogleManagers}
            selectedManagerId={selectedGoogleManagerId}
            activeCustomerId={googleStatus.accountId ?? null}
            activeCustomerName={googleStatus.accountName ?? null}
          />

          {/* GA Property selection modal */}
          {gaPropertyModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !gaSelectingId && setGaPropertyModalOpen(false)}>
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">{t('googleAnalytics.selectPropertyTitle')}</h3>
                  <button type="button" onClick={() => !gaSelectingId && setGaPropertyModalOpen(false)} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg" disabled={!!gaSelectingId}>
                    <span className="sr-only">{tc('close')}</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                  {gaPropertiesLoading && <p className="text-gray-600 text-center py-4">{t('googleAnalytics.loading')}</p>}
                  {gaPropertiesError && <p className="text-red-600 text-sm py-2">{gaPropertiesError}</p>}
                  {!gaPropertiesLoading && gaProperties.length > 0 && (
                    <ul className="space-y-2">
                      {gaProperties.map((p) => (
                        <li key={p.propertyId} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <span className="font-medium text-gray-900">{p.displayName} <span className="text-gray-500 text-sm">(ID: {p.propertyId})</span></span>
                          <button
                            type="button"
                            onClick={() => !gaSelectingId && selectGAProperty(p.propertyId, p.displayName)}
                            disabled={gaSelectingId === p.propertyId}
                            className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                          >
                            {gaSelectingId === p.propertyId ? t('googleAnalytics.selecting') : t('googleAnalytics.selectLabel')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!gaPropertiesLoading && !gaPropertiesError && gaProperties.length === 0 && (
                    <p className="text-gray-600 text-sm">{t('googleAnalytics.noProperties')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* GSC Site selection modal */}
          {gscSiteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !gscSelectingUrl && setGscSiteModalOpen(false)}>
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">{t('googleSearchConsole.selectSiteTitle')}</h3>
                  <button type="button" onClick={() => !gscSelectingUrl && setGscSiteModalOpen(false)} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg" disabled={!!gscSelectingUrl}>
                    <span className="sr-only">{tc('close')}</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                  {gscSitesLoading && <p className="text-gray-600 text-center py-4">{t('googleSearchConsole.loading')}</p>}
                  {gscSitesError && <p className="text-red-600 text-sm py-2">{gscSitesError}</p>}
                  {!gscSitesLoading && gscSites.length > 0 && (
                    <ul className="space-y-2">
                      {gscSites.map((s) => (
                        <li key={s.siteUrl} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <span className="font-medium text-gray-900 truncate mr-2">{formatSiteUrl(s.siteUrl)}</span>
                          <button
                            type="button"
                            onClick={() => !gscSelectingUrl && selectGSCSite(s.siteUrl)}
                            disabled={gscSelectingUrl === s.siteUrl}
                            className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex-shrink-0"
                          >
                            {gscSelectingUrl === s.siteUrl ? t('googleSearchConsole.selecting') : t('googleSearchConsole.selectLabel')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!gscSitesLoading && !gscSitesError && gscSites.length === 0 && (
                    <p className="text-gray-600 text-sm">{t('googleSearchConsole.noSites')}</p>
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
              <div className={`bg-white rounded-xl border-2 cardPad transition-all hover:shadow-md ${
                gaStatus.connected ? 'border-primary' : 'border-gray-200'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-transparent flex items-center justify-center">
                      <img src="/integration-icons/google-analytics.svg" alt="" className="h-6 w-6 object-contain" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{t('googleAnalytics.name')}</h4>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                        gaStatus.connected ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>
                        {gaStatus.connected ? t('googleAnalytics.connected') : t('googleAnalytics.notConnected')}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (gaStatus.connected) {
                        handleGADisconnect()
                      } else {
                        handleGAConnect()
                      }
                    }}
                    disabled={isLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      gaStatus.connected ? 'bg-green-500' : 'bg-gray-300'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      gaStatus.connected ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {gaStatus.connected && gaStatus.hasSelectedProperty && gaStatus.propertyName && (
                  <div className="mb-3 p-3 bg-green-50 rounded-lg">
                    <p className="text-caption text-green-900 font-medium mb-1">{t('googleAnalytics.property')}</p>
                    <p className="text-sm text-green-800">{gaStatus.propertyName}</p>
                    {gaStatus.lastSyncAt && (
                      <p className="text-caption text-green-700 mt-1">{t('googleAnalytics.lastSync')}: {formatSyncTime(gaStatus.lastSyncAt)}</p>
                    )}
                  </div>
                )}

                {gaStatus.connected && gaStatus.hasSelectedProperty && (
                  <button
                    onClick={openGAPropertyModal}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 btn-h-sm px-4 rounded-lg font-medium text-ui bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('googleAnalytics.changeProperty')}
                  </button>
                )}

                {gaStatus.connected && !gaStatus.hasSelectedProperty && (
                  <button
                    onClick={openGAPropertyModal}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 btn-h-sm px-4 rounded-lg font-medium text-ui bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {t('googleAnalytics.selectProperty')}
                  </button>
                )}

                {!gaStatus.connected && (
                  <button
                    onClick={handleGAConnect}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-primary text-white hover:bg-primary/90 transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {t('googleAnalytics.connectButton')}
                  </button>
                )}
              </div>

              {/* Google Search Console */}
              <div className={`bg-white rounded-xl border-2 cardPad transition-all hover:shadow-md ${
                gscStatus.connected ? 'border-primary' : 'border-gray-200'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-transparent flex items-center justify-center">
                      <img src="/integration-icons/google-search-console.svg" alt="" className="h-6 w-6 object-contain" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{t('googleSearchConsole.name')}</h4>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                        gscStatus.connected ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>
                        {gscStatus.connected ? t('googleSearchConsole.connected') : t('googleSearchConsole.notConnected')}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (gscStatus.connected) {
                        handleGSCDisconnect()
                      } else {
                        handleGSCConnect()
                      }
                    }}
                    disabled={isLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      gscStatus.connected ? 'bg-green-500' : 'bg-gray-300'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      gscStatus.connected ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {gscStatus.connected && gscStatus.hasSelectedSite && gscStatus.siteUrl && (
                  <div className="mb-3 p-3 bg-green-50 rounded-lg">
                    <p className="text-caption text-green-900 font-medium mb-1">{t('googleSearchConsole.site')}</p>
                    <p className="text-sm text-green-800 truncate">{formatSiteUrl(gscStatus.siteName || gscStatus.siteUrl)}</p>
                    {gscStatus.lastSyncAt && (
                      <p className="text-caption text-green-700 mt-1">{t('googleSearchConsole.lastSync')}: {formatSyncTime(gscStatus.lastSyncAt)}</p>
                    )}
                  </div>
                )}

                {gscStatus.connected && gscStatus.hasSelectedSite && (
                  <button
                    onClick={openGSCSiteModal}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 btn-h-sm px-4 rounded-lg font-medium text-ui bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('googleSearchConsole.changeSite')}
                  </button>
                )}

                {gscStatus.connected && !gscStatus.hasSelectedSite && (
                  <button
                    onClick={openGSCSiteModal}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 btn-h-sm px-4 rounded-lg font-medium text-ui bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {t('googleSearchConsole.selectSite')}
                  </button>
                )}

                {!gscStatus.connected && (
                  <button
                    onClick={handleGSCConnect}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-primary text-white hover:bg-primary/90 transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {t('googleSearchConsole.connectButton')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function EntegrasyonPage() {
  const t = useTranslations('dashboard.entegrasyon')
  const tc = useTranslations('common')
  return (
    <Suspense fallback={
      <>
        <Topbar
          title={t('title')}
          description={t('description')}
        />
        <div className="flex-1 overflow-y-auto app-content-surface p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <p className="text-gray-600">{tc('loading')}</p>
            </div>
          </div>
        </div>
      </>
    }>
      <EntegrasyonContent />
    </Suspense>
  )
}
