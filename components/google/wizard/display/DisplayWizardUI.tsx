'use client'

/**
 * Display Wizard — UI primitive'leri.
 *
 * Bu dosya artık tüm Google Ads wizard'larında ortak kullanılan
 * `components/google/wizard/shared/GoogleWizardUI.tsx` modülüne
 * delege eder. Eski Display step component'lerinin eski isimlerle
 * ettiği import'lar bozulmasın diye alias re-export'lar burada kalır.
 */

import {
  googleWizardInputCls,
  GoogleWizardSection,
  GoogleWizardRadioCard,
  GoogleWizardSummaryCard,
  GoogleWizardSummaryRow,
} from '../shared/GoogleWizardUI'

export const displayInputCls = googleWizardInputCls
export const DisplaySection = GoogleWizardSection
export const DisplayRadioCard = GoogleWizardRadioCard
export const DisplaySidebarCard = GoogleWizardSummaryCard
export const DisplaySidebarRow = GoogleWizardSummaryRow
