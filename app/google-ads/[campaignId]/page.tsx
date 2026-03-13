'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Tabs from '@/components/Tabs'
import { useGoogleCampaignDetail } from '@/hooks/google/useGoogleCampaignDetail'
import CampaignOverviewTab from '@/components/google/detail/CampaignOverviewTab'
import CampaignSearchTermsTab from '@/components/google/detail/CampaignSearchTermsTab'
import CampaignLocationsTab from '@/components/google/detail/CampaignLocationsTab'
import CampaignAdScheduleTab from '@/components/google/detail/CampaignAdScheduleTab'
import CampaignLandingPagesTab from '@/components/google/detail/CampaignLandingPagesTab'
import CampaignAssetsTab from '@/components/google/detail/CampaignAssetsTab'

const tabs = [
  { id: 'overview', label: 'Genel Bakış' },
  { id: 'search-terms', label: 'Arama Terimleri' },
  { id: 'locations', label: 'Lokasyonlar' },
  { id: 'ad-schedule', label: 'Reklam Zamanlaması' },
  { id: 'landing-pages', label: 'Landing Pages' },
  { id: 'assets', label: 'Öğeler' },
]

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.campaignId as string
  const [activeTab, setActiveTab] = useState('overview')

  const data = useGoogleCampaignDetail(campaignId)

  const campaignName = data.detail?.campaign.name || `Kampanya ${campaignId}`

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/google-ads')}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{campaignName}</h1>
            {data.detail && (
              <p className="text-sm text-gray-500 mt-0.5">
                {data.detail.campaign.status === 'ENABLED' ? 'Aktif' : data.detail.campaign.status === 'PAUSED' ? 'Duraklatıldı' : data.detail.campaign.status}
                {data.detail.campaign.optimizationScore != null && (
                  <span className="ml-2">
                    · Opt. Skor: %{data.detail.campaign.optimizationScore.toFixed(0)}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {data.detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">Yükleniyor...</p>
          </div>
        ) : data.detailError ? (
          <div className="p-6">
            <div className="bg-red-50 text-red-700 rounded-lg p-4 text-sm">{data.detailError}</div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200">
              <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

              {activeTab === 'overview' && data.detail && (
                <CampaignOverviewTab detail={data.detail} />
              )}

              {activeTab === 'search-terms' && (
                <CampaignSearchTermsTab
                  searchTerms={data.searchTerms}
                  isLoading={data.searchTermsLoading}
                  error={data.searchTermsError}
                  onFetch={data.fetchSearchTerms}
                />
              )}

              {activeTab === 'locations' && (
                <CampaignLocationsTab
                  locations={data.locations}
                  isLoading={data.locationsLoading}
                  error={data.locationsError}
                  onFetch={data.fetchLocations}
                />
              )}

              {activeTab === 'ad-schedule' && (
                <CampaignAdScheduleTab
                  schedule={data.schedule}
                  isLoading={data.scheduleLoading}
                  error={data.scheduleError}
                  onFetch={data.fetchSchedule}
                />
              )}

              {activeTab === 'landing-pages' && (
                <CampaignLandingPagesTab
                  landingPages={data.landingPages}
                  isLoading={data.landingPagesLoading}
                  error={data.landingPagesError}
                  onFetch={data.fetchLandingPages}
                />
              )}

              {activeTab === 'assets' && (
                <CampaignAssetsTab
                  assets={data.assets}
                  isLoading={data.assetsLoading}
                  error={data.assetsError}
                  onFetch={data.fetchAssets}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
