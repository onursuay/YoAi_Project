'use client'

import { Globe } from 'lucide-react'
import type { FullAdProposal } from '@/lib/yoai/adCreator'

interface Props {
  proposal: FullAdProposal
  selected: boolean
  onSelect: () => void
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

function fmtOptGoal(v?: string): string {
  if (!v) return '—'
  return OPTIMIZATION_GOAL_LABEL[v] || v
}
function fmtDest(v?: string): string {
  if (!v) return '—'
  return DESTINATION_LABEL[v] || v
}

export default function AdPreviewCard({ proposal, selected, onSelect }: Props) {
  const isGoogle = proposal.platform === 'Google'

  return (
    <button
      onClick={onSelect}
      className={`relative text-left w-full rounded-2xl overflow-hidden transition-all duration-200 border bg-[#0f172a] flex flex-col ${
        selected
          ? 'border-emerald-400/50 shadow-lg shadow-emerald-900/30'
          : 'border-[#23314d] shadow-md hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-900/20'
      }`}
    >
      {/* Subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.07),transparent_60%)]" />

      <div className="flex flex-col flex-1">

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
          <span className="text-[11px] text-slate-400">%{proposal.confidence} güven</span>
        </div>

        {/* Campaign structure */}
        <div className="px-4 pb-3 space-y-0.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Kampanya</span>
            <span className="text-slate-100 font-medium truncate max-w-[60%] text-right">{proposal.campaignName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{isGoogle ? 'Reklam Grubu' : 'Reklam Seti'}</span>
            <span className="text-slate-100 font-medium truncate max-w-[60%] text-right">{proposal.adsetName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Bütçe</span>
            <span className="text-slate-100 font-medium">₺{proposal.dailyBudget}/gün</span>
          </div>
          {proposal.targetingDescription && (
            <div className="flex justify-between">
              <span className="text-slate-500">Hedefleme</span>
              <span className="text-slate-300 truncate max-w-[60%] text-right">{proposal.targetingDescription}</span>
            </div>
          )}
          {proposal.optimizationGoal && (
            <div className="flex justify-between">
              <span className="text-slate-500">Opt. Hedef</span>
              <span className="text-slate-300 truncate max-w-[60%] text-right" title={proposal.optimizationGoal}>
                {fmtOptGoal(proposal.optimizationGoal)}
              </span>
            </div>
          )}
          {proposal.biddingStrategy && (
            <div className="flex justify-between">
              <span className="text-slate-500">Teklif</span>
              <span className="text-slate-300">{proposal.biddingStrategy}</span>
            </div>
          )}
          {proposal.destinationType && (
            <div className="flex justify-between">
              <span className="text-slate-500">Dönüşüm</span>
              <span className="text-slate-300 truncate max-w-[60%] text-right" title={proposal.destinationType}>
                {fmtDest(proposal.destinationType)}
              </span>
            </div>
          )}
        </div>

        {/* Ad preview */}
        <div className="px-4 pb-3 flex-1">
          {isGoogle ? (
            <div className="bg-[#151f33] border border-slate-700/60 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[9px] font-bold text-slate-300 bg-slate-700/60 px-1 py-0.5 rounded">
                  Reklam
                </span>
                {proposal.finalUrl && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                    <Globe className="w-2.5 h-2.5" />
                    {proposal.finalUrl.replace(/^https?:\/\//, '').split('/')[0]}
                  </span>
                )}
              </div>
              <h3 className="text-[13px] font-medium text-blue-300 leading-snug mb-1">
                {proposal.headlines?.slice(0, 3).join(' | ') || proposal.headline}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                {proposal.descriptions?.slice(0, 2).join(' ') || proposal.description}
              </p>
              {proposal.keywords && proposal.keywords.length > 0 && (
                <div className="pt-2 border-t border-slate-700/50">
                  <p className="text-[9px] text-slate-500 mb-1">Önerilen Anahtar Kelimeler:</p>
                  <div className="flex flex-wrap gap-1">
                    {proposal.keywords.slice(0, 5).map((k, i) => (
                      <span key={i} className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700/50">
                        {k}
                      </span>
                    ))}
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
                  <p className="text-[10px] font-semibold text-slate-100">İşletmeniz</p>
                  <p className="text-[8px] text-slate-500">Sponsorlu</p>
                </div>
              </div>
              <div className="px-3 py-2">
                <p className="text-[12px] text-slate-200 leading-relaxed line-clamp-3">{proposal.primaryText}</p>
              </div>
              <div className="h-28 bg-gradient-to-br from-slate-800 to-slate-900">
                <img src="/digital-ads.jpg" alt="" className="w-full h-full object-cover opacity-80 rounded-md" />
              </div>
              <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-100 truncate">{proposal.headline}</p>
                  <p className="text-[9px] text-slate-400 truncate">{proposal.description}</p>
                </div>
                <span className="shrink-0 ml-2 px-2 py-0.5 bg-slate-700 text-slate-200 rounded text-[9px] font-medium">
                  {humanizeCta(proposal.callToAction)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Competitor insight */}
        {proposal.competitorInsight && (
          <div className="mx-4 mb-3 bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2">
            <p className="text-[9px] text-slate-500 font-medium mb-0.5">Rakip Karşılaştırma</p>
            <p className="text-[10px] text-slate-300 line-clamp-2">{proposal.competitorInsight}</p>
          </div>
        )}

        {/* AI reasoning */}
        {proposal.reasoning && (
          <div className="mx-4 mb-3">
            <p className="text-[9px] text-indigo-400 uppercase tracking-wider font-medium mb-1">AI Gerekçesi:</p>
            <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3">{proposal.reasoning}</p>
          </div>
        )}

        {/* Expected performance */}
        <div className="px-4 pb-3">
          <p className="text-[10px] text-emerald-400 font-medium">{proposal.expectedPerformance}</p>
        </div>
      </div>
    </button>
  )
}
