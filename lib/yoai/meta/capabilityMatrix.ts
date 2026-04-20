/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Meta Capability Matrix (v1)

   Tek doğruluk kaynağı: YoAlgoritma v1'de hangi
   objective × destination kombinasyonlarının create edilmesine
   izin veriliyor? Hangileri açıkça desteklenmiyor?

   Not: Bu dosya YoAlgoritma'nın KENDİ kapsam sınırıdır.
   Meta API'nin neyi desteklediği ayrıdır (lib/meta/spec/objectiveSpec.ts).
   Burada biz "v1'de güvenle orchestrate edebileceğimiz"
   alt kümeyi tanımlıyoruz.
   ────────────────────────────────────────────────────────── */

export type MetaObjective =
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_APP_PROMOTION'

export type MetaDestination =
  | 'WEBSITE'
  | 'ON_AD'
  | 'ON_PAGE'
  | 'MESSENGER'
  | 'INSTAGRAM_DIRECT'
  | 'WHATSAPP'
  | 'CALL'
  | 'APP'

export type RequiredAsset =
  | 'page'
  | 'pixel'
  | 'conversion_event'
  | 'website_url'
  | 'lead_form'
  | 'creative'
  | 'phone_number'
  | 'instagram_account'

export interface CapabilityEntry {
  supported: boolean
  /** Desteklenmeyen kombinasyonlar için kullanıcıya net sebep */
  unsupportedReason?: string
  /** Bu kombinasyonu kurmak için gereken asset listesi */
  requiredAssets: RequiredAsset[]
  /** Varsayılan optimization goal (objectiveSpec'teki default'u override etmek için değil, UI/öneri için) */
  preferredOptimizationGoal?: string
  /** Kısa açıklama — UI'da gösterilebilir */
  note?: string
}

const UNSUPPORTED_V1 = (reason: string): CapabilityEntry => ({
  supported: false,
  unsupportedReason: reason,
  requiredAssets: [],
})

/* ── Matris: objective → destination → CapabilityEntry ── */

export const META_CAPABILITY_MATRIX: Record<
  MetaObjective,
  Partial<Record<MetaDestination, CapabilityEntry>>
