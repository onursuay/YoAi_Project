'use client'

/* ──────────────────────────────────────────────────────────
   YoAlgoritma — One-Click Approve Dialog

   Proposal alır, /api/yoai/one-click-approve çağırır.
   - Otomatik seçim yeterliyse → direkt yayına hazır taslak kurar
   - NEEDS_INPUT dönerse → eksik alanları sorar (page/pixel/form),
     kullanıcı seçince yeniden çağırır
   - Sonuç başarılıysa campaign/adset/ad ID'lerini gösterir
   ────────────────────────────────────────────────────────── */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import type { FullAdProposal } from '@/lib/yoai/adCreator'

interface Props {
  proposal: FullAdProposal
  onClose: () => void
  /** Faz 0C: yoai_pending_approvals row id — publish başarılı olursa published olarak işaretlenir */
  approvalId?: string | null
  /** Faz 0C: publish başarılı olduğunda parent'ı bilgilendir (UI state senkronizasyonu) */
  onPublished?: (approvalId: string | null) => void
}

type Phase = 'idle' | 'running' | 'needs_input' | 'success' | 'error'

interface NeedsInput {
  pages?: Array<{ id: string; name: string }>
  pixels?: Array<{ id: string; name: string }>
  leadForms?: Array<{ id: string; name: string; page_id: string }>
  websiteUrl?: boolean
}

interface SuccessResult {
  campaignId?: string
  adsetId?: string
  adId?: string
}

function humanizeErrorMsg(
  msg: string,
  t: (key: string) => string,
): string {
  const lower = msg.toLowerCase()
  if (
    lower.includes('yoai_direct_publish_enabled') ||
    lower.includes('direct_publish') ||
    lower.includes('feature flag') ||
    lower.includes('publish_enabled')
  ) {
    return t('publishDisabled')
  }
  return msg.replace(/\bPAUSED\b/g, t('draftWord'))
}

