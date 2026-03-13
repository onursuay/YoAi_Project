'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, Shield, Copy, Compass } from 'lucide-react'
import type { AudienceType } from './wizard/types'
import {
  initialCustomAudienceState,
  initialLookalikeState,
  initialSavedAudienceState,
} from './wizard/types'
import type { CustomAudienceState, LookalikeState, SavedAudienceState } from './wizard/types'
import AudienceWizardProgress from './wizard/AudienceWizardProgress'
import AudienceWizardNavigation from './wizard/AudienceWizardNavigation'
// Custom Audience steps
import CustomStepSource from './wizard/custom/StepSource'
import CustomStepRule from './wizard/custom/StepRule'
import CustomStepExclude from './wizard/custom/StepExclude'
import CustomStepSummary from './wizard/custom/StepSummary'
// Lookalike steps
import LookalikeStepSeed from './wizard/lookalike/StepSeed'
import LookalikeStepCountry from './wizard/lookalike/StepCountry'
import LookalikeStepSize from './wizard/lookalike/StepSize'
import LookalikeStepSummary from './wizard/lookalike/StepSummary'
// Saved Audience steps
import SavedStepLocation from './wizard/saved/StepLocation'
import SavedStepDemography from './wizard/saved/StepDemography'
import SavedStepLanguage from './wizard/saved/StepLanguage'
import SavedStepInterests from './wizard/saved/StepInterests'
import SavedStepExclude from './wizard/saved/StepExclude'
import SavedStepSummary from './wizard/saved/StepSummary'

interface AudienceWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void
  assets: {
    pixels: { id: string; name: string }[]
    instagramAccounts: { id: string; username: string }[]
    pages: { id: string; name: string }[]
  }
  initialType?: AudienceType
}

type WizardPhase = 'select-type' | 'custom' | 'lookalike' | 'saved'

const TYPE_OPTIONS: { type: AudienceType; phase: WizardPhase; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    type: 'CUSTOM',
    phase: 'custom',
    label: 'Retargeting',
    description: 'Pixel, IG etkileşim, sayfa ziyareti gibi kaynaklardan özel kitle oluşturun.',
    icon: Shield,
  },
  {
    type: 'LOOKALIKE',
    phase: 'lookalike',
    label: 'Benzer Kitle',
    description: 'Mevcut bir kitlenize benzer yeni kullanıcıları hedefleyin.',
    icon: Copy,
  },
  {
    type: 'SAVED',
    phase: 'saved',
    label: 'Detaylı Kitle',
    description: 'Konum, yaş, ilgi alanları gibi kriterlerle kayıtlı kitle oluşturun.',
    icon: Compass,
  },
]

const CUSTOM_STEPS = [
  { step: 1, label: 'Kaynak' },
  { step: 2, label: 'Kural' },
  { step: 3, label: 'Hariç Tut' },
  { step: 4, label: 'Özet' },
]

const LOOKALIKE_STEPS = [
  { step: 1, label: 'Tohum' },
  { step: 2, label: 'Ülke' },
  { step: 3, label: 'Boyut' },
  { step: 4, label: 'Özet' },
]

const SAVED_STEPS = [
  { step: 1, label: 'Konum' },
  { step: 2, label: 'Demografi' },
  { step: 3, label: 'Dil' },
  { step: 4, label: 'İlgi' },
  { step: 5, label: 'Hariç Tut' },
  { step: 6, label: 'Özet' },
]

function typeToPhase(type?: AudienceType): WizardPhase {
  if (type === 'CUSTOM') return 'custom'
  if (type === 'LOOKALIKE') return 'lookalike'
  if (type === 'SAVED') return 'saved'
  return 'select-type'
}

