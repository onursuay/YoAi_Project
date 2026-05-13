'use client'

import type { ReactNode } from 'react'
import { Globe } from 'lucide-react'
import type { FullAdProposal } from '@/lib/yoai/adCreator'

// Kampanya amacı / objective enum'larını kullanıcıya Türkçe humanized göster.
// Teknik enum (OUTCOME_ENGAGEMENT, MAXIMIZE_CONVERSIONS, vb.) kullanıcıya gösterilmez.
const CAMPAIGN_TYPE_HUMAN_LABEL: Record<string, string> = {
  // Meta objectives
  OUTCOME_TRAFFIC: 'Trafik',
  OUTCOME_ENGAGEMENT: 'Etkileşim',
  OUTCOME_LEADS: 'Potansiyel Müşteri',
  OUTCOME_SALES: 'Satış',
  OUTCOME_AWARENESS: 'Bilinirlik',
  OUTCOME_APP_PROMOTION: 'Uygulama Tanıtımı',
  POST_ENGAGEMENT: 'Gönderi Etkileşimi',
  TRAFFIC: 'Trafik',
  CONVERSIONS: 'Dönüşüm',
  ENGAGEMENT: 'Etkileşim',
  LEAD_GENERATION: 'Potansiyel Müşteri',
  VIDEO_VIEWS: 'Video İzlenmesi',
  BRAND_AWARENESS: 'Marka Bilinirliği',
  REACH: 'Erişim',
  MESSAGES: 'Mesajlaşma',
  CATALOG_SALES: 'Katalog Satışları',
  MAXIMIZE_CONVERSIONS: 'Dönüşüm Maksimizasyonu',
  SEND_MESSAGE: 'Mesaj Gönder',
  // Google campaign types
  SEARCH: 'Arama',
  PERFORMANCE_MAX: 'Performance Max',
  DISPLAY: 'Display',
  VIDEO: 'Video',
  SHOPPING: 'Shopping',
  DISCOVERY: 'Discovery',
  DEMAND_GEN: 'Demand Gen',
  LOCAL: 'Local',
  APP: 'App',
}