> = {
  /* ═══ TRAFFIC ═══ */
  OUTCOME_TRAFFIC: {
    WEBSITE: {
      supported: true,
      requiredAssets: ['page', 'website_url', 'creative'],
      preferredOptimizationGoal: 'LANDING_PAGE_VIEWS',
      note: 'Website trafiği; LPV daha kaliteli (sayfa gerçekten yüklenenleri sayar).',
    },
    MESSENGER: UNSUPPORTED_V1(
      'Messenger trafiği v1 kapsamında değil; dış asset bağlantısı gerektirir.',
    ),
    INSTAGRAM_DIRECT: UNSUPPORTED_V1(
      'Instagram Direct v1 kapsamında değil; sonraki sürümde eklenecek.',
    ),
    WHATSAPP: UNSUPPORTED_V1(
      'WhatsApp trafiği v1 kapsamında değil; WABA/numara bağlantısı gerektirir.',
    ),
    CALL: UNSUPPORTED_V1('Arama (Call) hedefi v1 kapsamında değil.'),
    APP: UNSUPPORTED_V1('App trafiği v1 kapsamında değil (App Promotion gerekir).'),
  },

  /* ═══ AWARENESS ═══ */
  OUTCOME_AWARENESS: {
    WEBSITE: {
      supported: true,
      requiredAssets: ['page', 'creative'],
      preferredOptimizationGoal: 'REACH',
      note: 'Bilinirlik; page + kreatif yeterli, pixel/event gerekmez.',
    },
  },

  /* ═══ ENGAGEMENT ═══ */
  OUTCOME_ENGAGEMENT: {
    ON_PAGE: {
      supported: true,
      requiredAssets: ['page', 'creative'],
      preferredOptimizationGoal: 'POST_ENGAGEMENT',
      note: 'Sayfa/post etkileşimi; page + kreatif ile çalışır.',
    },
    WEBSITE: {
      supported: true,
      requiredAssets: ['page', 'website_url', 'creative'],
      preferredOptimizationGoal: 'LINK_CLICKS',
      note: 'Website üzerinden etkileşim; destination_type Meta API\'ye gönderilmez.',
    },
    MESSENGER: UNSUPPORTED_V1('Messenger etkileşim v1 kapsamında değil.'),
    INSTAGRAM_DIRECT: UNSUPPORTED_V1('Instagram Direct v1 kapsamında değil.'),
    WHATSAPP: UNSUPPORTED_V1('WhatsApp etkileşim v1 kapsamında değil.'),
    CALL: UNSUPPORTED_V1('Call etkileşim v1 kapsamında değil.'),
  },

  /* ═══ LEADS ═══ */
  OUTCOME_LEADS: {
    ON_AD: {
      supported: true,
      requiredAssets: ['page', 'lead_form', 'creative'],
      preferredOptimizationGoal: 'LEAD_GENERATION',
      note: 'Instant Form (Meta içinde form). En güvenli leads akışı.',
    },
    WEBSITE: {
      supported: true,
      requiredAssets: ['page', 'website_url', 'pixel', 'conversion_event', 'creative'],
      preferredOptimizationGoal: 'OFFSITE_CONVERSIONS',
      note: 'Website lead formu; pixel + Lead event zorunlu.',
    },
    MESSENGER: UNSUPPORTED_V1(
      'Messenger leads v1 kapsamında değil; dış asset bağımlılığı yüksek.',
    ),
    WHATSAPP: UNSUPPORTED_V1(
      'WhatsApp leads v1 kapsamında değil; WABA/numara bağlantısı gerektirir.',
    ),
    CALL: UNSUPPORTED_V1('Call leads v1 kapsamında değil.'),
  },

  /* ═══ SALES ═══ */
  OUTCOME_SALES: {
    WEBSITE: {
      supported: true,
      requiredAssets: ['page', 'website_url', 'pixel', 'conversion_event', 'creative'],
      preferredOptimizationGoal: 'OFFSITE_CONVERSIONS',
      note: 'Website dönüşüm; pixel + Purchase/doğru event zorunlu. 4 asset tam olmalı.',
    },
    // Catalog Sales ayrı bir Meta sub-tipi; product_set_id gerektirir.
    // Mevcut /api/meta/ads/create bunu desteklemiyor → explicit UNSUPPORTED.
  },

  /* ═══ APP PROMOTION ═══ */
  OUTCOME_APP_PROMOTION: {
    APP: UNSUPPORTED_V1(
      'App Promotion v1 kapsamında değil; iOS/Android app asset entegrasyonu gerektirir.',
    ),
  },
}

/* ── Public API ── */

export function getCapability(
  objective: string,
  destination: string,
): CapabilityEntry {
  const obj = META_CAPABILITY_MATRIX[objective as MetaObjective]
  if (!obj) {
    return {
      supported: false,
      unsupportedReason: `Objective "${objective}" v1 kapsamında tanımlı değil.`,
      requiredAssets: [],
    }
  }
  const entry = obj[destination as MetaDestination]
  if (!entry) {
    return {
      supported: false,
      unsupportedReason: `"${objective}" + "${destination}" kombinasyonu v1 kapsamında değil.`,
      requiredAssets: [],
    }
  }
  return entry
}

export function isSupported(objective: string, destination: string): boolean {
  return getCapability(objective, destination).supported
}

/** Tüm desteklenen kombinasyonları liste olarak döner — UI için */
export function listSupportedCombinations(): Array<{
  objective: MetaObjective
  destination: MetaDestination
  entry: CapabilityEntry
}> {
  const out: Array<{
    objective: MetaObjective
    destination: MetaDestination
    entry: CapabilityEntry
  }> = []
  for (const obj of Object.keys(META_CAPABILITY_MATRIX) as MetaObjective[]) {
    const destMap = META_CAPABILITY_MATRIX[obj]!
    for (const dest of Object.keys(destMap) as MetaDestination[]) {
      const e = destMap[dest]!
      if (e.supported) out.push({ objective: obj, destination: dest, entry: e })
    }
  }
  return out
}
