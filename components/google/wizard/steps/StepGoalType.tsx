'use client'

import { ShoppingCart, Users, Globe, Eye, Smartphone, MapPin, Compass, Search, Monitor, PlayCircle, ShoppingBag, Zap, MessageCircle } from 'lucide-react'
import type { StepProps, CampaignGoal, AdvertisingChannelType } from '../shared/WizardTypes'
import { GOAL_CAMPAIGN_TYPES, CAMPAIGN_TYPE_BIDDING } from '../shared/WizardTypes'

const GOAL_IDS: CampaignGoal[] = ['SALES', 'LEADS', 'WEBSITE_TRAFFIC', 'APP_PROMOTION', 'BRAND_AWARENESS', 'LOCAL_STORE', 'NO_GOAL']
const GOAL_ICONS: Record<CampaignGoal, typeof ShoppingCart> = {
  SALES: ShoppingCart,
  LEADS: Users,
  WEBSITE_TRAFFIC: Globe,
  APP_PROMOTION: Smartphone,
  BRAND_AWARENESS: Eye,
  LOCAL_STORE: MapPin,
  NO_GOAL: Compass,
}

const CAMPAIGN_TYPE_ICONS: Record<AdvertisingChannelType, typeof Search> = {
  SEARCH: Search,
  DISPLAY: Monitor,
  VIDEO: PlayCircle,
  SHOPPING: ShoppingBag,
  PERFORMANCE_MAX: Zap,
  DEMAND_GEN: MessageCircle,
  MULTI_CHANNEL: Smartphone,
  SMART: Zap,
  LOCAL: MapPin,
}

export default function StepGoalType({ state, update, t }: StepProps) {
  const availableTypes = GOAL_CAMPAIGN_TYPES[state.campaignGoal] ?? []

  const handleGoalChange = (goal: CampaignGoal) => {
    const types = GOAL_CAMPAIGN_TYPES[goal] ?? []
    const firstType = types[0]?.type ?? 'SEARCH'
    const availableBidding = CAMPAIGN_TYPE_BIDDING[firstType] ?? ['MAXIMIZE_CLICKS']
    update({
      campaignGoal: goal,
      campaignType: firstType,
      // Reset bidding to first available for new campaign type
      biddingStrategy: availableBidding[0],
      // Reset network settings based on type
      networkSettings: {
        targetGoogleSearch: firstType === 'SEARCH',
        targetSearchNetwork: firstType === 'SEARCH',
        targetContentNetwork: firstType === 'DISPLAY',
      },
    })
  }

  const handleTypeChange = (type: AdvertisingChannelType) => {
    const availableBidding = CAMPAIGN_TYPE_BIDDING[type] ?? ['MAXIMIZE_CLICKS']
    update({
      campaignType: type,
      biddingStrategy: availableBidding[0],
      networkSettings: {
        targetGoogleSearch: type === 'SEARCH',
        targetSearchNetwork: type === 'SEARCH',
        targetContentNetwork: type === 'DISPLAY',
      },
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('goal.selectTitle')}</h3>
        <p className="text-sm text-gray-500">{t('goal.selectDesc')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {GOAL_IDS.map(id => {
          const active = state.campaignGoal === id
          const Icon = GOAL_ICONS[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleGoalChange(id)}
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                active
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${id === 'NO_GOAL' ? 'col-span-2' : ''}`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>{t(`goal.labels.${id}`)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t(`goal.descs.${id}`)}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Kampanya Türü yalnızca "Kılavuz Olmadan" seçilince görünür */}
      {state.campaignGoal === 'NO_GOAL' && availableTypes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('goal.campaignTypeTitle')}</h4>
          <div className={`grid gap-2 ${availableTypes.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {availableTypes.map(ct => {
              const active = state.campaignType === ct.type
              const Icon = CAMPAIGN_TYPE_ICONS[ct.type] ?? Search
              return (
                <button
                  key={ct.type}
                  type="button"
                  onClick={() => handleTypeChange(ct.type)}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                    active
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>{t(`summary.campaignTypeLabels.${ct.type}`)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t(`campaignTypeDescs.${ct.type}`)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
