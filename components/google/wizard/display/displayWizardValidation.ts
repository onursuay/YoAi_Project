import type { WizardState } from '../shared/WizardTypes'

function isValidDisplayUrl(val: string): boolean {
  if (!val || !val.trim()) return false
  const s = val.trim()
  if (!s.startsWith('http://') && !s.startsWith('https://')) return false
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateDisplayStep(
  step: number,
  state: WizardState,
  t: (key: string, params?: any) => string
): string | null {
  switch (step) {
    // Step 0: Hedef & Tür — GoalType picks are always valid
    case 0:
      return null

    // Step 1: Dönüşüm Hedefleri & Kampanya Adı
    case 1: {
      if (!state.campaignName.trim()) return t('validation.campaignNameRequired')
      return null
    }

    // Step 2: Kampanya Ayarları — language required; custom location must have at least one entry
    case 2: {
      if (state.languageIds.length === 0) return t('validation.languageRequired')
      if (state.displayLocationMode === 'CUSTOM' && state.locations.length === 0) {
        return t('display.validation.locationsCustomRequired')
      }
      return null
    }

    // Step 3: Bütçe & Teklif
    case 3: {
      if (!state.dailyBudget || parseFloat(state.dailyBudget) < 1) return t('validation.minBudget')
      if (state.displayBiddingFocus === 'CONVERSIONS' && state.displayConversionsSub === 'TARGET_CPA') {
        if (!state.targetCpa || parseFloat(state.targetCpa) <= 0) return t('validation.targetCpaRequired')
      }
      if (state.displayBiddingFocus === 'CONVERSION_VALUE' && state.displayValueSub === 'TARGET_ROAS') {
        if (!state.targetRoas || parseFloat(state.targetRoas) <= 0) return t('validation.targetRoasRequired')
      }
      return null
    }

    // Step 4: Hedefleme (Audience) — no required selections
    case 4:
      return null

    // Step 5: Reklamlar (Ads)
    case 5: {
      if (!isValidDisplayUrl(state.finalUrl)) return t('validation.urlRequired')
      const name = state.displayBusinessName.trim()
      if (!name) return t('display.validation.businessNameRequired')
      if (name.length > 25) return t('display.validation.businessNameMax')
      const heads = state.displayHeadlines.map(h => h.trim()).filter(Boolean)
      if (heads.length < 1) return t('display.validation.headlinesMin')
      if (heads.some(h => h.length > 30)) return t('display.validation.headlineMax')
      const longH = state.displayLongHeadline.trim()
      if (!longH) return t('display.validation.longHeadlineRequired')
      if (longH.length > 90) return t('display.validation.longHeadlineMax')
      const descs = state.displayDescriptions.map(d => d.trim()).filter(Boolean)
      if (descs.length < 1) return t('display.validation.descriptionsMin')
      if (descs.some(d => d.length > 90)) return t('display.validation.descriptionMax')
      return null
    }

    // Step 6: Özet — review only
    case 6:
      return null

    default:
      return null
  }
}
