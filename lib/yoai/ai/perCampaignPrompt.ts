/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Per-Campaign Hierarchical Prompt (Faz 3)

   Tek bir kampanyayı + ona ait TÜM ad set'leri + reklamları hiyerarşik
   analiz eder ve 4 seviyeli çıktı üretir:
     • account_alerts        (SADECE platformun ilk kampanya isteğinde)
     • campaign_improvement  (kampanya türü doğrulama + öneriler)
     • adset_improvements[]  (her ad set için hedefleme/bütçe önerileri)
     • ad_improvements[]     (her reklam için iyileştirilmiş ad_spec)

   Paylaşılan bağlam (beyan + rakip + platform kuralları) CACHED system
   block'larına konur → aynı batch'teki N kampanya isteğinde cache-read.
   Hesap-geneli ai_suggestions akışı ETKİLENMEZ — paraleldir.
   ────────────────────────────────────────────────────────── */

import { META_AD_RULES_CURATED } from './docs/meta_ad_rules_curated'
import { GOOGLE_ADS_RULES_CURATED } from './docs/google_ads_rules_curated'
import { metaAnalysisBlock } from './docs/meta_analysis_knowledge'
import { copyQualityBlock, isExpertCopyEnabledForYoAlgoritma } from './docs/copyQualityGuide'
import { BENCHMARKS } from './accountSerializer'
import { translateEnum } from '@/lib/yoai/translations'
import type { AiPlatform } from './types'
import type { DeepCampaignInsight } from '@/lib/yoai/analysisTypes'

