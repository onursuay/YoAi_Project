'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Contact,
  Loader2,
  Plus,
  Link2,
  Unlink,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Eye,
  Inbox,
  Mail,
  Phone,
  CheckCircle2,
} from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import CrmLeadDetailModal from './CrmLeadDetailModal'

type LeadStatus = 'new' | 'positive' | 'negative'
type FilterKey = 'all' | LeadStatus

interface LeadRow {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  campaignName: string | null
  formName: string | null
  status: LeadStatus
  note: string | null
  createdAt: string
  leadCreatedTime: string | null
  metaSyncedAt: string | null
}

interface PageOption { id: string; name: string }
interface ConnectedPage { pageId: string; pageName: string | null }
interface Counts { all: number; new: number; positive: number; negative: number }

export default function CrmDashboard() {
  const t = useTranslations('crm')

  // ── Bağlantı durumu ──
  const [metaConnected, setMetaConnected] = useState(true)
  const [pages, setPages] = useState<PageOption[]>([])
  const [connected, setConnected] = useState<ConnectedPage[]>([])
  const [pagesLoading, setPagesLoading] = useState(true)
  const [selectedPage, setSelectedPage] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [showConnectPanel, setShowConnectPanel] = useState(false)

  // ── Lead'ler ──
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [counts, setCounts] = useState<Counts>({ all: 0, new: 0, positive: 0, negative: 0 })
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const flash = useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const loadPages = useCallback(async () => {
    setPagesLoading(true)
    try {
      const res = await fetch('/api/crm/pages')
      const data = await res.json()
      if (data.ok) {
        setMetaConnected(Boolean(data.metaConnected))
        setPages(data.pages ?? [])
        setConnected(data.connected ?? [])
      }
    } catch {
      /* sessiz */
    } finally {
      setPagesLoading(false)
    }
  }, [])

  const loadLeads = useCallback(async (status: FilterKey) => {
    setLeadsLoading(true)
    try {
      const res = await fetch(`/api/crm/leads?status=${status}`)
      const data = await res.json()
      if (data.ok) {
        setLeads(data.leads ?? [])
        setCounts(data.counts ?? { all: 0, new: 0, positive: 0, negative: 0 })
      }
    } catch {
      /* sessiz */
    } finally {
      setLeadsLoading(false)
    }
  }, [])

  useEffect(() => { loadPages() }, [loadPages])
  useEffect(() => { loadLeads(filter) }, [filter, loadLeads])

  const connectablePages = useMemo(() => {
    const connectedIds = new Set(connected.map((c) => c.pageId))
    return pages.filter((p) => !connectedIds.has(p.id))
  }, [pages, connected])

  const handleConnect = useCallback(async () => {
    if (!selectedPage) return
    const page = pages.find((p) => p.id === selectedPage)
    setConnecting(true)
    try {
      const res = await fetch('/api/crm/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: selectedPage, pageName: page?.name ?? null }),
      })
      const data = await res.json()
      if (data.ok) {
        flash('ok', t('toast.connected'))
        setSelectedPage('')
        setShowConnectPanel(false)
        await loadPages()
      } else {
        flash('err', data.message || t('toast.connectError'))
      }
    } catch {
      flash('err', t('toast.connectError'))
    } finally {
      setConnecting(false)
    }
  }, [selectedPage, pages, flash, t, loadPages])

  const handleDisconnect = useCallback(async (pageId: string) => {
    try {
      const res = await fetch('/api/crm/connect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      })
      const data = await res.json()
      if (data.ok) {
        flash('ok', t('toast.disconnected'))
        await loadPages()
      } else {
        flash('err', t('toast.error'))
      }
    } catch {
      flash('err', t('toast.error'))
    }
  }, [flash, t, loadPages])

  const handleStatus = useCallback(async (id: string, status: LeadStatus) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (data.ok) {
        // Durum kaydedildi; Meta senkron sonucuna göre mesaj seç.
        const sync = data.metaSync as { ok?: boolean; reason?: string } | undefined
        if (sync?.ok && status !== 'new') {
          flash('ok', t('toast.synced'))
        } else if (sync && !sync.ok && sync.reason === 'sync_failed') {
          flash('err', t('toast.syncFailed'))
        } else {
          flash('ok', t('toast.statusUpdated'))
        }
        // Lokal güncelle + sayaçları yenile (metaSyncedAt server'dan gelir)
        setLeads((prev) => {
          if (filter !== 'all' && filter !== status) return prev.filter((l) => l.id !== id)
          return prev.map((l) => (l.id === id ? { ...l, status } : l))
        })
        loadLeads(filter)
      } else {
        flash('err', t('toast.error'))
      }
    } catch {
      flash('err', t('toast.error'))
    } finally {
      setUpdatingId(null)
    }
  }, [filter, flash, t, loadLeads])

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  const statusBadge = (status: LeadStatus) => {
    const map: Record<LeadStatus, string> = {
      new: 'bg-gray-100 text-gray-600 border-gray-200',
      positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      negative: 'bg-red-50 text-red-700 border-red-200',
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}>
        {t(`status.${status}`)}
      </span>
    )
  }

  const filters: FilterKey[] = ['all', 'new', 'positive', 'negative']

  // ── İlk kez bağlanma (hiç bağlı page yok) ──
  const noConnections = !pagesLoading && connected.length === 0

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Bağlantı bölümü */}
      {(noConnections || showConnectPanel) ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('connect.title')}</h2>
              <p className="text-sm text-gray-500">{t('connect.description')}</p>
            </div>
          </div>

          {!metaConnected ? (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-primary font-medium">{t('connect.metaNotConnected')}</p>
              <p className="text-sm text-gray-600 mt-1">{t('connect.metaNotConnectedHint')}</p>
            </div>
          ) : pagesLoading ? (
            <div className="mt-6 flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> {t('connect.loading')}
            </div>
          ) : connectablePages.length === 0 ? (
            <p className="mt-6 text-sm text-gray-500">{t('connect.noPages')}</p>
          ) : (
            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('connect.selectPage')}</label>
                <WizardSelect
                  value={selectedPage}
                  onChange={setSelectedPage}
                  options={connectablePages.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder={t('connect.selectPagePlaceholder')}
                />
              </div>
              <button
                onClick={handleConnect}
                disabled={!selectedPage || connecting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('connect.connectButton')}
              </button>
            </div>
          )}

          {/* Bağlı page'ler listesi (panel açıkken) */}
          {connected.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{t('connect.connectedPages')}</p>
              <div className="space-y-2">
                {connected.map((c) => (
                  <div key={c.pageId} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-2.5">
                    <span className="text-sm text-gray-800">{c.pageName || c.pageId}</span>
                    <button
                      onClick={() => handleDisconnect(c.pageId)}
                      className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      <Unlink className="w-3.5 h-3.5" /> {t('connect.disconnect')}
                    </button>
                  </div>
                ))}
              </div>
              {showConnectPanel && (
                <button onClick={() => setShowConnectPanel(false)} className="mt-4 text-sm text-gray-500 hover:text-gray-700">
                  {t('connect.done')}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Üst bar: bağlı sayfa özeti + yönet */
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Contact className="w-4 h-4 text-primary" />
            <span>{t('connectedSummary', { count: connected.length })}</span>
          </div>
          <button
            onClick={() => setShowConnectPanel(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <Plus className="w-4 h-4" /> {t('connect.managePages')}
          </button>
        </div>
      )}

      {/* Filtre sekmeleri */}
      {!noConnections && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
                  filter === f
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t(`filters.${f}`)}
                <span className={`text-xs ${filter === f ? 'text-white/80' : 'text-gray-400'}`}>{counts[f]}</span>
              </button>
            ))}
          </div>

          {/* Lead listesi */}
          {leadsLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : leads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Inbox className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-gray-700 font-medium">{t('list.empty')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('list.emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leads.map((lead) => (
                <div key={lead.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{lead.fullName || t('list.noName')}</h3>
                        {statusBadge(lead.status)}
                        {lead.metaSyncedAt && lead.status !== 'new' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> {t('list.metaSynced')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        {lead.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{lead.email}</span>}
                        {lead.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{lead.phone}</span>}
                        {lead.campaignName && <span className="truncate max-w-[200px]">{lead.campaignName}</span>}
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400">{fmtDate(lead.leadCreatedTime || lead.createdAt)}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setDetailId(lead.id)}
                        title={t('list.viewDetail')}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {lead.status !== 'positive' && (
                        <button
                          onClick={() => handleStatus(lead.id, 'positive')}
                          disabled={updatingId === lead.id}
                          title={t('list.markPositive')}
                          className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                      )}
                      {lead.status !== 'negative' && (
                        <button
                          onClick={() => handleStatus(lead.id, 'negative')}
                          disabled={updatingId === lead.id}
                          title={t('list.markNegative')}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40 transition"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      )}
                      {lead.status !== 'new' && (
                        <button
                          onClick={() => handleStatus(lead.id, 'new')}
                          disabled={updatingId === lead.id}
                          title={t('list.markNew')}
                          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {detailId && (
        <CrmLeadDetailModal
          leadId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  )
}