export default function OneClickApproveDialog({ proposal, onClose, approvalId, onPublished }: Props) {
  const t = useTranslations('dashboard.yoai.oneClickApprove')
  const tc = useTranslations('common')
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<string>('')
  const [needs, setNeeds] = useState<NeedsInput>({})
  const [choices, setChoices] = useState<{
    pageId?: string
    pixelId?: string
    leadFormId?: string
    conversionEvent?: string
  }>({})
  const [result, setResult] = useState<SuccessResult | null>(null)
  const [confirmAcknowledged, setConfirmAcknowledged] = useState<boolean>(false)

  async function submit(overrideChoices?: typeof choices) {
    setPhase('running')
    setMessage(t('preparingDraft'))
    try {
      const res = await fetch('/api/yoai/one-click-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal,
          choices: overrideChoices || choices,
          approvalId: approvalId ?? undefined,
        }),
      })
      const json = await res.json()

      if (json.ok) {
        setResult(json.created || {})
        setMessage(json.message || t('campaignReady'))
        setPhase('success')
        if (onPublished) onPublished(approvalId ?? null)
        return
      }

      if (json.code === 'NEEDS_INPUT') {
        setNeeds((json.needs || {}) as NeedsInput)
        setMessage(json.message || t('needsSelection'))
        setPhase('needs_input')
        return
      }

      const rawMsg = json.message || json.error || t('genericError')
      setMessage(humanizeErrorMsg(rawMsg, t))
      setPhase('error')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('connectionError'))
      setPhase('error')
    }
  }

  const canSubmitChoices = (() => {
    if (needs.pages && !choices.pageId) return false
    if (needs.pixels && !choices.pixelId) return false
    if (needs.leadForms && !choices.leadFormId) return false
    return true
  })()

  const start = () => submit()
  const retryWithChoices = () => submit(choices)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mb-12 animate-popup-scale">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
              <p className="text-xs text-gray-400">
                {t('subtitle')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {phase === 'idle' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('platform')}
                  </p>
                  <span className="text-xs font-medium text-gray-900">Meta</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    {t('campaignName')}
                  </p>
                  <p className="text-sm font-medium text-gray-900 leading-snug">
                    {proposal.campaignName || '—'}
                  </p>
                </div>
                {proposal.objectiveLabel && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      {t('objective')}
                    </p>
                    <p className="text-sm text-gray-700">{proposal.objectiveLabel}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    {t('dailyBudget')}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    ₺{proposal.dailyBudget ?? '—'}
                  </p>
                </div>
                {(proposal.headline || proposal.callToAction) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      {t('adSummary')}
                    </p>
                    {proposal.headline && (
                      <p className="text-sm text-gray-700 leading-snug">{proposal.headline}</p>
                    )}
                    {proposal.callToAction && (
                      <p className="text-xs text-gray-500 mt-1">CTA: {proposal.callToAction}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-xs text-primary leading-relaxed">
                <p className="font-semibold mb-1">{t('whatHappens')}</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>{t('whatHappens1')}</li>
                  <li>
                    {t.rich('whatHappens2', { strong: (chunks) => <strong>{chunks}</strong> })}
                  </li>
                  <li>
                    {t.rich('whatHappens3', { strong: (chunks) => <strong>{chunks}</strong> })}
                  </li>
                </ul>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-700 space-y-1.5">
                <p className="font-semibold text-gray-800 mb-1">{t('safetyChecksTitle')}</p>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{t('safetyCheck1')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{t('safetyCheck2')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{t('safetyCheck3')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{t('safetyCheck4')}</span>
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmAcknowledged}
                  onChange={(e) => setConfirmAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary"
                />
                <span className="text-xs text-gray-700 leading-relaxed">
                  {t.rich('acknowledge', { strong: (chunks) => <strong>{chunks}</strong> })}
                </span>
              </label>

              <button
                onClick={start}
                disabled={!confirmAcknowledged}
                className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
                  confirmAcknowledged
                    ? 'bg-primary text-white hover:bg-primary/90'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {t('approveAndCreate')}
              </button>
            </div>
          )}

          {phase === 'running' && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-sm text-gray-600 max-w-sm">{message}</p>
              <p className="text-[11px] text-gray-400 mt-2">
                {t('runningHint')}
              </p>
            </div>
          )}

          {phase === 'needs_input' && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-700">
                {message}
              </div>

              {needs.pages && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">{t('facebookPage')}</p>
                  <div className="space-y-2">
                    {needs.pages.map((p) => (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${
                          choices.pageId === p.id
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="pageId"
                          checked={choices.pageId === p.id}
                          onChange={() => setChoices((c) => ({ ...c, pageId: p.id }))}
                        />
                        <span>{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {needs.pixels && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Meta Pixel</p>
                  <select
                    value={choices.pixelId || ''}
                    onChange={(e) => setChoices((c) => ({ ...c, pixelId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">{t('selectPixel')}</option>
                    {needs.pixels.map((px) => (
                      <option key={px.id} value={px.id}>
                        {px.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {needs.leadForms && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Instant Form</p>
                  <select
                    value={choices.leadFormId || ''}
                    onChange={(e) => setChoices((c) => ({ ...c, leadFormId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">{t('selectForm')}</option>
                    {needs.leadForms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {tc('cancel')}
                </button>
                <button
                  onClick={retryWithChoices}
                  disabled={!canSubmitChoices}
                  className={`px-6 py-2.5 rounded-xl text-sm font-medium ${
                    canSubmitChoices
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {tc('continue')}
                </button>
              </div>
            </div>
          )}

          {phase === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('draftReady')}</h3>
              <p className="text-sm text-gray-600 max-w-sm mb-4">{message}</p>
              {result && (
                <div className="bg-gray-50 rounded-xl p-3 w-full text-xs text-gray-600 space-y-1">
                  {result.campaignId && (
                    <p>
                      {t('campaignLabel')}: <code>{result.campaignId}</code>
                    </p>
                  )}
                  {result.adsetId && (
                    <p>
                      {t('adsetLabel')}: <code>{result.adsetId}</code>
                    </p>
                  )}
                  {result.adId && (
                    <p>
                      {t('adLabel')}: <code>{result.adId}</code>
                    </p>
                  )}
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-3">
                {t('draftReadyFooter')}
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200"
              >
                {tc('close')}
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="w-14 h-14 text-gray-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('errorTitle')}</h3>
              <p className="text-sm text-gray-600 max-w-sm">{message}</p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setPhase('idle')}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {tc('retry')}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200"
                >
                  {tc('close')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
