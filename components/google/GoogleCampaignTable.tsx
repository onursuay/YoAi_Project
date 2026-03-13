'use client'

import Link from 'next/link'
import ToggleSwitch from '@/components/ToggleSwitch'
import CircularProgress from '@/components/CircularProgress'
import { Edit } from 'lucide-react'
import type { GoogleCampaign } from '@/hooks/google/useGoogleAdsCampaigns'

const localeString = 'tr-TR'
const fmtInt = (n: number) => (Number.isFinite(n) ? n.toLocaleString(localeString) : '0')
const fmtFixed = (n: number, d: number) => (Number.isFinite(n) ? n.toFixed(d) : '0')
const num = (n: number | null | undefined) => (n != null && Number.isFinite(n) ? n : 0)

interface GoogleCampaignTableProps {
  campaigns: GoogleCampaign[]
  isLoading: boolean
  loadingCampaignStatus: Record<string, boolean>
  loadingCampaignBudget: Record<string, boolean>
  colSpan: number
  tTable: (key: string) => string
  onPublishToggle: (campaign: GoogleCampaign) => void
  onEditBudget: (campaign: GoogleCampaign) => void
}

export default function GoogleCampaignTable({
  campaigns,
  isLoading,
  loadingCampaignStatus,
  loadingCampaignBudget,
  colSpan,
  tTable,
  onPublishToggle,
  onEditBudget,
}: GoogleCampaignTableProps) {
  if (isLoading && campaigns.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-500">
          {tTable('table.loading')}
        </td>
      </tr>
    )
  }

  if (campaigns.length === 0) {
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
      {campaigns.map((item) => {
        const toggleable = item.status === 'ENABLED' || item.status === 'PAUSED'
        const checked = item.publishEnabled
        const isLoadingStatus = loadingCampaignStatus[item.campaignId] || false
        const isLoadingBudget = loadingCampaignBudget[item.campaignId] || false
        const itemLoading = isLoadingStatus || isLoadingBudget
        return (
          <tr key={item.campaignId} className="hover:bg-gray-50">
            <td className="px-4 py-4">
              <div className="flex flex-col gap-0.5">
                <ToggleSwitch
                  enabled={checked}
                  onChange={() => onPublishToggle(item)}
                  disabled={itemLoading || !toggleable}
                />
                {!item.status && (
                  <span className="text-caption text-gray-400">{tTable('table.unknownStatus')}</span>
                )}
              </div>
            </td>
            <td className="px-4 py-4">
              {item.optScorePct != null ? (
                <CircularProgress percentage={item.optScorePct} />
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </td>
            <td className="px-4 py-4 text-sm text-gray-900">
              <Link
                href={`/google-ads/${item.campaignId}`}
                className="hover:text-green-700 hover:underline transition-colors"
              >
                {item.campaignName}
              </Link>
            </td>
            <td className="px-4 py-4 text-sm text-right text-gray-900">
              <div className="flex items-center gap-2 justify-end">
                <span>
                  {item.budget != null && item.budget > 0
                    ? `${num(item.budget).toLocaleString(localeString, { minimumFractionDigits: 2 })} TRY`
                    : '—'}
                </span>
                {item.budget != null && item.budget > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditBudget(item)
                    }}
                    disabled={itemLoading}
                    className="shrink-0"
                    title={tTable('actions.editBudget')}
                  >
                    <Edit className="w-3.5 h-3.5 text-gray-400 hover:text-blue-600" />
                  </button>
                )}
              </div>
            </td>
            <td className="px-4 py-4 text-sm text-right text-gray-900">
              {num(item.amountSpent).toLocaleString(localeString, { minimumFractionDigits: 2 })} TRY
            </td>
            <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtInt(item.impressions)}</td>
            <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtInt(item.clicks)}</td>
            <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtFixed(item.ctr, 2)}%</td>
            <td className="px-4 py-4 text-sm text-right text-gray-900">{fmtFixed(item.cpc, 2)} TRY</td>
            <td className="px-4 py-4 text-sm text-right text-gray-900">
              {item.roas != null && item.roas > 0 ? `${fmtFixed(item.roas, 1)}x` : '—'}
            </td>
          </tr>
        )
      })}
    </>
  )
}
