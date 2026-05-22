/* ──────────────────────────────────────────────────────────
   Google Ads Optimizasyon — Öneri Üreteci (Faz 1)

   Google kampanyasının (googleDeepFetcher çıktısı — Meta-format
   ProblemTag taşır) sorunlarından somut öneriler üretir.
   Deterministik şablon her zaman çalışır; Claude (ANTHROPIC_API_KEY
   varsa + useAI) zenginleştirir, başarısızsa şablona düşer.

   Mevcut Meta tipleri (Recommendation/ProblemTag/...) yeniden kullanılır —
   googleDeepFetcher zaten Meta-format ProblemTag ürettiği için ek şekil yok.
   Meta/Google entegrasyon koduna dokunulmaz.
   ────────────────────────────────────────────────────────── */

import { getAnthropicClient, getAiEngineModel, isAnthropicReady } from '@/lib/anthropic/client'
import type {
  Recommendation,
  RecommendationCategory,
  ProblemTag,
  ProblemTagId,
  MetricEvidence,
  ChangeSet,
} from '@/lib/meta/optimization/types'
import type { StandardMetrics } from '@/lib/yoai/analysisTypes'

export interface GoogleScanCampaign {
  id: string
  name: string
  channelType?: string
  biddingStrategy?: string
  optimizationScore?: number | null
  currency: string
  dailyBudget: number | null
  metrics: StandardMetrics
  problemTags: ProblemTag[]
}

interface Template {
  title: string
  rootCause: string
  action: string
  risk: 'low' | 'medium' | 'high'
  expectedImpact: string
  category: RecommendationCategory
}

// Google'a özgü öneri şablonları (Meta-format ProblemTagId anahtarlı —
// googleDeepFetcher google sorunlarını bu id'lere map eder).
const TEMPLATES: Partial<Record<ProblemTagId, Template>> = {
  NO_DELIVERY: {
    title: 'Kampanya yayında değil',
    rootCause: 'Harcama ve gösterim sıfır — kampanya teslim edilmiyor (bütçe, teklif, onay veya hedefleme engeli).',
    action: 'Bütçe ve teklif stratejisini kontrol et; politika/onay durumunu ve anahtar kelime/hedefleme kapsamını gözden geçir.',
    risk: 'low',
    expectedImpact: 'Teslimat başlar, gösterim akışı açılır.',
    category: 'TASK',
  },
  INSUFFICIENT_DATA: {
    title: 'Yetersiz veri',
    rootCause: 'Harcama var ama gösterim çok düşük — sağlıklı değerlendirme için yeterli veri yok.',
    action: 'Öğrenme dönemini bekle; bütçe/teklif çok düşükse kademeli artır, kampanya yapısını parçalama.',
    risk: 'low',
    expectedImpact: 'Daha güvenilir performans sinyali.',
    category: 'TASK',
  },
  LOW_CTR: {
    title: 'Düşük tıklama oranı (CTR)',
    rootCause: 'CTR sektör eşiğinin altında — reklam metni/uzantılar arama niyetiyle yeterince eşleşmiyor.',
    action: 'RSA başlık/açıklamalarını arama niyetine göre güçlendir, sitelink/açıklama uzantıları ekle, alakasız anahtar kelimeleri negatifle.',
    risk: 'low',
    expectedImpact: 'Daha yüksek CTR → daha iyi kalite puanı + düşük TBM.',
    category: 'TASK',
  },
  HIGH_CPC: {
    title: 'Yüksek tıklama maliyeti (TBM)',
    rootCause: 'Ortalama TBM eşiğin üzerinde — rekabetçi/geniş anahtar kelimeler veya zayıf kalite puanı.',
    action: 'Kalite puanını yükselt (alaka + açılış sayfası), pahalı/geniş eşlemeleri daralt, teklif stratejisini gözden geçir.',
    risk: 'medium',
    expectedImpact: 'Tıklama başına düşük maliyet, aynı bütçeyle daha çok trafik.',
    category: 'REVIEW_REQUIRED',
  },
  HIGH_CPA: {
    title: 'Dönüşüm yok / yüksek edinme maliyeti',
    rootCause: 'Anlamlı harcamaya rağmen dönüşüm gelmiyor — hedefleme, teklif veya açılış sayfası uyumu sorunlu.',
    action: 'Dönüşüm takibini doğrula, hedef kitleyi/anahtar kelimeleri daralt, açılış sayfası dönüşüm akışını iyileştir.',
    risk: 'medium',
    expectedImpact: 'Edinme maliyeti düşer, bütçe verimi artar.',
    category: 'REVIEW_REQUIRED',
  },
  LOW_ROAS: {
    title: 'Düşük ROAS',
    rootCause: 'Reklam harcaması getirisi hedefin altında — değer odaklı olmayan tıklamalar veya zayıf dönüşüm değeri.',
    action: 'tROAS/Maksimum dönüşüm değeri stratejisine geç, yüksek değerli ürün/anahtar kelimelere bütçe kaydır, düşük getirili segmentleri kıs.',
    risk: 'medium',
    expectedImpact: 'Harcama başına getiri yükselir.',
    category: 'REVIEW_REQUIRED',
  },
  NEGATIVE_ROAS: {
    title: 'Zarar eden kampanya',
    rootCause: 'Getiri maliyeti karşılamıyor — kampanya mevcut hâliyle zarar yazıyor.',
    action: 'Kampanyayı duraklatmayı değerlendir; teklif/hedefleme yapısını yeniden kur, sonra yeniden başlat.',
    risk: 'high',
    expectedImpact: 'Zararlı harcama durur.',
    category: 'REVIEW_REQUIRED',
  },
  ADSET_IMBALANCE: {
    title: 'Ad grubu dengesizliği',
    rootCause: 'Bütçe/performans ad grupları arasında dengesiz dağılmış.',
    action: 'Düşük performanslı ad gruplarından yükseğe bütçe kaydır; çok dağınık yapıyı sadeleştir.',
    risk: 'medium',
    expectedImpact: 'Bütçe en verimli ad gruplarına akar.',
    category: 'REVIEW_REQUIRED',
  },
  SINGLE_ADSET_RISK: {
    title: 'Tek ad grubu riski',
    rootCause: 'Kampanya tek ad grubuna bağımlı — test ve dağılım esnekliği yok.',
    action: 'Farklı tema/anahtar kelime kümeleriyle ikinci bir ad grubu ekleyip A/B test başlat.',
    risk: 'low',
    expectedImpact: 'Daha dayanıklı yapı + öğrenme alanı.',
    category: 'TASK',
  },
}

