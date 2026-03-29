/* ──────────────────────────────────────────────────────────
   Platform Knowledge Engine
   Analyzes campaign STRUCTURE (objective, destination,
   optimization goal, bidding, location, etc.) and detects
   misconfigurations based on Meta/Google best practices.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight, AdsetInsight, Platform } from './analysisTypes'

/* ── Types ── */
export interface StructuralIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: 'objective' | 'destination' | 'optimization_goal' | 'bidding' | 'targeting' | 'budget' | 'conversion'
  title: string
  description: string
  currentValue: string
  recommendedValue: string
  reasoning: string
  platform: Platform
  campaignId: string
  campaignName: string
}

export interface StructuralAnalysis {
  issues: StructuralIssue[]
  campaignStructure: CampaignStructureSummary[]
}

export interface CampaignStructureSummary {
  campaignId: string
  campaignName: string
  platform: Platform
  objective: string
  destination?: string
  optimizationGoal?: string
  biddingStrategy?: string
  channelType?: string
  dailyBudget: number | null
  adsetCount: number
  adCount: number
  avgCtr: number
  conversions: number
  spend: number
}

/* ── Meta Structural Analysis ── */
function analyzeMetaCampaign(campaign: DeepCampaignInsight): StructuralIssue[] {
  const issues: StructuralIssue[] = []
  const triple = campaign.triple
  if (!triple) return issues

  const { objective, optimizationGoal, destination } = triple
  const id = campaign.id
  const name = campaign.campaignName
  const ctr = campaign.metrics.ctr * 100
  const conversions = campaign.metrics.conversions
  const spend = campaign.metrics.spend
  const frequency = campaign.metrics.frequency ?? 0

  // ── Objective vs Performance Mismatch ──

  // Traffic campaign with high bounce (low CTR = proxy for bounce)
  if (objective === 'OUTCOME_TRAFFIC' && optimizationGoal === 'LINK_CLICKS' && ctr < 1) {
    issues.push({
      id: `meta_${id}_traffic_lpv`, severity: 'warning', category: 'optimization_goal',
      title: 'Landing Page Views tercih edilmeli',
      description: 'CTR düşük, LINK_CLICKS yerine LANDING_PAGE_VIEWS daha kaliteli trafik getirir.',
      currentValue: 'LINK_CLICKS', recommendedValue: 'LANDING_PAGE_VIEWS',
      reasoning: 'LINK_CLICKS her tıklamayı sayar ama LANDING_PAGE_VIEWS sadece sayfa yüklenenleri sayar — daha kaliteli trafik.',
      platform: 'Meta', campaignId: id, campaignName: name,
    })
  }

  // Engagement campaign used for sales
  if (objective === 'OUTCOME_ENGAGEMENT' && conversions > 0 && spend > 200) {
    issues.push({
      id: `meta_${id}_eng_to_sales`, severity: 'info', category: 'objective',
      title: 'Satış amacına geçiş değerlendirilebilir',
      description: 'Etkileşim kampanyasından dönüşüm alıyorsunuz. SALES amacı ile daha iyi optimize edebilirsiniz.',
      currentValue: 'OUTCOME_ENGAGEMENT', recommendedValue: 'OUTCOME_SALES',
      reasoning: 'Etkileşim kampanyası beğeni/yorum optimizasyonu yapar. Satış hedefiniz varsa SALES amacı dönüşüm optimizasyonu yapar.',
      platform: 'Meta', campaignId: id, campaignName: name,
    })
  }

  // ── Destination Recommendations ──

  // Lead campaign with ON_AD but could use WhatsApp
  if (objective === 'OUTCOME_LEADS' && destination === 'ON_AD') {
    issues.push({
      id: `meta_${id}_lead_whatsapp`, severity: 'info', category: 'destination',
      title: 'WhatsApp dönüşüm hedefi değerlendirilebilir',
      description: 'Lead form yerine WhatsApp kullanılabilir — Türkiye pazarında WhatsApp dönüşüm oranı genellikle daha yüksek.',
      currentValue: 'ON_AD (Lead Form)', recommendedValue: 'WHATSAPP',
      reasoning: 'Türkiye\'de WhatsApp kullanımı yaygın. Müşteriler form doldurmak yerine mesaj atma eğiliminde.',
      platform: 'Meta', campaignId: id, campaignName: name,
    })
  }

  // WhatsApp with CONVERSATIONS instead of REPLIES for leads
  if ((objective === 'OUTCOME_LEADS' || objective === 'OUTCOME_SALES') && destination === 'WHATSAPP' && optimizationGoal === 'CONVERSATIONS') {
    issues.push({
      id: `meta_${id}_wa_replies`, severity: 'warning', category: 'optimization_goal',
      title: 'REPLIES optimizasyonu tercih edilmeli',
      description: 'Lead/Sales amacında CONVERSATIONS yerine REPLIES kullanılmalı — yanıt veren kişileri hedefler.',
      currentValue: 'CONVERSATIONS', recommendedValue: 'REPLIES',
      reasoning: 'CONVERSATIONS yeni konuşma başlatır ama REPLIES yanıt veren (ilgili) kişileri optimize eder.',
      platform: 'Meta', campaignId: id, campaignName: name,
    })
  }

  // ── Budget Issues ──

  if (objective === 'OUTCOME_AWARENESS' && campaign.dailyBudget != null && campaign.dailyBudget < 100) {
    issues.push({
      id: `meta_${id}_budget_awareness`, severity: 'warning', category: 'budget',
      title: 'Bilinirlik kampanyası için bütçe düşük',
      description: 'AWARENESS kampanyası geniş erişim gerektirir. Günlük ₺100+ önerilir.',
      currentValue: `₺${campaign.dailyBudget.toFixed(0)}/gün`, recommendedValue: '₺200+/gün',
      reasoning: 'Düşük bütçeyle az kişiye ulaşılır, CPM yükselir. TRAFFIC amacına geçiş daha verimli olabilir.',
      platform: 'Meta', campaignId: id, campaignName: name,
    })
  }

  if (objective === 'OUTCOME_SALES' && spend > 500 && conversions < 5) {
    issues.push({
      id: `meta_${id}_sales_no_conv`, severity: 'critical', category: 'conversion',
      title: 'Yüksek harcama, düşük dönüşüm',
      description: `₺${spend.toFixed(0)} harcanmış ama sadece ${conversions} dönüşüm var. Pixel/dönüşüm takibi kontrol edilmeli.`,
      currentValue: `${conversions} dönüşüm / ₺${spend.toFixed(0)}`, recommendedValue: 'Pixel kontrolü + hedefleme daraltma',
      reasoning: 'Dönüşüm optimizasyonu için yeterli sinyal yok. Pixel doğru çalışmıyor olabilir veya hedefleme çok geniş.',
      platform: 'Meta', campaignId: id, campaignName: name,
    })
  }

  // ── Structural Issues ──

  // Single adset risk
  if (campaign.adsets.length === 1 && spend > 100) {
    issues.push({
      id: `meta_${id}_single_adset`, severity: 'info', category: 'targeting',
      title: 'Tek reklam seti ile çalışılıyor',
      description: 'A/B testi ve risk dağılımı için en az 2 reklam seti önerilir.',
      currentValue: '1 reklam seti', recommendedValue: '2-3 reklam seti',
      reasoning: 'Tek sette sorun olursa tüm kampanya durur. Farklı hedef kitlelerle test yapın.',
      platform: 'Meta', campaignId: id, campaignName: name,
    })
  }

  // Frequency too high
  if (frequency > 4) {
    issues.push({
      id: `meta_${id}_high_freq`, severity: frequency > 6 ? 'critical' : 'warning', category: 'targeting',
      title: `Frequency çok yüksek (${frequency.toFixed(1)})`,
      description: 'Aynı kişiler reklamı tekrar tekrar görüyor. Kreatif yorgunluğu ve reklam körlüğü riski var.',
      currentValue: `Frequency: ${frequency.toFixed(1)}`, recommendedValue: 'Frequency < 3',
      reasoning: 'Frequency 3\'ün üzerinde ise yeni kreatif ekleyin veya hedef kitleyi genişletin.',
      platform: 'Meta', campaignId: id, campaignName: name,
    })
  }

  return issues
}

