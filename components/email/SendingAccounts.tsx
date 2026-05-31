'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Globe, Server, Loader2, Trash2, Star, ArrowLeft, X, Zap, Check } from 'lucide-react'

interface Account {
  id: string; type: string; label: string | null; fromName: string | null; fromEmail: string
  status: string; isDefault: boolean; host: string | null; user: string | null
}

export default function SendingAccounts({ flash, onClose }: { flash: (k: 'ok' | 'err', m: string, ms?: number) => void; onClose: () => void }) {
  const t = useTranslations('email')

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list' | 'smtp'>('list')

  // SMTP form (yalnız kurumsal/özel sunucu)
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [secure, setSecure] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/email/sending-accounts')
      const data = await res.json()
      if (data.ok) setAccounts(data.accounts ?? [])
    } catch { /* sessiz */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const saveSmtp = useCallback(async () => {
    if (!fromEmail || !user || !pass || !host) { flash('err', t('sending.missing')); return }
    setSaving(true)
    try {
      const res = await fetch('/api/email/sending-accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'smtp', host, port: Number(port), secure, user, pass, fromEmail, fromName, label: host }),
      })
      const data = await res.json()
      if (data.ok) { flash('ok', t('sending.connected')); setMode('list'); setPass(''); load() }
      else if (data.error === 'smtp_failed') flash('err', data.message || t('sending.testFailed'), 8000)
      else flash('err', t('sending.error'))
    } catch { flash('err', t('sending.error')) } finally { setSaving(false) }
  }, [fromEmail, user, pass, host, port, secure, fromName, flash, t, load])

  const setDefault = async (id: string) => { await fetch(`/api/email/sending-accounts/${id}`, { method: 'PATCH' }); load() }
  const remove = async (id: string) => { await fetch(`/api/email/sending-accounts/${id}`, { method: 'DELETE' }); load() }

  // ── SMTP form (kurumsal/özel) ──
  if (mode === 'smtp') {
    return (
      <div className="max-w-xl">
        <button onClick={() => setMode('list')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"><ArrowLeft className="w-4 h-4" /> {t('sending.back')}</button>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">{t('sending.smtp.title')}</h3>
          <p className="text-xs text-gray-500">{t('sending.smtp.corpHint')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">{t('sending.smtp.fromEmail')}</label>
              <input value={fromEmail} onChange={(e) => { setFromEmail(e.target.value); if (!user) setUser(e.target.value) }} placeholder="siz@firma.com" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">{t('sending.smtp.fromName')}</label>
              <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Firma Adı" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">{t('sending.smtp.user')}</label>
            <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="siz@firma.com" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">{t('sending.smtp.pass')}</label>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1.5">{t('sending.smtp.host')}</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.firma.com" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">{t('sending.smtp.port')}</label>
              <input value={port} onChange={(e) => setPort(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary/20" /> {t('sending.smtp.secure')}
          </label>
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button onClick={saveSmtp} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('sending.smtp.testSave')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Liste + 3 kart ──
  const cards = [
    { key: 'oauth', icon: Zap, soon: true, onClick: () => {} },
    { key: 'domain', icon: Globe, soon: true, onClick: () => {} },
    { key: 'smtp', icon: Server, soon: false, onClick: () => setMode('smtp') },
  ]

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
                  <p className="text-xs text-gray-500">{a.type.toUpperCase()} · {a.host} {a.isDefault && <span className="text-primary font-medium">· {t('sending.default')}</span>}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!a.isDefault && <button onClick={() => setDefault(a.id)} title={t('sending.makeDefault')} className="p-1.5 text-gray-400 hover:text-primary"><Star className="w-4 h-4" /></button>}
                <button onClick={() => remove(a.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-600 mb-3">{t('sending.chooseHint')}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(({ key, icon: Icon, soon, onClick }) => (
          <button key={key} onClick={onClick} disabled={soon}
            className={`text-left rounded-2xl border bg-white shadow-sm p-5 transition ${soon ? 'border-gray-200 opacity-60 cursor-not-allowed' : 'border-gray-200 hover:border-primary hover:shadow-md'}`}>
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3"><Icon className="w-5 h-5 text-primary" /></div>
            <h3 className="text-sm font-semibold text-gray-900">{t(`sending.cards.${key}.title`)}</h3>
            <p className="text-xs text-gray-600 mt-1">{t(`sending.cards.${key}.desc`)}</p>
            {soon && <span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">{t('soon')}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
