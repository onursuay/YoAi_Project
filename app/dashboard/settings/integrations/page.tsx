'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Topbar from '@/components/Topbar'
import MetaConnectWizard from '@/components/MetaConnectWizard'
import { Puzzle, Facebook, Search, MessageSquare, AlertCircle, ArrowRight } from 'lucide-react'

function EntegrasyonContent() {
  const searchParams = useSearchParams()
  const [selectedAccountName, setSelectedAccountName] = useState<string | null>(null)

  useEffect(() => {
    const metaParam = searchParams.get('meta')
    if (metaParam === 'connected' || metaParam === 'error' || metaParam === 'connected_pending') {
      window.history.replaceState({}, '', '/dashboard/settings/integrations')
    }
    
    // Check for selected account
    const checkAccount = async () => {
      try {
        const response = await fetch('/api/meta/status')
        if (response.ok) {
          const data = await response.json()
          if (data.connected && data.adAccountName) {
            setSelectedAccountName(data.adAccountName)
          }
        }
      } catch (err) {
        // Ignore errors
      }
    }
    checkAccount()
  }, [searchParams])
  return (
    <>
      <Topbar 
        title="Entegrasyon" 
        description="Reklam ve raporlama platformlarınızı bağlayın"
      />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Puzzle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Entegrasyon
                </h2>
                <p className="text-gray-600">
                  Reklam ve raporlama platformlarınızı bağlayarak kampanyalarınızı tek bir yerden yönetin.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reklam Platformları
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border-2 border-primary p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Facebook className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Meta Ads</h4>
                      {selectedAccountName ? (
                        <p className="text-sm text-gray-600">Hesap: {selectedAccountName}</p>
                      ) : (
                        <p className="text-sm text-gray-500">Bağlan</p>
                      )}
                    </div>
                  </div>
                </div>
                <MetaConnectWizard />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <Search className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Google Ads</h4>
                      <p className="text-sm text-gray-500">Bağlanmadı</p>
                    </div>
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 text-primary text-sm font-medium hover:text-primary/80 transition-colors">
                  Hesap bağla <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-60 cursor-not-allowed">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">TikTok Ads</h4>
                      <p className="text-sm text-gray-500">Yakında</p>
                    </div>
                  </div>
                </div>
                <div className="w-full flex items-center justify-center gap-2 text-gray-400 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>Yakında</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Raporlama Platformları
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Search className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Google Analytics</h4>
                      <p className="text-sm text-gray-500">Bağlanmadı</p>
                    </div>
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 text-primary text-sm font-medium hover:text-primary/80 transition-colors">
                  Hesap bağla <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-60 cursor-not-allowed">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Slack</h4>
                      <p className="text-sm text-gray-500">Yakında</p>
                    </div>
                  </div>
                </div>
                <div className="w-full flex items-center justify-center gap-2 text-gray-400 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>Yakında</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function EntegrasyonPage() {
  return (
    <Suspense fallback={
      <>
        <Topbar 
          title="Entegrasyon" 
          description="Reklam ve raporlama platformlarınızı bağlayın"
        />
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-12">
              <p className="text-gray-600">Yükleniyor...</p>
            </div>
          </div>
        </div>
      </>
    }>
      <EntegrasyonContent />
    </Suspense>
  )
}

