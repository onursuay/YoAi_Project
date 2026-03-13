'use client'

import type { GoogleAdGroup } from '@/hooks/google/useGoogleAdsCampaigns'

const localeString = 'tr-TR'
const fmtInt = (n: number) => (Number.isFinite(n) ? n.toLocaleString(localeString) : '0')
const fmtFixed = (n: number, d: number) => (Number.isFinite(n) ? n.toFixed(d) : '0')
const num = (n: number | null | undefined) => (n != null && Number.isFinite(n) ? n : 0)

interface GoogleAdGroupTableProps {
  adGroups: GoogleAdGroup[]
  isLoading: boolean
  colSpan: number
  tTable: (key: string) => string
  tGoogle: (key: string) => string
}

export default function GoogleAdGroupTable({
  adGroups,
  isLoading,
  colSpan,
  tTable,
  tGoogle,
}: GoogleAdGroupTableProps) {
  if (isLoading) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-500">
          {tTable('table.loading')}
        </td>
      </tr>
    )
  }

  if (adGroups.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-500">
          {tTable('table.noData')}
        </td>
      </tr>
    )
  }

  return (
    <>
      {adGroups.map((ag) => (
        <tr key={ag.adGroupId} className="hover:bg-gray-50">
          <td className="px-4 py-4">—</td>
          <td className="px-4 py-4">
            <span className={`inline-flex items-center px-2 py-1 text-caption font-medium rounded-full ${ag.status === 'ENABLED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {ag.status === 'ENABLED' ? tTable('table.active') : tTable('table.inactive')}
            </span>
          </td>
          <td className="px-4 py-4"><span className="text-gray-400">—</span></td>
          <td className="px-4 py-4 text-sm text-gray-900">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{ag.adGroupName}</span>
              <span className="text-caption text-gray-500">{ag.campaignName}</span>
            </div>
          </td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">—</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">{num(ag.amountSpent).toLocaleString(localeString, { minimumFractionDigits: 2 })} TRY</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtInt(ag.impressions)}</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtInt(ag.clicks)}</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtFixed(ag.ctr, 2)}%</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtFixed(ag.cpc, 2)} TRY</td>
          <td className="px-4 py-4 text-sm text-right text-gray-900">
            {ag.roas != null && ag.roas > 0 ? `${fmtFixed(ag.roas, 1)}x` : '—'}
          </td>
          <td className="px-4 py-4 text-center text-gray-400 text-sm">{tGoogle('comingSoon')}</td>
        </tr>
      ))}
    </>
  )
}
