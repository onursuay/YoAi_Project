'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Users, Send, Workflow, ShieldCheck, Download, Upload, Loader2, Mail, Phone, Trash2 } from 'lucide-react'
import { parseContactsFile } from './parseContactsFile'
import CampaignsTab from './CampaignsTab'
import SendingAccounts from './SendingAccounts'
import { useSubscription } from '@/components/providers/SubscriptionProvider'

type Tab = 'contacts' | 'campaigns' | 'automation'

interface Contact {
  id: string
  email: string
  fullName: string | null
  phone: string | null
  source: string
  optOut: boolean
  createdAt: string
}

const PAGE = 50

export default function EmailDashboard() {
  const t = useTranslations('email')
  const { isOwner } = useSubscription()

  const [tab, setTab] = useState<Tab>('contacts')
  const [managingSending, setManagingSending] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<{ total: number; optedOut: number }>({ total: 0, optedOut: 0 })
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const flash = useCallback((kind: 'ok' | 'err', msg: string, ms = 3500) => {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), ms)
  }, [])

  const loadContacts = useCallback(async (off: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/email/contacts?limit=${PAGE}&offset=${off}`)
      const data = await res.json()
      if (data.ok) {
        setContacts(data.contacts ?? [])
        setTotal(data.total ?? 0)
        setCounts(data.counts ?? { total: 0, optedOut: 0 })
      }
    } catch {
      /* sessiz */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadContacts(offset) }, [offset, loadContacts])

  // Gmail OAuth dönüşü (?gmail=connected|error|...) → bildir + paneli aç.
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get('gmail')
    if (!g) return
    if (g === 'connected') { flash('ok', t('sending.gmailConnected')); setManagingSending(true) }
    else if (g === 'config_missing') flash('err', t('sending.gmailConfig'), 8000)
    else if (g === 'no_refresh') flash('err', t('sending.gmailNoRefresh'), 8000)
    else flash('err', t('sending.gmailError'))
    window.history.replaceState({}, '', '/email-marketing')
  }, [flash, t])

  const handleImportCrm = useCallback(async () => {
    setImporting(true)
    try {
      const res = await fetch('/api/email/contacts/import-crm', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        flash('ok', t('contacts.imported', { count: data.inserted }))
        setOffset(0)
        loadContacts(0)
      } else {
        flash('err', t('contacts.error'))
      }
    } catch {
      flash('err', t('contacts.error'))
    } finally {
      setImporting(false)
    }
  }, [flash, t, loadContacts])

  const handleFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const rows = await parseContactsFile(file)
      if (rows.length === 0) { flash('err', t('contacts.noValid')); return }
      const res = await fetch('/api/email/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, source: 'csv' }),
      })
      const data = await res.json()
      if (data.ok) {
        flash('ok', t('contacts.uploaded', { count: data.inserted, total: rows.length }))
        setOffset(0)
        loadContacts(0)
      } else {
        flash('err', t('contacts.error'))
      }
    } catch {
      flash('err', t('contacts.parseError'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [flash, t, loadContacts])

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/email/contacts/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) { setContacts((p) => p.filter((c) => c.id !== id)); loadContacts(offset) }
    } catch { /* sessiz */ }
  }, [offset, loadContacts])

  const sourceLabel = (s: string) => t(`contacts.source.${['crm', 'csv', 'sheets', 'manual'].includes(s) ? s : 'manual'}`)
  const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return iso } }

  const tabs: { key: Tab; icon: typeof Users; soon: boolean }[] = [
    { key: 'contacts', icon: Users, soon: false },
    { key: 'campaigns', icon: Send, soon: false },
    { key: 'automation', icon: Workflow, soon: true },
  ]

  return (
    <div className="w-full px-6 lg:px-8 py-8">
      {toast && (
        <div className={`fixed top-4 right-6 z-[80] px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {managingSending ? (
        <SendingAccounts flash={flash} onClose={() => setManagingSending(false)} isOwner={isOwner} />
      ) : (
       <>
      {/* Gönderim hesabı yönlendirmesi */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-3 mb-6">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{t('sending.bannerTitle')}</p>
            <p className="text-sm text-gray-600 mt-0.5">{t('sending.bannerDesc')}</p>
          </div>
        </div>
        <button onClick={() => setManagingSending(true)} className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition">
          {t('sending.manage')}
        </button>
      </div>

      {/* Sekmeler */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200">
        {tabs.map(({ key, icon: Icon, soon }) => (
          <button
            key={key}
            onClick={() => !soon && setTab(key)}
            disabled={soon}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 -mb-px text-sm font-medium border-b-2 transition ${
              tab === key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            } ${soon ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Icon className="w-4 h-4" /> {t(`sections.${key}.title`)}
            {soon && <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">{t('soon')}</span>}
          </button>
        ))}
      </div>

      {tab === 'contacts' && (
        <>
          {/* Aksiyonlar + sayaç */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{counts.total}</span> {t('contacts.total')}
              {counts.optedOut > 0 && <span className="text-gray-400"> · {counts.optedOut} {t('contacts.optOut')}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleImportCrm}
                disabled={importing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {t('contacts.importCrm')}
              </button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {t('contacts.upload')}
              </button>
            </div>
          </div>

          {/* Tablo */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : contacts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4"><Users className="w-6 h-6 text-gray-300" /></div>
              <p className="text-gray-700 font-medium">{t('contacts.empty')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('contacts.emptyHint')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">{t('contacts.colEmail')}</th>
                    <th className="text-left font-medium px-4 py-3">{t('contacts.colName')}</th>
                    <th className="text-left font-medium px-4 py-3">{t('contacts.colPhone')}</th>
                    <th className="text-left font-medium px-4 py-3">{t('contacts.colSource')}</th>
                    <th className="text-left font-medium px-4 py-3">{t('contacts.colDate')}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contacts.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-800">
                        <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" />{c.email}{c.optOut && <span className="text-[10px] text-red-600 border border-red-200 bg-red-50 rounded-full px-1.5">{t('contacts.optOut')}</span>}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{c.fullName || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.phone ? <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" />{c.phone}</span> : '—'}</td>
                      <td className="px-4 py-2.5"><span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{sourceLabel(c.source)}</span></td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{fmtDate(c.createdAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-300 hover:text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Sayfalama */}
              {total > PAGE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
                  <span>{offset + 1}–{Math.min(offset + PAGE, total)} / {total}</span>
                  <div className="flex gap-2">
                    <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹</button>
                    <button disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">›</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'campaigns' && <CampaignsTab flash={flash} />}

      {tab === 'automation' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 text-center">
          <p className="text-gray-700 font-medium">{t('sections.automation.title')}</p>
          <p className="text-sm text-gray-500 mt-1">{t('sections.automation.desc')}</p>
          <span className="inline-flex items-center mt-3 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{t('soon')}</span>
        </div>
      )}
       </>
      )}
    </div>
  )
}