function genericTemplate(tag: ProblemTag): Template {
  return {
    title: 'İncelenmesi gereken sinyal',
    rootCause: `Kural motoru "${tag.id}" sinyalini işaretledi.`,
    action: 'İlgili metrikleri gözden geçirip kampanya ayarlarını buna göre düzenle.',
    risk: tag.severity === 'critical' ? 'high' : tag.severity === 'warning' ? 'medium' : 'low',
    expectedImpact: 'Sinyalin giderilmesi performansı iyileştirir.',
    category: 'TASK',
  }
}

// Faz 2: uygulanabilir aksiyon → ChangeSet (canlı apply). Yalnız net/güvenli
// kararlar: zarar eden kampanyayı duraklat, düşük getiride bütçeyi kıs.
function changeSetFor(campaign: GoogleScanCampaign, tagId: ProblemTagId): ChangeSet | undefined {
  const base = {
    id: `cs_g_${campaign.id}_${tagId}_${Date.now()}`,
    entityType: 'campaign' as const,
    entityId: campaign.id,
    entityName: campaign.name,
    status: 'pending' as const,
    timestamp: Date.now(),
  }
  if (tagId === 'NEGATIVE_ROAS') {
    return { ...base, changeType: 'status', oldValue: 'ENABLED', newValue: 'PAUSED', riskLevel: 'high' }
  }
  if ((tagId === 'LOW_ROAS' || tagId === 'HIGH_CPA') && campaign.dailyBudget && campaign.dailyBudget > 0) {
    return { ...base, changeType: 'budget', oldValue: campaign.dailyBudget, newValue: Math.round(campaign.dailyBudget * 0.8 * 100) / 100, riskLevel: 'medium' }
  }
  return undefined
}

function buildFallback(campaign: GoogleScanCampaign): Recommendation[] {
  return campaign.problemTags.map((tag, i) => {
    const t = TEMPLATES[tag.id] ?? genericTemplate(tag)
    const changeSet = changeSetFor(campaign, tag.id)
    return {
      id: `rec_g_${Date.now()}_${i}`,
      title: t.title,
      problemTag: tag.id,
      evidence: tag.evidence,
      rootCause: t.rootCause,
      action: t.action,
      risk: t.risk,
      expectedImpact: t.expectedImpact,
      confidence: 0.7,
      // changeSet varsa tek-tık uygulanabilir → REVIEW_REQUIRED (açık onay)
      category: changeSet ? 'REVIEW_REQUIRED' : t.category,
      changeSet,
    }
  })
}

