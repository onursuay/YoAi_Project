/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Meta Diagnosis (v1)

   Çok değişkenli teşhis matrisi.
   Amaç: Tek-değişkenli "CTR düşük → kreatif" çıkarımı yerine,
   birkaç metriği birlikte okuyup hangi kök nedenin baskın olduğunu
   belirlemek.

   Ürettiği rootCause'lar decision.ts tarafından aksiyona çevrilir.

   NOT: Bu modül hiçbir kaynağı değiştirmez. Sadece insight alır,
   structured bir teşhis çıktısı verir.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight } from '../analysisTypes'

/* ── Benchmark eşikleri (v1 — konservatif, Meta genel) ──
   Bu değerler sektör ortalaması değildir; "güvenli baseline"dır.
   Yanlış teşhis riskini azaltmak için eşikler geniş tutulmuştur.
*/
export const BENCHMARKS = {
  ctr: { low: 0.8, high: 2.0 }, // yüzde
  cpm: { low: 30, high: 120 }, // TRY
  frequency: { fatigueWarn: 3, fatigueCritical: 5 },
  spendNoConversionHigh: 500, // TRY, dönüşümsüz harcama eşiği
  lpvToClickRatio: { healthyMin: 0.6 }, // LPV / click — 0.6 altı = landing sorunu sinyali
  cpaInflationVsCpc: 50, // cpa / cpc > 50 → event/landing problemi göstergesi
} as const

/* ── Types ── */

export type RootCauseId =
  | 'hook_problem' // kreatif giriş/başlık zayıf — tıklatıyor ama değil
  | 'landing_page_problem' // tıklatıyor ama LP zayıf
  | 'creative_fatigue' // frequency yüksek, CTR düşüyor
  | 'audience_mismatch' // CPM normal, CTR çok düşük, LP ok
  | 'event_quality_problem' // dönüşüm event'i bozuk/az tetiklenen
  | 'insufficient_data' // veri yok ya da spend düşük
  | 'budget_starvation' // bütçe çok düşük, öğrenme fazına giremiyor
  | 'wrong_optimization_goal' // objective vs goal uyumsuz
  | 'pixel_misfire' // dönüşüm yok, spend var — pixel/event sorunu güçlü
  | 'healthy' // teşhis: sistem iyi çalışıyor

export interface RootCause {
  id: RootCauseId
  confidence: 'low' | 'medium' | 'high'
  evidence: string[] // hangi metrikler bu teşhisi destekliyor
  summary: string // TR kısa açıklama
}

export interface DiagnosisResult {
  campaignId: string
  campaignName: string
  objective: string
  /** Teşhisler — confidence'a göre sıralı (yüksekten düşüğe) */
  rootCauses: RootCause[]
  /** En baskın teşhis (rootCauses[0] veya healthy) */
  primary: RootCause
  /** Debug için — kullanılan metrik değerleri */
  snapshot: {
    ctr: number
    cpm: number
    cpc: number
    frequency: number
    spend: number
    conversions: number
    impressions: number
    clicks: number
    adCount: number
    hasPeriodData: boolean
    ctrTrend: number | null // % change
  }
}

/* ── Main diagnose function ── */

