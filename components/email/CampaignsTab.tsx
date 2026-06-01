'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Loader2, Send, Trash2, ArrowLeft, Users, Inbox, ChevronDown } from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import { STAGES } from '@/components/crm/stageMeta'

type Segment = { type: 'all' } | { type: 'source'; source: string } | { type: 'crm_stage'; stage: string }

interface CampaignListItem {
  id: string
  name: string
  subject: string
  status: string
  sentAt: string | null
  stats: Record<string, number>
  createdAt: string
}

function encodeSeg(s: Segment): string {
  if (s.type === 'source') return `source:${s.source}`
  if (s.type === 'crm_stage') return `stage:${s.stage}`
  return 'all'
}
function decodeSeg(v: string): Segment {
  if (v.startsWith('source:')) return { type: 'source', source: v.slice(7) }
  if (v.startsWith('stage:')) return { type: 'crm_stage', stage: v.slice(6) }
  return { type: 'all' }
}

export default function CampaignsTab({ flash }: { flash: (k: 'ok' | 'err', m: string, ms?: number) => void }) {
  const t = useTranslations('email')
  const tc = useTranslations('crm')

  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)

  // composer
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')
  const [seg, setSeg] = useState('all')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [backOpen, setBackOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/email/campaigns')
      const data = await res.json()
      if (data.ok) setCampaigns(data.campaigns ?? [])
    } catch { /* sessiz */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // segment değişince alıcı sayısı önizleme
  useEffect(() => {
    if (!composing) return
    let active = true
    setRecipientCount(null)
    fetch('/api/email/recipients-count', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment: decodeSeg(seg) }),
    }).then((r) => r.json()).then((d) => { if (active && d.ok) setRecipientCount(d.count) }).catch(() => {})
    return () => { active = false }
  }, [seg, composing])

  const segOptions = useMemo(() => [
    { value: 'all', label: t('campaigns.seg.all') },
    { value: 'source:crm', label: t('campaigns.seg.sourceCrm') },
    { value: 'source:csv', label: t('campaigns.seg.sourceCsv') },
    ...STAGES.map((s) => ({ value: `stage:${s}`, label: `${t('campaigns.seg.stagePrefix')}: ${tc(`stages.${s}`)}` })),
  ], [t, tc])

  const openNew = () => { setEditId(null); setName(''); setSubject(''); setHtml(''); setSeg('all'); setComposing(true); setBackOpen(false) }

  const saveDraft = useCallback(async (): Promise<string | null> => {
    const payload = { name: name || t('campaigns.untitled'), subject, html, segment: decodeSeg(seg) }
    if (editId) {
      const res = await fetch(`/api/email/campaigns/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json()
      return d.ok ? editId : null
    }
    const res = await fetch('/api/email/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const d = await res.json()
    if (d.ok) { setEditId(d.id); return d.id }
    return null
  }, [editId, name, subject, html, seg, t])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const id = await saveDraft()
      if (id) { flash('ok', t('campaigns.saved')); load() } else flash('err', t('contacts.error'))
    } finally { setSaving(false) }
  }, [saveDraft, flash, t, load])

  const handleSend = useCallback(async () => {
    if (!subject.trim() || !html.trim()) { flash('err', t('campaigns.needContent')); return }
    setSending(true)
    try {
      const id = await saveDraft()
      if (!id) { flash('err', t('contacts.error')); return }
      const res = await fetch(`/api/email/campaigns/${id}/send`, { method: 'POST' })
      const d = await res.json()
      if (d.ok) { flash('ok', t('campaigns.sent', { count: d.sent }), 5000); setComposing(false); load() }
      else if (d.reason === 'no_recipients') flash('err', t('campaigns.noRecipients'))
      else if (d.reason === 'resend_not_configured') flash('err', t('campaigns.noResend'))
      else flash('err', t('contacts.error'))
    } finally { setSending(false) }
  }, [saveDraft, subject, html, flash, t, load])

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/email/campaigns/${id}`, { method: 'DELETE' })
    load()
  }, [load])

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-600', scheduled: 'bg-primary/10 text-primary',
      sending: 'bg-primary/10 text-primary', sent: 'bg-emerald-50 text-emerald-700', failed: 'bg-red-50 text-red-700',
    }
    return <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${map[s] || 'bg-gray-100 text-gray-600'}`}>{t(`campaigns.status.${s}`)}</span>
  }

  // ── Composer (sol form + sağ canlı önizleme) ──
  if (composing) {
    return (
      <div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('campaigns.name')}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('campaigns.untitled')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('campaigns.subject')}</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('campaigns.segment')}</label>
              <WizardSelect value={seg} onChange={setSeg} options={segOptions} />
              <p className="text-xs text-gray-500 mt-1.5 inline-flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {recipientCount === null ? t('campaigns.counting') : t('campaigns.recipientCount', { count: recipientCount })}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('campaigns.content')}</label>
              <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={12} placeholder={t('campaigns.contentPlaceholder')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              <p className="text-xs text-gray-400 mt-1">{t('campaigns.contentHint')}</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('campaigns.saveDraft')}
              </button>
              <button onClick={handleSend} disabled={sending} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {t('campaigns.send')}
              </button>
            </div>
          </div>

          {/* Canlı önizleme */}
          <div className="lg:sticky lg:top-4 self-start">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden animate-card-enter">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-[11px] text-gray-400">{t('campaigns.previewFrom')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{subject || t('campaigns.noSubject')}</p>
              </div>
              {/* Sandbox'lı iframe — kullanıcı içeriği izole render; script çalışmaz (XSS kapalı). */}
              <iframe
                title="email-preview"
                sandbox=""
                className="w-full min-h-[320px] border-0 block bg-white"
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;padding:20px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6;font-size:14px">${
                  html.trim() || `<p style="color:#d1d5db">${t('campaigns.previewEmpty')}</p>`
                }<hr style="margin-top:28px;border:none;border-top:1px solid #e5e7eb"/><p style="font-size:11px;color:#9ca3af;margin-top:12px">${t('campaigns.unsubPreview')}</p></body></html>`}
              />
            </div>
            <div className="mt-3 flex flex-col items-end gap-2">
              <button
                onClick={() => setBackOpen(v => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span>{t('campaigns.back')}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${backOpen ? 'rotate-180' : ''}`} />
              </button>
              {backOpen && (
                <button
                  onClick={() => setComposing(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> {t('campaigns.back')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Liste ──
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">{campaigns.length} {t('campaigns.count')}</p>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" /> {t('campaigns.new')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4"><Inbox className="w-6 h-6 text-gray-300" /></div>
          <p className="text-gray-700 font-medium">{t('campaigns.empty')}</p>
          <p className="text-sm text-gray-500 mt-1">{t('campaigns.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{c.name}</h3>
                  {statusBadge(c.status)}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{c.subject || '—'}</p>
                {c.status === 'sent' && (
                  <p className="text-xs text-emerald-600 mt-1">{t('campaigns.sentStat', { sent: c.stats?.sent ?? 0, total: c.stats?.recipients ?? 0 })}</p>
                )}
              </div>
              <button onClick={() => handleDelete(c.id)} className="p-2 text-gray-300 hover:text-red-600 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
