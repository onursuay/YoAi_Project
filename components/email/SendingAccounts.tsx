'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Globe, Server, Loader2, Trash2, Star, ArrowLeft, X, Zap, Check, Rocket, Copy } from 'lucide-react'

interface DnsRecord { record?: string; name?: string; type?: string; value?: string; priority?: number }
interface Account {
  id: string; type: string; label: string | null; fromName: string | null; fromEmail: string
  replyTo: string | null; status: string; isDefault: boolean; host: string | null; domain: string | null
  records: DnsRecord[] | null
}

export default function SendingAccounts({ flash, onClose, isOwner }: { flash: (k: 'ok' | 'err', m: string, ms?: number) => void; onClose: () => void; isOwner: boolean }) {
  const t = useTranslations('email')

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list' | 'platform' | 'domain' | 'smtp'>('list')
  const [busy, setBusy] = useState(false)

  // platform
  const [pFromName, setPFromName] = useState('')
  const [pReplyTo, setPReplyTo] = useState('')

  // domain
  const [dDomain, setDDomain] = useState('')
  const [dFromEmail, setDFromEmail] = useState('')
  const [dFromName, setDFromName] = useState('')
  const [dRecords, setDRecords] = useState<DnsRecord[] | null>(null)
  const [dAccountId, setDAccountId] = useState<string | null>(null)

  // smtp
  const [sFromEmail, setSFromEmail] = useState('')
  const [sFromName, setSFromName] = useState('')
  const [sUser, setSUser] = useState('')
  const [sPass, setSPass] = useState('')
  const [sHost, setSHost] = useState('')
  const [sPort, setSPort] = useState('587')
  const [sSecure, setSSecure] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/email/sending-accounts')
      const data = await res.json()
      if (data.ok) setAccounts(data.accounts ?? [])
    } catch { /* sessiz */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const post = (body: Record<string, unknown>) => fetch('/api/email/sending-accounts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then((r) => r.json())

  const savePlatform = useCallback(async () => {
    setBusy(true)
    try {
      const d = await post({ type: 'platform', fromName: pFromName, replyTo: pReplyTo })
      if (d.ok) { flash('ok', t('sending.connected')); setMode('list'); load() } else flash('err', t('sending.error'))
    } finally { setBusy(false) }
  }, [pFromName, pReplyTo, flash, t, load])

  const createDomain = useCallback(async () => {
    if (!dDomain || !dFromEmail) { flash('err', t('sending.missing')); return }
    setBusy(true)
    try {
      const d = await post({ type: 'domain', domain: dDomain, fromEmail: dFromEmail, fromName: dFromName })
      if (d.ok) { setDRecords(d.records ?? []); setDAccountId(d.account?.id ?? null) }
      else if (d.error === 'email_domain_mismatch') flash('err', t('sending.domain.mismatch'))
      else flash('err', d.message || t('sending.error'), 8000)
    } finally { setBusy(false) }
  }, [dDomain, dFromEmail, dFromName, flash, t])

  const verifyDomain = useCallback(async () => {
    if (!dAccountId) return
    setBusy(true)
    try {
      const r = await fetch(`/api/email/sending-accounts/${dAccountId}/verify`, { method: 'POST' })
      const d = await r.json()
      if (d.ok && d.status === 'active') { flash('ok', t('sending.domain.verified')); setMode('list'); load() }
      else { flash('err', t('sending.domain.pending'), 8000); if (d.records) setDRecords(d.records) }
    } finally { setBusy(false) }
  }, [dAccountId, flash, t, load])

  const saveSmtp = useCallback(async () => {
    if (!sFromEmail || !sUser || !sPass || !sHost) { flash('err', t('sending.missing')); return }
    setBusy(true)
    try {
      const d = await post({ type: 'smtp', host: sHost, port: Number(sPort), secure: sSecure, user: sUser, pass: sPass, fromEmail: sFromEmail, fromName: sFromName })
      if (d.ok) { flash('ok', t('sending.connected')); setMode('list'); setSPass(''); load() }
      else if (d.error === 'smtp_failed') flash('err', d.message || t('sending.testFailed'), 8000)
      else flash('err', t('sending.error'))
    } finally { setBusy(false) }
  }, [sFromEmail, sUser, sPass, sHost, sPort, sSecure, sFromName, flash, t, load])

  const setDefault = async (id: string) => { await fetch(`/api/email/sending-accounts/${id}`, { method: 'PATCH' }); load() }
  const remove = async (id: string) => { await fetch(`/api/email/sending-accounts/${id}`, { method: 'DELETE' }); load() }
  const copy = (v: string) => { navigator.clipboard?.writeText(v).then(() => flash('ok', t('sending.domain.copied'), 1500)).catch(() => {}) }

  const input = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
  const label = 'block text-sm font-medium text-gray-700 mb-1.5'
  const Back = () => <button onClick={() => { setMode('list'); setDRecords(null); setDAccountId(null) }} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"><ArrowLeft className="w-4 h-4" /> {t('sending.back')}</button>

  // ── Alt mail (platform) ──
  if (mode === 'platform') {
    return (
      <div className="max-w-xl"><Back />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">{t('sending.platform.title')}</h3>
          <p className="text-xs text-gray-500">{t('sending.platform.hint')}</p>
          <div><label className={label}>{t('sending.platform.fromName')}</label>
            <input value={pFromName} onChange={(e) => setPFromName(e.target.value)} placeholder={t('sending.placeholderCompanyName')} className={input} /></div>
          <div><label className={label}>{t('sending.platform.replyTo')}</label>
            <input value={pReplyTo} onChange={(e) => setPReplyTo(e.target.value)} placeholder="siz@firma.com" className={input} />
            <p className="text-xs text-gray-400 mt-1">{t('sending.platform.replyHint')}</p></div>
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button onClick={savePlatform} disabled={busy} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('sending.platform.activate')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Kendi domaini ──
  if (mode === 'domain') {
    return (
      <div className="max-w-2xl"><Back />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">{t('sending.domain.title')}</h3>
          {!dRecords ? (
            <>
              <div><label className={label}>{t('sending.domain.domain')}</label>
                <input value={dDomain} onChange={(e) => setDDomain(e.target.value)} placeholder="mail.firma.com" className={input} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>{t('sending.domain.fromEmail')}</label>
                  <input value={dFromEmail} onChange={(e) => setDFromEmail(e.target.value)} placeholder="info@mail.firma.com" className={input} /></div>
                <div><label className={label}>{t('sending.domain.fromName')}</label>
                  <input value={dFromName} onChange={(e) => setDFromName(e.target.value)} placeholder={t('sending.placeholderCompanyName')} className={input} /></div>
              </div>
              <p className="text-xs text-gray-400">{t('sending.domain.emailHint')}</p>
              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button onClick={createDomain} disabled={busy} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t('sending.domain.getRecords')}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">{t('sending.domain.recordsHint')}</p>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500"><tr><th className="text-left px-3 py-2">{t('sending.domain.colType')}</th><th className="text-left px-3 py-2">{t('sending.domain.colName')}</th><th className="text-left px-3 py-2">{t('sending.domain.colValue')}</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {dRecords.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium text-gray-700">{r.type}</td>
                        <td className="px-3 py-2 text-gray-600 font-mono break-all">{r.name}</td>
                        <td className="px-3 py-2 text-gray-600 font-mono break-all">
                          <span className="inline-flex items-start gap-1">{r.value}
                            <button onClick={() => copy(r.value || '')} className="text-gray-300 hover:text-primary shrink-0"><Copy className="w-3 h-3" /></button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">{t('sending.domain.afterAdd')}</p>
                <button onClick={verifyDomain} disabled={busy} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('sending.domain.verify')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Kurumsal SMTP ──
  if (mode === 'smtp') {
    return (
      <div className="max-w-xl"><Back />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">{t('sending.smtp.title')}</h3>
          <p className="text-xs text-gray-500">{t('sending.smtp.corpHint')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>{t('sending.smtp.fromEmail')}</label>
              <input value={sFromEmail} onChange={(e) => { setSFromEmail(e.target.value); if (!sUser) setSUser(e.target.value) }} placeholder="siz@firma.com" className={input} /></div>
            <div><label className={label}>{t('sending.smtp.fromName')}</label>
              <input value={sFromName} onChange={(e) => setSFromName(e.target.value)} placeholder={t('sending.placeholderCompanyName')} className={input} /></div>
          </div>
          <div><label className={label}>{t('sending.smtp.user')}</label><input value={sUser} onChange={(e) => setSUser(e.target.value)} className={input} /></div>
          <div><label className={label}>{t('sending.smtp.pass')}</label><input type="password" value={sPass} onChange={(e) => setSPass(e.target.value)} className={input} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><label className={label}>{t('sending.smtp.host')}</label><input value={sHost} onChange={(e) => setSHost(e.target.value)} placeholder="smtp.firma.com" className={input} /></div>
            <div><label className={label}>{t('sending.smtp.port')}</label><input value={sPort} onChange={(e) => setSPort(e.target.value)} className={input} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={sSecure} onChange={(e) => setSSecure(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary/20" /> {t('sending.smtp.secure')}</label>
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button onClick={saveSmtp} disabled={busy} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('sending.smtp.testSave')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Liste + kartlar ──
  // "Platform (alt mail)" yalnız süper admin/owner'a — normal kullanıcılar bizim
  // domainimizden gönderemez (itibar/yasal risk).
  const cards = [
    ...(isOwner ? [{ key: 'platform', icon: Rocket, onClick: () => setMode('platform') }] : []),
    { key: 'domain', icon: Globe, onClick: () => setMode('domain') },
    { key: 'oauth', icon: Zap, onClick: () => { window.location.href = '/api/email/gmail/start' } },
    { key: 'smtp', icon: Server, onClick: () => setMode('smtp') },
  ]
  const typeLabel = (a: Account) => a.type === 'platform' ? t('sending.cards.platform.title') : a.type === 'domain' ? `${a.domain} (${a.status === 'active' ? t('sending.domain.active') : t('sending.domain.pendingShort')})` : a.type.toUpperCase()

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">{t('sending.title')}</h2>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
      </div>

      {!loading && accounts.length > 0 && (
        <div className="space-y-2 mb-6">
          {accounts.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center"><Server className="w-4 h-4 text-primary" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.fromName ? `${a.fromName} · ` : ''}{a.fromEmail}</p>
                  <p className="text-xs text-gray-500">{typeLabel(a)} {a.isDefault && <span className="text-primary font-medium">· {t('sending.default')}</span>}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!a.isDefault && a.status === 'active' && <button onClick={() => setDefault(a.id)} title={t('sending.makeDefault')} className="p-1.5 text-gray-400 hover:text-primary"><Star className="w-4 h-4" /></button>}
                <button onClick={() => remove(a.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-600 mb-3">{t('sending.chooseHint')}</p>
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isOwner ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        {cards.map(({ key, icon: Icon, onClick }) => (
          <button key={key} onClick={onClick} className="text-left rounded-2xl border border-gray-200 bg-white shadow-sm p-5 transition hover:border-primary hover:shadow-md">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3"><Icon className="w-5 h-5 text-primary" /></div>
            <h3 className="text-sm font-semibold text-gray-900">{t(`sending.cards.${key}.title`)}</h3>
            <p className="text-xs text-gray-600 mt-1">{t(`sending.cards.${key}.desc`)}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