export function diagnoseCampaign(insight: DeepCampaignInsight): DiagnosisResult {
  const m = insight.metrics
  const prev = insight.periodComparison
  const ctrTrend = prev?.changes.ctr ?? null

  // LPV metric Meta'ya özel ve metrics'te yok — insights'tan gelirse buradan erişilir.
  // v1: LPV yoksa "null" olarak bırakıp ratio kuralını atla.
  const adCount = insight.adsets.reduce((s, a) => s + (a.ads?.length ?? 0), 0)

  const snapshot = {
    ctr: m.ctr ?? 0,
    cpm: m.cpm ?? 0,
    cpc: m.cpc ?? 0,
    frequency: m.frequency ?? 0,
    spend: m.spend ?? 0,
    conversions: m.conversions ?? 0,
    impressions: m.impressions ?? 0,
    clicks: m.clicks ?? 0,
    adCount,
    hasPeriodData: !!prev,
    ctrTrend,
  }

  const causes: RootCause[] = []

  // ── Insufficient data guard ──
  if (snapshot.spend < 50 || snapshot.impressions < 1000) {
    causes.push({
      id: 'insufficient_data',
      confidence: 'high',
      evidence: [
        `spend: ${snapshot.spend.toFixed(2)} TL`,
        `impressions: ${snapshot.impressions}`,
      ],
      summary:
        'Veri yetersiz. Öğrenme fazı tamamlanmadan teşhis güvenilir değil — en az 50+ dönüşüm veya 7 gün bekleyin.',
    })
    // Insufficient data tek başına baskın teşhistir; diğerlerini eklemeyiz.
    return buildResult(insight, causes, snapshot)
  }

  // ── Budget starvation ──
  const dailyBudget = insight.dailyBudget ?? 0
  if (dailyBudget > 0 && dailyBudget < 35 && snapshot.conversions < 5) {
    causes.push({
      id: 'budget_starvation',
      confidence: 'medium',
      evidence: [`daily_budget: ${dailyBudget} TL`, `conversions: ${snapshot.conversions}`],
      summary:
        'Günlük bütçe çok düşük; Meta öğrenme fazına giremez, optimize edemez.',
    })
  }

  // ── Pixel misfire (SALES/LEADS için) ──
  const isConversionObjective =
    insight.objective === 'OUTCOME_SALES' || insight.objective === 'OUTCOME_LEADS'
  if (
    isConversionObjective &&
    snapshot.spend >= BENCHMARKS.spendNoConversionHigh &&
    snapshot.conversions === 0 &&
    snapshot.clicks > 50
  ) {
    causes.push({
      id: 'pixel_misfire',
      confidence: 'high',
      evidence: [
        `spend: ${snapshot.spend.toFixed(2)} TL`,
        'conversions: 0',
        `clicks: ${snapshot.clicks}`,
      ],
      summary:
        'Dönüşüm hedefli kampanyada yüksek harcama + sıfır dönüşüm. Pixel/event entegrasyonu veya landing page conversion tracking bozuk olma ihtimali yüksek.',
    })
  }

  // ── Creative fatigue ──
  if (
    snapshot.frequency >= BENCHMARKS.frequency.fatigueWarn &&
    (ctrTrend !== null ? ctrTrend < -10 : true)
  ) {
    const critical = snapshot.frequency >= BENCHMARKS.frequency.fatigueCritical
    causes.push({
      id: 'creative_fatigue',
      confidence: critical ? 'high' : 'medium',
      evidence: [
        `frequency: ${snapshot.frequency.toFixed(2)}`,
        ctrTrend !== null ? `CTR trend: ${ctrTrend.toFixed(1)}%` : 'CTR trend: veri yok',
      ],
      summary:
        'Aynı kişilere çok sık gösteriliyor ve CTR düşüşte. Kreatif yorgunluğu — yeni varyantlar eklenmeli.',
    })
  }

  // ── CTR düşük çoklu-yorum ──
  const ctrLow = snapshot.ctr > 0 && snapshot.ctr < BENCHMARKS.ctr.low
  const ctrNormal = snapshot.ctr >= BENCHMARKS.ctr.low && snapshot.ctr <= BENCHMARKS.ctr.high
  const cpmNormal = snapshot.cpm >= BENCHMARKS.cpm.low && snapshot.cpm <= BENCHMARKS.cpm.high
  const cpmHigh = snapshot.cpm > BENCHMARKS.cpm.high

  if (ctrLow) {
    if (cpmHigh) {
      // CTR düşük + CPM yüksek → audience pahalı ama ilgili değil
      causes.push({
        id: 'audience_mismatch',
        confidence: 'medium',
        evidence: [`ctr: ${snapshot.ctr.toFixed(2)}%`, `cpm: ${snapshot.cpm.toFixed(2)} TL`],
        summary:
          'CTR düşük, CPM yüksek — pahalı ama ilgisiz kitleye gösteriliyor. Hedefleme revize edilmeli.',
      })
    } else if (cpmNormal || snapshot.cpm < BENCHMARKS.cpm.low) {
      // CTR düşük + CPM normal → hook/kreatif zayıf
      causes.push({
        id: 'hook_problem',
        confidence: 'medium',
        evidence: [`ctr: ${snapshot.ctr.toFixed(2)}%`, `cpm: ${snapshot.cpm.toFixed(2)} TL`],
        summary:
          'Gösterim ucuz ama tıklama düşük — kreatif başlık/hook zayıf. İlk 3 saniye ve görsel revize edilmeli.',
      })
    }
  }

  // ── Landing page problem: CTR ok ama CPA şişik, clicks/conversions oranı bozuk ──
  if (
    ctrNormal &&
    snapshot.clicks > 50 &&
    isConversionObjective &&
    snapshot.conversions > 0 &&
    snapshot.cpc > 0
  ) {
    const cpa = snapshot.spend / snapshot.conversions
    const cpaToCpc = cpa / snapshot.cpc
    if (cpaToCpc > BENCHMARKS.cpaInflationVsCpc) {
      causes.push({
        id: 'landing_page_problem',
        confidence: 'medium',
        evidence: [
          `ctr: ${snapshot.ctr.toFixed(2)}%`,
          `cpc: ${snapshot.cpc.toFixed(2)} TL`,
          `cpa: ${cpa.toFixed(2)} TL`,
          `cpa/cpc: ${cpaToCpc.toFixed(1)}x`,
        ],
        summary:
          'Tıklama iyi ama dönüşüm pahalı — landing page veya funnel ziyaretçiyi satışa çeviremiyor.',
      })
    }
  }

  // ── Wrong optimization goal (sezgi kural — objective vs kampanya yaşı) ──
  // Kural: OUTCOME_ENGAGEMENT ile satış tetikleniyorsa (dönüşüm > 0, spend yüksek) → objective yanlış seçilmiş olabilir
  if (
    insight.objective === 'OUTCOME_ENGAGEMENT' &&
    snapshot.conversions >= 3 &&
    snapshot.spend >= 200
  ) {
    causes.push({
      id: 'wrong_optimization_goal',
      confidence: 'low',
      evidence: [
        `objective: ${insight.objective}`,
        `conversions: ${snapshot.conversions}`,
        `spend: ${snapshot.spend.toFixed(2)} TL`,
      ],
      summary:
        'Etkileşim kampanyasında satış gerçekleşiyor; SALES objective ile dönüşüm optimizasyonu daha iyi sonuç verebilir.',
    })
  }

  // ── Healthy (default) ──
  if (causes.length === 0) {
    causes.push({
      id: 'healthy',
      confidence: 'medium',
      evidence: [
        `ctr: ${snapshot.ctr.toFixed(2)}%`,
        `cpm: ${snapshot.cpm.toFixed(2)} TL`,
        `frequency: ${snapshot.frequency.toFixed(2)}`,
      ],
      summary:
        'Belirgin bir kök neden tespit edilmedi. Mevcut yapıyı izlemeye devam edin.',
    })
  }

  return buildResult(insight, causes, snapshot)
}

/* ── helpers ── */

function buildResult(
  insight: DeepCampaignInsight,
  causes: RootCause[],
  snapshot: DiagnosisResult['snapshot'],
): DiagnosisResult {
  const sorted = [...causes].sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence))
  return {
    campaignId: insight.id,
    campaignName: insight.campaignName,
    objective: insight.objective,
    rootCauses: sorted,
    primary: sorted[0],
    snapshot,
  }
}

function confidenceRank(c: 'low' | 'medium' | 'high'): number {
  return c === 'high' ? 3 : c === 'medium' ? 2 : 1
}

/* ── Batch helper ── */

export function diagnoseCampaigns(campaigns: DeepCampaignInsight[]): DiagnosisResult[] {
  return campaigns
    .filter((c) => c.platform === 'Meta')
    .map(diagnoseCampaign)
}
