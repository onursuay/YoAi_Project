'use client'

import type { WizardState } from './types'
import { getWizardTranslations, getLocaleFromCookie } from '@/lib/i18n/wizardTranslations'

interface FxState {
  status: 'loading' | 'ready' | 'error'
  rate?: number
  asOf?: string
}

interface StepSummaryProps {
  state: WizardState
  accountCurrency?: string | null
  fxState?: FxState
}

export default function StepSummary({ state, accountCurrency = null, fxState }: StepSummaryProps) {
  const t = getWizardTranslations(getLocaleFromCookie())
  const { campaign, adset, ad } = state

  const OBJECTIVE_LABELS: Record<string, string> = {
    OUTCOME_AWARENESS: t.OUTCOME_AWARENESS, OUTCOME_TRAFFIC: t.OUTCOME_TRAFFIC,
    OUTCOME_ENGAGEMENT: t.OUTCOME_ENGAGEMENT, OUTCOME_LEADS: t.OUTCOME_LEADS,
    OUTCOME_APP_PROMOTION: t.OUTCOME_APP_PROMOTION, OUTCOME_SALES: t.OUTCOME_SALES,
  }
  const FORMAT_LABELS: Record<string, string> = {
    single_image: t.singleImage, single_video: t.singleVideo, carousel: t.carousel,
  }

  // CTA translations for user-friendly display
  const CTA_LABELS: Record<string, string> = {
    WHATSAPP_MESSAGE: t.SEND_WHATSAPP_MESSAGE,
    SEND_MESSAGE: t.SEND_WHATSAPP_MESSAGE,
    LEARN_MORE: t.LEARN_MORE,
    SHOP_NOW: t.SHOP_NOW,
    SIGN_UP: t.SIGN_UP,
    CALL_NOW: 'Call Now',
    DOWNLOAD: t.DOWNLOAD,
    BOOK_NOW: t.BOOK_NOW,
    CONTACT_US: t.CONTACT_US,
    GET_QUOTE: t.GET_QUOTE,
    SUBSCRIBE: 'Subscribe',
    APPLY_NOW: t.APPLY_NOW,
    WATCH_MORE: t.WATCH_MORE,
    NO_BUTTON: t.NO_BUTTON,
  }

  // Check if this is a messaging destination (WhatsApp/Messenger)
  const isMessagingDest = adset.conversionLocation === 'WHATSAPP' || adset.conversionLocation === 'MESSENGER'

  return (
    <div className="space-y-8">
      <div className="light-sweep-wrapper rounded-md w-fit">
        <h3 className="text-lg font-semibold text-gray-900">{t.summaryAndPublish}</h3>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">{t.campaignSummary}</h4>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-gray-500">{t.campaignNameLabel}</dt>
            <dd className="font-medium">{campaign.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">{t.objectiveLabel}</dt>
            <dd className="font-medium">{OBJECTIVE_LABELS[campaign.objective] ?? campaign.objective}</dd>
          </div>
          <div>
            <dt className="text-gray-500">{t.budgetOptLabel}</dt>
            <dd className="font-medium">
              {campaign.budgetOptimization === 'campaign' ? t.advantageCampaignBudget : t.adsetBudget}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">{t.adsetSummary}</h4>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-gray-500">{t.adsetNameLabel}</dt>
            <dd className="font-medium">{adset.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">{t.targetAudience}</dt>
            <dd className="font-medium">
              {t.age} {adset.targeting.ageMin}-{adset.targeting.ageMax}, {t.locations}: {adset.targeting.locations.length || 0}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">{t.budgetAndSchedule}</dt>
            <dd className="font-medium">
              {adset.budgetType === 'daily' ? t.daily : t.lifetime} {adset.budget != null ? `${adset.budget} TRY` : '—'}
              {adset.budget != null && accountCurrency && accountCurrency !== 'TRY' && fxState?.status === 'ready' && fxState.rate ? (
                <span className="ml-1 text-caption text-gray-500">
                  (≈ {(adset.budget / fxState.rate).toFixed(2)} {accountCurrency})
                </span>
              ) : null}
            </dd>
            {accountCurrency && accountCurrency !== 'TRY' && fxState?.status === 'ready' && fxState.rate && fxState.asOf && fxState.asOf !== 'env-fallback' && (
              <dd className="text-caption text-gray-400 mt-0.5">
                Kur: 1 {accountCurrency} = {fxState.rate.toFixed(2)} TRY (güncelleme: {(() => { try { return new Date(fxState.asOf).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) } catch { return fxState.asOf } })()})
              </dd>
            )}
          </div>
          <div>
            <dt className="text-gray-500">{t.placements}</dt>
            <dd className="font-medium">
              {adset.placements === 'advantage' ? t.advantagePlacements : t.manual}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">{t.adSummary}</h4>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-gray-500">{t.adNameLabel}</dt>
            <dd className="font-medium">{ad.name || '—'}</dd>
          </div>

          {/* Dynamic content based on ad creation mode */}
          {ad.adCreationMode === 'existing' ? (
            <>
              {/* Existing Post Mode */}
              <div>
                <dt className="text-gray-500">{t.adCreationMode}</dt>
                <dd className="font-medium">{t.useExistingPost}</dd>
              </div>
              {ad.existingPostData && (
                <>
                  <div>
                    <dt className="text-gray-500">{getLocaleFromCookie() === 'tr' ? 'Seçilen Gönderi' : 'Selected Post'}</dt>
                    <dd className="space-y-2">
                      {(ad.existingPostData.media_url || ad.existingPostData.full_picture || ad.existingPostData.thumbnail_url) && (
                        <img
                          src={ad.existingPostData.media_url || ad.existingPostData.full_picture || ad.existingPostData.thumbnail_url}
                          alt="Post preview"
                          className="w-32 h-32 object-cover rounded border border-gray-200"
                        />
                      )}
                      {(ad.existingPostData.message || ad.existingPostData.caption) && (
                        <p className="text-sm text-gray-600 line-clamp-3">{ad.existingPostData.message || ad.existingPostData.caption}</p>
                      )}
                    </dd>
                  </div>
                </>
              )}
              {ad.callToAction && (
                <>
                  <div>
                    <dt className="text-gray-500">{t.ctaButton}</dt>
                    <dd className="font-medium">{CTA_LABELS[ad.callToAction] || ad.callToAction}</dd>
                  </div>
                  {/* Don't show URL for messaging destinations (WhatsApp/Messenger) - it's internal */}
                  {!isMessagingDest && ad.websiteUrl && (
                    <div>
                      <dt className="text-gray-500">{t.websiteUrl}</dt>
                      <dd className="font-medium truncate">{ad.websiteUrl}</dd>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Create New Ad Mode */}
              <div>
                <dt className="text-gray-500">{t.formatLabel}</dt>
                <dd className="font-medium">{FORMAT_LABELS[ad.format] ?? ad.format}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t.textPreview}</dt>
                <dd className="font-medium line-clamp-2">{ad.primaryText || '—'}</dd>
              </div>
              {/* Don't show URL for messaging destinations (WhatsApp/Messenger) */}
              {!isMessagingDest && (
                <div>
                  <dt className="text-gray-500">{t.targetUrl}</dt>
                  <dd className="font-medium truncate">{ad.websiteUrl || '—'}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">{t.ctaButton}</dt>
                <dd className="font-medium">{CTA_LABELS[ad.callToAction] || ad.callToAction || '—'}</dd>
              </div>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}