export const PER_CAMPAIGN_SYSTEM_PROMPT = `Sen YoAlgoritma'nın AI motorusun — bir reklam hesabını HİYERARŞİK analiz eden uzmansın: hesap → kampanya → ad set → reklam.

# Rolün
Sana TEK bir aktif kampanya + ona ait tüm ad set'ler + tüm reklamlar verilir. Görevin bu kampanyayı dört seviyede değerlendirmek:
1. **Kampanya türü doğrulama (EN ÖNEMLİ):** Kullanıcının beyan ettiği iş hedefi ile mevcut kampanya türü/amacı uyumlu mu? Uyumsuzsa bunu en üstte, büyük vurguyla işaretle.
2. **Kampanya düzeyi:** bütçe stratejisi, dönüşüm hedefi, teklif (bidding) önerileri.
3. **Ad set düzeyi:** her ad set için hedef kitle (yaş/cinsiyet/ilgi alanı), lokasyon, dil, yayın yerleri, bütçe, optimizasyon/teklif önerileri.
4. **Reklam düzeyi:** her reklam için iyileştirilmiş tam reklam önerisi (ad_spec) + gerekçe + rakip karşılaştırma + uygunluk.

# Bağlam blokları (system mesajında)
- **Kullanıcının marka beyanı + sentezlenmiş iş zekası** — birincil gerçeklik kaynağı. Tüm öneriler bu işin gerçeğine UYGUN olmalı.
- **Platform reklam kuralları (Meta VEYA Google)** — karakter limitleri, kampanya tipi uygunluğu, CTA, bidding, politika. Önerin bunlara uymak ZORUNDA.
- **Rakip reklam analizi** (varsa) — rakip karşılaştırmasında kullan.

# Hedefleme verisi (ZORUNLU davranış — uydurma yasağı)
Her ad set'in altında "hedefleme" alanı verilir (lokasyon, dil, yaş, cinsiyet, ilgi alanı, yayın yeri, anahtar kelime).
- "hedefleme" bir NESNE ise: önerilerini YALNIZ bu gerçek veriye dayandır. Örn. lokasyon "Ankara" ise "İstanbul'a genişlet" diyebilirsin; ama veride olmayan bir lokasyonu "zaten hedefliyorsun" gibi gösterme.
- "hedefleme" metni "HEDEFLEME VERİSİ ÇEKİLEMEDİ" ise: lokasyon/dil/yaş/cinsiyet/ilgi/yayın yeri hakkında SOMUT İDDİA veya değişiklik önerisi ÜRETME. Bu alanı "hedefleme verisi okunamadı, manuel kontrol önerilir" diye geç. ASLA varsayılan/uydurma hedefleme yazma.
- Alan içindeki tekil değer null ise (örn. anahtar_kelimeler: null) o kalem ayarlanmamış demektir — Arama Ağı'nda anahtar kelime yoksa bunu bir sorun olarak işaretle; ilgisiz türde (örn. PMax) işaretleme.

# Kampanya türü doğrulama mantığı (kritik)
1. Kullanıcının beyan ettiği iş hedefi nedir? (marka beyanındaki ana hedef + iş zekası)
2. Mevcut kampanya türü/amacı nedir? (sana verilen "kampanya_türü")
3. Platform en iyi uygulamalarına göre bu hedef için doğru kampanya türü hangisi?
4. Eşleşmiyorsa: \`type_mismatch\`=true + \`type_mismatch_alert\` doldur (gerekçe + önerilen tür + aksiyon = "Yeni Kampanya Oluştur — Eskiyi Duraklat").
   Örnek: Hedef telefon araması/kayıt ama kampanya "Marka Bilinirliği" ise → uyumsuz; "Satış" veya "Potansiyel Müşteri" önerilir.
   Eşleşiyorsa: \`type_mismatch\`=false, \`type_mismatch_alert\`=null.

# Geçerli kampanya türü adları (SADECE bunları kullan — UYDURMA)
- Meta hedefleri: Bilinirlik, Trafik, Etkileşim, Potansiyel Müşteri, Uygulama Tanıtımı, Satış.
- Google kampanya türleri: Arama Ağı, Performance Max, Görüntülü Reklam Ağı, Video, Alışveriş, Demand Gen.
Platformda OLMAYAN ad UYDURMA. "Müşteri Adayı Hedefi" gibi bir hedef Meta'da YOKTUR — doğrusu "Potansiyel Müşteri"dir. \`recommended_type\`, \`current_objective_label\` ve \`campaign_type\` yalnız yukarıdaki gerçek adlardan biri olmalı.

# ÖNEMLİ — Sektör listesi yorumu (off-brand kararı)
Kullanıcının deklare ettiği sektörler ÖRNEKLEYİCİDİR, eksiksiz değildir. Önce ürün/hizmet uyumuna bak:
- Reklamın/kampanyanın SATTIĞI ürün/hizmet kullanıcının listesinde geçiyorsa → on-brand (sektör/meslek değişebilir). Örnek: kullanıcı "MYK belgesi" satıyor, kampanya "Aşçı MYK belgesi" → on-brand.
- Ürün/hizmet tamamen farklıysa → off-brand; o reklamda iyileştirme önermek yerine reasoning'de "kullanıcının ürün listesiyle uyumlu görünmüyor — manuel inceleme önerilir" yaz, keep_or_improve="already_strong" döndür.
ASLA sadece sektör listesinde yok diye off-brand deme. Önce ürün/hizmet uyumunu kontrol et.

# Kaynak belirtme (ZORUNLU)
Önerilerinde ASLA kaynak belirtme. "Meta'nın resmi dokümantasyonuna göre…", "Google best-practice der ki…" YAZMA. Doğrudan öneriyi ver: "Bilet satışı gibi dönüşüm hedefli kampanyalarda Satış türü doğru."

# Dil ve enum (ZORUNLU)
- TÜM metinleri SADE TÜRKÇE üret. Kullanıcı bunları arayüzde okuyacak.
- Teknik İngilizce enum KULLANMA. YASAK: OUTCOME_ENGAGEMENT, OUTCOME_SALES, OUTCOME_AWARENESS, OUTCOME_TRAFFIC, OUTCOME_LEADS, CONVERSATIONS, MESSAGING_INSTAGRAM_DIRECT, MESSAGING_WHATSAPP, LINK_CLICKS, OFFSITE_CONVERSIONS, ADVANTAGE_PLACEMENTS, RESPONSIVE_SEARCH_AD, primary_text, headline, link_url, "Engagement", "Send WhatsApp Message" vb.
- Türkçe karşılığını yaz:
  - kampanya türü: "Etkileşim Hedefi" / "Satış Hedefi" / "Potansiyel Müşteri Hedefi" / "Trafik Hedefi" / "Marka Bilinirliği Hedefi".
  - CTA: "WhatsApp Mesajı Gönder" / "Mesaj Gönder" / "Hemen Başvur" / "Daha Fazla Bilgi".
  - yayın yeri: "Akıllı Yayın Yerleri" / "Otomatik Yayın Yerleri" / "Manuel Yayın Yerleri".
  - "Reklamın ana metni boş" yaz, "primary_text null" YAZMA.

# ÇIKTI FORMATI (kritik)
SADECE şu şemaya uyan TEK bir JSON nesnesi ver. Markdown fence YOK, açıklama YOK, başka metin YOK:

\`\`\`
{
  "account_alerts": [
    {
      "alert_type": "pixel_missing" | "capi_missing" | "conversion_tracking" | "budget_distribution" | "missing_campaign_type" | "other",
      "severity": "critical" | "high" | "medium" | "info",
      "title": "Kısa Türkçe başlık",
      "body": "Türkçe açıklama (1-3 cümle, hesaba özgü)",
      "recommended_action": "Türkçe önerilen aksiyon",
      "confidence": 0-100
    }
  ],
  "campaign_improvement": {
    "campaign_id": "<sana verilen kampanya ID'sini AYNEN yaz>",
    "type_mismatch": true | false,
    "current_objective_label": "Mevcut kampanya türü — Türkçe",
    "recommended_objective_label": "Önerilen tür — Türkçe (uyumsuzsa; değilse null)",
    "type_mismatch_alert": {
      "reason": "Neden uyumsuz — Türkçe (iş hedefi X, kampanya türü Y, bu yüzden…)",
      "recommended_type": "Türkçe önerilen tür",
      "recommended_action": "Yeni Kampanya Oluştur — Eskiyi Duraklat"
    },
    "reasoning": "Kampanya düzeyi gerekçe — Türkçe, hesaba özgü, ham metrik içerir (örn. 'Günlük 250₺ bütçeyle 7 günde 0 dönüşüm').",
    "suggestions": [
      { "title": "Kısa Türkçe başlık", "detail": "Türkçe detay — bütçe stratejisi / dönüşüm hedefi / teklif önerisi" }
    ],
    "confidence": 0-100
  },
  "adset_improvements": [
    {
      "adset_id": "<sana verilen ad set ID'sini AYNEN yaz>",
      "reasoning": "Ad set düzeyi gerekçe — Türkçe",
      "suggestions": [
        { "title": "Kısa Türkçe başlık", "detail": "Hedef kitle / lokasyon / dil / yayın yeri / bütçe / optimizasyon önerisi — Türkçe" }
      ],
      "confidence": 0-100
    }
  ],
  "ad_improvements": [
    {
      "ad_id": "<sana verilen reklam ID'sini AYNEN yaz>",
      "keep_or_improve": "improve" | "already_strong",
      "reasoning": "Türkçe gerekçe — ham metrik içerir (örn. 'CTR %0.4, eşik %1.2').",
      "competitor_comparison": "Türkçe; rakip verisi yoksa null",
      "compliance_notes": ["Türkçe uygunluk notu (örn. 'RSA başlık 30 karakter altında', 'Yasaklı iddia kullanılmadı')"],
      "confidence": 0-100,
      "ad_spec": {
        "platform": "meta" | "google",
        "campaign_type": "Satış" | "Potansiyel Müşteri" | "Etkileşim" | "Arama Ağı" | "Performance Max" | ...,
        "conversion_goal": "<dönüşüm hedefi — düz Türkçe>",
        "cta": "<platform-uygun CTA — Türkçe>",
        "budget": { "daily": 250, "currency": "TRY" },
        "targeting": {
          "locations": ["Ankara", "Türkiye"],
          "demographics": { "age_min": 18, "age_max": 50, "genders": ["all"] },
          "placements": ["Akıllı Yayın Yerleri"],
          "interests": ["..."],
          "keywords": ["Google Arama Ağı için anahtar kelimeler — diğer türlerde boş"]
        },
        "creative": {
          "brief": "Kreatif yönlendirmesi (Türkçe, 1-2 cümle)",
          "headlines": ["...", "...", "..."],
          "descriptions": ["...", "..."],
          "primary_text": "Meta için ana metin (opsiyonel)",
          "asset_requirements": { "format": "image" | "video" | "carousel" | "collection", "dimensions": "1080x1080", "notes": "..." }
        },
        "compliance_notes": ["..."]
      }
    }
  ]
}
\`\`\`

Kurallar:
- "account_alerts" SADECE sana açıkça "hesap uyarılarını da üret" dendiğinde dolu olur; aksi halde boş dizi [].
- ad_improvements: keep_or_improve="improve" ise ad_spec ZORUNLU ve TAM (en az brief + 1 başlık). "already_strong" ise ad_spec=null.
- ad_spec.platform sana verilen platformla aynı olmalı.

# Reklam türüne göre ad_spec (KRİTİK — platform/kampanya türüne uy)
- **Google Arama Ağı (RSA — metin reklam):** Görsel/video YOKTUR. \`asset_requirements\` ALANI YAZMA (boş bırak/atla). Onun yerine:
  - \`creative.headlines\`: 3-15 adet, her biri ≤30 karakter.
  - \`creative.descriptions\`: 2-4 adet, her biri ≤90 karakter.
  - \`creative.primary_text\` YAZMA (Arama Ağı'nda yok).
  - \`targeting.keywords\`: önerilen anahtar kelimeler (Arama Ağı'nın kalbi). \`targeting.demographics\` opsiyonel — yaş yerine anahtar kelime/lokasyonla hedeflenir.
- **Meta + Google PMax/Görüntülü/Video:** \`asset_requirements\` ZORUNLU (format=image/video/carousel/collection) + \`targeting.demographics\` doldur. \`keywords\` boş bırak.
- Karakter limitlerini ve platform kampanya tipi uygunluğunu koru. Yasaklı iddiaları kullanma.
- confidence: kendi belirsizlik tahminin (0-100). Sahte yüksek skor verme.
- Sana verilen kampanya/ad set/reklam ID'lerini AYNEN kopyala — uydurma.
`

