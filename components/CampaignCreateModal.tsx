'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface CampaignCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onToast?: (message: string, type: 'success' | 'error') => void
}

export default function CampaignCreateModal({ isOpen, onClose, onSuccess, onToast }: CampaignCreateModalProps) {
  const t = useTranslations('meta.campaignModal')
  const tDashboard = useTranslations('dashboard.meta')
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('ENGAGEMENT')
  const [dailyBudget, setDailyBudget] = useState('')
  const [specialAdCategory, setSpecialAdCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<{ title: string; desc: string } | null>(null)

  const objectives = [
    { value: 'AWARENESS', labelKey: 'awareness' },
    { value: 'TRAFFIC', labelKey: 'traffic' },
    { value: 'ENGAGEMENT', labelKey: 'engagement' },
    { value: 'LEADS', labelKey: 'leads' },
    { value: 'APP_PROMOTION', labelKey: 'appPromotion' },
    { value: 'SALES', labelKey: 'sales' }
  ]

  const specialAdCategories = [
    { value: 'CREDIT', key: 'credit' },
    { value: 'EMPLOYMENT', key: 'employment' },
    { value: 'HOUSING', key: 'housing' },
    { value: 'SOCIAL_ISSUES_ELECTIONS_POLITICS', key: 'politics' }
  ]

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    // Client-side validation
    const trimmedName = name.trim()
    if (!trimmedName || trimmedName.length < 1) {
      setError({
        title: tDashboard('errors.invalidForm.title'),
        desc: tDashboard('errors.invalidForm.desc'),
      })
      setIsSubmitting(false)
      return
    }

    if (!objective) {
      setError({
        title: tDashboard('errors.invalidForm.title'),
        desc: tDashboard('errors.invalidForm.desc'),
      })
      setIsSubmitting(false)
      return
    }

    if (dailyBudget && (isNaN(parseFloat(dailyBudget)) || parseFloat(dailyBudget) <= 0)) {
      setError({
        title: tDashboard('errors.invalidForm.title'),
        desc: tDashboard('errors.invalidForm.desc'),
      })
      setIsSubmitting(false)
      return
    }

    try {
      // Get account_id from status endpoint
      const statusResponse = await fetch('/api/meta/status')
      const statusData = statusResponse.ok ? await statusResponse.json() : null
      const accountId = statusData?.adAccountId

      if (!accountId) {
        setError({
          title: tDashboard('errors.noAdAccount'),
          desc: tDashboard('errors.noAdAccountDesc'),
        })
        setIsSubmitting(false)
        return
      }

      // Auto-set NONE if empty/not selected
      const selected = specialAdCategory
      const finalCategory = selected && selected.trim() ? selected : 'NONE'

      const response = await fetch('/api/meta/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adAccountId: accountId,
          name: trimmedName,
          objective,
          dailyBudget: dailyBudget ? parseFloat(dailyBudget) : undefined,
          specialAdCategory: finalCategory,
        }),
      })

      const data = await response.json()

      if (response.ok && data.ok === true) {
        // Success
        if (onToast) {
          onToast(tDashboard('toast.createSuccess'), 'success')
        }
        onSuccess()
        onClose()
        setName('')
        setDailyBudget('')
        setObjective('ENGAGEMENT')
        setSpecialAdCategory('')
        setError(null)
      } else {
        // Error handling
        const errorType = data.error || 'unknown'
        let errorTitle = tDashboard('errors.unknown.title')
        let errorDesc = tDashboard('errors.unknown.desc')

        if (errorType === 'invalid_input' || errorType === 'validation_error') {
          errorTitle = tDashboard('errors.invalidForm.title')
          errorDesc = data.message || tDashboard('errors.invalidForm.desc')
        } else if (errorType === 'permission_denied') {
          errorTitle = tDashboard('errors.metaApi.title')
          errorDesc = data.message || tDashboard('errors.metaApi.desc')
        } else if (errorType === 'rate_limit_exceeded') {
          errorTitle = tDashboard('errors.metaApi.title')
          errorDesc = data.message || tDashboard('errors.metaApi.desc')
        } else if (errorType === 'meta_api_error') {
          errorTitle = tDashboard('errors.metaApi.title')
          errorDesc = data.message || tDashboard('errors.metaApi.desc')
        } else if (data.code === 100 || (data.message && data.message.includes('special_ad_categories'))) {
          // Meta error #100: special_ad_categories required
          errorTitle = tDashboard('errors.specialAdCategoryRequired.title')
          errorDesc = tDashboard('errors.specialAdCategoryRequired.desc')
        }

        setError({ title: errorTitle, desc: errorDesc })

        // Also show toast if available
        if (onToast) {
          onToast(`${errorTitle}: ${errorDesc}`, 'error')
        }
      }
    } catch (error) {
      console.error('Campaign create error:', error)
      const errorTitle = tDashboard('errors.unknown.title')
      const errorDesc = tDashboard('errors.unknown.desc')
      setError({ title: errorTitle, desc: errorDesc })
      if (onToast) {
        onToast(`${errorTitle}: ${errorDesc}`, 'error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4">{t('title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-red-800 mb-1">{error.title}</p>
              <p className="text-caption text-red-600">{error.desc}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('campaignName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
              minLength={1}
              maxLength={256}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('objective')} <span className="text-red-500">*</span>
            </label>
            <select
              value={objective}
              onChange={(e) => {
                setObjective(e.target.value)
                setError(null)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              {objectives.map(obj => (
                <option key={obj.value} value={obj.value}>
                  {t(obj.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('dailyBudget')}
            </label>
            <input
              type="number"
              value={dailyBudget}
              onChange={(e) => {
                setDailyBudget(e.target.value)
                setError(null)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tDashboard('create.specialAd.label')}
            </label>
            <select
              value={specialAdCategory}
              onChange={(e) => {
                setSpecialAdCategory(e.target.value)
                setError(null)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">{tDashboard('create.specialAd.placeholder')}</option>
              {specialAdCategories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {tDashboard(`create.specialAd.options.${cat.key}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('creating') : t('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
