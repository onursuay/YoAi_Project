'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import { getStoredInvoiceInfo, setStoredInvoiceInfo, getStoredInvoiceHistory } from '@/lib/subscription/storage'
import type { InvoiceInfo, InvoiceType, InvoiceRecord } from '@/lib/subscription/types'

const DEFAULT_INVOICE_INFO: InvoiceInfo = {
  type: 'individual',
  fullName: '',
  phone: '',
  country: 'Türkiye',
  city: '',
  district: '',
  postalCode: '',
  address: '',
}

export default function FaturalarimPage() {
  const t = useTranslations('invoices')

  const [info, setInfo] = useState<InvoiceInfo>(DEFAULT_INVOICE_INFO)
  const [history, setHistory] = useState<InvoiceRecord[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = getStoredInvoiceInfo()
    if (stored) setInfo(stored)
    setHistory(getStoredInvoiceHistory())
  }, [])

  const handleTypeChange = (type: InvoiceType) => {
    setInfo(prev => ({ ...prev, type }))
  }

  const handleSave = () => {
    setStoredInvoiceInfo(info)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <Topbar title={t('title')} description={t('description')} />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left: Invoice Info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-base font-bold text-gray-900 mb-1">{t('info')}</h3>
              <p className="text-sm text-gray-500 mb-5">{t('infoDesc')}</p>

              {/* Type toggle */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5">
                <button
                  onClick={() => handleTypeChange('individual')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    info.type === 'individual'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t('individual')}
                </button>
                <button
                  onClick={() => handleTypeChange('corporate')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    info.type === 'corporate'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t('corporate')}
                </button>
              </div>

              <div className="space-y-4">
                {/* Name fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('fullName')}</label>
                    <input
                      type="text"
                      value={info.fullName}
                      onChange={e => setInfo({ ...info, fullName: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('lastName')}</label>
                    <input
                      type="text"
                      value={info.phone}
                      onChange={e => setInfo({ ...info, phone: e.target.value })}
                      placeholder=""
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('phone')}</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 shrink-0">
                      <span>🇹🇷</span>
                      <span className="text-gray-600">+90</span>
                    </div>
                    <input
                      type="tel"
                      value={info.phone}
                      onChange={e => setInfo({ ...info, phone: e.target.value })}
                      placeholder="531 232 34 56"
                      className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                {/* Address fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('address')}</label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <div className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50">
                      <span>🇹🇷</span>
                      <span className="text-gray-600">{info.country}</span>
                    </div>
                    <input
                      type="text"
                      value={info.city}
                      onChange={e => setInfo({ ...info, city: e.target.value })}
                      placeholder={t('city')}
                      className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <input
                      type="text"
                      value={info.district}
                      onChange={e => setInfo({ ...info, district: e.target.value })}
                      placeholder={t('district')}
                      className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <input
                      type="text"
                      value={info.postalCode}
                      onChange={e => setInfo({ ...info, postalCode: e.target.value })}
                      placeholder={t('postalCode')}
                      className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <textarea
                    value={info.address}
                    onChange={e => setInfo({ ...info, address: e.target.value })}
                    placeholder={t('address')}
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>

                {/* Corporate fields */}
                {info.type === 'corporate' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('companyName')}</label>
                      <input
                        type="text"
                        value={info.companyName || ''}
                        onChange={e => setInfo({ ...info, companyName: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('taxOffice')}</label>
                        <input
                          type="text"
                          value={info.taxOffice || ''}
                          onChange={e => setInfo({ ...info, taxOffice: e.target.value })}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('taxNumber')}</label>
                        <input
                          type="text"
                          value={info.taxNumber || ''}
                          onChange={e => setInfo({ ...info, taxNumber: e.target.value })}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                    </div>
                  </>
                )}

                <button
                  onClick={handleSave}
                  className="w-full py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors text-sm"
                >
                  {saved ? t('saved') : t('save')}
                </button>
              </div>
            </div>

            {/* Right: Invoice History */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-base font-bold text-gray-900 mb-1">{t('history')}</h3>
              <p className="text-sm text-gray-500 mb-5">{t('historyDesc')}</p>

              {history.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-400">{t('noInvoices')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">{t('date')}</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">{t('invoiceDescription')}</th>
                        <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">{t('amount')}</th>
                        <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">{t('invoiceStatus')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(inv => (
                        <tr key={inv.id} className="border-b border-gray-50">
                          <td className="py-3 px-2 text-gray-700">
                            {new Date(inv.date).toLocaleDateString('tr-TR')}
                          </td>
                          <td className="py-3 px-2 text-gray-700">{inv.description}</td>
                          <td className="py-3 px-2 text-right text-gray-700">₺{inv.amount.toFixed(2)}</td>
                          <td className="py-3 px-2 text-right">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              inv.status === 'paid'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {inv.status === 'paid' ? t('paid') : t('pending')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
