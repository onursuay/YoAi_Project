'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Loader2, Trash2, ArrowLeft, Zap, Workflow, ShieldCheck, AlertCircle } from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import { STAGES } from '@/components/crm/stageMeta'

type Trigger = { type: 'crm_stage_enter'; stage: string } | { type: 'contact_added' }

interface StepDraft {
  step_order: number
  subject: string
  html: string
  delay_days: number
  condition: { type: 'always' | 'if_opened' | 'if_not_opened' | 'if_clicked' }
}

interface AutomationItem {
  id: string
  name: string
  trigger: Trigger | Record<string, unknown>
  subject: string
  html: string
  enabled: boolean
  createdAt: string
  steps?: StepDraft[]
}

// Trigger ↔ WizardSelect value kodlaması ('contact' | 'stage:giris' ...)
function encodeTrigger(t: Trigger): string {
  return t.type === 'crm_stage_enter' ? `stage:${t.stage}` : 'contact'
}
function decodeTrigger(v: string): Trigger {
  return v.startsWith('stage:') ? { type: 'crm_stage_enter', stage: v.slice(6) } : { type: 'contact_added' }
}

export default function AutomationsTab({ flash, onManageSending }: { flash: (k: 'ok' | 'err', m: string, ms?: number) => void; onManageSending: () => void }) {
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
  const [accountReady, setAccountReady] = useState<boolean | null>(null)

  // multi-step state
  const [steps, setSteps] = useState<StepDraft[]>([{ step_order: 0, subject: '', html: '', delay_days: 0, condition: { type: 'always' } }])
  const [activeStep, setActiveStep] = useState(0)

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
    ...STAGES.map((s) => ({ value: `stage:${s}`, label: t('automations.triggerStageLabel', { stage: tc(`stages.${s}`) }) })),
    { value: 'contact', label: t('automations.triggerContact') },
  ], [t, tc])

  const checkAccount = () => {
    setAccountReady(null)
    fetch('/api/email/sending-accounts').then(r => r.json()).then(d => {
      setAccountReady((d.accounts ?? []).some((a: { status: string }) => a.status === 'active'))
    }).catch(() => setAccountReady(false))
  }

  const openNew = () => {
    setEditId(null); setName(''); setTrig('stage:uygun'); setSubject(''); setHtml('')
    setSteps([{ step_order: 0, subject: '', html: '', delay_days: 0, condition: { type: 'always' } }])
    setActiveStep(0)
    setComposing(true)
    checkAccount()
  }
  const openEdit = (a: AutomationItem) => {
    setEditId(a.id); setName(a.name)
    setTrig(encodeTrigger(a.trigger as Trigger)); setSubject(a.subject); setHtml(a.html)
    const existingSteps = (a.steps && a.steps.length > 0)
      ? a.steps.map((s: StepDraft) => ({
          step_order: s.step_order, subject: s.subject, html: s.html, delay_days: s.delay_days,
          condition: (s.condition as { type: 'always'|'if_opened'|'if_not_opened'|'if_clicked' }) ?? { type: 'always' },
        }))
      : [{ step_order: 0, subject: a.subject || '', html: a.html || '', delay_days: 0, condition: { type: 'always' as const } }]
    setSteps(existingSteps)
    setActiveStep(0)
    setComposing(true)
    checkAccount()
  }

  const handleSave = useCallback(async () => {
    if (!steps[0]?.subject.trim() || !steps[0]?.html.trim()) { flash('err', t('automations.needContent')); return }
    setSaving(true)
    try {
      const payload = {
        name: name || t('automations.namePlaceholder'),
        trigger: decodeTrigger(trig),
        subject: steps[0]?.subject ?? '',
        html: steps[0]?.html ?? '',
        enabled: true,
        steps: steps.map((s, i) => ({ step_order: i, subject: s.subject, html: s.html, delay_days: s.delay_days, condition: s.condition })),
      }
      const url = editId ? `/api/email/automations/${editId}` : '/api/email/automations'
      const method = editId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json()
      if (d.ok) { flash('ok', t('automations.saved')); setComposing(false); load() }
      else flash('err', t('contacts.error'))
    } finally { setSaving(false) }
  }, [editId, name, trig, steps, flash, t, load])

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
        {accountReady === false ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-3 mb-6">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{t('sending.noAccountTitle')}</p>
                <p className="text-sm text-gray-600 mt-0.5">{t('sending.noAccountDesc')}</p>
              </div>
            </div>
            <button onClick={onManageSending} className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition">
              {t('sending.addAccount')}
            </button>
          </div>
        ) : (
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
            <button onClick={onManageSending} className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition">
              {t('sending.manage')}
            </button>
          </div>
        )}
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

            {/* ── Adım sekmeleri ── */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('automations.steps.label')}</label>
              <div className="flex items-center gap-1 mb-4 flex-wrap">
                {steps.map((s, i) => {
                  const condBadge =
                    i === 0 ? null
                    : s.condition.type === 'if_opened' ? ' ✓'
                    : s.condition.type === 'if_not_opened' ? ' ✗'
                    : s.condition.type === 'if_clicked' ? ' ↗'
                    : null

                  return (
                    <button
                      key={i}
                      onClick={() => setActiveStep(i)}
                      className={`inline-flex items-center gap-0.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        activeStep === i ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t('automations.steps.tab', { n: i + 1 })}
                      {condBadge && (
                        <span className={`text-[10px] font-bold ${activeStep === i ? 'text-white/80' : 'text-gray-400'}`}>
                          {condBadge}
                        </span>
                      )}
                    </button>
                  )
                })}
                {steps.length < 5 && (
                  <button
                    onClick={() => {
                      setSteps((prev) => [
                        ...prev,
                        { step_order: prev.length, subject: '', html: '', delay_days: 1, condition: { type: 'always' } },
                      ])
                      setActiveStep(steps.length)
                    }}
                    className="px-3 py-1.5 rounded-lg text-sm text-primary border border-primary/30 hover:bg-primary/5 transition"
                  >
                    {t('automations.steps.add')}
                  </button>
                )}
              </div>

              {steps[activeStep] && (
                <div className="space-y-4">
                  {activeStep === 0 ? (
                    <p className="text-xs text-gray-500">{t('automations.steps.delayFirst')}</p>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t('automations.steps.condition.label')}
                        </label>
                        <WizardSelect
                          value={steps[activeStep].condition.type}
                          onChange={(v) =>
                            setSteps((prev) =>
                              prev.map((s, i) =>
                                i === activeStep
                                  ? { ...s, condition: { type: v as 'always' | 'if_opened' | 'if_not_opened' | 'if_clicked' } }
                                  : s
                              )
                            )
                          }
                          options={[
                            { value: 'always', label: t('automations.steps.condition.always') },
                            { value: 'if_opened', label: t('automations.steps.condition.if_opened') },
                            { value: 'if_not_opened', label: t('automations.steps.condition.if_not_opened') },
                            { value: 'if_clicked', label: t('automations.steps.condition.if_clicked') },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t('automations.steps.delayLabel')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={steps[activeStep].delay_days}
                          onChange={(e) => {
                            const v = Math.max(1, parseInt(e.target.value) || 1)
                            setSteps((prev) => prev.map((s, i) => i === activeStep ? { ...s, delay_days: v } : s))
                          }}
                          className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.subject')}</label>
                    <input
                      value={steps[activeStep].subject}
                      onChange={(e) => setSteps((prev) => prev.map((s, i) => i === activeStep ? { ...s, subject: e.target.value } : s))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.content')}</label>
                    <textarea
                      value={steps[activeStep].html}
                      onChange={(e) => setSteps((prev) => prev.map((s, i) => i === activeStep ? { ...s, html: e.target.value } : s))}
                      rows={10}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">{t('automations.contentHint')}</p>
                  </div>

                  {steps.length > 1 && (
                    <button
                      onClick={() => {
                        setSteps((prev) => prev.filter((_, i) => i !== activeStep).map((s, i) => ({ ...s, step_order: i })))
                        setActiveStep(Math.max(0, activeStep - 1))
                      }}
                      className="text-xs text-red-500 hover:text-red-700 transition"
                    >
                      {t('automations.steps.remove')}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={handleSave}
                disabled={saving || accountReady === false}
                title={accountReady === false ? t('sending.noAccountSendHint') : undefined}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} {t('automations.save')}
              </button>
            </div>
          </div>
          <div className="lg:sticky lg:top-4 self-start">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden animate-card-enter">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{steps[activeStep]?.subject || '—'}</p>
              </div>
              <iframe
                title="automation-preview"
                sandbox=""
                className="w-full min-h-[320px] border-0 block bg-white"
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;padding:20px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6;font-size:14px">${
                  (steps[activeStep]?.html ?? '').trim() || `<p style="color:#d1d5db">${t('automations.previewEmpty')}</p>`
                }</body></html>`}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setComposing(false)}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 active:scale-[0.97] transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> {t('automations.back')}
              </button>
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
