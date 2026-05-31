'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Contact,
  Loader2,
  Plus,
  Link2,
  Unlink,
  Eye,
  Inbox,
  Mail,
  Phone,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  X,
  LayoutGrid,
  List as ListIcon,
  TrendingUp,
  Filter,
  Check,
  ChevronDown,
} from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import CrmLeadDetailModal from './CrmLeadDetailModal'
import StageSelect from './StageSelect'
import { STAGES, STAGE_STYLE, type Stage } from './stageMeta'

type FilterKey = 'all' | Stage

interface LeadRow {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  campaignName: string | null
  formName: string | null
  status: Stage
  note: string | null
  createdAt: string
  leadCreatedTime: string | null
  metaSyncedAt: string | null
  pageId: string | null
}

interface PageOption { id: string; name: string }
interface ConnectedPage { pageId: string; pageName: string | null }
type Counts = { all: number } & Record<Stage, number>

const EMPTY_COUNTS: Counts = { all: 0, giris: 0, uygun: 0, donusum: 0, kayip: 0, uygun_degil: 0 }

export default function CrmDashboard() {
  const t = useTranslations('crm')
  const stageLabel = useCallback((s: Stage) => t(`stages.${s}`), [t])

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
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [filter, setFilter] = useState<FilterKey>('all')
  // Aktif sayfa (tek sayfa görünür — karışmasın)
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [pageMenuOpen, setPageMenuOpen] = useState(false)
  const pageMenuRef = useRef<HTMLDivElement>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [tosUrl, setTosUrl] = useState<string | null>(null)
  // Aşama (sütun) filtresi + sürükle-bırak
  const [hiddenStages, setHiddenStages] = useState<Set<Stage>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null)

  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const flash = useCallback((kind: 'ok' | 'err', msg: string, ms = 3000) => {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), ms)
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

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true)
    try {
      const res = await fetch('/api/crm/leads?status=all&limit=500')
      const data = await res.json()
      if (data.ok) {
        setLeads(data.leads ?? [])
      }
    } catch {
      /* sessiz */
    } finally {
      setLeadsLoading(false)
    }
  }, [])

  useEffect(() => { loadPages() }, [loadPages])
  useEffect(() => { loadLeads() }, [loadLeads])

  useEffect(() => {
    if (!filterOpen) return
    const onDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [filterOpen])

  // Bağlı sayfalar geldiğinde aktif sayfayı belirle (ilk sayfa; mevcut geçerliyse korunur).
  useEffect(() => {
    if (connected.length === 0) { setActivePageId(null); return }
    setActivePageId((cur) => (cur && connected.some((c) => c.pageId === cur) ? cur : connected[0].pageId))
  }, [connected])

  // Sayfa seçici dış-tıklama kapatır.
  useEffect(() => {
    if (!pageMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (pageMenuRef.current && !pageMenuRef.current.contains(e.target as Node)) setPageMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pageMenuOpen])

  const toggleStage = useCallback((s: Stage) => {
    setHiddenStages((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }, [])

  // Aşama filtresi tercihini kalıcı yap — sayfa yenilemesinde korunur.
  const stagesHydrated = useRef(false)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('crm.hiddenStages')
      if (raw) setHiddenStages(new Set(JSON.parse(raw) as Stage[]))
    } catch { /* yok say */ }
  }, [])
  useEffect(() => {
    if (!stagesHydrated.current) { stagesHydrated.current = true; return }
    try {
      window.localStorage.setItem('crm.hiddenStages', JSON.stringify([...hiddenStages]))
    } catch { /* yok say */ }
  }, [hiddenStages])

  const connectablePages = useMemo(() => {
    const ids = new Set(connected.map((c) => c.pageId))
    return pages.filter((p) => !ids.has(p.id))
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

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/crm/sync', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        if (data.inserted > 0) flash('ok', t('toast.syncPulled', { count: data.inserted }))
        else flash('ok', t('toast.syncNone'))
        await loadLeads()
      } else {
        flash('err', t('toast.error'))
      }
    } catch {
      flash('err', t('toast.error'))
    } finally {
      setSyncing(false)
    }
  }, [flash, t, loadLeads])

  const handleStage = useCallback(async (id: string, stage: Stage) => {
    // Optimistik: durumu hemen yansıt → kart anında doğru sütuna/filtreye geçer.
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: stage } : l)))
    try {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: stage }),
      })
      const data = await res.json()
      if (data.ok) {
        const sync = data.metaSync as
          | { ok?: boolean; reason?: string; error?: string; tosUrl?: string }
          | undefined
        const noSignal = stage === 'giris'
        if (sync && !sync.ok && sync.reason === 'tos_required') {
          setTosUrl(sync.tosUrl || null)
          flash('err', sync.error || t('toast.syncFailed'), 9000)
        } else if (sync?.ok && !noSignal) {
          flash('ok', t('toast.synced'))
        } else if (sync && !sync.ok && sync.reason === 'sync_failed') {
          flash('err', sync.error || t('toast.syncFailed'), 9000)
        } else {
          flash('ok', t('toast.statusUpdated'))
        }
      } else {
        flash('err', t('toast.error'))
      }
    } catch {
      flash('err', t('toast.error'))
    } finally {
      loadLeads()
    }
  }, [flash, t, loadLeads])

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  const noConnections = !pagesLoading && connected.length === 0
  // Yalnız aktif sayfanın lead'leri (karışmasın).
  const pageLeads = useMemo(
    () => (activePageId ? leads.filter((l) => l.pageId === activePageId) : leads),
    [leads, activePageId],
  )
  // Sayaçlar aktif sayfaya göre istemci tarafında hesaplanır.
  const counts = useMemo(() => {
    const c: Counts = { ...EMPTY_COUNTS }
    for (const l of pageLeads) {
      c.all++
      if (l.status in c) (c as Record<string, number>)[l.status]++
    }
    return c
  }, [pageLeads])
  const conversionRate = counts.all > 0 ? Math.round((counts.donusum / counts.all) * 100) : 0
  const listLeads = useMemo(
    () => (filter === 'all' ? pageLeads : pageLeads.filter((l) => l.status === filter)),
    [pageLeads, filter],
  )
  const activePageName = connected.find((c) => c.pageId === activePageId)?.pageName || connected[0]?.pageName || ''

  return (
    <div className="w-full px-6 lg:px-8 py-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-md text-center ${toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Özel Hedef Kitle koşulu kabul edilmedi → kabul URL'i ile uyarı */}
      {tosUrl && (
        <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{t('tos.title')}</p>
            <p className="text-sm text-gray-600 mt-0.5">{t('tos.desc')}</p>
            <a
              href={tosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition"
            >
              {t('tos.cta')} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <button onClick={() => setTosUrl(null)} className="p-1 text-gray-400 hover:text-gray-600 transition shrink-0" aria-label={t('tos.dismiss')}>
            <X className="w-4 h-4" />
          </button>
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

          {connected.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{t('connect.connectedPages')}</p>
              <div className="space-y-2">
                {connected.map((c) => (
                  <div key={c.pageId} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-2.5">
                    <span className="text-sm text-gray-800">{c.pageName || c.pageId}</span>
                    <button onClick={() => handleDisconnect(c.pageId)} className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium">
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
        /* Üst bar: özet + dönüşüm oranı + görünüm + aksiyonlar */
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-4 text-sm">
            {connected.length > 1 ? (
              <div ref={pageMenuRef} className="relative">
                <button
                  onClick={() => setPageMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-800 hover:bg-gray-50 transition"
                >
                  <Contact className="w-4 h-4 text-primary" />
                  <span className="font-medium max-w-[180px] truncate">{activePageName}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${pageMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {pageMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-30 w-60 bg-white rounded-xl border border-gray-200 shadow-lg py-1">
                    {connected.map((c) => (
                      <button
                        key={c.pageId}
                        onClick={() => { setActivePageId(c.pageId); setPageMenuOpen(false) }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${c.pageId === activePageId ? 'text-primary font-medium' : 'text-gray-700'}`}
                      >
                        <Contact className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1 truncate">{c.pageName || c.pageId}</span>
                        {c.pageId === activePageId && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-gray-800">
                <Contact className="w-4 h-4 text-primary" />
                <span className="font-medium max-w-[180px] truncate">{activePageName}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-gray-700">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t('conversionRate')}: <span className="font-semibold text-gray-900">%{conversionRate}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Aşama (sütun) filtresi — Pano/Liste toggle'ının solunda */}
            <div ref={filterRef} className="relative">
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <Filter className="w-4 h-4" /> {t('stageFilter')}
                {hiddenStages.size > 0 && (
                  <span className="text-xs text-primary font-medium">{STAGES.length - hiddenStages.size}/{STAGES.length}</span>
                )}
              </button>
              {filterOpen && (
                <div className="absolute left-0 top-full mt-1 z-30 w-52 bg-white rounded-xl border border-gray-200 shadow-lg py-1">
                  {STAGES.map((s) => {
                    const visible = !hiddenStages.has(s)
                    return (
                      <button
                        key={s}
                        onClick={() => toggleStage(s)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50"
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${visible ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                          {visible && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${STAGE_STYLE[s].dot}`} />
                        <span className="flex-1 text-gray-700">{stageLabel(s)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {/* Görünüm geçişi */}
            <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-white">
              <button
                onClick={() => setView('board')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === 'board' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <LayoutGrid className="w-4 h-4" /> {t('view.board')}
              </button>
              <button
                onClick={() => setView('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === 'list' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <ListIcon className="w-4 h-4" /> {t('view.list')}
              </button>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> {t('sync.button')}
            </button>
            <button
              onClick={() => setShowConnectPanel(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <Plus className="w-4 h-4" /> {t('connect.managePages')}
            </button>
          </div>
        </div>
      )}

      {!noConnections && (
        leadsLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : counts.all === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-gray-700 font-medium">{t('list.empty')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('list.emptyHint')}</p>
          </div>
        ) : view === 'board' ? (
          /* ── Kanban (Pano) ── */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.filter((s) => !hiddenStages.has(s)).map((stage) => {
              const items = pageLeads.filter((l) => l.status === stage)
              return (
                <div
                  key={stage}
                  onDragOver={(e) => { e.preventDefault(); if (dragOverStage !== stage) setDragOverStage(stage) }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage((cur) => (cur === stage ? null : cur)) }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverStage(null)
                    const id = e.dataTransfer.getData('text/plain')
                    const lead = leads.find((l) => l.id === id)
                    if (lead && lead.status !== stage) handleStage(id, stage)
                  }}
                  className={`flex-1 min-w-[240px] rounded-2xl border transition ${dragOverStage === stage ? 'bg-primary/5 border-primary/40 ring-2 ring-primary/20' : 'bg-gray-50 border-gray-200'}`}
                >
                  <div className="px-4 pt-3.5 pb-2.5 border-b border-gray-200">
                    <div className={`h-1 w-10 rounded-full mb-2 ${STAGE_STYLE[stage].bar}`} />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">{stageLabel(stage)}</span>
                      <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">{counts[stage]}</span>
                    </div>
                  </div>
                  <div className="p-2.5 space-y-2.5 max-h-[60vh] overflow-y-auto">
                    {items.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">{t('board.emptyColumn')}</p>
                    ) : items.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', lead.id); e.dataTransfer.effectAllowed = 'move' }}
                        className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-gray-300 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{lead.fullName || t('list.noName')}</h3>
                          <button onClick={() => setDetailId(lead.id)} title={t('list.viewDetail')} className="p-1 -mr-1 text-gray-400 hover:text-gray-700 shrink-0">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="mt-1 space-y-0.5 text-[11px] text-gray-500">
                          {lead.email && <p className="inline-flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{lead.email}</p>}
                          {lead.phone && <p className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</p>}
                        </div>
                        <p className="mt-1 text-[10px] text-gray-400">{fmtDate(lead.leadCreatedTime || lead.createdAt)}</p>
                        <div className="mt-2.5 flex items-center justify-between">
                          <StageSelect value={lead.status} onChange={(s) => handleStage(lead.id, s)} labelFor={stageLabel} />
                          {lead.metaSyncedAt && stage !== 'giris' && (
                            <span title={t('list.metaSynced')}><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /></span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── Liste ── */
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {(['all', ...STAGES] as FilterKey[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${filter === f ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                  {f === 'all' ? t('filters.all') : stageLabel(f)}
                  <span className={`text-xs ${filter === f ? 'text-white/80' : 'text-gray-400'}`}>{f === 'all' ? counts.all : counts[f]}</span>
                </button>
              ))}
            </div>

            {listLeads.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-500">{t('board.emptyColumn')}</div>
            ) : (
              <div className="space-y-3">
                {listLeads.map((lead) => (
                  <div key={lead.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{lead.fullName || t('list.noName')}</h3>
                          {lead.metaSyncedAt && lead.status !== 'giris' && (
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
                      <div className="flex items-center gap-2 shrink-0">
                        <StageSelect value={lead.status} onChange={(s) => handleStage(lead.id, s)} labelFor={stageLabel} />
                        <button onClick={() => setDetailId(lead.id)} title={t('list.viewDetail')} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}

      {detailId && <CrmLeadDetailModal leadId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
