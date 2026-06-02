'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Loader2,
  Send,
  Eye,
  MousePointerClick,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface Summary {
  total: number
  sent: number
  opens: number
  clicks: number
  bounced: number
  delivered: number
}

interface HourlyPoint {
  label: string
  count: number
}

interface Recipient {
  email: string
  sentAt: string | null
  status: string
  opened: boolean
  clicked: boolean
  bounced: boolean
}

interface CampaignInfo {
  id: string
  name: string
  subject: string
  status: string
  sentAt: string | null
  stats: Record<string, number>
}

interface StatsData {
  campaign: CampaignInfo
  summary: Summary
  hourlyOpens: HourlyPoint[]
  recipients: Recipient[]
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 animate-card-enter">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function CampaignDetail({
  campaignId,
  onBack,
}: {
  campaignId: string
  onBack: () => void
}) {
  const t = useTranslations('email.campaigns')
  const td = useTranslations('email.campaigns.detail')

  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/email/campaigns/${campaignId}/stats`)
      const d = await res.json()
      if (d.ok) setData(d)
    } catch { /* sessiz */ } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { load() }, [load])

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('tr-TR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return iso }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
        <Loader2 className="w-7 h-7 animate-spin" />
        <span className="text-sm">{td('loading')}</span>
      </div>
    )
  }

  if (!data) return null

  const { campaign, summary, hourlyOpens, recipients } = data
  const openRate = summary.total > 0 ? Math.round((summary.opens / summary.total) * 100) : 0
  const clickRate = summary.opens > 0 ? Math.round((summary.clicks / summary.opens) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Üst bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition shrink-0"
            aria-label={td('back')}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">{campaign.name}</h2>
            <p className="text-sm text-gray-500 truncate">{campaign.subject}</p>
          </div>
        </div>
        {campaign.sentAt && (
          <span className="text-xs text-gray-400 shrink-0 mt-1">
            {td('sentAt')}: {fmtDate(campaign.sentAt)}
          </span>
        )}
      </div>

      {/* 4 istatistik kartı */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Send className="w-5 h-5 text-primary" />}
          label={td('statSent')}
          value={String(summary.sent)}
          sub={`${summary.total} alıcı`}
          color="bg-primary/10"
        />
        <StatCard
          icon={<Eye className="w-5 h-5 text-emerald-600" />}
          label={td('statOpened')}
          value={`%${openRate}`}
          sub={`${summary.opens} kişi`}
          color="bg-emerald-50"
        />
        <StatCard
          icon={<MousePointerClick className="w-5 h-5 text-primary" />}
          label={td('statClicked')}
          value={`%${clickRate}`}
          sub={`${summary.clicks} tıklama`}
          color="bg-primary/10"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-gray-500" />}
          label={td('statBounced')}
          value={String(summary.bounced)}
          color="bg-gray-50"
        />
      </div>

      {/* Saatlik açılma grafiği */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 animate-card-enter" style={{ ['--card-index' as string]: 1 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">{td('chartTitle')}</h3>
        </div>

        {hourlyOpens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
            <Eye className="w-8 h-8 opacity-30" />
            <span className="text-sm">{td('chartEmpty')}</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourlyOpens} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(v) => [v, 'Açılma']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#059669"
                strokeWidth={2}
                fill="url(#openGrad)"
                dot={{ r: 3, fill: '#059669', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{td('chartNote')}</span>
        </div>
      </div>

      {/* Alıcı tablosu */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-card-enter" style={{ ['--card-index' as string]: 2 }}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            {td('tableTitle')} <span className="text-gray-400 font-normal text-sm">({recipients.length})</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">{td('colEmail')}</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{td('colSent')}</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">{td('colOpened')}</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">{td('colClicked')}</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">{td('colBounced')}</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r, i) => (
                <tr key={r.email} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors" style={{ ['--card-index' as string]: Math.min(i, 10) }}>
                  <td className="px-5 py-3 text-gray-800 font-medium">{r.email}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(r.sentAt)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.opened
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                      : <XCircle className="w-4 h-4 text-gray-200 inline" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.clicked
                      ? <CheckCircle2 className="w-4 h-4 text-primary inline" />
                      : <XCircle className="w-4 h-4 text-gray-200 inline" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.bounced
                      ? <AlertTriangle className="w-4 h-4 text-gray-400 inline" />
                      : <span className="text-gray-200 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
