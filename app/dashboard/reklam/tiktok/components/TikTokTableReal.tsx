'use client'

import type { TikTokCampaign } from '@/hooks/tiktok/useTikTokAdsCampaigns'

interface TikTokTableRealProps {
  campaigns: TikTokCampaign[]
  locale: string
}

const objectiveLabels: Record<string, string> = {
  TRAFFIC: 'Trafik',
  CONVERSIONS: 'Dönüşüm',
  APP_INSTALL: 'Uygulama Yükleme',
  REACH: 'Erişim',
  VIDEO_VIEWS: 'Video Görüntüleme',
  LEAD_GENERATION: 'Potansiyel Müşteri',
  ENGAGEMENT: 'Etkileşim',
  CATALOG_SALES: 'Katalog Satışları',
  APP_PROMOTION: 'Uygulama Tanıtımı',
  WEB_CONVERSIONS: 'Web Dönüşüm',
  PRODUCT_SALES: 'Ürün Satışı',
}

export default function TikTokTableReal({ campaigns, locale }: TikTokTableRealProps) {
  const fmtCurrency = (v: number) =>
    v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtInt = (v: number) => v.toLocaleString(locale)
  const fmtPct = (v: number) =>
    `${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-rose-50/60">
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-left whitespace-nowrap">Durum</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-left whitespace-nowrap">Kampanya</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-left whitespace-nowrap">Amaç</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">Bütçe</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">Harcama</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">Gösterim</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">Tıklama</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">CTR</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">CPC</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">Dönüşüm</th>
            <th className="px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase text-right whitespace-nowrap">Erişim</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {campaigns.map((c) => (
            <tr
              key={c.campaignId}
              className="hover:bg-rose-50/30 transition-colors"
            >
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${
                    c.publishEnabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${c.publishEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {c.publishEnabled ? 'Aktif' : 'Duraklatıldı'}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate" title={c.campaignName}>
                {c.campaignName}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {objectiveLabels[c.objective] || c.objective}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {c.budget > 0 ? fmtCurrency(c.budget) : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums font-medium">
                {fmtCurrency(c.amountSpent)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtInt(c.impressions)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtInt(c.clicks)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtPct(c.ctr)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtCurrency(c.cpc)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtInt(c.conversions)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">
                {fmtInt(c.reach)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