export default function AudienceWizardModal({ isOpen, onClose, onSuccess, onToast, assets, initialType }: AudienceWizardModalProps) {
  const [phase, setPhase] = useState<WizardPhase>(typeToPhase(initialType))
  const [customState, setCustomState] = useState<CustomAudienceState>(initialCustomAudienceState)
  const [lookalikeState, setLookalikeState] = useState<LookalikeState>(initialLookalikeState)
  const [savedState, setSavedState] = useState<SavedAudienceState>(initialSavedAudienceState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasInitialType, setHasInitialType] = useState(!!initialType)

  // When modal opens, set phase based on initialType
  useEffect(() => {
    if (isOpen) {
      setPhase(typeToPhase(initialType))
      setHasInitialType(!!initialType)
      setCustomState(initialCustomAudienceState)
      setLookalikeState(initialLookalikeState)
      setSavedState(initialSavedAudienceState)
      setIsSubmitting(false)
    }
  }, [isOpen, initialType])

  const reset = useCallback(() => {
    setPhase(typeToPhase(initialType))
    setHasInitialType(!!initialType)
    setCustomState(initialCustomAudienceState)
    setLookalikeState(initialLookalikeState)
    setSavedState(initialSavedAudienceState)
    setIsSubmitting(false)
  }, [initialType])

  const handleClose = () => {
    reset()
    onClose()
  }

  /* ── Custom Audience handlers ── */
  const customOnChange = (updates: Partial<CustomAudienceState>) => {
    setCustomState((prev) => ({ ...prev, ...updates }))
  }

  const customCanGoNext = (): boolean => {
    const s = customState
    switch (s.currentStep) {
      case 1: return s.source !== ''
      case 2: return s.rule.retention > 0
      case 3: return true // exclude is optional
      case 4: return s.name.trim().length > 0
      default: return false
    }
  }

  /* ── Lookalike handlers ── */
  const lookalikeOnChange = (updates: Partial<LookalikeState>) => {
    setLookalikeState((prev) => ({ ...prev, ...updates }))
  }

  const lookalikeCanGoNext = (): boolean => {
    const s = lookalikeState
    switch (s.currentStep) {
      case 1: return s.seedAudienceId !== ''
      case 2: return s.countries.length > 0
      case 3: return s.sizePercent >= 1 && s.sizePercent <= 10
      case 4: return s.name.trim().length > 0
      default: return false
    }
  }

  /* ── Saved Audience handlers ── */
  const savedOnChange = (updates: Partial<SavedAudienceState>) => {
    setSavedState((prev) => ({ ...prev, ...updates }))
  }

  const savedCanGoNext = (): boolean => {
    const s = savedState
    switch (s.currentStep) {
      case 1: return true // location optional (defaults to TR)
      case 2: return true // demography always valid
      case 3: return true // language optional
      case 4: return true // interests optional
      case 5: return true // exclude optional
      case 6: return s.name.trim().length > 0
      default: return false
    }
  }

  /* ── Submit ── */
  const submitAudience = async (type: AudienceType) => {
    setIsSubmitting(true)
    try {
      let body: Record<string, unknown>
      if (type === 'CUSTOM') {
        body = {
          type: 'CUSTOM',
          source: customState.source,
          name: customState.name,
          description: customState.description || null,
          yoai_spec_json: {
            rule: customState.rule,
            excludeRules: customState.excludeRules,
          },
        }
      } else if (type === 'LOOKALIKE') {
        body = {
          type: 'LOOKALIKE',
          name: lookalikeState.name,
          description: lookalikeState.description || null,
          yoai_spec_json: {
            seedAudienceId: lookalikeState.seedAudienceId,
            seedName: lookalikeState.seedName,
            countries: lookalikeState.countries,
            sizePercent: lookalikeState.sizePercent,
          },
        }
      } else {
        body = {
          type: 'SAVED',
          name: savedState.name,
          description: savedState.description || null,
          yoai_spec_json: {
            locations: savedState.locations,
            ageMin: savedState.ageMin,
            ageMax: savedState.ageMax,
            genders: savedState.genders,
            locales: savedState.locales,
            interests: savedState.interests,
            excludeInterests: savedState.excludeInterests,
            advantageAudience: savedState.advantageAudience,
          },
        }
      }

      const res = await fetch('/api/audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? 'Kayıt oluşturulamadı')
      }

      // DRAFT oluşturuldu — şimdi Meta'ya gönder
      const audienceId = json.audience?.id
      if (audienceId) {
        onToast?.('Kitle kaydedildi, Meta\'ya gönderiliyor...', 'info')
        try {
          const createRes = await fetch(`/api/audiences/${audienceId}/create`, { method: 'POST' })
          const createJson = await createRes.json()
          if (createRes.ok && createJson.ok) {
            onToast?.('Kitle Meta\'ya başarıyla gönderildi', 'success')
          } else {
            onToast?.(createJson.message ?? 'Meta\'ya gönderim başarısız — liste ekranından tekrar deneyebilirsiniz', 'error')
          }
        } catch {
          onToast?.('Meta\'ya gönderim sırasında hata — liste ekranından tekrar deneyebilirsiniz', 'error')
        }
      } else {
        onToast?.('Kitle DRAFT olarak kaydedildi', 'success')
      }

      onSuccess?.()
      handleClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Beklenmeyen hata'
      onToast?.(msg, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  /* ── Navigation helpers ── */
  const navigateStep = (
    current: number,
    direction: 'next' | 'back',
    max: number,
    setter: (step: number) => void,
    type: AudienceType,
  ) => {
    if (direction === 'back') {
      if (current === 1) {
        // If opened directly from a tab, close modal; otherwise go to type selection
        if (hasInitialType) {
          handleClose()
        } else {
          setPhase('select-type')
        }
        return
      }
      setter(current - 1)
    } else {
      if (current === max) {
        submitAudience(type)
        return
      }
      setter(current + 1)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-page-title font-semibold text-gray-900">
            {phase === 'select-type' && 'Yeni Hedef Kitle'}
            {phase === 'custom' && 'Yeni Retargeting Kitlesi'}
            {phase === 'lookalike' && 'Yeni Benzer Kitle'}
            {phase === 'saved' && 'Yeni Detaylı Kitle'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* ── Tip seçimi ── */}
          {phase === 'select-type' && (
            <div>
              <p className="text-sm text-gray-500 mb-6">
                Oluşturmak istediğiniz kitle tipini seçin.
              </p>
              <div className="space-y-3">
                {TYPE_OPTIONS.map(({ type, phase: p, label, description, icon: Icon }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPhase(p)}
                    className="w-full text-left p-5 rounded-xl border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
                        <Icon className="w-6 h-6 text-gray-500 group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">
                          {label}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Custom Audience Wizard ── */}
          {phase === 'custom' && (
            <div>
              <AudienceWizardProgress steps={CUSTOM_STEPS} currentStep={customState.currentStep} />
              {customState.currentStep === 1 && <CustomStepSource state={customState} onChange={customOnChange} assets={assets} />}
              {customState.currentStep === 2 && <CustomStepRule state={customState} onChange={customOnChange} assets={assets} />}
              {customState.currentStep === 3 && <CustomStepExclude state={customState} onChange={customOnChange} />}
              {customState.currentStep === 4 && <CustomStepSummary state={customState} onChange={customOnChange} />}
              <AudienceWizardNavigation
                currentStep={customState.currentStep}
                totalSteps={4}
                onBack={() => navigateStep(customState.currentStep, 'back', 4, (s) => setCustomState((p) => ({ ...p, currentStep: s as CustomAudienceState['currentStep'] })), 'CUSTOM')}
                onNext={() => navigateStep(customState.currentStep, 'next', 4, (s) => setCustomState((p) => ({ ...p, currentStep: s as CustomAudienceState['currentStep'] })), 'CUSTOM')}
                canGoNext={customCanGoNext()}
                isSubmitting={isSubmitting}
              />
            </div>
          )}

          {/* ── Lookalike Wizard ── */}
          {phase === 'lookalike' && (
            <div>
              <AudienceWizardProgress steps={LOOKALIKE_STEPS} currentStep={lookalikeState.currentStep} />
              {lookalikeState.currentStep === 1 && <LookalikeStepSeed state={lookalikeState} onChange={lookalikeOnChange} />}
              {lookalikeState.currentStep === 2 && <LookalikeStepCountry state={lookalikeState} onChange={lookalikeOnChange} />}
              {lookalikeState.currentStep === 3 && <LookalikeStepSize state={lookalikeState} onChange={lookalikeOnChange} />}
              {lookalikeState.currentStep === 4 && <LookalikeStepSummary state={lookalikeState} onChange={lookalikeOnChange} />}
              <AudienceWizardNavigation
                currentStep={lookalikeState.currentStep}
                totalSteps={4}
                onBack={() => navigateStep(lookalikeState.currentStep, 'back', 4, (s) => setLookalikeState((p) => ({ ...p, currentStep: s as LookalikeState['currentStep'] })), 'LOOKALIKE')}
                onNext={() => navigateStep(lookalikeState.currentStep, 'next', 4, (s) => setLookalikeState((p) => ({ ...p, currentStep: s as LookalikeState['currentStep'] })), 'LOOKALIKE')}
                canGoNext={lookalikeCanGoNext()}
                isSubmitting={isSubmitting}
              />
            </div>
          )}

          {/* ── Saved Audience Wizard ── */}
          {phase === 'saved' && (
            <div>
              <AudienceWizardProgress steps={SAVED_STEPS} currentStep={savedState.currentStep} />
              {savedState.currentStep === 1 && <SavedStepLocation state={savedState} onChange={savedOnChange} />}
              {savedState.currentStep === 2 && <SavedStepDemography state={savedState} onChange={savedOnChange} />}
              {savedState.currentStep === 3 && <SavedStepLanguage state={savedState} onChange={savedOnChange} />}
              {savedState.currentStep === 4 && <SavedStepInterests state={savedState} onChange={savedOnChange} />}
              {savedState.currentStep === 5 && <SavedStepExclude state={savedState} onChange={savedOnChange} />}
              {savedState.currentStep === 6 && <SavedStepSummary state={savedState} onChange={savedOnChange} />}
              <AudienceWizardNavigation
                currentStep={savedState.currentStep}
                totalSteps={6}
                onBack={() => navigateStep(savedState.currentStep, 'back', 6, (s) => setSavedState((p) => ({ ...p, currentStep: s as SavedAudienceState['currentStep'] })), 'SAVED')}
                onNext={() => navigateStep(savedState.currentStep, 'next', 6, (s) => setSavedState((p) => ({ ...p, currentStep: s as SavedAudienceState['currentStep'] })), 'SAVED')}
                canGoNext={savedCanGoNext()}
                isSubmitting={isSubmitting}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
