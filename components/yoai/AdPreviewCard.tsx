'use client'

import type { ReactNode } from 'react'
import { Globe } from 'lucide-react'
import type { FullAdProposal } from '@/lib/yoai/adCreator'

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

        {/* TOP: Badge + Confidence */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-200">
              {proposal.objectiveLabel || (isGoogle ? 'Google' : 'Meta')}
            </span>
            {proposal.isNewObjective && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                Yeni Öneri
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-300">%{proposal.confidence} güven</span>
        </div>

        {/* Campaign structure */}
        <div className="px-4 pb-3 space-y-0.5 text-[11px]">
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
