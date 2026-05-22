/* Optimizasyon sorun etiketleri → kullanıcı dostu Türkçe.
   UI'da ham enum (LOW_ROAS, SINGLE_ADSET_RISK …) ASLA gösterilmez —
   proje "UI Dil / Terminoloji Kuralı" gereği her zaman sade Türkçe etiket. */

import type { ProblemTagId } from '@/lib/meta/optimization/types'

const PROBLEM_LABELS: Record<ProblemTagId, string> = {
  NO_DELIVERY: 'Yayın yok',
  INSUFFICIENT_DATA: 'Yetersiz veri',
  HIGH_CPL: 'Yüksek müşteri adayı maliyeti',
  HIGH_CPA: 'Yüksek edinme maliyeti',
  HIGH_CPM: 'Yüksek bin gösterim maliyeti',
  HIGH_CPC: 'Yüksek tıklama maliyeti',
  LOW_CTR: 'Düşük tıklama oranı',
  LOW_ROAS: 'Düşük getiri',
  NEGATIVE_ROAS: 'Zarar ediyor',
  HIGH_FREQUENCY: 'Yüksek gösterim sıklığı',
  CRITICAL_FREQUENCY: 'Kritik gösterim sıklığı',
  QUALITY_BELOW_AVERAGE: 'Reklam kalitesi düşük',
  ENGAGEMENT_BELOW_AVERAGE: 'Etkileşim düşük',
  CONVERSION_BELOW_AVERAGE: 'Dönüşüm oranı düşük',
  LPV_DROP: 'Açılış sayfası kaybı yüksek',
  FUNNEL_BOTTLENECK: 'Hunide darboğaz',
  BUDGET_UNDERUTILIZED: 'Bütçe yetersiz kullanılıyor',
  ADSET_IMBALANCE: 'Grup dengesizliği',
  SINGLE_ADSET_RISK: 'Tek grup riski',
}

/** Sorun etiketi id'sini kullanıcı dostu Türkçe metne çevirir. Ham enum dönmez. */
export function problemLabel(id: ProblemTagId | string): string {
  return PROBLEM_LABELS[id as ProblemTagId] ?? 'Performans sinyali'
}