async function generateWithAI(campaign: GoogleScanCampaign, locale: string): Promise<Recommendation[]> {
  if (!isAnthropicReady()) throw new Error('ANTHROPIC_API_KEY yok')
  const lang = locale === 'en' ? 'English' : 'Turkish'
  const m = campaign.metrics

  const systemPrompt = `You are a Google Ads optimization expert. Given a campaign's data and detected problems, generate actionable recommendations in ${lang}.

Output ONLY a JSON array with this exact schema:
[{
  "title": "short title",
  "problemTag": "EXACT_TAG_ID",
  "rootCause": "1-2 sentence explanation",
  "action": "specific actionable recommendation",
  "risk": "low" | "medium" | "high",
  "expectedImpact": "expected outcome",
  "confidence": 0.0-1.0,
  "category": "AUTO_APPLY_SAFE" | "REVIEW_REQUIRED" | "TASK"
}]

Google Ads context: campaigns have ad groups + keywords (no audiences/creatives like Meta). Recommendations should fit Search/PMax/Display/Video. Keep them concise and metric-backed. Do NOT cite sources.`

  const userPrompt = `Campaign: "${campaign.name}"
Channel Type: ${campaign.channelType ?? 'N/A'}
Bidding Strategy: ${campaign.biddingStrategy ?? 'N/A'}
Optimization Score: ${campaign.optimizationScore ?? 'N/A'}
Daily Budget: ${campaign.dailyBudget ?? 'N/A'} ${campaign.currency}

Metrics (last 7d):
- Spend: ${m.spend}, Impressions: ${m.impressions}, Clicks: ${m.clicks}
- CTR: ${m.ctr}%, CPC: ${m.cpc}, Conversions: ${m.conversions}, ROAS: ${m.roas ?? 'N/A'}

Detected Problems:
${campaign.problemTags.map((t) => `- ${t.id} (${t.severity}): ${JSON.stringify(t.evidence)}`).join('\n')}`

  const client = getAnthropicClient()
  const res = await client.messages.create(
    {
      model: getAiEngineModel(),
      max_tokens: 2000,
      temperature: 0.3,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    },
    { timeout: 10000 },
  )
  let content = ''
  for (const block of res.content) if (block.type === 'text') content += block.text
  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(jsonStr) as Array<{
    title: string; problemTag: string; rootCause: string; action: string
    risk: string; expectedImpact: string; confidence: number; category: string
  }>

  const tagById = new Map(campaign.problemTags.map((t) => [t.id, t.evidence] as const))
  return parsed.map((item, i) => {
    const tagId = (item.problemTag || 'INSUFFICIENT_DATA') as ProblemTagId
    const evidence: MetricEvidence[] = tagById.get(tagId) ?? []
    const changeSet = changeSetFor(campaign, tagId)
    return {
      id: `rec_gai_${Date.now()}_${i}`,
      title: item.title,
      problemTag: tagId,
      evidence,
      rootCause: item.rootCause,
      action: item.action,
      risk: (['low', 'medium', 'high'].includes(item.risk) ? item.risk : 'medium') as Recommendation['risk'],
      expectedImpact: item.expectedImpact,
      confidence: Math.max(0, Math.min(1, item.confidence || 0.7)),
      // changeSet (pause/bütçe) varsa tek-tık uygulanabilir → REVIEW_REQUIRED.
      // AUTO_APPLY_SAFE üretmeyiz (Google'da otomatik uygulama yok, açık onay şart).
      category: (changeSet ? 'REVIEW_REQUIRED' : 'TASK') as RecommendationCategory,
      changeSet,
    }
  })
}

export async function generateGoogleRecommendations(
  campaign: GoogleScanCampaign,
  locale: string,
  useAI: boolean,
): Promise<{ recommendations: Recommendation[]; aiGenerated: boolean }> {
  if (campaign.problemTags.length === 0) {
    return { recommendations: [], aiGenerated: false }
  }
  if (useAI && isAnthropicReady()) {
    try {
      const recs = await generateWithAI(campaign, locale)
      if (recs.length > 0) return { recommendations: recs, aiGenerated: true }
    } catch (err) {
      console.error('[Google Magic Scan AI] Fallback:', err)
    }
  }
  return { recommendations: buildFallback(campaign), aiGenerated: false }
}
