import type {
  ProblemTag,
  ProblemTagId,
  Recommendation,
  RecommendationCategory,
  OptimizationCampaign,
  MetricEvidence,
  ChangeSet,
} from './types'
import { createChangeSet } from './changeSetManager'

// ═══════════════════════════════════════════════════════════════════════════
// Fallback Recommendation Templates (deterministic, always available)
// ═══════════════════════════════════════════════════════════════════════════

interface FallbackTemplate {
  title: { tr: string; en: string }
  rootCause: { tr: string; en: string }
  action: { tr: string; en: string }
  expectedImpact: { tr: string; en: string }
  category: RecommendationCategory
  risk: 'low' | 'medium' | 'high'
  confidence: number
  changeSetFactory?: (campaign: OptimizationCampaign) => ChangeSet | undefined
}

const FALLBACK_TEMPLATES: Record<ProblemTagId, FallbackTemplate> = {
  NO_DELIVERY: {
    title: { tr: 'Kampanya teslim edilmiyor — duraklatın', en: 'Campaign is not delivering — pause it' },
    rootCause: { tr: 'Kampanya aktif ancak harcama veya gösterim gerçekleşmiyor. Bütçe, hedefleme veya teklif stratejisi sorunu olabilir.', en: 'Campaign is active but not spending or generating impressions. This may be due to budget, targeting, or bidding issues.' },
    action: { tr: 'Kampanyayı duraklatın, hedefleme ve bütçeyi gözden geçirdikten sonra yeniden başlatın.', en: 'Pause the campaign, review targeting and budget, then restart.' },
    expectedImpact: { tr: 'Boşa harcama durdurulacak. Düzeltme sonrası yeniden başlatılabilir.', en: 'Wasted spend will be stopped. Can be restarted after fixes.' },
    category: 'AUTO_APPLY_SAFE',
    risk: 'low',
    confidence: 0.95,
    changeSetFactory: (c) => {
      if (c.effectiveStatus !== 'ACTIVE' && c.status !== 'ACTIVE') return undefined
      return createChangeSet('campaign', c.id, c.name, 'status', 'ACTIVE', 'PAUSED')
    },
  },

  INSUFFICIENT_DATA: {
    title: { tr: 'Yetersiz veri — bütçeyi %50 artırın', en: 'Insufficient data — increase budget by 50%' },
    rootCause: { tr: 'Kampanya henüz yeterli harcama veya gösterim oluşturmamış. Analiz için daha fazla veri gerekiyor.', en: 'Campaign has not generated enough spend or impressions yet. More data is needed for analysis.' },
    action: { tr: 'Bütçeyi %50 artırarak daha hızlı veri toplanmasını sağlayın.', en: 'Increase budget by 50% to accelerate data collection.' },
    expectedImpact: { tr: 'Yeterli veri toplandığında daha doğru analiz yapılabilecek.', en: 'More accurate analysis will be possible once sufficient data is collected.' },
    category: 'REVIEW_REQUIRED',
    risk: 'medium',
    confidence: 0.90,
    changeSetFactory: (c) => {
      const budget = c.dailyBudget
      if (!budget || budget <= 0) return undefined
      return createChangeSet('campaign', c.id, c.name, 'budget', budget, Math.round(budget * 1.5 * 100) / 100)
    },
  },

  LOW_CTR: {
    title: { tr: 'Düşük tıklama oranı', en: 'Low click-through rate' },
    rootCause: { tr: 'Reklam görseli veya metni hedef kitlenin dikkatini çekemiyor. Hedefleme uyumsuzluğu da olabilir.', en: 'Ad creative or copy is not capturing the audience\'s attention. Targeting mismatch may also be a factor.' },
    action: { tr: 'Reklam görseli ve metnini yenileyin. Farklı başlık ve açıklama varyasyonlarını test edin.', en: 'Refresh ad creative and copy. Test different headline and description variations.' },
    expectedImpact: { tr: 'CTR artışı ile tıklama maliyeti düşecek ve daha fazla trafik elde edilecek.', en: 'Increased CTR will lower cost per click and generate more traffic.' },
    category: 'TASK',
    risk: 'low',
    confidence: 0.85,
  },

  HIGH_CPC: {
    title: { tr: 'Yüksek tıklama maliyeti — bütçeyi artırın ve hedef kitleyi genişletin', en: 'High cost per click — increase budget and broaden audience' },
    rootCause: { tr: 'Hedefleme çok dar veya rekabet yoğun. Dar kitle = daha az açık artırma fırsatı = yüksek TBM.', en: 'Targeting is too narrow or competition is intense. Narrow audience = fewer auction opportunities = higher CPC.' },
    action: { tr: 'Bütçeyi %20 artırarak algoritmaya alan verin. Aynı zamanda hedef kitleyi genişletin: ilgi alanı hedeflemesini gevşetin veya Advantage+ kitle kullanın.', en: 'Increase budget by 20% to give the algorithm more room. Also broaden audience: loosen interest targeting or use Advantage+ audience.' },
    expectedImpact: { tr: 'Geniş kitle + yeterli bütçe ile daha ucuz tıklamalar elde edilecek, TBM düşecek.', en: 'Broader audience + sufficient budget will yield cheaper clicks and lower CPC.' },
    category: 'REVIEW_REQUIRED',
    risk: 'low',
    confidence: 0.80,
    changeSetFactory: (c) => {
      const budget = c.dailyBudget
      if (!budget || budget <= 0) return undefined
      return createChangeSet('campaign', c.id, c.name, 'budget', budget, Math.round(budget * 1.2 * 100) / 100)
    },
  },

  HIGH_CPM: {
    title: { tr: 'Yüksek bin gösterim maliyeti — bütçeyi artırın ve hedef kitleyi genişletin', en: 'High CPM — increase budget and broaden audience' },
    rootCause: { tr: 'Hedeflenen kitle çok dar veya yoğun rekabet var. Dar kitle Meta\'nın teslimat algoritmasını kısıtlıyor.', en: 'Target audience is too narrow or there is heavy competition. Narrow audience constrains Meta\'s delivery algorithm.' },
    action: { tr: 'Bütçeyi %20 artırın ve hedef kitleyi genişletin: coğrafya, yaş aralığı veya ilgi alanlarını genişletin. Advantage+ hedefleme kullanmayı deneyin.', en: 'Increase budget by 20% and broaden your audience: expand geography, age range, or interests. Try using Advantage+ targeting.' },
    expectedImpact: { tr: 'Geniş kitle + artan bütçe ile gösterim maliyeti düşecek, daha fazla erişim sağlanacak.', en: 'Broader audience + increased budget will lower CPM and provide more reach.' },
    category: 'REVIEW_REQUIRED',
    risk: 'low',
    confidence: 0.80,
    changeSetFactory: (c) => {
      const budget = c.dailyBudget
      if (!budget || budget <= 0) return undefined
      return createChangeSet('campaign', c.id, c.name, 'budget', budget, Math.round(budget * 1.2 * 100) / 100)
    },
  },

  HIGH_CPL: {
    title: { tr: 'Yüksek potansiyel müşteri maliyeti — bütçeyi azaltın ve formu iyileştirin', en: 'High cost per lead — reduce budget and improve form' },
    rootCause: { tr: 'Form veya açılış sayfası dönüşüm oranı düşük. Hedefleme yeterince nitelikli değil.', en: 'Form or landing page conversion rate is low. Targeting may not be qualified enough.' },
    action: { tr: 'Bütçeyi %15 azaltarak maliyeti kontrol altına alın. Formu sadeleştirin (daha az alan), açılış sayfası hızını artırın. Lookalike kitle kullanın.', en: 'Reduce budget by 15% to control costs. Simplify the form (fewer fields), improve landing page speed. Use Lookalike audiences.' },
    expectedImpact: { tr: 'Bütçe tasarrufu + form iyileştirmesi ile potansiyel müşteri maliyeti düşecek.', en: 'Budget savings + form improvement will reduce cost per lead.' },
    category: 'REVIEW_REQUIRED',
    risk: 'low',
    confidence: 0.75,
    changeSetFactory: (c) => {
      const budget = c.dailyBudget
      if (!budget || budget <= 0) return undefined
      return createChangeSet('campaign', c.id, c.name, 'budget', budget, Math.round(budget * 0.85 * 100) / 100)
    },
  },

  HIGH_CPA: {
    title: { tr: 'Yüksek aksiyon maliyeti — bütçeyi azaltın ve huniyi iyileştirin', en: 'High cost per action — reduce budget and optimize funnel' },
    rootCause: { tr: 'Dönüşüm hunisinde kayıp var veya hedefleme uyumsuz.', en: 'There is funnel leakage or targeting mismatch.' },
    action: { tr: 'Bütçeyi %20 azaltarak zararı sınırlayın. Dönüşüm hunisini gözden geçirin: açılış sayfası, ürün sayfası ve ödeme akışındaki kayıp noktalarını belirleyin.', en: 'Reduce budget by 20% to limit losses. Review the conversion funnel: identify drop-off points in landing page, product page, and checkout flow.' },
    expectedImpact: { tr: 'Bütçe tasarrufu + huni iyileştirmesi ile aksiyon maliyeti düşecek.', en: 'Budget savings + funnel improvement will reduce cost per action.' },
    category: 'REVIEW_REQUIRED',
    risk: 'medium',
    confidence: 0.70,
    changeSetFactory: (c) => {
      const budget = c.dailyBudget
      if (!budget || budget <= 0) return undefined
      return createChangeSet('campaign', c.id, c.name, 'budget', budget, Math.round(budget * 0.8 * 100) / 100)
    },
  },

  NEGATIVE_ROAS: {
    title: { tr: 'Negatif reklam getirisi — kampanyayı duraklatın', en: 'Negative ROAS — pause campaign' },
    rootCause: { tr: 'Reklam harcaması, elde edilen gelirden fazla. Her harcanan TL zarar üretiyor.', en: 'Ad spend exceeds revenue generated. Every TL spent is producing a loss.' },
    action: { tr: 'Kampanyayı duraklatın ve hedefleme, kreatif ve ürün fiyatlamasını gözden geçirin.', en: 'Pause the campaign and review targeting, creative, and product pricing.' },
    expectedImpact: { tr: 'Zarar durdurulacak. Optimizasyon sonrası yeniden başlatılabilir.', en: 'Losses will be stopped. Can be restarted after optimization.' },
    category: 'AUTO_APPLY_SAFE',
    risk: 'low',
    confidence: 0.92,
    changeSetFactory: (c) => {
      if (c.effectiveStatus !== 'ACTIVE' && c.status !== 'ACTIVE') return undefined
      return createChangeSet('campaign', c.id, c.name, 'status', 'ACTIVE', 'PAUSED')
    },
  },

  LOW_ROAS: {
    title: { tr: 'Düşük reklam getirisi', en: 'Low return on ad spend' },
    rootCause: { tr: 'ROAS 1-2 aralığında; kârlılık düşük. Hedefleme veya ürün/fiyat uyumsuzluğu olabilir.', en: 'ROAS between 1-2; profitability is low. Targeting or product/pricing mismatch may exist.' },
    action: { tr: 'Bütçeyi %20 azaltın ve en iyi performans gösteren reklam setlerine odaklanın.', en: 'Reduce budget by 20% and focus on best performing ad sets.' },
    expectedImpact: { tr: 'Harcama azalırken ROAS artışı beklenir.', en: 'Expected ROAS increase while reducing spend.' },
    category: 'REVIEW_REQUIRED',
    risk: 'medium',
    confidence: 0.78,
    changeSetFactory: (c) => {
      const budget = c.dailyBudget
      if (!budget || budget <= 0) return undefined
      return createChangeSet('campaign', c.id, c.name, 'budget', budget, Math.round(budget * 0.8 * 100) / 100)
    },
  },

  HIGH_FREQUENCY: {
    title: { tr: 'Kitle yorgunluğu — bütçeyi %20 azaltın', en: 'Audience fatigue — reduce budget by 20%' },
    rootCause: { tr: 'Aynı kişiler reklamı ortalama 4+ kez gördü. Etkileşim düşmeye başlayabilir.', en: 'Same people have seen the ad 4+ times on average. Engagement may start declining.' },
    action: { tr: 'Bütçeyi %20 azaltarak frekansı düşürün. Kitleyi genişletin veya kreatifi yenileyin.', en: 'Reduce budget by 20% to lower frequency. Broaden the audience or refresh creative.' },
    expectedImpact: { tr: 'Frekans düşecek, kitle tazeliği ile CTR artacak.', en: 'Frequency will decrease, audience freshness will increase CTR.' },
    category: 'REVIEW_REQUIRED',
    risk: 'low',
    confidence: 0.82,
    changeSetFactory: (c) => {
      const budget = c.dailyBudget
      if (!budget || budget <= 0) return undefined
      return createChangeSet('campaign', c.id, c.name, 'budget', budget, Math.round(budget * 0.8 * 100) / 100)
    },
  },

  CRITICAL_FREQUENCY: {
    title: { tr: 'Kritik kitle doygunluğu — bütçeyi azaltın', en: 'Critical audience saturation — reduce budget' },
    rootCause: { tr: 'Sıklık 6+ seviyesinde. Kitle tamamen doymuş, reklam körlüğü oluşuyor.', en: 'Frequency at 6+ level. Audience is fully saturated, ad blindness is occurring.' },
    action: { tr: 'Bütçeyi %30 azaltın ve yeni kitle segmentleri ekleyin.', en: 'Reduce budget by 30% and add new audience segments.' },
    expectedImpact: { tr: 'Sıklık düşecek, maliyet verimliliği artacak.', en: 'Frequency will decrease, cost efficiency will improve.' },
    category: 'REVIEW_REQUIRED',
    risk: 'medium',
    confidence: 0.88,
    changeSetFactory: (c) => {
      const budget = c.dailyBudget
      if (!budget || budget <= 0) return undefined
      return createChangeSet('campaign', c.id, c.name, 'budget', budget, Math.round(budget * 0.7 * 100) / 100)
    },
  },

  QUALITY_BELOW_AVERAGE: {
    title: { tr: 'Düşük reklam kalitesi', en: 'Below average ad quality' },
    rootCause: { tr: 'Meta, reklam kalitenizi ortalamanın altında değerlendiriyor. Görsel veya metin kalitesi yetersiz.', en: 'Meta rates your ad quality below average. Visual or copy quality is insufficient.' },
    action: { tr: 'Reklam görsellerini ve metinlerini profesyonel standartlara yükseltin.', en: 'Upgrade ad visuals and copy to professional standards.' },
    expectedImpact: { tr: 'Kalite sıralaması arttığında maliyetler düşecek.', en: 'Costs will decrease as quality ranking improves.' },
    category: 'TASK',
    risk: 'low',
    confidence: 0.85,
  },

  ENGAGEMENT_BELOW_AVERAGE: {
    title: { tr: 'Düşük etkileşim sıralaması', en: 'Below average engagement ranking' },
    rootCause: { tr: 'Reklamınız benzer reklamlara kıyasla daha az etkileşim alıyor.', en: 'Your ad receives less engagement compared to similar ads.' },
    action: { tr: 'Daha dikkat çekici başlıklar ve görsel formatları deneyin (video, carousel).', en: 'Try more attention-grabbing headlines and visual formats (video, carousel).' },
    expectedImpact: { tr: 'Etkileşim artışı ile reklam maliyetleri düşecek.', en: 'Increased engagement will lower ad costs.' },
    category: 'TASK',
    risk: 'low',
    confidence: 0.80,
  },

  CONVERSION_BELOW_AVERAGE: {
    title: { tr: 'Düşük dönüşüm sıralaması', en: 'Below average conversion ranking' },
    rootCause: { tr: 'Açılış sayfası veya dönüşüm akışı rakiplere kıyasla düşük performans gösteriyor.', en: 'Landing page or conversion flow underperforms compared to competitors.' },
    action: { tr: 'Açılış sayfasını optimize edin: hız, mobil uyumluluk, CTA netliği.', en: 'Optimize landing page: speed, mobile compatibility, CTA clarity.' },
    expectedImpact: { tr: 'Dönüşüm oranı artışı ile edinme maliyetleri düşecek.', en: 'Increased conversion rate will reduce acquisition costs.' },
    category: 'TASK',
    risk: 'low',
    confidence: 0.80,
  },

  LPV_DROP: {
    title: { tr: 'Açılış sayfası kayıp oranı yüksek', en: 'High landing page drop-off rate' },
    rootCause: { tr: 'Tıklayanların yarısından azı sayfayı yüklüyor. Sayfa yavaş veya mobil uyumsuz olabilir.', en: 'Less than half of clickers load the page. Page may be slow or not mobile-friendly.' },
    action: { tr: 'Sayfa yükleme hızını optimize edin. Mobil uyumluluğu kontrol edin.', en: 'Optimize page load speed. Check mobile compatibility.' },
    expectedImpact: { tr: 'Açılış sayfası görüntüleme oranı artarak dönüşüm fırsatları artacak.', en: 'Landing page view rate will increase, creating more conversion opportunities.' },
    category: 'TASK',
    risk: 'low',
    confidence: 0.88,
  },

  FUNNEL_BOTTLENECK: {
    title: { tr: 'Dönüşüm hunisinde darboğaz', en: 'Conversion funnel bottleneck' },
    rootCause: { tr: 'Huninin bir aşamasında %70\'den fazla kayıp var. Bu aşama optimizasyon gerektiriyor.', en: 'More than 70% drop-off at one funnel stage. This stage needs optimization.' },
    action: { tr: 'Darboğaz aşamasını inceleyin: ürün sayfası, sepet veya ödeme akışını iyileştirin.', en: 'Investigate the bottleneck stage: improve product page, cart, or checkout flow.' },
    expectedImpact: { tr: 'Darboğaz aşılırsa satın alma sayısı önemli ölçüde artacak.', en: 'Resolving the bottleneck will significantly increase purchase volume.' },
    category: 'TASK',
    risk: 'low',
    confidence: 0.82,
  },

  BUDGET_UNDERUTILIZED: {
    title: { tr: 'Bütçe yeterince kullanılmıyor — bütçeyi %30 artırın', en: 'Budget underutilized — increase budget by 30%' },
    rootCause: { tr: 'Günlük bütçenin yarısından azı harcanıyor. Hedefleme çok dar veya teklifler düşük olabilir.', en: 'Less than half of daily budget is being spent. Targeting may be too narrow or bids too low.' },
    action: { tr: 'Bütçeyi %30 artırarak teslimat algoritmasına daha fazla alan verin.', en: 'Increase budget by 30% to give the delivery algorithm more room.' },
    expectedImpact: { tr: 'Bütçe kullanımı artarak daha fazla sonuç elde edilecek.', en: 'Increased budget utilization will generate more results.' },
    category: 'REVIEW_REQUIRED',
    risk: 'low',
    confidence: 0.75,
    changeSetFactory: (c) => {
      const budget = c.dailyBudget
      if (!budget || budget <= 0) return undefined
      return createChangeSet('campaign', c.id, c.name, 'budget', budget, Math.round(budget * 1.3 * 100) / 100)
    },
  },

  ADSET_IMBALANCE: {
    title: { tr: 'Reklam seti dengesizliği — dominant setin bütçesini azaltın', en: 'Ad set imbalance — reduce dominant set budget' },
    rootCause: { tr: 'Bir reklam seti harcamanın %80\'inden fazlasını tüketiyor. Diğer setler test edilemiyor.', en: 'One ad set consumes over 80% of spending. Other sets cannot be properly tested.' },
    action: { tr: 'En çok harcayan reklam setinin bütçesini %30 azaltarak diğer setlere alan açın.', en: 'Reduce the top-spending ad set budget by 30% to give other sets room to perform.' },
    expectedImpact: { tr: 'Daha dengeli test ile en iyi kitleyi keşfetme şansı artacak.', en: 'More balanced testing will increase chances of discovering the best audience.' },
    category: 'REVIEW_REQUIRED',
    risk: 'medium',
    confidence: 0.70,
    changeSetFactory: (c) => {
      // Find the dominant adset (highest spend)
      if (!c.adsets || c.adsets.length < 2) return undefined
      const sorted = [...c.adsets].sort((a, b) => (b.insights?.spend || 0) - (a.insights?.spend || 0))
      const dominant = sorted[0]
      const budget = dominant.dailyBudget
      if (!budget || budget <= 0) return undefined
      return createChangeSet('adset', dominant.id, dominant.name, 'budget', budget, Math.round(budget * 0.7 * 100) / 100)
    },
  },

  SINGLE_ADSET_RISK: {
    title: { tr: 'Tek reklam seti riski — seti kopyalayın', en: 'Single ad set risk — duplicate the set' },
    rootCause: { tr: 'Kampanyada tek reklam seti var. A/B testi yapılamıyor.', en: 'Campaign has only one ad set. A/B testing is not possible.' },
    action: { tr: 'Mevcut reklam setini kopyalayarak A/B testi için ikinci bir set oluşturun.', en: 'Duplicate the existing ad set to create a second set for A/B testing.' },
    expectedImpact: { tr: 'Çoklu test ile en iyi performans gösteren kombinasyon bulunabilir.', en: 'Multiple tests can help find the best performing combination.' },
    category: 'REVIEW_REQUIRED',
    risk: 'low',
    confidence: 0.72,
    changeSetFactory: (c) => {
      if (!c.adsets || c.adsets.length === 0) return undefined
      const adset = c.adsets[0]
      return createChangeSet('adset', adset.id, adset.name, 'duplicate_adset', 1, 2)
    },
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// Deterministic Fallback Generator
// ═══════════════════════════════════════════════════════════════════════════

function generateFallback(
  campaign: OptimizationCampaign,
  problemTags: ProblemTag[],
  locale: string,
): Recommendation[] {
  const lang = locale === 'en' ? 'en' : 'tr'
  const recs: Recommendation[] = []

  for (const tag of problemTags) {
    const tmpl = FALLBACK_TEMPLATES[tag.id]
    if (!tmpl) continue

    const changeSet = tmpl.changeSetFactory?.(campaign)

    recs.push({
      id: `rec_${tag.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: tmpl.title[lang],
      problemTag: tag.id,
      evidence: tag.evidence,
      rootCause: tmpl.rootCause[lang],
      action: tmpl.action[lang],
      risk: tmpl.risk,
      expectedImpact: tmpl.expectedImpact[lang],
      confidence: tmpl.confidence,
      category: tmpl.category,
      changeSet,
    })
  }

  return recs
}

// ═══════════════════════════════════════════════════════════════════════════
// AI-Powered Generator (when OPENAI_API_KEY is set)
// ═══════════════════════════════════════════════════════════════════════════

async function generateWithAI(
  campaign: OptimizationCampaign,
  problemTags: ProblemTag[],
  locale: string,
): Promise<Recommendation[]> {
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  if (!apiKey) throw new Error('No API key')

  const lang = locale === 'en' ? 'English' : 'Turkish'

  const systemPrompt = `You are a Meta Ads optimization expert. Given campaign data and detected problems, generate actionable recommendations in ${lang}.

Output ONLY a JSON array of objects with this exact schema:
[{
  "title": "short title",
  "problemTag": "EXACT_TAG_ID",
  "rootCause": "1-2 sentence explanation",
  "action": "specific actionable recommendation",
  "risk": "low" | "medium" | "high",
  "expectedImpact": "expected outcome",
  "confidence": 0.0-1.0,
  "category": "AUTO_APPLY_SAFE" | "REVIEW_REQUIRED" | "TASK",
  "changeType": "pause" | "budget_decrease_20" | "budget_decrease_30" | "budget_increase_30" | "budget_increase_50" | null
}]

Category rules:
- AUTO_APPLY_SAFE: only for pause campaign (when ROAS<1) or small budget decrease
- REVIEW_REQUIRED: for significant budget changes, targeting changes
- TASK: for creative refresh, landing page, audience expansion (non-API actions)

Keep recommendations concise and metric-backed.`

  const i = campaign.insights
  const userPrompt = `Campaign: "${campaign.name}"
Objective: ${campaign.triple.objective}
Optimization Goal: ${campaign.triple.optimizationGoal}
Destination: ${campaign.triple.destination}
Status: ${campaign.status}
Budget: ${campaign.dailyBudget || campaign.lifetimeBudget || 'N/A'} ${campaign.currency}

Key Metrics:
- Spend: ${i.spend}, Impressions: ${i.impressions}, Reach: ${i.reach}
- CTR: ${i.ctr}%, CPC: ${i.cpc}, CPM: ${i.cpm}
- Frequency: ${i.frequency}
- ROAS: ${i.websitePurchaseRoas}
- Quality: ${i.qualityRanking || 'N/A'}, Engagement: ${i.engagementRateRanking || 'N/A'}, Conversion: ${i.conversionRateRanking || 'N/A'}
- Ad Sets: ${campaign.adsets.length}

Detected Problems:
${problemTags.map(t => `- ${t.id} (${t.severity}): ${JSON.stringify(t.evidence)}`).join('\n')}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) throw new Error(`AI API error: ${response.status}`)

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '[]'

    // Parse JSON (handle markdown code blocks)
    const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr) as Array<{
      title: string
      problemTag: string
      rootCause: string
      action: string
      risk: string
      expectedImpact: string
      confidence: number
      category: string
      changeType?: string | null
    }>

    return parsed.map((item) => {
      // Build changeSet if applicable
      let changeSet: ChangeSet | undefined
      if (item.changeType === 'pause') {
        changeSet = createChangeSet('campaign', campaign.id, campaign.name, 'status', 'ACTIVE', 'PAUSED')
      } else if (item.changeType === 'budget_decrease_20' && campaign.dailyBudget) {
        changeSet = createChangeSet('campaign', campaign.id, campaign.name, 'budget', campaign.dailyBudget, Math.round(campaign.dailyBudget * 0.8 * 100) / 100)
      } else if (item.changeType === 'budget_decrease_30' && campaign.dailyBudget) {
        changeSet = createChangeSet('campaign', campaign.id, campaign.name, 'budget', campaign.dailyBudget, Math.round(campaign.dailyBudget * 0.7 * 100) / 100)
      } else if (item.changeType === 'budget_increase_30' && campaign.dailyBudget) {
        changeSet = createChangeSet('campaign', campaign.id, campaign.name, 'budget', campaign.dailyBudget, Math.round(campaign.dailyBudget * 1.3 * 100) / 100)
      } else if (item.changeType === 'budget_increase_50' && campaign.dailyBudget) {
        changeSet = createChangeSet('campaign', campaign.id, campaign.name, 'budget', campaign.dailyBudget, Math.round(campaign.dailyBudget * 1.5 * 100) / 100)
      }

      // Find matching evidence from problem tags
      const matchingTag = problemTags.find(t => t.id === item.problemTag)
      const evidence: MetricEvidence[] = matchingTag?.evidence || []

      return {
        id: `rec_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: item.title,
        problemTag: (item.problemTag || 'INSUFFICIENT_DATA') as ProblemTag['id'],
        evidence,
        rootCause: item.rootCause,
        action: item.action,
        risk: (['low', 'medium', 'high'].includes(item.risk) ? item.risk : 'medium') as Recommendation['risk'],
        expectedImpact: item.expectedImpact,
        confidence: Math.max(0, Math.min(1, item.confidence || 0.7)),
        category: (['AUTO_APPLY_SAFE', 'REVIEW_REQUIRED', 'TASK'].includes(item.category) ? item.category : 'TASK') as Recommendation['category'],
        changeSet,
      }
    })
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════

export async function generateRecommendations(
  campaign: OptimizationCampaign,
  problemTags: ProblemTag[],
  locale: string,
  useAI: boolean = false,
): Promise<{ recommendations: Recommendation[]; aiGenerated: boolean }> {
  if (problemTags.length === 0) {
    return { recommendations: [], aiGenerated: false }
  }

  // Try AI path only when user explicitly chose it AND API key is configured
  if (useAI && process.env.OPENAI_API_KEY) {
    try {
      const recs = await generateWithAI(campaign, problemTags, locale)
      if (recs.length > 0) {
        return { recommendations: recs, aiGenerated: true }
      }
    } catch (err) {
      console.error('[Magic Scan AI] Falling back to deterministic:', err)
    }
  }

  // Deterministic fallback
  const recs = generateFallback(campaign, problemTags, locale)
  return { recommendations: recs, aiGenerated: false }
}
