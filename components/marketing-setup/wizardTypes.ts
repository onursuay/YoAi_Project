// Shared wizard state contract for the Marketing Setup wizard.
// Owned by the wizard shell; imported by every step component.
// Pure types — no runtime, safe on client + server.

import type {
  SiteScanResult,
  ConnectionStatus,
  DeployStepResult,
} from '@/lib/marketing-setup/types'
import type {
  StandardEventKey,
  SetupStepName,
} from '@/lib/marketing-setup/constants'

/** 0 scan · 1 connect · 2 preview · 3 deploy · 4 result */
export type WizardStepIndex = 0 | 1 | 2 | 3 | 4

export interface WizardState {
  siteUrl: string
  scan: SiteScanResult | null
  selectedEvents: StandardEventKey[]
  connections: ConnectionStatus | null
  gtmMode: 'create' | 'existing'
  gtmContainerId: string
  googleAdsCustomerId: string
  /** Kullanıcı "Hesap Seçilmedi" dedi → bu kurulumda Google Ads adımı atlanır. */
  googleAdsOptOut: boolean
  metaAdAccountId: string
  deploySteps: Partial<Record<SetupStepName, DeployStepResult>>
}

export interface StepProps {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  goNext: () => void
  goBack: () => void
}
