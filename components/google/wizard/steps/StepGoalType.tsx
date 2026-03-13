'use client'

import { ShoppingCart, Users, Globe, Eye, Smartphone, MapPin, Compass, Search, Monitor, PlayCircle, ShoppingBag, Zap, MessageCircle } from 'lucide-react'
import type { StepProps, CampaignGoal, AdvertisingChannelType } from '../shared/WizardTypes'
import { GOAL_CAMPAIGN_TYPES, CAMPAIGN_TYPE_BIDDING } from '../shared/WizardTypes'

const goals: Array<{ id: CampaignGoal; icon: typeof ShoppingCart; label: string; desc: string }> = [
  { id: 'SALES', icon: ShoppingCart, label: 'Satış', desc: 'Online, uygulama, telefon veya mağaza içi satışları artırın' },
  { id: 'LEADS', icon: Users, label: 'Potansiyel Müşteriler', desc: 'Potansiyel müşteri formları ve kayıtlar toplayın' },
  { id: 'WEBSITE_TRAFFIC', icon: Globe, label: 'Web Sitesi Trafiği', desc: 'Web sitenize daha fazla ziyaretçi çekin' },
  { id: 'APP_PROMOTION', icon: Smartphone, label: 'Uygulama Tanıtımı', desc: 'Uygulamanızın yüklenmesini ve etkileşimini artırın' },
  { id: 'BRAND_AWARENESS', icon: Eye, label: 'Bilinirlik ve Markayı Dikkate Alma', desc: 'Markanızı daha geniş kitlelere ulaştırın' },
  { id: 'LOCAL_STORE', icon: MapPin, label: 'Yerel Mağaza Ziyaretleri', desc: 'Mağazanıza gerçek ziyaretleri artırın' },
  { id: 'NO_GOAL', icon: Compass, label: 'Kılavuz Olmadan Kampanya Oluştur', desc: 'Hedef belirlemeden doğrudan kampanya oluşturun' },
]

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

export default function StepGoalType({ state, update }: StepProps) {
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
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Kampanya Hedefinizi Seçin</h3>
        <p className="text-sm text-gray-500">Kampanyanızla ne elde etmek istiyorsunuz?</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {goals.map(g => {
          const active = state.campaignGoal === g.id
          const Icon = g.icon
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => handleGoalChange(g.id)}
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                active
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${g.id === 'NO_GOAL' ? 'col-span-2' : ''}`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>{g.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{g.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Dynamic Campaign Type Selection */}
      {availableTypes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Kampanya Türü</h4>
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
                    <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>{ct.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{ct.desc}</p>
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
