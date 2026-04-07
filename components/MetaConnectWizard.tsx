'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { ROUTES } from '@/lib/routes'

interface AdAccount {
  id: string
  name: string
  account_id: string
  currency?: string
}

type Step3Phase = 'waiting_session' | 'fetching' | 'done' | 'error' | 'empty'

const RETRY_DELAYS = [300, 800, 1500] // ms — max 3 retries

export default function MetaConnectWizard() {
  const t = useTranslations('wizard')
  const locale = useLocale()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isConnected, setIsConnected] = useState(false)
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [step3Phase, setStep3Phase] = useState<Step3Phase>('waiting_session')
  const [fetchError, setFetchError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  // Session-aware account fetch with retry
  const fetchAdAccountsWithRetry = useCallback(async (): Promise<AdAccount[]> => {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (!mountedRef.current) return []

      // Re-check session readiness before each attempt
      if (attempt > 0) {
        console.log(`[STEP3] STEP3_FETCH_RETRY: attempt=${attempt + 1}, checking session...`)
        const sessionReady = await checkSessionReady()
        if (!sessionReady) {
          console.warn(`[STEP3] STEP3_FETCH_BLOCKED_WAITING_FOR_SESSION: attempt=${attempt + 1}`)
          if (attempt < RETRY_DELAYS.length) {
            await sleep(RETRY_DELAYS[attempt])
            continue
          }
          return []
        }
      }

      console.log(`[STEP3] STEP3_FETCH_ATTEMPT: attempt=${attempt + 1}`)

      try {
        const response = await fetch('/api/meta/adaccounts', { cache: 'no-store' })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.warn(`[STEP3] STEP3_FETCH_ERROR: status=${response.status}, error=${errorData.error ?? 'unknown'}, reason=${errorData.reason ?? 'unknown'}`)

          // 401 = token not ready yet — retry
          if (response.status === 401 && attempt < RETRY_DELAYS.length) {
            await sleep(RETRY_DELAYS[attempt])
            continue
          }
          return []
        }

        const data = await response.json()
        const accounts: AdAccount[] = data.accounts || []
        console.log(`[STEP3] STEP3_FETCH_SUCCESS: rawCount=${accounts.length}`)
        return accounts
      } catch (error) {
        console.error(`[STEP3] STEP3_FETCH_ERROR: attempt=${attempt + 1}`, error)
        if (attempt < RETRY_DELAYS.length) {
          await sleep(RETRY_DELAYS[attempt])
          continue
        }
        return []
      }
    }
    return []
  }, [])

  // Check if Meta session is ready (token cookie exists and is valid)
  const checkSessionReady = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/meta/status', { cache: 'no-store' })
      if (!res.ok) return false
      const data = await res.json()
      console.log(`[STEP3] META_SESSION_READY: connected=${data.connected}`)
      return !!data.connected
    } catch {
      return false
    }
  }, [])

  // Main Step 3 initialization flow
  const initStep3 = useCallback(async () => {
    console.log('[STEP3] STEP3_MOUNT')
    setStep3Phase('waiting_session')
    setFetchError(null)

    // 1. Wait for session
    const sessionReady = await checkSessionReady()
    if (!mountedRef.current) return

    if (!sessionReady) {
      console.warn('[STEP3] STEP3_FETCH_BLOCKED_WAITING_FOR_SESSION: initial check failed, will retry')
      // Try waiting a bit — cookie might still be propagating after OAuth redirect
      await sleep(500)
      const retrySession = await checkSessionReady()
      if (!mountedRef.current) return
      if (!retrySession) {
        setStep3Phase('error')
        setFetchError('Meta bağlantısı doğrulanamadı. Sayfayı yenileyin.')
        console.error('[STEP3] STEP3_FETCH_BLOCKED_WAITING_FOR_SESSION: session never became ready')
        return
      }
    }

    setIsConnected(true)
    setStep(3)

    // 2. Fetch accounts with retry
    setStep3Phase('fetching')
    const accounts = await fetchAdAccountsWithRetry()
    if (!mountedRef.current) return

    setAdAccounts(accounts)
    if (accounts.length > 0) {
      setSelectedAccount(accounts[0].id)
      setStep3Phase('done')
      console.log('[STEP3] STEP3_RENDER:', JSON.stringify({
        loading: false, hasSession: true, hasToken: true,
        rawCount: accounts.length, error: null,
      }))
    } else {
      setStep3Phase('empty')
      console.log('[STEP3] STEP3_FETCH_EMPTY: no ad accounts found after all retries')
    }
  }, [checkSessionReady, fetchAdAccountsWithRetry])

  // On mount: check connection and init Step 3 if connected
  useEffect(() => {
    mountedRef.current = true

    async function init() {
      try {
        console.log('[STEP3] WIZARD_MOUNT: checking connection...')
        const res = await fetch('/api/meta/status', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()

        if (!mountedRef.current) return

        if (data.connected) {
          await initStep3()
        }
        // else: stay on Step 1 (not connected)
      } catch (error) {
        console.error('[STEP3] Connection check failed:', error)
      }
    }

    init()
    return () => { mountedRef.current = false }
  }, [initStep3])

  const handleConnect = () => {
    window.location.href = '/api/meta/login'
  }

  const handleRetryFetch = async () => {
    setFetchError(null)
    await initStep3()
  }

  const handleSelectAccount = async () => {
    if (!selectedAccount) return
    const account = adAccounts.find((a) => a.id === selectedAccount)
    setIsLoading(true)
    try {
      const response = await fetch('/api/meta/select-adaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountId: selectedAccount }),
      })
      const data = await response.json()
      if (response.ok) {
        const accountName = data.account_name || account?.name || 'Unknown Account'
        await fetch('/api/active-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'meta',
            account_id: data.account_id || selectedAccount,
            account_name: accountName,
          }),
        }).catch(() => {})

        setStep(4)
        setTimeout(() => {
          router.push(locale === 'en' ? '/en/dashboard' : ROUTES.DASHBOARD)
        }, 2000)
      }
    } catch (error) {
      console.error('Account selection failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step >= num
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {num}
                </div>
                {num < 4 && (
                  <div
                    className={`w-16 h-1 ${
                      step > num ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-caption text-gray-500">
            <span>{t('steps.welcome')}</span>
            <span>{t('steps.connect')}</span>
            <span>{t('steps.selectAccount')}</span>
            <span>{t('steps.completed')}</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t('welcome')}
              </h2>
              <p className="text-gray-600 mb-8">
                {t('welcomeDesc')}
              </p>
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                {t('connectButton')}
              </button>
            </div>
          )}

          {/* Step 2: Connect */}
          {step === 2 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t('connect')}
              </h2>
              <p className="text-gray-600 mb-8">
                {t('connectDesc')}
              </p>
              <ul className="text-left text-sm text-gray-600 mb-8 space-y-2">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('permissions.viewCampaigns')}
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('permissions.manageCampaigns')}
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('permissions.analyzePerformance')}
                </li>
              </ul>
              <button
                onClick={handleConnect}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {t('metaButton')}
              </button>
            </div>
          )}

          {/* Step 3: Select Ad Account */}
          {step === 3 && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {t('selectAccount')}
                </h2>
                <p className="text-gray-600">
                  {t('selectAccountDesc')}
                </p>
              </div>

              {/* Phase: waiting for session */}
              {step3Phase === 'waiting_session' && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Bağlantı hazırlanıyor...</p>
                </div>
              )}

              {/* Phase: fetching accounts */}
              {step3Phase === 'fetching' && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">{t('loadingAccounts')}</p>
                </div>
              )}

              {/* Phase: error */}
              {step3Phase === 'error' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-red-600 font-medium mb-2">{fetchError || 'Hesaplar yüklenemedi'}</p>
                  <button
                    onClick={handleRetryFetch}
                    className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium mt-2"
                  >
                    Tekrar Dene
                  </button>
                </div>
              )}

              {/* Phase: empty result */}
              {step3Phase === 'empty' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-gray-700 font-medium mb-1">Reklam hesabı bulunamadı</p>
                  <p className="text-gray-500 text-sm mb-4">
                    Meta Business Suite üzerinden en az bir reklam hesabınız olmalıdır.
                  </p>
                  <button
                    onClick={handleRetryFetch}
                    className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Tekrar Dene
                  </button>
                </div>
              )}

              {/* Phase: done — show account list */}
              {step3Phase === 'done' && (
                <>
                  <div className="space-y-3 mb-6">
                    {adAccounts.map((account) => (
                      <label
                        key={account.id}
                        className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                        style={{
                          borderColor: selectedAccount === account.id ? '#10B981' : '#E5E7EB'
                        }}
                      >
                        <input
                          type="radio"
                          name="adaccount"
                          value={account.id}
                          checked={selectedAccount === account.id}
                          onChange={(e) => setSelectedAccount(e.target.value)}
                          className="w-4 h-4 text-green-600"
                        />
                        <div className="ml-3">
                          <div className="font-medium text-gray-900">{account.name}</div>
                          <div className="text-sm text-gray-500">ID: {account.account_id}{account.currency ? ` · ${account.currency}` : ''}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={handleSelectAccount}
                    disabled={!selectedAccount || isLoading}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (locale === 'en' ? 'Selecting...' : 'Seçiliyor...') : t('continue')}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t('success')}
              </h2>
              <p className="text-gray-600 mb-8">
                {t('successDesc')}
              </p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
