'use client'

import { useEffect } from 'react'
import type { LandingPage } from '@/hooks/google/useGoogleCampaignDetail'
import ViewErrorAlert, { type ViewErrorInfo } from './ViewErrorAlert'

const localeString = 'tr-TR'
const fmtInt = (n: number) => n.toLocaleString(localeString)
const fmtCurrency = (n: number) => n.toLocaleString(localeString, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
  landingPages: LandingPage[]
  isLoading: boolean
  error: ViewErrorInfo | null
  onFetch: () => void
}

export default function CampaignLandingPagesTab({ landingPages, isLoading, error, onFetch }: Props) {
  useEffect(() => { onFetch() }, [onFetch])

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Landing page verileri yükleniyor...</div>
  }

  if (error) {
    return <ViewErrorAlert error={error} />
  }

  if (landingPages.length === 0) {
    return <div className="p-6 text-center text-gray-400">Bu kampanya için landing page verisi bulunamadı.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tıklama</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gösterim</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ort. TBM</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Maliyet</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dönüşüm</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {landingPages.map((lp, i) => (
            <tr key={`${lp.url}-${i}`} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-blue-600 max-w-md truncate">
                <a href={lp.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {lp.url}
                </a>
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">{fmtInt(lp.clicks)}</td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">{fmtInt(lp.impressions)}</td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">{lp.ctr.toFixed(2)}%</td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">{fmtCurrency(lp.cpc)} TRY</td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">{fmtCurrency(lp.cost)} TRY</td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">{lp.conversions > 0 ? fmtInt(lp.conversions) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