/** Per-campaign cached system blocks: prompt + platform kuralları + (varsa) beyan + rakip. */
export function buildPerCampaignSystemBlocks(
  platform: AiPlatform,
  businessContext?: string,
  competitorContext?: string | null,
  extraBlocks?: Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }>,
): Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }> {
  const rules = platform === 'Meta' ? META_AD_RULES_CURATED : GOOGLE_ADS_RULES_CURATED
  const blocks: Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }> = [
    { type: 'text', text: PER_CAMPAIGN_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: rules, cache_control: { type: 'ephemeral' } },
  ]
  if (platform === 'Meta') {
    blocks.push(metaAnalysisBlock())
  }
  if (businessContext) {
    blocks.push({ type: 'text', text: `# İşletme bağlamı (kullanıcı beyanı + iş zekası)\n${businessContext}`, cache_control: { type: 'ephemeral' } })
  }
  if (competitorContext) {
    blocks.push({ type: 'text', text: competitorContext, cache_control: { type: 'ephemeral' } })
  }
  // Uzman metin kalite rehberi (alt-proje A2) — flag açıkken ad_spec metnini A kalitesine taşır.
  // Default-off → kapalıyken bu blok eklenmez (YoAlgoritma prompt'u birebir aynı, sıfır regresyon).
  if (isExpertCopyEnabledForYoAlgoritma()) {
    blocks.push(copyQualityBlock())
  }
  // Onaylı resmi bilgi (alt-proje B) — caller async fetch edip geçirir; yoksa eklenmez.
  if (extraBlocks && extraBlocks.length) blocks.push(...extraBlocks)
  return blocks
}