function humanizeCampaignType(value: string | undefined | null): string {
  if (!value) return '—'
  const upper = value.toUpperCase()
  if (CAMPAIGN_TYPE_HUMAN_LABEL[upper]) return CAMPAIGN_TYPE_HUMAN_LABEL[upper]
  // Bilinmeyen enum'u underscore'dan ayırıp Title Case yap
  return upper
    .replace(/^OUTCOME_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Platform logo: küçük inline SVG marker — hem Meta hem Google için ayrı.
function PlatformLogo({ platform }: { platform: string }) {
  if (platform === 'Meta') {
    return (
      <span data-testid="platform-logo-meta" aria-label="Meta" title="Meta"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#1877F2]">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="white" aria-hidden="true">
          <path d="M22.675 0H1.325C.593 0 0 .593 0 1.326v21.348C0 23.407.593 24 1.325 24h11.495v-9.294H9.692V11.01h3.128V8.41c0-3.099 1.893-4.785 4.659-4.785 1.325 0 2.464.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.31h3.587l-.467 3.696h-3.12V24h6.116c.732 0 1.325-.593 1.325-1.326V1.326C24 .593 23.407 0 22.675 0z" />
        </svg>
      </span>
    )
  }
  if (platform === 'Google') {
    return (
      <span data-testid="platform-logo-google" aria-label="Google" title="Google"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-300">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
      </span>
    )
  }
  return null
}

interface Props {
  proposal: FullAdProposal
  selected: boolean
  onSelect: () => void
  diagnostic?: {
    label: string
    summary: string
    action?: string
    isHealthy: boolean
  }
  actionFooter?: ReactNode
}

const CTA_LABELS: Record<string, string> = {
  SEND_MESSAGE: 'Mesaj Gönder',
  LEARN_MORE: 'Daha Fazla Bilgi Al',
  SHOP_NOW: 'Hemen Alışveriş Yap',
  SIGN_UP: 'Kayıt Ol',
  SUBSCRIBE: 'Abone Ol',
  BOOK_TRAVEL: 'Seyahat Rezervasyonu Yap',
  WATCH_MORE: 'Daha Fazla İzle',
  APPLY_NOW: 'Hemen Başvur',
  CONTACT_US: 'Bize Ulaşın',
  GET_QUOTE: 'Teklif Al',
  DOWNLOAD: 'İndir',
  INSTALL_MOBILE_APP: 'Uygulamayı İndir',
  OPEN_LINK: 'Bağlantıyı Aç',
  ORDER_NOW: 'Hemen Sipariş Ver',
  GET_OFFER: 'Teklifi Gör',
  LISTEN_NOW: 'Hemen Dinle',
  GET_DIRECTIONS: 'Yol Tarifi Al',
  CALL_NOW: 'Hemen Ara',
  SAVE: 'Kaydet',
  BUY_NOW: 'Hemen Satın Al',
  FIND_A_GROUP: 'Grup Bul',
  BUY_TICKETS: 'Bilet Al',
  SEE_MENU: 'Menüyü Gör',
  PLAY_GAME: 'Oyunu Oyna',
  GET_SHOWTIMES: 'Seans Saatlerini Gör',
  REQUEST_TIME: 'Randevu Al',
  SEE_ALL_OFFERS: 'Tüm Teklifleri Gör',
  FOLLOW_PAGE: 'Sayfayı Takip Et',
}

function humanizeCta(cta: string | undefined | null): string {
  if (!cta) return 'Daha Fazla'
  return CTA_LABELS[cta.toUpperCase()] ?? cta.replace(/_/g, ' ')
}

const OPTIMIZATION_GOAL_LABEL: Record<string, string> = {
  LINK_CLICKS: 'Bağlantı Tıklamaları',
  LANDING_PAGE_VIEWS: 'Landing Page Görüntüleme',
  REACH: 'Erişim',
  IMPRESSIONS: 'Gösterim',
  POST_ENGAGEMENT: 'Gönderi Etkileşimi',
  PAGE_LIKES: 'Sayfa Beğenileri',
  LEAD_GENERATION: 'Potansiyel Müşteri (Form)',
  OFFSITE_CONVERSIONS: 'Web Sitesi Dönüşümleri',
  VALUE: 'Dönüşüm Değeri',
  THRUPLAY: 'Video İzleme (ThruPlay)',
  REPLIES: 'Mesaj Yanıtı',
  CONVERSATIONS: 'Sohbet Başlatma',
  QUALITY_CALL: 'Kaliteli Arama',
  MAXIMIZE_CONVERSIONS: 'Dönüşüm Maksimizasyonu',
  MAXIMIZE_CLICKS: 'Tıklama Maksimizasyonu',
  TARGET_SPEND: 'Hedef Harcama',
  TARGET_CPA: 'Hedef CPA',
  TARGET_ROAS: 'Hedef ROAS',
}

const DESTINATION_LABEL: Record<string, string> = {
  WEBSITE: 'Web Sitesi',
  APP: 'Uygulama',
  ON_AD: 'Reklam İçi Form',
  ON_PAGE: 'Sayfa / Gönderi',
  MESSENGER: 'Messenger',
  INSTAGRAM_DIRECT: 'Instagram Direct',
  WHATSAPP: 'WhatsApp',
  CALL: 'Telefon Araması',
}

const BIDDING_STRATEGY_LABEL: Record<string, string> = {
  MAXIMIZE_CONVERSIONS: 'Dönüşümleri Artır',
  MAXIMIZE_CLICKS: 'Tıklamaları Artır',
  TARGET_CPA: 'Hedef CPA',
  TARGET_ROAS: 'Hedef ROAS',
  TARGET_IMPRESSION_SHARE: 'Hedef Gösterim Payı',
  MANUAL_CPC: 'Manuel CPC',
  MANUAL_CPM: 'Manuel CPM',
  ENHANCED_CPC: 'Gelişmiş CPC',
  MAXIMIZE_CONVERSION_VALUE: 'Dönüşüm Değerini Artır',
}

function fmtOptGoal(v?: string): string {
  if (!v) return '—'
  return OPTIMIZATION_GOAL_LABEL[v] || v.replace(/_/g, ' ')
}
function fmtDest(v?: string): string {
  if (!v) return '—'
  return DESTINATION_LABEL[v] || v.replace(/_/g, ' ')
}
function fmtBidding(v?: string): string {
  if (!v) return '—'
  return BIDDING_STRATEGY_LABEL[v] || v.replace(/_/g, ' ')
}

export default function AdPreviewCard({ proposal, selected, onSelect, diagnostic, actionFooter }: Props) {
  const isGoogle = proposal.platform === 'Google'

  return (
    <div
      className={`relative text-left w-full rounded-2xl overflow-hidden transition-all duration-200 border bg-[#0f172a] flex flex-col h-full ${
        selected
          ? 'border-emerald-400/50 shadow-lg shadow-emerald-900/30'
          : 'border-[#23314d] shadow-md hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-900/20'
      }`}
    >
      {/* Subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.07),transparent_60%)]" />

      {/* Clickable main content */}
      <div onClick={onSelect} className="flex flex-col flex-1 cursor-pointer">

        {/* TOP: Platform logo + new badge + confidence */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <PlatformLogo platform={proposal.platform} />
            {proposal.isNewObjective && (
              <span data-testid="new-suggestion-badge" className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                Yeni Öneri
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-300">%{proposal.confidence} güven</span>
        </div>

        {/* Campaign structure */}
        <div className="px-4 pb-3 space-y-0.5 text-[11px]">
          <div className="flex justify-between" data-testid="campaign-type-row">
            <span className="text-slate-400">Kampanya Türü</span>
            <span className="text-white font-medium truncate max-w-[60%] text-right">
              {proposal.objectiveLabel || humanizeCampaignType(proposal.campaignObjective)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Kampanya</span>
            <span className="text-white font-medium truncate max-w-[60%] text-right">{proposal.campaignName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{isGoogle ? 'Reklam Grubu' : 'Reklam Seti'}</span>
            <span className="text-white font-medium truncate max-w-[60%] text-right">{proposal.adsetName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Bütçe</span>
            <span className="text-white font-medium">₺{proposal.dailyBudget}/gün</span>
          </div>
          {proposal.targetingDescription && (
            <div className="flex justify-between">
              <span className="text-slate-400">Hedefleme</span>
              <span className="text-slate-200 truncate max-w-[60%] text-right">{proposal.targetingDescription}</span>
            </div>
          )}
          {proposal.optimizationGoal && (
            <div className="flex justify-between">
              <span className="text-slate-400">Opt. Hedef</span>
              <span className="text-slate-200 truncate max-w-[60%] text-right" title={proposal.optimizationGoal}>
                {fmtOptGoal(proposal.optimizationGoal)}
              </span>
            </div>
          )}
          {proposal.biddingStrategy && (
            <div className="flex justify-between">
              <span className="text-slate-400">Teklif</span>
              <span className="text-slate-200">{fmtBidding(proposal.biddingStrategy)}</span>
            </div>
          )}
          {proposal.destinationType && (
            <div className="flex justify-between">
              <span className="text-slate-400">Dönüşüm</span>
              <span className="text-slate-200 truncate max-w-[60%] text-right" title={proposal.destinationType}>
                {fmtDest(proposal.destinationType)}
              </span>
            </div>
          )}
        </div>

        {/* Ad preview */}
        <div className="px-4 pb-3 flex-1">
          {isGoogle ? (
            <div className="bg-[#151f33] border border-slate-700/60 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-200 bg-slate-700/60 px-1.5 py-0.5 rounded">
                  Reklam
                </span>
                {proposal.finalUrl && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                    <Globe className="w-2.5 h-2.5" />
                    {proposal.finalUrl.replace(/^https?:\/\//, '').split('/')[0]}
                  </span>
                )}
              </div>

              {proposal.headlines && proposal.headlines.length > 0 ? (
                <div>
                  <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider mb-1">Önerilen Başlıklar</p>
                  <div className="flex flex-wrap gap-1">
                    {proposal.headlines.slice(0, 5).map((h, i) => (
                      <span key={i} className="text-[10px] bg-slate-700/50 text-blue-200 px-2 py-0.5 rounded border border-slate-600/40 leading-snug">
                        {h}
                      </span>
                    ))}
                    {proposal.headlines.length > 5 && (
                      <span className="text-[10px] text-slate-400 px-1 py-0.5">+{proposal.headlines.length - 5}</span>
                    )}
                  </div>
                </div>
              ) : proposal.headline ? (
                <p className="text-[13px] font-medium text-blue-200 leading-snug">{proposal.headline}</p>
              ) : null}

              {proposal.descriptions && proposal.descriptions.length > 0 ? (
                <div>
                  <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider mb-1">Açıklamalar</p>
                  <div className="space-y-0.5">
                    {proposal.descriptions.slice(0, 2).map((d, i) => (
                      <p key={i} className="text-[11px] text-slate-300 leading-relaxed">{d}</p>
                    ))}
                  </div>
                </div>
              ) : proposal.description ? (
                <p className="text-[11px] text-slate-300 leading-relaxed">{proposal.description}</p>
              ) : null}

              {proposal.keywords && proposal.keywords.length > 0 && (
                <div className="pt-2 border-t border-slate-700/50">
                  <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider mb-1">Anahtar Kelimeler</p>
                  <div className="flex flex-wrap gap-1">
                    {proposal.keywords.slice(0, 6).map((k, i) => (
                      <span key={i} className="text-[9px] bg-emerald-950/40 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {k}
                      </span>
                    ))}
                    {proposal.keywords.length > 6 && (
                      <span className="text-[9px] text-slate-400">+{proposal.keywords.length - 6}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-slate-700/60 rounded-xl overflow-hidden flex flex-col bg-[#151f33]">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-indigo-300">YO</span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-white">İşletmeniz</p>
                  <p className="text-[8px] text-slate-400">Sponsorlu</p>
                </div>
              </div>
              <div className="px-3 py-2">
                <p className="text-[12px] text-slate-100 leading-relaxed line-clamp-3">{proposal.primaryText}</p>
              </div>
              <div className="h-28 bg-gradient-to-br from-slate-800 to-slate-900">
                <img src="/digital-ads.jpg" alt="" className="w-full h-full object-cover opacity-80 rounded-md" />
              </div>
              <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-white truncate">{proposal.headline}</p>
                  <p className="text-[9px] text-slate-300 truncate">{proposal.description}</p>
                </div>
                <span className="shrink-0 ml-2 px-2 py-0.5 bg-slate-700 text-slate-100 rounded text-[9px] font-medium">
                  {humanizeCta(proposal.callToAction)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Competitor insight */}
        {proposal.competitorInsight && (
          <div className="mx-4 mb-3 bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2">
            <p className="text-[9px] text-slate-400 font-medium mb-0.5">Rakip Karşılaştırma</p>
            <p className="text-[10px] text-slate-200 line-clamp-2">{proposal.competitorInsight}</p>
          </div>
        )}

        {/* AI reasoning */}
        {proposal.reasoning && (
          <div className="mx-4 mb-3">
            <p className="text-[9px] text-indigo-300 uppercase tracking-wider font-medium mb-1">AI Gerekçesi:</p>
            <p className="text-[10px] text-slate-300 leading-relaxed line-clamp-3">{proposal.reasoning}</p>
          </div>
        )}

        {/* Expected performance */}
        {proposal.expectedPerformance && (
          <div className="px-4 pb-3">
            <p className="text-[10px] text-emerald-300 font-medium">{proposal.expectedPerformance}</p>
          </div>
        )}

        {/* AI Kontrol Notu (diagnostic) */}
        {diagnostic && (
          <div className={`mx-4 mb-3 rounded-lg px-3 py-2 border max-h-[110px] overflow-hidden ${
            diagnostic.isHealthy
              ? 'bg-emerald-950/30 border-emerald-500/20'
              : 'bg-slate-800/60 border-slate-700/40'
          }`}>
            <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${
              diagnostic.isHealthy ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              AI Kontrol Notu
            </p>
            <p className={`text-[10px] font-medium ${diagnostic.isHealthy ? 'text-emerald-200' : 'text-slate-200'}`}>
              {diagnostic.label}
            </p>
            <p className={`text-[10px] mt-0.5 leading-relaxed line-clamp-2 ${diagnostic.isHealthy ? 'text-emerald-300/80' : 'text-slate-300'}`}>
              {diagnostic.summary}
            </p>
            {diagnostic.action && (
              <p className="text-[10px] mt-1 text-slate-300 line-clamp-1">→ Önerilen: {diagnostic.action}</p>
            )}
          </div>
        )}

        {/* Platform Kuralı Uyarısı (policy guard) */}
        {proposal.policyStatus === 'review_required' && proposal.policySummary && (
          <div className="mx-4 mb-3 rounded-lg px-3 py-2 border bg-primary/5 border-primary/20">
            <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5 text-primary">
              Platform Kuralı Uyarısı
            </p>
            <p className="text-[10px] leading-relaxed line-clamp-3 text-primary/80">
              {proposal.policySummary}
            </p>
          </div>
        )}
      </div>

      {/* Action footer — pinned at card bottom, outside clickable area */}
      {actionFooter && (
        <div className="border-t border-slate-700/40">
          {actionFooter}
        </div>
      )}
    </div>
  )
}
