'use client'

/**
 * Gözetim Merkezi → "Başvurular" sekmesi.
 *
 * Sadece owner (Süper Admin) görür. Manuel onay/red/engelle/manuel-inceleme işlemlerini yapar.
 * Liste `/api/admin/signups`'tan beslenir; owner filtresi backend tarafında uygulanır.
 *
 * Özellikler:
 * - Detay: sağ drawer değil, ortalanmış modal
 * - Engelle: 6 seçenekli modal (user/email/domain/ip/hepsi/manuel-inceleme)
 * - Manuel İnceleme: ayrı status
 * - KPI kartları: tüm approval durumları
 * - Sesli uyarı: toggle + polling + toast
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Search,
  CalendarCheck,
  CalendarX2,
  Clock,
  Shield,
  Eye,
  X,
  Bell,
  BellOff,
} from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'

interface SignupRow {
  id: string
  email: string | null
  name: string | null
  company: string | null
  phone: string | null
  status: string | null
  approval_status: string | null
  approval_note: string | null
  signup_source: string | null
  premeeting_status: string | null
  premeeting_scheduled_at: string | null
  premeeting_declined_at: string | null
  premeeting_requested_at: string | null
  approved_at: string | null
  approved_by: string | null
  rejected_at: string | null
  rejected_by: string | null
  blocked_at: string | null
  blocked_by: string | null
  block_reason: string | null
  manual_review_at: string | null
  manual_review_by: string | null
  manual_review_note: string | null
  created_at: string | null
  verified_at: string | null
  updated_at: string | null
}

type ApprovalFilter =
  | 'all'
  | 'pending'
  | 'call_scheduled'
  | 'call_declined'
  | 'manual_review'
  | 'approved'
  | 'rejected'
  | 'blocked'

type BlockOption = 'user' | 'email' | 'domain' | 'ip' | 'all' | 'manual_review'

function fmt(value: string | null): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul',
    })
  } catch {
    return '—'
  }
}

function approvalBadge(status: string | null): { labelKey: string; className: string } {
  switch ((status || '').toLowerCase()) {
    case 'approved':
      return { labelKey: 'badge.approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'rejected':
      return { labelKey: 'badge.rejected', className: 'bg-red-50 text-red-700 border-red-200' }
    case 'blocked':
      return { labelKey: 'badge.blocked', className: 'bg-red-50 text-red-800 border-red-300' }
    case 'manual_review':
      return { labelKey: 'badge.manualReview', className: 'bg-primary/5 text-primary border-primary/20' }
    case 'call_scheduled':
      return { labelKey: 'badge.callScheduled', className: 'bg-primary/5 text-primary border-primary/20' }
    case 'call_declined':
      return { labelKey: 'badge.callDeclined', className: 'bg-gray-50 text-gray-700 border-gray-200' }
    case 'needs_call':
      return { labelKey: 'badge.needsCall', className: 'bg-primary/5 text-primary border-primary/20' }
    default:
      return { labelKey: 'badge.pending', className: 'bg-gray-50 text-gray-700 border-gray-200' }
  }
}

function premeetingIcon(status: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'scheduled':
      return <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
    case 'declined':
      return <CalendarX2 className="h-3.5 w-3.5 text-gray-500" />
    default:
      return <Clock className="h-3.5 w-3.5 text-gray-400" />
  }
}

function KpiChip({ label, value, tone = 'gray', onClick, active }: {
  label: string
  value: number
  tone?: 'gray' | 'primary' | 'emerald' | 'red'
  onClick?: () => void
  active?: boolean
}) {
  const tones: Record<string, string> = {
    gray: 'border-gray-200 text-gray-700',
    primary: 'border-primary/20 text-primary',
    emerald: 'border-emerald-200 text-emerald-700',
    red: 'border-red-200 text-red-700',
  }
  const bg = active ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${tones[tone]} ${bg} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <span className="tabular-nums text-sm font-semibold">{value}</span>
      <span className="opacity-80">{label}</span>
    </button>
  )
}

// Ses çalmak için kısa bir beep (AudioContext API)
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // Autoplay engeli veya desteklenmiyor — sessizce devam
  }
}

export default function SignupApprovalsPanel() {
  const t = useTranslations('gozetim.signups')
  const tc = useTranslations('common')
  const [rows, setRows] = useState<SignupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ApprovalFilter>('all')
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [selected, setSelected] = useState<SignupRow | null>(null)
  const [blockTarget, setBlockTarget] = useState<SignupRow | null>(null)

  // Sesli uyarı
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gozetim_sound_enabled') === 'true'
    }
    return false
  })
  const prevPendingCount = useRef<number | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/signups?limit=200', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'load_failed')
      }
      const newRows = (data.signups as SignupRow[]) || []
      setRows(newRows)

      // Sesli uyarı: pending sayısı arttıysa bildir
      if (soundEnabled) {
        const newPendingCount = newRows.filter(
          (r) => !r.approval_status || r.approval_status === 'pending',
        ).length
        if (prevPendingCount.current !== null && newPendingCount > prevPendingCount.current) {
          playBeep()
          setToastMsg(t('newSignupToast'))
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
          toastTimerRef.current = setTimeout(() => setToastMsg(null), 4000)
        }
        prevPendingCount.current = newPendingCount
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load_failed')
    } finally {
      setLoading(false)
    }
  }, [soundEnabled, t])

  useEffect(() => {
    load()
  }, [load])

  // Polling — 45 saniyede bir
  useEffect(() => {
    if (!soundEnabled) return
    const interval = setInterval(() => {
      load()
    }, 45000)
    return () => clearInterval(interval)
  }, [soundEnabled, load])

  function toggleSound() {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem('gozetim_sound_enabled', String(next))
    if (next) {
      // Toggle açılışında bir kere ses çal — browser user-gesture gerekliliğini karşıla
      playBeep()
      prevPendingCount.current = rows.filter(
        (r) => !r.approval_status || r.approval_status === 'pending',
      ).length
    } else {
      prevPendingCount.current = null
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const st = r.approval_status || 'pending'
      if (filter !== 'all' && st !== filter) return false
      if (!q) return true
      const fields = [r.email, r.name, r.company, r.phone, r.signup_source]
      return fields.some((f) => (f || '').toLowerCase().includes(q))
    })
  }, [rows, filter, search])

  // KPI hesapla
  const kpis = useMemo(() => {
    const c = (st: string) => rows.filter((r) => (r.approval_status || 'pending') === st).length
    return {
      total: rows.length,
      pending: c('pending'),
      callScheduled: c('call_scheduled'),
      callDeclined: c('call_declined'),
      manualReview: c('manual_review'),
      approved: c('approved'),
      rejected: c('rejected'),
      blocked: c('blocked'),
    }
  }, [rows])

  async function performAction(
    id: string,
    action: 'approve' | 'reject',
    note?: string,
  ): Promise<boolean> {
    setPending(id + ':' + action)
    try {
      const res = await fetch(`/api/admin/signups/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: note ? JSON.stringify({ note }) : undefined,
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || action + '_failed')
      }
      await load()
      return true
    } catch (e) {
      console.error('[SignupApprovalsPanel] action failed', e)
      setError(e instanceof Error ? e.message : 'action_failed')
      return false
    } finally {
      setPending(null)
    }
  }

  async function performNote(id: string, note: string): Promise<boolean> {
    setPending(id + ':note')
    try {
      const res = await fetch(`/api/admin/signups/${id}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'note_failed')
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'note_failed')
      return false
    } finally {
      setPending(null)
    }
  }

  async function performBlock(
    id: string,
    option: BlockOption,
    note?: string,
    sourceIp?: string,
  ): Promise<boolean> {
    setPending(id + ':block')
    try {
      if (option === 'manual_review') {
        const res = await fetch(`/api/admin/signups/${id}/manual-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: note?.trim() || null }),
        })
        const data = await res.json()
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'manual_review_failed')
      } else {
        const blockTypes =
          option === 'all' ? ['user', 'email', 'domain', 'ip'] : [option]
        const res = await fetch(`/api/admin/signups/${id}/block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blockTypes, reason: note?.trim() || null, sourceIp }),
        })
        const data = await res.json()
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'block_failed')
      }
      await load()
      return true
    } catch (e) {
      console.error('[SignupApprovalsPanel] block failed', e)
      setError(e instanceof Error ? e.message : 'block_failed')
      return false
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="mt-8" data-testid="signup-approvals-panel">
      {/* Toast */}
      {toastMsg && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-lg"
          data-testid="sound-toast"
        >
          <Bell className="h-4 w-4" />
          {toastMsg}
        </div>
      )}

      {/* KPI chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <KpiChip label={t('kpi.total')} value={kpis.total} tone="gray" onClick={() => setFilter('all')} active={filter === 'all'} />
        <KpiChip label={t('kpi.pending')} value={kpis.pending} tone="primary" onClick={() => setFilter('pending')} active={filter === 'pending'} />
        <KpiChip label={t('kpi.callScheduled')} value={kpis.callScheduled} tone="emerald" onClick={() => setFilter('call_scheduled')} active={filter === 'call_scheduled'} />
        <KpiChip label={t('kpi.callDeclined')} value={kpis.callDeclined} tone="gray" onClick={() => setFilter('call_declined')} active={filter === 'call_declined'} />
        <KpiChip label={t('kpi.manualReview')} value={kpis.manualReview} tone="primary" onClick={() => setFilter('manual_review')} active={filter === 'manual_review'} />
        <KpiChip label={t('kpi.approved')} value={kpis.approved} tone="emerald" onClick={() => setFilter('approved')} active={filter === 'approved'} />
        <KpiChip label={t('kpi.rejected')} value={kpis.rejected} tone="red" onClick={() => setFilter('rejected')} active={filter === 'rejected'} />
        <KpiChip label={t('kpi.blocked')} value={kpis.blocked} tone="red" onClick={() => setFilter('blocked')} active={filter === 'blocked'} />
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-gray-900">{t('title')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <WizardSelect
            value={filter}
            onChange={(v) => setFilter(v as ApprovalFilter)}
            options={[
              { value: 'all', label: t('filter.all') },
              { value: 'pending', label: t('badge.pending') },
              { value: 'call_scheduled', label: t('badge.callScheduled') },
              { value: 'call_declined', label: t('badge.callDeclined') },
              { value: 'manual_review', label: t('badge.manualReview') },
              { value: 'approved', label: t('badge.approved') },
              { value: 'rejected', label: t('badge.rejected') },
              { value: 'blocked', label: t('badge.blocked') },
            ]}
            className="w-48"
          />
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {/* Sesli uyarı toggle */}
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? t('soundOffTitle') : t('soundOnTitle')}
            data-testid="sound-toggle"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              soundEnabled
                ? 'border-primary/20 bg-primary/5 text-primary'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {soundEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            {soundEnabled ? t('soundOn') : t('soundOff')}
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {tc('refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">{t('table.email')}</th>
              <th className="px-3 py-2">{t('table.name')}</th>
              <th className="px-3 py-2">{t('table.company')}</th>
              <th className="px-3 py-2">{t('table.approval')}</th>
              <th className="px-3 py-2">{t('table.premeeting')}</th>
              <th className="px-3 py-2">{t('table.meetingTime')}</th>
              <th className="px-3 py-2">{t('table.signup')}</th>
              <th className="px-3 py-2 text-right">{t('table.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  <Loader2 className="inline h-4 w-4 animate-spin text-primary" />
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  {t('noRecords')}
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((r) => {
                const badge = approvalBadge(r.approval_status)
                const actionPending = pending?.startsWith(r.id + ':')
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900 break-all">{r.email || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{r.name || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.company || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${badge.className}`}>
                        {t(badge.labelKey)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        {premeetingIcon(r.premeeting_status)}
                        {r.premeeting_status === 'scheduled'
                          ? t('premeeting.scheduled')
                          : r.premeeting_status === 'declined'
                          ? t('premeeting.declined')
                          : t('premeeting.waiting')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{fmt(r.premeeting_scheduled_at)}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{fmt(r.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => performAction(r.id, 'approve')}
                          disabled={actionPending || r.approval_status === 'approved'}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid={`approve-${r.id}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {tc('approve')}
                        </button>
                        <button
                          onClick={() => performAction(r.id, 'reject')}
                          disabled={actionPending || r.approval_status === 'rejected'}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid={`reject-${r.id}`}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {tc('reject')}
                        </button>
                        <button
                          onClick={() => setBlockTarget(r)}
                          disabled={actionPending || r.approval_status === 'blocked'}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid={`block-btn-${r.id}`}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          {t('block')}
                        </button>
                        <button
                          onClick={() => setSelected(r)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          data-testid={`detail-btn-${r.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('detail')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* Detay Modal */}
      {selected && (
        <SignupDetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onApprove={async () => {
            const ok = await performAction(selected.id, 'approve')
            if (ok) setSelected(null)
          }}
          onReject={async () => {
            const ok = await performAction(selected.id, 'reject')
            if (ok) setSelected(null)
          }}
          onBlock={() => {
            setSelected(null)
            setBlockTarget(selected)
          }}
          onAddNote={(note) => performNote(selected.id, note)}
        />
      )}

      {/* Engelle Modal */}
      {blockTarget && (
        <BlockModal
          row={blockTarget}
          onClose={() => setBlockTarget(null)}
          onConfirm={async (option, note, sourceIp) => {
            const ok = await performBlock(blockTarget.id, option, note, sourceIp)
            if (ok) setBlockTarget(null)
          }}
          pending={pending?.startsWith(blockTarget.id + ':block') ?? false}
        />
      )}
    </section>
  )
}

// ─── Detay Modal ──────────────────────────────────────────────────────────────

function SignupDetailModal({
  row,
  onClose,
  onApprove,
  onReject,
  onBlock,
  onAddNote,
}: {
  row: SignupRow
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  onBlock: () => void
  onAddNote: (note: string) => Promise<boolean>
}) {
  const t = useTranslations('gozetim.signups')
  const tc = useTranslations('common')
  const [noteDraft, setNoteDraft] = useState(row.approval_note || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!noteDraft.trim()) return
    setSaving(true)
    await onAddNote(noteDraft.trim())
    setSaving(false)
  }

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        data-testid="signup-detail-modal"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{t('detailModal.eyebrow')}</div>
            <div className="text-base font-semibold text-gray-900">{row.name || row.email || t('detailModal.fallback')}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={tc('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5 text-sm">
          {/* Temel bilgiler grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field k={t('field.email')} v={row.email} />
            <Field k={t('field.name')} v={row.name} />
            <Field k={t('field.company')} v={row.company} />
            <Field k={t('field.phone')} v={row.phone} />
            <Field k={t('field.signupDate')} v={fmt(row.created_at)} />
            <Field k={t('field.emailVerification')} v={fmt(row.verified_at)} />
            <Field k={t('field.source')} v={row.signup_source} />
            <Field k={t('field.approvalStatus')} v={t(approvalBadge(row.approval_status).labelKey)} />
            <Field k={t('field.premeeting')} v={row.premeeting_status} />
            <Field k={t('field.meetingTime')} v={fmt(row.premeeting_scheduled_at)} />
            <Field k={t('field.approvedBy')} v={row.approved_by} />
            <Field k={t('field.approvedAt')} v={fmt(row.approved_at)} />
            <Field k={t('field.rejectedBy')} v={row.rejected_by} />
            <Field k={t('field.rejectedAt')} v={fmt(row.rejected_at)} />
            <Field k={t('field.meetingDeclined')} v={fmt(row.premeeting_declined_at)} />
          </div>

          {/* Engel bilgileri */}
          {row.approval_status === 'blocked' && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">{t('blockInfo.title')}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field k={t('blockInfo.blockedBy')} v={row.blocked_by} />
                <Field k={t('blockInfo.blockedAt')} v={fmt(row.blocked_at)} />
                <Field k={t('blockInfo.reason')} v={row.block_reason} />
              </div>
            </div>
          )}

          {/* Manuel inceleme bilgileri */}
          {row.approval_status === 'manual_review' && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{t('badge.manualReview')}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field k={t('manualReviewInfo.reviewedBy')} v={row.manual_review_by} />
                <Field k={t('manualReviewInfo.date')} v={fmt(row.manual_review_at)} />
                <Field k={t('manualReviewInfo.note')} v={row.manual_review_note} />
              </div>
            </div>
          )}

          {/* Manuel not */}
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">{t('manualNote.label')}</div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t('manualNote.placeholder')}
            />
            <button
              onClick={save}
              disabled={saving || !noteDraft.trim()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('manualNote.save')}
            </button>
          </div>

          {/* Aksiyon butonları */}
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <button
              onClick={onApprove}
              disabled={row.approval_status === 'approved'}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4" />
              {tc('approve')}
            </button>
            <button
              onClick={onReject}
              disabled={row.approval_status === 'rejected'}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle className="h-4 w-4" />
              {tc('reject')}
            </button>
            <button
              onClick={onBlock}
              disabled={row.approval_status === 'blocked'}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shield className="h-4 w-4" />
              {t('blockReview')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Engelle Modal ────────────────────────────────────────────────────────────

const BLOCK_OPTIONS: Array<{ value: BlockOption; labelKey: string; descKey: string }> = [
  { value: 'user', labelKey: 'blockOptions.user.label', descKey: 'blockOptions.user.desc' },
  { value: 'email', labelKey: 'blockOptions.email.label', descKey: 'blockOptions.email.desc' },
  { value: 'domain', labelKey: 'blockOptions.domain.label', descKey: 'blockOptions.domain.desc' },
  { value: 'ip', labelKey: 'blockOptions.ip.label', descKey: 'blockOptions.ip.desc' },
  { value: 'all', labelKey: 'blockOptions.all.label', descKey: 'blockOptions.all.desc' },
  { value: 'manual_review', labelKey: 'blockOptions.manualReview.label', descKey: 'blockOptions.manualReview.desc' },
]

function BlockModal({
  row,
  onClose,
  onConfirm,
  pending,
}: {
  row: SignupRow
  onClose: () => void
  onConfirm: (option: BlockOption, note?: string, sourceIp?: string) => Promise<void>
  pending: boolean
}) {
  const t = useTranslations('gozetim.signups')
  const tc = useTranslations('common')
  const [selected, setSelected] = useState<BlockOption>('user')
  const [note, setNote] = useState('')
  const [sourceIp, setSourceIp] = useState('')

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        data-testid="block-modal"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{t('blockReview')}</div>
            <div className="text-base font-semibold text-gray-900">{row.email || row.name || t('detailModal.fallback')}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" aria-label={tc('close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="text-xs font-medium text-gray-500 mb-1">{t('blockModal.selectAction')}</div>
          {BLOCK_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                selected === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              data-testid={`block-option-${opt.value}`}
            >
              <input
                type="radio"
                name="block_option"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="mt-0.5 accent-primary"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">{t(opt.labelKey)}</div>
                <div className="text-xs text-gray-500">{t(opt.descKey)}</div>
              </div>
            </label>
          ))}

          {/* IP input sadece ip veya all seçiliyken */}
          {(selected === 'ip' || selected === 'all') && (
            <div>
              <label className="text-xs font-medium text-gray-500">{t('blockModal.ipAddress')}</label>
              <input
                type="text"
                value={sourceIp}
                onChange={(e) => setSourceIp(e.target.value)}
                placeholder={t('blockModal.ipPlaceholder')}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              {selected === 'ip' && !sourceIp.trim() && (
                <p className="mt-1 text-xs text-gray-500">{t('blockModal.ipHint')}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500">{t('blockModal.noteOptional')}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('blockModal.notePlaceholder')}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {tc('cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected, note.trim() || undefined, sourceIp.trim() || undefined)}
            disabled={pending}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              selected === 'manual_review'
                ? 'bg-primary hover:bg-primary/90'
                : 'bg-red-600 hover:bg-red-700'
            }`}
            data-testid="block-confirm-btn"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {selected === 'manual_review' ? t('blockModal.confirmManualReview') : t('block')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium text-gray-500">{k}</span>
      <span className="text-sm text-gray-800 break-all">{v || '—'}</span>
    </div>
  )
}