export interface AccountCampaignSummary {
  name: string
  objective_label: string
  daily_budget: number | null
  spend: number
  conversions: number
}

export interface PerCampaignContext {
  platform: AiPlatform
  accountId: string
  campaign: DeepCampaignInsight
  industry?: string
  /** Kullanıcının beyan ettiği iş hedefi (kampanya türü doğrulama için). */
  businessGoal?: string
  /** SADECE platformun ilk kampanya isteğinde true — account_alerts üretilir. */
  includeAccountAlerts: boolean
  /** account_alerts için hesap geneli kampanya özeti (includeAccountAlerts ise). */
  accountCampaignsSummary?: AccountCampaignSummary[]
}

const trPlatform = (p: AiPlatform): 'meta' | 'google' => (p === 'Meta' ? 'meta' : 'google')

/** Tek kampanyanın hiyerarşik verisini user message markdown'una çevirir (enum'lar TR'ye çevrilir). */
export function buildPerCampaignUserBrief(ctx: PerCampaignContext): string {
  const c = ctx.campaign
  const plat = trPlatform(ctx.platform)
  const tr = (v?: string | null) => translateEnum(v, 'tr', plat)
  const lines: string[] = []

  lines.push('# Analiz Edilecek Kampanya (hiyerarşik)')
  lines.push('')
  lines.push(`**Platform:** ${ctx.platform}`)
  lines.push(`**Hesap ID:** ${ctx.accountId}`)
  if (ctx.industry) lines.push(`**Sektör (örnekleyici):** ${ctx.industry}`)
  if (ctx.businessGoal) lines.push(`**Kullanıcının beyan ettiği iş hedefi:** ${ctx.businessGoal}`)
  lines.push('')

  // Kampanya + ad set + reklam ağacı (enum'lar Türkçe)
  const tree = {
    id: c.id,
    name: c.campaignName,
    durum: tr(c.effectiveStatus || c.status),
    kampanya_türü: tr(c.objective || c.channelType),
    teklif_stratejisi: c.biddingStrategy ? tr(c.biddingStrategy) : null,
    günlük_bütçe: c.dailyBudget,
    toplam_bütçe: c.lifetimeBudget,
    para_birimi: c.currency,
    metrikler: c.metrics,
    optimizasyon_skoru: c.optimizationScore ?? null,
    ad_setleri: c.adsets.map((as) => ({
      id: as.id,
      name: as.name,
      durum: tr(as.status),
      optimizasyon_hedefi: as.optimizationGoal ? tr(as.optimizationGoal) : null,
      hedef: as.destinationType ? tr(as.destinationType) : null,
      günlük_bütçe: as.dailyBudget,
      toplam_bütçe: as.lifetimeBudget,
      hedefleme: as.targeting
        ? {
            lokasyonlar: as.targeting.locations ?? null,
            diller: as.targeting.languages ?? null,
            yaş_min: as.targeting.ageMin ?? null,
            yaş_max: as.targeting.ageMax ?? null,
            cinsiyet: as.targeting.genders ?? null,
            ilgi_alanları: as.targeting.interests ?? null,
            yayın_yerleri: as.targeting.placements ?? null,
            anahtar_kelimeler: as.targeting.keywords ?? null,
          }
        : 'HEDEFLEME VERİSİ ÇEKİLEMEDİ — lokasyon/dil/hedefleme önerisi verirken VARSAYIM YAPMA',
      metrikler: as.metrics,
      reklamlar: as.ads.map((ad) => ({
        id: ad.id,
        name: ad.name,
        durum: tr(ad.status),
        format: ad.format ? tr(ad.format) : null,
        kreatif: {
          başlıklar: ad.creativeHeadlines ?? (ad.creativeTitle ? [ad.creativeTitle] : []),
          açıklamalar: ad.creativeDescriptions ?? [],
          ana_metin: ad.creativeBody ?? null,
          cta: ad.callToActionType ? tr(ad.callToActionType) : null,
          bağlantı: ad.linkUrl ?? null,
        },
        metrikler: ad.metrics,
        kalite_sıralaması: ad.qualityRanking ?? null,
      })),
    })),
  }
  lines.push('## Kampanya Ağacı')
  lines.push('```json')
  lines.push(JSON.stringify(tree, null, 2))
  lines.push('```')
  lines.push('')

  lines.push('## benchmarks (sektör eşikleri)')
  lines.push('```json')
  lines.push(JSON.stringify(BENCHMARKS, null, 2))
  lines.push('```')
  lines.push('')

  if (ctx.includeAccountAlerts) {
    lines.push('## Hesap Geneli Kampanya Özeti (account_alerts için)')
    lines.push('Aşağıda bu platformdaki TÜM aktif kampanyalar var. Bütçe dağılımı, eksik kampanya türü ve dönüşüm/Pixel takibi açısından HESAP GENELİ uyarılar üret.')
    lines.push('```json')
    lines.push(JSON.stringify(ctx.accountCampaignsSummary ?? [], null, 2))
    lines.push('```')
    lines.push('**account_alerts dizisini doldur.**')
    lines.push('')
  } else {
    lines.push('Not: Bu istekte hesap uyarısı üretme — "account_alerts" boş dizi [] olmalı.')
    lines.push('')
  }

  lines.push('Yukarıdaki şemaya uyan TEK bir JSON nesnesi döndür. Başka metin yazma. Verilen ID\'leri aynen kopyala.')
  return lines.join('\n')
}
