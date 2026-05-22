/**
 * YoAi Feature Access Map
 *
 * Ücretli erişim gerektiren tüm YoAi alanları bu dosyada tek noktadan
 * tanımlanır. Yeni bir özellik kredi veya abonelik gerektiriyorsa burada
 * kayıt edilir; UI tarafında `AccessRequiredModal` doğrudan bu kayıttan
 * besleneceği için yeni bir modal türü yazılmaz.
 *
 * tier:
 *   - 'free'                 : ücretsiz, herhangi bir bariyer yok
 *   - 'credit_required'      : kredi bakiyesi tüketir (AI üretim aksiyonları)
 *   - 'subscription_required': aktif abonelik gerektirir (modül erişimi)
 *   - 'owner_full_access'    : sadece owner / süper admin görür
 *
 * NOT: Owner allowlist (`SUPER_ADMIN_EMAILS`) burada uygulanmaz; her
 * tier için owner otomatik full access alır. Bu yapı `useFeatureAccess`
 * hook'unda ve sunucu guard'larında uygulanır.
 */

export type AccessTier =
  | 'free'
  | 'credit_required'
  | 'subscription_required'
  | 'owner_full_access'

export interface FeatureAccessRule {
  /** Stable feature anahtarı — log/telemetry'de de kullanılır. */
  key: string
  /** Modal başlığı/açıklamasında geçen Türkçe etiket. */
  label: string
  /** Hangi erişim gerekli. */
  tier: AccessTier
  /** Kredi tier için per-aksiyon kredi maliyeti (opsiyonel). */
  creditCost?: number
  /** Modal'da gösterilecek kısa açıklama (opsiyonel — verilmezse tier'a göre default). */
  description?: string
}

export const FEATURE_ACCESS: Record<string, FeatureAccessRule> = {
  // ─── Abonelik gerektiren modüller ────────────────────────────────
  optimization: {
    key: 'optimization',
    label: 'Optimizasyon',
    tier: 'subscription_required',
    description:
      'Optimizasyon paneli ve kampanya skoru için aktif bir abonelik planına sahip olmanız gerekir.',
  },
  strategy: {
    key: 'strategy',
    label: 'Strateji',
    tier: 'subscription_required',
    description:
      'AI destekli strateji motorunu kullanmak için aktif bir abonelik planına sahip olmanız gerekir.',
  },
  yoalgoritma: {
    key: 'yoalgoritma',
    label: 'YoAlgoritma',
    tier: 'subscription_required',
    description:
      'YoAlgoritma komut merkezi ve AI önerileri için aktif bir abonelik planına sahip olmanız gerekir.',
  },
  seo: {
    key: 'seo',
    label: 'SEO',
    tier: 'subscription_required',
    description:
      'SEO analiz aracını kullanmak için aktif bir abonelik planına sahip olmanız gerekir.',
  },
  audience_ai: {
    key: 'audience_ai',
    label: 'AI Tabanlı Hedef Kitle',
    tier: 'subscription_required',
    description:
      'AI tabanlı hedef kitle üretimi için aktif bir abonelik planına sahip olmanız gerekir.',
  },
  ad_account_slot: {
    key: 'ad_account_slot',
    label: 'Reklam Hesabı',
    tier: 'subscription_required',
    description:
      'Planınızın reklam hesabı limitine ulaştınız. Daha fazla reklam hesabı eklemek için planınızı yükseltin.',
  },

  // ─── Kredi gerektiren AI aksiyonları ─────────────────────────────
  optimization_ai_scan_pro: {
    key: 'optimization_ai_scan_pro',
    label: 'AI ile Tara Pro',
    tier: 'credit_required',
    description:
      'AI ile Tara Pro derinlemesine analizi için yeterli kredi bakiyesine sahip olmanız gerekir.',
  },
  design_generation: {
    key: 'design_generation',
    label: 'Tasarım Üretimi',
    tier: 'credit_required',
    description:
      'AI tasarım üretimini çalıştırmak için yeterli kredi bakiyesine sahip olmanız gerekir.',
  },
  strategy_overage: {
    key: 'strategy_overage',
    label: 'Ek Strateji',
    tier: 'credit_required',
    description:
      'Aylık strateji limitiniz doldu. Ek strateji oluşturmak için yeterli kredi bakiyesine sahip olmanız gerekir.',
  },
  yoalgoritma_chat: {
    key: 'yoalgoritma_chat',
    label: 'YoAlgoritma Sohbet',
    tier: 'credit_required',
    description:
      'YoAlgoritma içerik üretimi için yeterli kredi bakiyesine sahip olmanız gerekir.',
  },
} as const

export type FeatureKey = keyof typeof FEATURE_ACCESS

export function getFeatureRule(key: FeatureKey | string): FeatureAccessRule | null {
  return (FEATURE_ACCESS as Record<string, FeatureAccessRule>)[key] ?? null
}

/** Kredi gerektiren mi? Owner ise hiçbir tier engellemez. */
export function requiresCredits(rule: FeatureAccessRule | null | undefined): boolean {
  return rule?.tier === 'credit_required'
}

/** Abonelik gerektiren mi? */
export function requiresSubscription(
  rule: FeatureAccessRule | null | undefined,
): boolean {
  return rule?.tier === 'subscription_required'
}
