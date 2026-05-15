'use client'

/**
 * Gözetim Merkezi → "Başvurular" sekmesi.
 *
 * Sadece owner (Süper Admin) görür. Manuel onay/red işlemlerini buradan yapar.
 * Liste `/api/admin/signups`'tan beslenir.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Search,
  CalendarCheck,
  CalendarX2,
  Clock,
} from 'lucide-react'

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
  created_at: string | null
  verified_at: string | null
  updated_at: string | null
}

type ApprovalFilter = 'all' | 'pending' | 'call_scheduled' | 'call_declined' | 'approved' | 'rejected'

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

function approvalBadge(status: string | null): { label: string; className: string } {
  switch ((status || '').toLowerCase()) {
    case 'approved':
      return { label: 'Onaylandı', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'rejected':
      return { label: 'Reddedildi', className: 'bg-red-50 text-red-700 border-red-200' }
    case 'call_scheduled':
      return { label: 'Görüşme planlı', className: 'bg-primary/5 text-primary border-primary/20' }
    case 'call_declined':
      return { label: 'Görüşme reddedildi', className: 'bg-gray-50 text-gray-700 border-gray-200' }
    case 'needs_call':
      return { label: 'Görüşme bekleniyor', className: 'bg-primary/5 text-primary border-primary/20' }
    default:
      return { label: 'Bekliyor', className: 'bg-gray-50 text-gray-700 border-gray-200' }
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

export default function SignupApprovalsPanel() {
  const [rows, setRows] = useState<SignupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ApprovalFilter>('all')
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [selected, setSelected] = useState<SignupRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/signups?limit=200', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'load_failed')
      }
      setRows((data.signups as SignupRow[]) || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load_failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== 'all' && (r.approval_status || 'pending') !== filter) return false
      if (!q) return true
      const fields = [r.email, r.name, r.company, r.phone, r.signup_source]
      return fields.some((f) => (f || '').toLowerCase().includes(q))
    })
  }, [rows, filter, search])

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

  return (
    <section className="mt-8" data-testid="signup-approvals-panel">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-gray-900">Başvurular</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ApprovalFilter)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700 focus:border-primary focus:outline-none"
          >
            <option value="all">Onay · Tümü</option>
            <option value="pending">Bekliyor</option>
            <option value="call_scheduled">Görüşme planlı</option>
            <option value="call_declined">Görüşme reddedildi</option>
            <option value="approved">Onaylandı</option>
            <option value="rejected">Reddedildi</option>
          </select>
          <div className="relative w-72 max-w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="E-posta, isim, firma ara"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Yenile
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
              <th className="px-3 py-2">E-posta</th>
              <th className="px-3 py-2">İsim</th>
              <th className="px-3 py-2">Firma</th>
              <th className="px-3 py-2">Onay</th>
              <th className="px-3 py-2">Ön Görüşme</th>
              <th className="px-3 py-2">Görüşme Saati</th>
              <th className="px-3 py-2">Kayıt</th>
              <th className="px-3 py-2 text-right">Aksiyon</th>
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
                  Kayıt bulunamadı.
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
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        {premeetingIcon(r.premeeting_status)}
                        {r.premeeting_status === 'scheduled'
                          ? 'Planlandı'
                          : r.premeeting_status === 'declined'
                          ? 'Reddedildi'
                          : 'Bekliyor'}
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
                          Onayla
                        </button>
                        <button
                          onClick={() => performAction(r.id, 'reject')}
                          disabled={actionPending || r.approval_status === 'rejected'}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid={`reject-${r.id}`}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reddet
                        </button>
                        <button
                          onClick={() => setSelected(r)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Detay
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {selected && (
        <SignupDetailDrawer
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
          onAddNote={(note) => performNote(selected.id, note)}
        />
      )}
    </section>
  )
}

function SignupDetailDrawer({
  row,
  onClose,
  onApprove,
  onReject,
  onAddNote,
}: {
  row: SignupRow
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  onAddNote: (note: string) => Promise<boolean>
}) {
  const [noteDraft, setNoteDraft] = useState(row.approval_note || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!noteDraft.trim()) return
    setSaving(true)
    await onAddNote(noteDraft.trim())
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} aria-hidden="true" />
      <div className="relative ml-auto h-full w-full max-w-md overflow-y-auto bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Başvuru Detayı</div>
            <div className="text-base font-semibold text-gray-900">{row.name || row.email || 'Başvuru'}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-5 text-sm">
          <div className="grid grid-cols-3 gap-2">
            <Field k="E-posta" v={row.email} />
            <Field k="Telefon" v={row.phone} />
            <Field k="Firma" v={row.company} />
            <Field k="Kayıt" v={fmt(row.created_at)} />
            <Field k="Email Doğrulama" v={fmt(row.verified_at)} />
            <Field k="Kaynak" v={row.signup_source} />
            <Field k="Onay Durumu" v={approvalBadge(row.approval_status).label} />
            <Field k="Ön Görüşme" v={row.premeeting_status} />
            <Field k="Görüşme Saati" v={fmt(row.premeeting_scheduled_at)} />
            <Field k="Onaylayan" v={row.approved_by} />
            <Field k="Onay Zamanı" v={fmt(row.approved_at)} />
            <Field k="Reddeden" v={row.rejected_by} />
            <Field k="Red Zamanı" v={fmt(row.rejected_at)} />
            <Field k="Görüşme Reddi" v={fmt(row.premeeting_declined_at)} />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">Manuel Not</div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Bu başvuruya dair not…"
            />
            <button
              onClick={save}
              disabled={saving || !noteDraft.trim()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Notu Kaydet
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onApprove}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <CheckCircle2 className="h-4 w-4" />
              Başvuruyu Onayla
            </button>
            <button
              onClick={onReject}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              <XCircle className="h-4 w-4" />
              Başvuruyu Reddet
            </button>
          </div>
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