/* ── Google Structural Analysis ── */
function analyzeGoogleCampaign(campaign: DeepCampaignInsight): StructuralIssue[] {
  const issues: StructuralIssue[] = []
  const id = campaign.id
  const name = campaign.campaignName
  const ctr = campaign.metrics.ctr * 100
  const conversions = campaign.metrics.conversions
  const spend = campaign.metrics.spend
  const bidding = campaign.biddingStrategy || ''
  const channelType = campaign.channelType || 'SEARCH'
  const optScore = campaign.optimizationScore

  // ── Bidding Strategy Mismatches ──

  // Has conversions but still using MAXIMIZE_CLICKS
  if (bidding.includes('TARGET_SPEND') || bidding.includes('MAXIMIZE_CLICKS')) {
    if (conversions >= 15) {
      issues.push({
        id: `google_${id}_bid_upgrade`, severity: 'warning', category: 'bidding',
        title: 'Dönüşüm odaklı teklif stratejisine geçin',
        description: `${conversions} dönüşümünüz var. MAXIMIZE_CLICKS yerine MAXIMIZE_CONVERSIONS kullanarak daha fazla dönüşüm alabilirsiniz.`,
        currentValue: 'Tıklamaları En Üst Düzeye Çıkarma', recommendedValue: 'Dönüşümleri En Üst Düzeye Çıkarma',
        reasoning: 'Yeterli dönüşüm verisi biriktiğinde smart bidding çok daha verimli çalışır.',
        platform: 'Google', campaignId: id, campaignName: name,
      })
    }
  }

  // Using TARGET_CPA but not enough conversions
  if (bidding.includes('TARGET_CPA') && conversions < 15) {
    issues.push({
      id: `google_${id}_bid_downgrade`, severity: 'warning', category: 'bidding',
      title: 'Hedef CPA için yeterli veri yok',
      description: 'TARGET_CPA en az 15 dönüşüm/ay gerektirir. Veri yetersiz olduğunda performans düşer.',
      currentValue: 'Hedef CPA', recommendedValue: 'Dönüşümleri En Üst Düzeye Çıkarma',
      reasoning: 'Yeterli dönüşüm verisi olmadan TARGET_CPA algoritmayı yanıltır. Önce MAXIMIZE_CONVERSIONS ile veri toplayın.',
      platform: 'Google', campaignId: id, campaignName: name,
    })
  }

  // Using TARGET_ROAS but not enough sales
  if (bidding.includes('TARGET_ROAS') && conversions < 30) {
    issues.push({
      id: `google_${id}_roas_data`, severity: 'warning', category: 'bidding',
      title: 'Hedef ROAS için yeterli veri yok',
      description: 'TARGET_ROAS en az 30 dönüşüm/ay gerektirir.',
      currentValue: 'Hedef ROAS', recommendedValue: 'Dönüşüm Değerini En Üst Düzeye Çıkarma',
      reasoning: 'Düşük veriyle ROAS hedeflemesi teslimati kısıtlar. Önce MAXIMIZE_CONVERSION_VALUE kullanın.',
      platform: 'Google', campaignId: id, campaignName: name,
    })
  }

  // ── CTR Issues ──
  if (channelType === 'SEARCH' && ctr < 2 && spend > 100) {
    issues.push({
      id: `google_${id}_low_ctr`, severity: 'warning', category: 'optimization_goal',
      title: 'Search kampanyasında CTR çok düşük',
      description: `CTR %${ctr.toFixed(1)} — Search kampanyalarında %3-5 beklenir. Reklam metinleri ve anahtar kelimeler gözden geçirilmeli.`,
      currentValue: `CTR: %${ctr.toFixed(1)}`, recommendedValue: 'CTR > %3',
      reasoning: 'Düşük CTR kalite puanını düşürür, CPC artar. Başlıkları ve anahtar kelimeleri optimize edin.',
      platform: 'Google', campaignId: id, campaignName: name,
    })
  }

  // ── Optimization Score ──
  if (optScore != null && optScore < 50) {
    issues.push({
      id: `google_${id}_opt_score`, severity: 'info', category: 'optimization_goal',
      title: `Optimizasyon puanı düşük (%${optScore.toFixed(0)})`,
      description: 'Google\'ın önerileri incelenmeli. Düşük puan potansiyel iyileştirmelerin olduğunu gösterir.',
      currentValue: `%${optScore.toFixed(0)}`, recommendedValue: '%70+',
      reasoning: 'Google\'ın sunduğu önerileri (keyword, bütçe, reklam metni) değerlendirin.',
      platform: 'Google', campaignId: id, campaignName: name,
    })
  }

  // ── Single ad group risk ──
  if (campaign.adsets.length === 1 && spend > 200) {
    issues.push({
      id: `google_${id}_single_ag`, severity: 'info', category: 'targeting',
      title: 'Tek reklam grubu ile çalışılıyor',
      description: 'Farklı anahtar kelime grupları için ayrı ad group\'lar oluşturun.',
      currentValue: '1 ad group', recommendedValue: '2-5 ad group',
      reasoning: 'Tema bazlı ad group\'lar reklam alaka düzeyini artırır, Quality Score yükselir.',
      platform: 'Google', campaignId: id, campaignName: name,
    })
  }

  // ── No conversions with high spend ──
  if (spend > 500 && conversions < 1) {
    issues.push({
      id: `google_${id}_no_conv`, severity: 'critical', category: 'conversion',
      title: 'Yüksek harcama, sıfır dönüşüm',
      description: `₺${spend.toFixed(0)} harcanmış ama dönüşüm yok. Dönüşüm takibi kontrol edilmeli.`,
      currentValue: '0 dönüşüm', recommendedValue: 'Dönüşüm eylemi tanımla ve takip et',
      reasoning: 'Ya dönüşüm takibi kurulu değil ya da hedefleme/reklam metni sorunlu. Önce tracking kontrol edin.',
      platform: 'Google', campaignId: id, campaignName: name,
    })
  }

  return issues
}

