'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { X, Loader2, Sparkles, ChevronRight, ChevronLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import AdPreviewCard from './AdPreviewCard'
import MetaPreflightPanel, { type PreflightConfirmPayload } from './MetaPreflightPanel'
import MetaCreativePanel, { type MetaCreativePayload } from './MetaCreativePanel'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import type { Platform } from '@/lib/yoai/analysisTypes'
import { translateEnum } from '@/lib/yoai/translations'

interface Props {
  onClose: () => void
  connectedPlatforms: Platform[]
  initialProposal?: FullAdProposal | null
  /** Yayın denemesi tamamlanınca çağrılır (per-ad improvement kartını "Yayında" yapmak için). */
  onPublished?: (success: boolean) => void
}

type Step = 'platform' | 'generating' | 'preview' | 'preflight' | 'creative' | 'confirm' | 'publishing' | 'done'

// Normalize unsupported Meta objective+destination combos to supported equivalents.
function normalizeMetaDestination(objective: string, destination: string): string {
  if (objective === 'OUTCOME_ENGAGEMENT' && (destination === 'ON_AD' || destination === 'WHATSAPP' || destination === 'MESSENGER' || destination === 'INSTAGRAM_DIRECT')) {
    return 'ON_PAGE'
  }
  return destination
}

export default function AdCreationWizard({ onClose, connectedPlatforms, initialProposal, onPublished }: Props) {
  const t = useTranslations('dashboard.yoai.adWizard')
  const locale: 'tr' | 'en' = useLocale() === 'en' ? 'en' : 'tr'
  const [step, setStep] = useState<Step>(initialProposal ? 'preview' : 'platform')
  const [platform, setPlatform] = useState<Platform | null>(initialProposal?.platform as Platform || null)
  const [proposals, setProposals] = useState<FullAdProposal[]>(initialProposal ? [initialProposal] : [])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [competitorInfo, setCompetitorInfo] = useState<{ competitorCount: number; summary: string } | null>(null)
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [preflightPayload, setPreflightPayload] = useState<PreflightConfirmPayload | null>(null)

  const callGenerateAd = async (p: Platform, forceGenerate: boolean) => {
    const res = await fetch('/api/yoai/generate-ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: p, forceGenerate }),
    })
    return res.json()
  }

  // Route bağlı tüm platformların önerilerini dönebilir; seçilen platformu süz.
  const pickPlatformProposals = (json: any, p: Platform): FullAdProposal[] => {
    if (!json?.ok || !Array.isArray(json.data?.proposals)) return []
    return (json.data.proposals as FullAdProposal[]).filter((pr) => pr.platform === p)
  }

  const handleSelectPlatform = async (p: Platform) => {
    setPlatform(p)
    setStep('generating')
    setError(null)

    try {
      // 1) Önce kayıtlı (hızlı) sonucu dene
      let json = await callGenerateAd(p, false)
      let list = pickPlatformProposals(json, p)
      // 2) Kayıtlı veri yoksa (haftalık tarama henüz çalışmamış) → canlı üretim tetikle
      if (list.length === 0) {
        json = await callGenerateAd(p, true)
        list = pickPlatformProposals(json, p)
      }
      if (list.length > 0) {
        setProposals(list)
        setCompetitorInfo(json.data?.competitorAnalysis || null)
        setStep('preview')
      } else {
        setError(json.data?.error || json.error || t('errorGenerate'))
        setStep('platform')
      }
    } catch {
      setError(t('errorConnection'))
      setStep('platform')
    }
  }

  const handleContinueFromPreview = () => {
    const selected = proposals[selectedIndex]
    if (!selected) return
    if (selected.platform === 'Meta') {
      setStep('preflight')
    } else {
      setStep('confirm')
    }
  }

  const handlePreflightConfirm = (payload: PreflightConfirmPayload) => {
    setPreflightPayload(payload)
    const selected = proposals[selectedIndex]
    if (!selected) return
    if (selected.platform === 'Meta' && payload.allBlockingResolved) {
      setStep('creative')
    } else {
      handlePublish(payload, null)
    }
  }

  const handlePublish = async (
    pfPayload: PreflightConfirmPayload | null,
    creative: MetaCreativePayload | null,
  ) => {
    const selected = proposals[selectedIndex]
    if (!selected) return
    setStep('publishing')

    try {
      const body: Record<string, unknown> = { proposal: selected }
      if (pfPayload) {
        body.explicitPageId = pfPayload.explicitPageId
        body.pixelId = pfPayload.pixelId
        body.conversionEvent = pfPayload.conversionEvent
        body.websiteUrl = pfPayload.websiteUrl
        body.leadFormId = pfPayload.leadFormId
      }
      if (creative) {
        body.creative = creative
      }

      const res = await fetch('/api/yoai/create-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await res.text()

      let json: any
      try { json = JSON.parse(text) } catch { json = { ok: false, error: t('publishInvalidResponse', { detail: text.slice(0, 200) }) } }

      const rawMsg = (json.message || json.error || t('publishGenericDone')) as string
      const cleanMsg = rawMsg.replace(/\bPAUSED\b/g, t('statusPaused')).replace(/\bENABLED\b/g, t('statusEnabled'))
      setPublishResult({ ok: json.ok, message: cleanMsg })
      setStep('done')
      onPublished?.(!!json.ok)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setPublishResult({ ok: false, message: t('publishConnError', { detail: msg }) })
      setStep('done')
      onPublished?.(false)
    }
  }

  const selected = proposals[selectedIndex]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0f172a] border border-[#1e2d45] rounded-2xl shadow-2xl w-full max-w-3xl mb-12 animate-popup-scale">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d45]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {initialProposal ? t('titleApproval') : t('title')}
              </h2>
              <p className="text-xs text-slate-400">
                {initialProposal ? t('subtitleApproval') : t('subtitle')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">

          {/* ── Platform seçimi ── */}
          {step === 'platform' && (
            <div>
              {error && (
                <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}
              <h3 className="text-sm font-semibold text-white mb-4">{t('selectPlatform')}</h3>
              <div className="grid grid-cols-2 gap-4">
                {connectedPlatforms.includes('Meta') && (
                  <button
                    onClick={() => handleSelectPlatform('Meta')}
                    className="p-6 rounded-2xl border-2 border-[#1e2d45] hover:border-blue-500/60 hover:bg-blue-900/10 transition-all text-left"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-3 p-2.5">
                      <img src="/platform-icons/meta.svg" alt="Meta" width={28} height={28} className="w-full h-full object-contain" />
                    </div>
                    <h4 className="font-semibold text-white mb-1">{t('metaAds')}</h4>
                    <p className="text-xs text-slate-400">{t('metaAdsDesc')}</p>
                  </button>
                )}
                {connectedPlatforms.includes('Google') && (
                  <button
                    onClick={() => handleSelectPlatform('Google')}
                    className="p-6 rounded-2xl border-2 border-[#1e2d45] hover:border-red-500/60 hover:bg-red-900/10 transition-all text-left"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-3 p-2.5">
                      <img src="/platform-icons/google-ads.svg" alt="Google Ads" width={28} height={28} className="w-full h-full object-contain" />
                    </div>
                    <h4 className="font-semibold text-white mb-1">{t('googleAds')}</h4>
                    <p className="text-xs text-slate-400">{t('googleAdsDesc')}</p>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Üretiliyor ── */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">{t('generatingTitle')}</h3>
              <p className="text-sm text-slate-400 text-center max-w-sm">
                {t('generatingDesc')}
              </p>
            </div>
          )}

          {/* ── Önizleme ── */}
          {step === 'preview' && proposals.length > 0 && (
            <div>
              {competitorInfo && (
                <div className="bg-[#1a2540] border border-[#1e2d45] rounded-xl px-4 py-3 mb-5">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('analysisSummary')}</p>
                  <p className="text-xs text-slate-300">
                    {t('competitorAnalyzed', { count: competitorInfo.competitorCount, summary: competitorInfo.summary })}
                  </p>
                </div>
              )}

              <h3 className="text-sm font-semibold text-white mb-4">
                {t('proposalsSelect', { count: proposals.length })}
              </h3>
              <div className="space-y-4">
                {proposals.map((p, i) => (
                  <AdPreviewCard key={p.id} proposal={p} selected={selectedIndex === i} onSelect={() => setSelectedIndex(i)} />
                ))}
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#1e2d45]">
                <button
                  onClick={() => { setStep('platform'); setProposals([]); setError(null) }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-slate-400 text-sm hover:bg-white/5 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />{t('back')}
                </button>
                <button
                  onClick={handleContinueFromPreview}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {t('continue')}<ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Ön Kontrol (Meta) ── */}
          {step === 'preflight' && selected?.platform === 'Meta' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-blue-900/40 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-400">M</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{t('preflightTitle')}</h3>
                  <p className="text-xs text-slate-400">{t('preflightDesc')}</p>
                </div>
              </div>
              <MetaPreflightPanel
                objective={selected.campaignObjective || 'OUTCOME_TRAFFIC'}
                destination={normalizeMetaDestination(
                  selected.campaignObjective || 'OUTCOME_TRAFFIC',
                  selected.destinationType || 'WEBSITE',
                )}
                initialWebsiteUrl={selected.finalUrl || null}
                creativeAvailable={true}
                onBack={() => setStep('preview')}
                onConfirm={handlePreflightConfirm}
              />
            </div>
          )}

          {/* ── Kreatif (Meta) ── */}
          {step === 'creative' && selected?.platform === 'Meta' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-blue-900/40 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-400">M</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{t('creativeTitle')}</h3>
                  <p className="text-xs text-slate-400">{t('creativeDesc')}</p>
                </div>
              </div>
              <MetaCreativePanel
                primaryText={selected.primaryText || selected.headline || ''}
                headline={selected.headline}
                description={selected.description}
                callToAction={selected.callToAction}
                websiteUrl={preflightPayload?.websiteUrl || selected.finalUrl || null}
                imagePrompt={`${selected.headline || ''} ${selected.description || ''}`.trim() || selected.campaignName}
                onBack={() => setStep('preflight')}
                onConfirm={(creative) => handlePublish(preflightPayload, creative)}
              />
            </div>
          )}

          {/* ── Son Onay (Google) ── */}
          {step === 'confirm' && selected && (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-red-900/40 rounded-xl flex items-center justify-center">
                  <span className="text-sm font-bold text-red-400">G</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{t('confirmTitle')}</h3>
                  <p className="text-xs text-slate-400">{t('confirmDesc')}</p>
                </div>
              </div>

              <div className="bg-[#1a2540] border border-[#1e2d45] rounded-xl p-4 space-y-2.5 mb-5">
                {[
                  { label: t('fieldPlatform'), value: selected.platform },
                  { label: t('fieldCampaign'), value: selected.campaignName },
                  { label: t('fieldObjective'), value: selected.objectiveLabel || (selected.campaignObjective ? translateEnum(selected.campaignObjective, locale, selected.platform === 'Google' ? 'google' : 'meta') : undefined) },
                  { label: t('fieldBudget'), value: selected.dailyBudget != null ? t('budgetPerDay', { amount: selected.dailyBudget }) : undefined },
                  { label: t('fieldAdGroup'), value: selected.adsetName },
                  { label: t('fieldHeadline'), value: selected.headlines?.[0] || selected.headline },
                  { label: t('fieldUrl'), value: selected.finalUrl },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="grid grid-cols-3 gap-2">
                    <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide pt-0.5">{f.label}</span>
                    <span className="col-span-2 text-sm text-slate-200 break-all">{f.value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 text-xs text-emerald-300 mb-5 leading-relaxed">
                <p className="font-semibold mb-1">{t('whatHappens')}</p>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-200/80">
                  <li>{t('whatHappens1')}</li>
                  <li>{t('whatHappens2')}</li>
                  <li>{t('whatHappens3')}</li>
                </ul>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1e2d45]">
                <button
                  onClick={() => setStep('preview')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-slate-400 text-sm hover:bg-white/5 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />{t('back')}
                </button>
                <button
                  onClick={() => handlePublish(null, null)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {t('publish')}<ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Yayınlanıyor ── */}
          {step === 'publishing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">{t('publishingTitle')}</h3>
              <p className="text-sm text-slate-400">
                {t('publishingDesc', { platform: platform ?? '' })}
              </p>
            </div>
          )}

          {/* ── Sonuç ── */}
          {step === 'done' && publishResult && (
            <div className="flex flex-col items-center justify-center py-12">
              {publishResult.ok ? (
                <>
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-9 h-9 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{t('doneSuccess')}</h3>
                  <p className="text-sm text-slate-400 text-center max-w-sm">{publishResult.message}</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="w-9 h-9 text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{t('doneFailed')}</h3>
                  <p className="text-sm text-slate-400 text-center max-w-sm">{publishResult.message}</p>
                </>
              )}
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-sm font-medium transition-colors"
              >
                {t('close')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
