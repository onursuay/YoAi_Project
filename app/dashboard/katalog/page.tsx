'use client'

import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'

export default function KatalogPage() {
  const t = useTranslations('dashboard.katalog')
  return (
    <>
      <Topbar 
        title={t('title')} 
        description={t('description')}
      />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Katalog
            </h2>
            <p className="text-gray-600">
              Bu modül yakında aktif olacak.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

