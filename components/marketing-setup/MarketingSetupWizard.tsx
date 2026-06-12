'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ToastContainer, type Toast } from '@/components/Toast'
import Stepper from './Stepper'
import type { WizardState, WizardStepIndex, StepProps } from './wizardTypes'
import StepScan from './steps/StepScan'
import StepConnect from './steps/StepConnect'
import StepPreview from './steps/StepPreview'
import StepDeploy from './steps/StepDeploy'
import StepResult from './steps/StepResult'
import type { ConnectionStatus } from '@/lib/marketing-setup/types'
import type { StandardEventKey } from '@/lib/marketing-setup/constants'

const INITIAL_STATE: WizardState = {
  siteUrl: '',
  scan: null,
  selectedEvents: [],
  connections: null,
  gtmMode: 'create',
  gtmContainerId: '',
  googleAdsCustomerId: '',
  googleAdsOptOut: false,
  metaAdAccountId: '',
  deploySteps: {},
}

const STEP_COMPONENTS: Array<React.ComponentType<StepProps>> = [
  StepScan,
  StepConnect,
  StepPreview,
  StepDeploy,
  StepResult,
]

export default function MarketingSetupWizard() {
  const t = useTranslations('marketingSetup')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<WizardStepIndex>(0)
  const [state, setState] = useState<WizardState>(INITIAL_STATE)
  const [toasts, setToasts] = useState<Toast[]>([])
  const handledQuery = useRef(false)

  const addToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info') => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, message, type }])
    },
    [],
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((tx) => tx.id !== id))
  }, [])

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  const goNext = useCallback(() => {
    setStep((s) => (s < 4 ? ((s + 1) as WizardStepIndex) : s))
  }, [])

  const goBack = useCallback(() => {
    setStep((s) => (s > 0 ? ((s - 1) as WizardStepIndex) : s))
  }, [])

  // ─── Fetch live platform connection status ─────────────────────────────────
  const refreshConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing-setup/connections', {
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = (await res.json()) as ConnectionStatus
      update({ connections: data })
    } catch {
      /* keep prior connections on transient failure */
    }
  }, [update])

  // ─── Hydrate persisted setup row + connections on mount ────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/marketing-setup/setup', {
          cache: 'no-store',
        })
        if (res.ok && !cancelled) {
          const json = await res.json()
          const row = json?.ok ? json.setup : null
          if (row) {
            update({
              siteUrl: row.site_url ?? '',
              scan: row.site_scan_result ?? null,
              selectedEvents: (row.selected_events ?? []) as StandardEventKey[],
              gtmContainerId: row.gtm_container_id ?? '',
              gtmMode: row.gtm_container_id ? 'existing' : 'create',
              metaAdAccountId: row.meta_ad_account_id ?? '',
              googleAdsCustomerId: row.google_ads_customer_id ?? '',
            })
          }
        }
      } catch {
        /* fresh wizard — start from INITIAL_STATE */
      }
      if (!cancelled) await refreshConnections()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Handle return from setup-google consent (?setup=connected|error) ──────
  useEffect(() => {
    if (handledQuery.current) return
    const setupParam = searchParams.get('setup')
    if (!setupParam) return
    handledQuery.current = true

    if (setupParam === 'connected') {
      addToast(t('connect.setupConsentConnected'), 'success')
      refreshConnections()
      // Returning from consent lands on the connect step.
      setStep(1)
    } else if (setupParam === 'error') {
      addToast(t('errors.notConnectedSetup'), 'error')
      setStep(1)
    }

    // Strip the query param so a refresh doesn't re-trigger the toast.
    router.replace('/donusum-sihirbazi')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const stepProps: StepProps = { state, update, goNext, goBack }
  const CurrentStep = STEP_COMPONENTS[step]

  return (
    <div className="space-y-6">
      <Stepper current={step} onStepClick={(i) => setStep(i)} />

      {/* key={step} → her adım geçişinde içerik yumuşakça belirir */}
      <div key={step} className="animate-card-enter">
        <CurrentStep {...stepProps} />
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
