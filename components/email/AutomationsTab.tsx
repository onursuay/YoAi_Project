'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Loader2, Trash2, ArrowLeft, Zap, Workflow, ChevronDown } from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import { STAGES } from '@/components/crm/stageMeta'

type Trigger = { type: 'crm_stage_enter'; stage: string } | { type: 'contact_added' }

interface AutomationItem {
  id: string
  name: string
  trigger: Trigger | Record<string, unknown>
  subject: string
  html: string
  enabled: boolean
  createdAt: string
}

// Trigger ↔ WizardSelect value kodlaması ('contact' | 'stage:giris' ...)
function encodeTrigger(t: Trigger): string {
  return t.type === 'crm_stage_enter' ? `stage:${t.stage}` : 'contact'
}
function decodeTrigger(v: string): Trigger {
  return v.startsWith('stage:') ? { type: 'crm_stage_enter', stage: v.slice(6) } : { type: 'contact_added' }
}

export default function AutomationsTab({ flash }: { flash: (k: 'ok' | 'err', m: string, ms?: number) => void }) {
  const t = useTranslations('email')
  const tc = useTranslations('crm')

  const [items, setItems] = useState<AutomationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)

  // composer state
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [trig, setTrig] = useState('stage:uygun')
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [backOpen, setBackOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/email/automations')
      const data = await res.json()
      if (data.ok) setItems(data.automations ?? [])
    } catch { /* sessiz */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const trigOptions = useMemo(() => [
    ...STAGES.map((s) => ({ value: `stage:${s}`, label: `${t('automations.triggerStage')}: ${tc(`stages.${s}`)}` })),
    { value: 'contact', label: t('automations.triggerContact') },
  ], [t, tc])

  const openNew = () => { setEditId(null); setName(''); setTrig('stage:uygun'); setSubject(''); setHtml(''); setComposing(true); setBackOpen(false) }
  const openEdit = (a: AutomationItem) => {
    setEditId(a.id); setName(a.name)
    setTrig(encodeTrigger(a.trigger as Trigger)); setSubject(a.subject); setHtml(a.html); setComposing(true); setBackOpen(false)
  }

  const handleSave = useCallback(async () => {
    if (!subject.trim() || !html.trim()) { flash('err', t('automations.needContent')); return }
    setSaving(true)
    try {
      const payload = { name: name || t('automations.namePlaceholder'), trigger: decodeTrigger(trig), subject, html, enabled: true }
      const url = editId ? `/api/email/automations/${editId}` : '/api/email/automations'
      const method = editId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json()
      if (d.ok) { flash('ok', t('automations.saved')); setComposing(false); load() }
      else flash('err', t('contacts.error'))
    } finally { setSaving(false) }
  }, [editId, name, trig, subject, html, flash, t, load])

  const toggleEnabled = useCallback(async (a: AutomationItem) => {
    await fetch(`/api/email/automations/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !a.enabled }) })
    load()
  }, [load])

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/email/automations/${id}`, { method: 'DELETE' })
    load()
  }, [load])

  const triggerSummary = (tr: Trigger | Record<string, unknown>) => {
    const tt = tr as Trigger
    if (tt?.type === 'crm_stage_enter') return t('automations.triggerSummaryStage', { stage: tc(`stages.${(tt as { type: 'crm_stage_enter'; stage: string }).stage}`) })
    return t('automations.triggerSummaryContact')
  }

  // ── Composer (sol form + sağ önizleme) ── CampaignsTab composer'ı ile aynı layout
  if (composing) {
    return (
      <div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.name')}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('automations.namePlaceholder')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.triggerLabel')}</label>
              <WizardSelect value={trig} onChange={setTrig} options={trigOptions} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.subject')}</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.content')}</label>
              <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={12} placeholder={t('automations.contentPlaceholder')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              <p className="text-xs text-gray-400 mt-1">{t('automations.contentHint')}</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 active:scale-[0.97] transition-all">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} {t('automations.save')}
              </button>
            </div>
          </div>
          <div className="lg:sticky lg:top-4 self-start">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden animate-card-enter">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{subject || '—'}</p>
              </div>
              <iframe
                title="automation-preview"
                sandbox=""
                className="w-full min-h-[320px] border-0 block bg-white"
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;padding:20px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6;font-size:14px">${
                  html.trim() || `<p style="color:#d1d5db">${t('automations.previewEmpty')}</p>`
                }</body></html>`}
              />
            </div>
            <div className="mt-3 flex flex-col items-end gap-2">
              <button
                onClick={() => setBackOpen(v => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span>{t('automations.back')}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${backOpen ? 'rotate-180' : ''}`} />
              </button>
              {backOpen && (
                <button
                  onClick={() => setComposing(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> {t('automations.back')}
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
        <p className="text-sm text-gray-600">{items.length} {t('automations.count')}</p>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 active:scale-[0.97] transition-all">
          <Plus className="w-4 h-4" /> {t('automations.new')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4"><Workflow className="w-6 h-6 text-gray-300" /></div>
          <p className="text-gray-700 font-medium">{t('automations.empty')}</p>
          <p className="text-sm text-gray-500 mt-1">{t('automations.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a, i) => (
            <div
              key={a.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-4 hover:shadow-md transition-all duration-300 animate-card-enter"
              style={{ ['--card-index' as string]: Math.min(i, 10) }}
            >
              <button onClick={() => openEdit(a)} className="min-w-0 text-left">
                <h3 className="text-base font-semibold text-gray-900 truncate">{a.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5 truncate">{triggerSummary(a.trigger)} · {a.subject || '—'}</p>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleEnabled(a)}
                  className={`text-xs font-medium rounded-full px-2.5 py-1 transition ${a.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {a.enabled ? t('automations.enabledOn') : t('automations.enabledOff')}
                </button>
                <button onClick={() => handleDelete(a.id)} className="p-2 text-gray-300 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
