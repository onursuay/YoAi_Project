'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Users, Send, Workflow, ShieldCheck, Download, Upload, Loader2, Mail, Phone, Trash2, Plus } from 'lucide-react'
import { parseContactsFile } from './parseContactsFile'
import CampaignsTab from './CampaignsTab'
import AutomationsTab from './AutomationsTab'
import SendingAccounts from './SendingAccounts'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import { usePathTab } from '@/hooks/usePathTab'

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

  // Sekme durumu URL path'inden türetilir (/email-marketing/<sekme>)
  const { activeTab, setTab } = usePathTab('email-marketing')
  const tab = activeTab as Tab
  const [managingSending, setManagingSending] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<{ total: number; optedOut: number }>({ total: 0, optedOut: 0 })
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addName, setAddName] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addSaving, setAddSaving] = useState(false)
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

  const handleAddManual = useCallback(async () => {
    const email = addEmail.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { flash('err', t('contacts.addNeedEmail')); return }
    setAddSaving(true)
    try {
      const res = await fetch('/api/email/contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{ email, fullName: addName.trim() || null, phone: addPhone.trim() || null }], source: 'manual' }),
      })
      const d = await res.json()
      if (d.ok) {
        flash('ok', t('contacts.addSaved'))
        setAdding(false); setAddEmail(''); setAddName(''); setAddPhone('')
        loadContacts(offset)
      } else flash('err', t('contacts.error'))
    } finally { setAddSaving(false) }
  }, [addEmail, addName, addPhone, flash, t, loadContacts, offset])

  const sourceLabel = (s: string) => t(`contacts.source.${['crm', 'csv', 'sheets', 'manual'].includes(s) ? s : 'manual'}`)
  const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return iso } }

  const tabs: { key: Tab; icon: typeof Users; soon: boolean }[] = [
    { key: 'contacts', icon: Users, soon: false },
    { key: 'campaigns', icon: Send, soon: false },
    { key: 'automation', icon: Workflow, soon: false },
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
                onClick={() => setAdding((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <Plus className="w-4 h-4" /> {t('contacts.addManual')}
              </button>
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

          {adding && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4 animate-card-enter">
              <p className="text-base font-semibold text-gray-900 mb-3">{t('contacts.addManualTitle')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder={t('contacts.addEmail')} className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={t('contacts.addName')} className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                <input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder={t('contacts.addPhone')} className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">{t('contacts.addCancel')}</button>
                <button onClick={handleAddManual} disabled={addSaving} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 active:scale-[0.97] transition-all">
                  {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('contacts.addSave')}
                </button>
              </div>
            </div>
          )}

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

      {tab === 'campaigns' && <CampaignsTab flash={flash} onManageSending={() => setManagingSending(true)} />}

      {tab === 'automation' && <AutomationsTab flash={flash} onManageSending={() => setManagingSending(true)} />}
       </>
      )}
    </div>
  )
}
