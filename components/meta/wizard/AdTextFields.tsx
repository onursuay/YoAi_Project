'use client'

import { useEffect, useState } from 'react'
import type { WizardState } from './types'
import WizardSelect from './WizardSelect'
import { getAllowedCTAs, getDefaultCTA, requiresWebsiteUrl } from '@/lib/meta/spec/objectiveSpec'
import { getWizardTranslations, getLocaleFromCookie } from '@/lib/i18n/wizardTranslations'
import { CTA_LABEL_TR } from '@/lib/meta/ctaLabels'

interface AdTextFieldsProps {
  state: WizardState['ad']
  campaignObjective?: string
  conversionLocation?: string
  optimizationGoal?: string
  onChange: (updates: Partial<WizardState['ad']>) => void
  errors?: Record<string, string>
  isMessaging?: boolean
  isCall?: boolean
  isOnPage?: boolean
  isOnAd?: boolean
  isAppPromotion?: boolean
  isCatalog?: boolean
  isLeadsOnAd?: boolean
  activeLeadForms?: Array<{ form_id: string; name: string; privacy_policy_url?: string }>
}

export default function AdTextFields({ state, campaignObjective = 'OUTCOME_TRAFFIC', conversionLocation = 'WEBSITE', optimizationGoal = 'LINK_CLICKS', onChange, errors = {}, isMessaging = false, isCall = false, isOnPage = false, isOnAd = false, isAppPromotion = false, isCatalog = false, isLeadsOnAd = false, activeLeadForms = [] }: AdTextFieldsProps) {
  const locale = getLocaleFromCookie()
  const t = getWizardTranslations(locale)

  const allowedCTAs = getAllowedCTAs(campaignObjective, conversionLocation, optimizationGoal)
  const ctaOptions = allowedCTAs.map((value) => ({
    value,
    label: locale === 'en' ? ((t[value as keyof typeof t] as string) ?? CTA_LABEL_TR[value] ?? value) : (CTA_LABEL_TR[value] ?? value),
  }))
  const [ctaAutoUpdated, setCtaAutoUpdated] = useState(false)

  // Destination veya objective değişince websiteUrl kontrolü
  const showWebsiteUrl = requiresWebsiteUrl(campaignObjective, conversionLocation, optimizationGoal) && !isMessaging && !isCall && !isOnAd && !isOnPage && !isAppPromotion && !isCatalog

  // Geçersiz CTA'yı sadece objective veya destination değiştiğinde defaultCTA'ya resetle
  useEffect(() => {
    if (!allowedCTAs.length) return
    const currentIncluded = allowedCTAs.includes(state.callToAction)
    if (!currentIncluded) {
      const defaultCTA = getDefaultCTA(campaignObjective, conversionLocation, optimizationGoal)
      onChange({ callToAction: defaultCTA })
      setCtaAutoUpdated(true)
    } else {
      setCtaAutoUpdated(false)
    }
  }, [campaignObjective, conversionLocation])

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t.primaryText} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={state.primaryText}
          onChange={(e) => onChange({ primaryText: e.target.value })}
          placeholder={isCatalog ? '{{product.name}} - {{product.description}}' : t.primaryTextPlaceholder}
          rows={4}
          maxLength={3000}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
        />
        <p className="mt-1 text-caption text-gray-500">{state.primaryText.length} / 3000 ({t.primaryTextHint})</p>
        {isCatalog && (
          <p className="mt-1 text-caption text-blue-600">Katalog alanlarını kullanabilirsiniz: {'{{product.name}}'}, {'{{product.price}}'}, {'{{product.description}}'}</p>
        )}
        {errors.primaryText && <p className="mt-1 text-sm text-red-600">{errors.primaryText}</p>}
      </div>

      {!isMessaging && !isCall && !isOnPage && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t.headline}</label>
          <input
            type="text"
            value={state.headline}
            onChange={(e) => onChange({ headline: e.target.value })}
            placeholder={t.headlinePlaceholder}
            maxLength={40}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
          />
          <p className="mt-1 text-caption text-gray-500">{state.headline.length} / 40</p>
        </div>
      )}

      {!isMessaging && !isCall && !isOnPage && !isOnAd && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t.description}</label>
          <input
            type="text"
            value={state.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={t.descriptionPlaceholder}
            maxLength={30}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
          />
          <p className="mt-1 text-caption text-gray-500">{state.description.length} / 30</p>
        </div>
      )}

      {/* Website URL — sadece destination gerektiriyorsa göster */}
      {showWebsiteUrl && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t.websiteUrl} <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={state.websiteUrl}
            onChange={(e) => onChange({ websiteUrl: e.target.value })}
            placeholder="https://..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
          />
          {errors.websiteUrl && <p className="mt-1 text-sm text-red-600">{errors.websiteUrl}</p>}
        </div>
      )}

      {/* Display URL — sadece websiteUrl gösteriliyorsa anlamlı */}
      {showWebsiteUrl && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t.displayUrl}</label>
          <input
            type="text"
            value={state.displayUrl}
            onChange={(e) => onChange({ displayUrl: e.target.value })}
            placeholder={t.displayUrlPlaceholder}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
          />
        </div>
      )}

      {/* Leads + ON_AD: Potansiyel Müşteri Formu — CTA'dan önce */}
      {isLeadsOnAd && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t.leadFormLabel} <span className="text-red-500">*</span>
          </label>
          {activeLeadForms.length > 0 ? (
            <WizardSelect
              value={state.leadFormId ?? ''}
              onChange={(selectedFormId) => {
                const selectedForm = activeLeadForms.find(f => f.form_id === selectedFormId)
                onChange({
                  leadFormId: selectedFormId || undefined,
                  ...(selectedForm?.privacy_policy_url && !state.websiteUrl ? { websiteUrl: selectedForm.privacy_policy_url } : {}),
                })
              }}
              placeholder={t.selectForm}
              options={[
                { value: '', label: t.selectForm },
                ...activeLeadForms.map((f) => ({ value: f.form_id, label: f.name })),
              ]}
            />
          ) : (
            <p className="text-sm text-amber-600">
              {t.leadFormNotFound}
            </p>
          )}
          {errors.lead_form && <p className="mt-1 text-sm text-red-600">{errors.lead_form}</p>}
        </div>
      )}

      {!isCall && !isOnPage && (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">{t.ctaButton}</label>
        {conversionLocation === 'INSTAGRAM_DIRECT' || conversionLocation === 'MESSENGER' || conversionLocation === 'WHATSAPP' ? (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            {conversionLocation === 'WHATSAPP' && (
              <svg className="h-4 w-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.553 4.103 1.523 5.827L.057 23.928l6.266-1.443A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.667-.5-5.207-1.377l-.373-.221-3.861.889.924-3.768-.243-.389A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            )}
            {conversionLocation === 'MESSENGER' && (
              <svg className="h-4 w-4 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.733 8l3.13 3.259L19.752 8l-6.559 6.963z"/>
              </svg>
            )}
            {conversionLocation === 'INSTAGRAM_DIRECT' && (
              <svg className="h-4 w-4 shrink-0 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            )}
            <span className="font-medium">{t.sendMessage}</span>
          </div>
        ) : (
          <>
            <WizardSelect
              value={state.callToAction}
              onChange={(v) => { onChange({ callToAction: v }); setCtaAutoUpdated(false) }}
              options={ctaOptions}
            />
            {ctaAutoUpdated && (
              <p className="mt-1 text-caption text-amber-600">{t.ctaAutoUpdated}</p>
            )}
          </>
        )}
      </div>
      )}

    </div>
  )
}
