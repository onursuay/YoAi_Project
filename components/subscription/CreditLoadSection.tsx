'use client'

import { useState } from 'react'
import { Coins, Sparkles, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCredits } from '@/components/providers/CreditProvider'
import { CREDIT_PACKAGES } from '@/lib/subscription/plans'

export default function CreditLoadSection() {
  const t = useTranslations('subscription.credits')
  const { credits, addCredits } = useCredits()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [purchased, setPurchased] = useState(false)

  const selectedPkg = CREDIT_PACKAGES.find(p => p.id === selectedId)

  const handlePurchase = () => {
    if (!selectedPkg) return
    // TODO: Payment integration — for now just add credits
    addCredits(selectedPkg.credits)
    setPurchased(true)
    setTimeout(() => {
      setPurchased(false)
      setSelectedId(null)
    }, 2000)
  }

  return (
    <div id="krediler" className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-base font-bold text-gray-900 mb-4">{t('title')}</h3>

      {/* Current balance */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <Coins className="w-6 h-6 text-amber-500" />
        <div>
          <p className="text-sm text-amber-600">{t('balance')}</p>
          <p className="text-2xl font-bold text-amber-700">{credits}</p>
        </div>
      </div>

      {/* Credit packages — select one */}
      <div className="space-y-3 mb-4">
        {CREDIT_PACKAGES.map(pkg => {
          const isSelected = selectedId === pkg.id
          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelectedId(isSelected ? null : pkg.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-colors text-left ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : pkg.popular
                    ? 'border-primary/40 bg-primary/5 hover:border-primary'
                    : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isSelected || pkg.popular ? 'bg-primary/10' : 'bg-gray-100'
                }`}>
                  {isSelected ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Coins className={`w-4 h-4 ${pkg.popular ? 'text-primary' : 'text-gray-500'}`} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{pkg.label}</p>
                  <p className="text-sm text-gray-500">{pkg.credits} kredi</p>
                </div>
                {pkg.popular && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-primary text-white rounded-full">
                    <Sparkles className="w-3 h-3 inline mr-0.5" />
                    Popüler
                  </span>
                )}
              </div>
              <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                ₺{pkg.price}
              </span>
            </button>
          )
        })}
      </div>

      {/* Purchase button */}
      <button
        onClick={handlePurchase}
        disabled={!selectedPkg || purchased}
        className={`w-full py-3 text-sm font-medium rounded-xl transition-colors ${
          selectedPkg && !purchased
            ? 'bg-primary text-white hover:bg-primary/90'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {purchased
          ? t('purchased') ?? 'Kredi Yüklendi!'
          : selectedPkg
            ? `₺${selectedPkg.price} — ${t('buy') ?? 'Satın Al'}`
            : t('selectPackage') ?? 'Paket Seçin'}
      </button>

      {/* Info */}
      <div className="space-y-1.5 text-sm text-gray-500 mt-4">
        <p>{t('perGeneration')}</p>
        <p className="text-primary font-medium">{t('freeCredits')}</p>
      </div>
    </div>
  )
}