/* ── Main Entry: Analyze all campaigns structurally ── */
export function runStructuralAnalysis(campaigns: DeepCampaignInsight[]): StructuralAnalysis {
  const issues: StructuralIssue[] = []
  const campaignStructure: CampaignStructureSummary[] = []

  for (const campaign of campaigns) {
    // Build structure summary
    const totalAds = campaign.adsets.reduce((s, as) => s + as.ads.length, 0)
    campaignStructure.push({
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      platform: campaign.platform,
      objective: campaign.objective,
      destination: campaign.triple?.destination,
      optimizationGoal: campaign.triple?.optimizationGoal,
      biddingStrategy: campaign.biddingStrategy,
      channelType: campaign.channelType,
      dailyBudget: campaign.dailyBudget,
      adsetCount: campaign.adsets.length,
      adCount: totalAds,
      avgCtr: campaign.metrics.ctr * 100,
      conversions: campaign.metrics.conversions,
      spend: campaign.metrics.spend,
    })

    // Run platform-specific analysis
    if (campaign.platform === 'Meta') {
      issues.push(...analyzeMetaCampaign(campaign))
    } else if (campaign.platform === 'Google') {
      issues.push(...analyzeGoogleCampaign(campaign))
    }
  }

  // Sort: critical first
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return { issues, campaignStructure }
}
