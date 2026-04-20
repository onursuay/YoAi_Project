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

export default function OneClickApproveDialog({ proposal, onClose }: Props) {
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

  async function submit(overrideChoices?: typeof choices) {
    setPhase('running')
    setMessage('Taslak hazırlanıyor — görsel üretiliyor, Meta\'ya yükleniyor, kampanya kuruluyor…')
    try {
      const res = await fetch('/api/yoai/one-click-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal,
          choices: overrideChoices || choices,
        }),
      })
      const json = await res.json()

      if (json.ok) {
        setResult(json.created || {})
        setMessage(json.message || 'Kampanya hazır.')
        setPhase('success')
        return
      }

      if (json.code === 'NEEDS_INPUT') {
        setNeeds((json.needs || {}) as NeedsInput)
        setMessage(json.message || 'Bazı seçimler yapmanız gerekiyor.')
        setPhase('needs_input')
        return
      }

      setMessage(json.message || json.error || 'Hata.')
      setPhase('error')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Bağlantı hatası.')
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
              <h2 className="text-lg font-semibold text-gray-900">Tek Tıkla Onayla</h2>
              <p className="text-xs text-gray-400">
                YoAlgoritma hazır taslağı oluşturur — onay sende
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
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Kampanya
                </p>
                <p className="text-sm font-medium text-gray-900">{proposal.campaignName}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {proposal.objectiveLabel} · Günlük bütçe: {proposal.dailyBudget} TL
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                Onay verdiğinde kampanya + reklam seti + reklam (görsel dahil) tümü{' '}
                <strong>PAUSED</strong> olarak oluşturulur. Hiçbir şey otomatik yayınlanmaz.
              </div>
              <button
                onClick={start}
                className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90"
              >
                Taslağı Oluşturmaya Başla
              </button>
            </div>
          )}

          {phase === 'running' && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-sm text-gray-600 max-w-sm">{message}</p>
              <p className="text-[11px] text-gray-400 mt-2">
                Bu işlem 20-40 saniye sürebilir (görsel üretimi dahil).
              </p>
            </div>
          )}

          {phase === 'needs_input' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                {message}
              </div>

              {needs.pages && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Facebook Sayfası</p>
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
                    <option value="">— Pixel seçin —</option>
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
                    <option value="">— Form seçin —</option>
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
                  İptal
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
                  Devam Et
                </button>
              </div>
            </div>
          )}

          {phase === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Taslak Hazır</h3>
              <p className="text-sm text-gray-600 max-w-sm mb-4">{message}</p>
              {result && (
                <div className="bg-gray-50 rounded-xl p-3 w-full text-xs text-gray-600 space-y-1">
                  {result.campaignId && (
                    <p>
                      Kampanya: <code>{result.campaignId}</code>
                    </p>
                  )}
                  {result.adsetId && (
                    <p>
                      Reklam Seti: <code>{result.adsetId}</code>
                    </p>
                  )}
                  {result.adId && (
                    <p>
                      Reklam: <code>{result.adId}</code>
                    </p>
                  )}
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-3">
                Tümü PAUSED. Yayına almak için Meta Ads Manager'dan aktif et.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200"
              >
                Kapat
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="w-14 h-14 text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Hata</h3>
              <p className="text-sm text-gray-600 max-w-sm">{message}</p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setPhase('idle')}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Tekrar dene
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200"
                >
                  Kapat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
