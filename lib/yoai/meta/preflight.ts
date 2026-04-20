/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Meta Preflight (v1)

   Create zincirinden ÖNCE tüm zorunlu asset'leri kontrol eder.
   Eksik asset varsa create başlatılmaz; kullanıcıya net sebep döner.

   Input: hedef objective + destination + UI/inherit ipuçları
   Output: ok | requires_selection | missing_assets | unsupported
   ────────────────────────────────────────────────────────── */

import {
  getCapability,
  type RequiredAsset,
  type CapabilityEntry,
} from './capabilityMatrix'
import {
  resolvePage,
  type PageOption,
  type PageSelectionResult,
} from './pageResolver'

export type PreflightStatus =
  | 'ok'
  | 'requires_selection'
  | 'missing_assets'
  | 'unsupported'

export interface PreflightAssetsSnapshot {
  pages: PageOption[]
  pixels: Array<{ id: string; name: string }>
  leadForms: Array<{ id: string; name: string; page_id: string }>
  /** Kullanıcının Pixel ID seçimi (UI'dan) */
}

export interface PreflightInput {
  objective: string
  destination: string

  /** capabilities'ten */
  assets: PreflightAssetsSnapshot

  /** UI/AI seçimleri */
  explicitPageId?: string | null
  pixelId?: string | null
  conversionEvent?: string | null
  websiteUrl?: string | null
  leadFormId?: string | null
  /** Kreatif hazır mı? UI bunu hazırladıktan sonra true geçer */
  creativeReady?: boolean

  /** Kaynak kampanyadan miras ipuçları */
  inheritedPageId?: string | null
}

export interface MissingAssetDetail {
  asset: RequiredAsset
  reason: string
}

export interface PreflightResult {
  status: PreflightStatus
  objective: string
  destination: string
  capability: CapabilityEntry
  /** Hangi page seçildi / seçilmesi gerekiyor */
  pageSelection: PageSelectionResult
  /** Eksik asset'ler (missing_assets status'ünde dolu) */
  missing: MissingAssetDetail[]
  /** Doğrulanmış, orchestrator'a geçirilecek değerler */
  resolved: {
    pageId: string | null
    pixelId: string | null
    conversionEvent: string | null
    websiteUrl: string | null
    leadFormId: string | null
    preferredOptimizationGoal: string | null
  }
  /** Kullanıcıya gösterilecek mesaj */
  message: string
}

export function runPreflight(input: PreflightInput): PreflightResult {
  const capability = getCapability(input.objective, input.destination)

  // 1) Kapsam kontrolü — en başta
  if (!capability.supported) {
    return {
      status: 'unsupported',
      objective: input.objective,
      destination: input.destination,
      capability,
      pageSelection: { source: 'missing', pageId: null },
      missing: [],
      resolved: emptyResolved(capability),
      message:
        capability.unsupportedReason ||
        'Bu kombinasyon v1 kapsamında desteklenmiyor.',
    }
  }

  // 2) Page resolution — her supported akış page ister
  const pageSelection = resolvePage({
    availablePages: input.assets.pages,
    inheritedPageId: input.inheritedPageId,
    explicitPageId: input.explicitPageId,
  })

  // 3) Ambiguous page → kullanıcı seçmeli
  if (pageSelection.source === 'ambiguous') {
    return {
      status: 'requires_selection',
      objective: input.objective,
      destination: input.destination,
      capability,
      pageSelection,
      missing: [],
      resolved: { ...emptyResolved(capability), pageId: null },
      message: pageSelection.message || 'Sayfa seçimi gerekli.',
    }
  }

  // 4) Asset bazında eksik kontrolü
  const missing: MissingAssetDetail[] = []
  const required = capability.requiredAssets

  for (const asset of required) {
    switch (asset) {
      case 'page': {
        if (!pageSelection.pageId) {
          missing.push({
            asset: 'page',
            reason:
              pageSelection.source === 'missing'
                ? 'Hesapta bağlı Facebook sayfası yok.'
                : 'Sayfa çözümlenemedi.',
          })
        }
        break
      }
      case 'pixel': {
        const availablePixels = input.assets.pixels
        if (!input.pixelId && availablePixels.length === 0) {
          missing.push({
            asset: 'pixel',
            reason: 'Meta Pixel bulunamadı; dönüşüm akışı için pixel zorunlu.',
          })
        } else if (!input.pixelId && availablePixels.length > 0) {
          missing.push({
            asset: 'pixel',
            reason: 'Pixel mevcut ama seçilmedi. Lütfen bir pixel seçin.',
          })
        }
        break
      }
      case 'conversion_event': {
        if (!input.conversionEvent) {
          missing.push({
            asset: 'conversion_event',
            reason:
              'Dönüşüm olayı (ör. Purchase, Lead) seçilmedi. Pixel üzerinde aktif bir event gerekli.',
          })
        }
        break
      }
      case 'website_url': {
        if (!input.websiteUrl || !isValidUrl(input.websiteUrl)) {
          missing.push({
            asset: 'website_url',
            reason: 'Geçerli bir web sitesi URL\'si (https://...) zorunludur.',
          })
        }
        break
      }
      case 'lead_form': {
        const pageId = pageSelection.pageId
        const availableForms = pageId
          ? input.assets.leadForms.filter((f) => f.page_id === pageId)
          : input.assets.leadForms
        if (!input.leadFormId && availableForms.length === 0) {
          missing.push({
            asset: 'lead_form',
            reason:
              'Seçili sayfada Instant Form (Lead Form) bulunamadı. Önce Meta\'da form oluşturun.',
          })
        } else if (!input.leadFormId && availableForms.length > 0) {
          missing.push({
            asset: 'lead_form',
            reason: 'Instant Form mevcut ama seçilmedi. Lütfen bir form seçin.',
          })
        } else if (input.leadFormId && pageId) {
          const formBelongs = input.assets.leadForms.some(
            (f) => f.id === input.leadFormId && f.page_id === pageId,
          )
          if (!formBelongs) {
            missing.push({
              asset: 'lead_form',
              reason:
                'Seçili Instant Form, seçili sayfaya ait değil. Form/sayfa eşleşmesini kontrol edin.',
            })
          }
        }
        break
      }
      case 'creative': {
        if (!input.creativeReady) {
          missing.push({
            asset: 'creative',
            reason:
              'Reklam kreatifi (görsel/video + metin) hazır değil. Önce kreatifi tamamlayın.',
          })
        }
        break
      }
      case 'phone_number':
      case 'instagram_account': {
        // v1'de bu asset'leri zorunlu kılan kombinasyon yok (CALL/IG_DIRECT unsupported).
        // Edge olarak bırakıyoruz; ileride eklenirse burada kontrol edilir.
        break
      }
    }
  }

  const resolved = {
    pageId: pageSelection.pageId,
    pixelId: input.pixelId ?? null,
    conversionEvent: input.conversionEvent ?? null,
    websiteUrl: input.websiteUrl ?? null,
    leadFormId: input.leadFormId ?? null,
    preferredOptimizationGoal: capability.preferredOptimizationGoal ?? null,
  }

  if (missing.length > 0) {
    return {
      status: 'missing_assets',
      objective: input.objective,
      destination: input.destination,
      capability,
      pageSelection,
      missing,
      resolved,
      message: buildMissingMessage(missing),
    }
  }

  return {
    status: 'ok',
    objective: input.objective,
    destination: input.destination,
    capability,
    pageSelection,
    missing: [],
    resolved,
    message:
      pageSelection.message ||
      'Preflight başarılı. Create zinciri başlatılabilir.',
  }
}

/* ── helpers ── */

function emptyResolved(capability: CapabilityEntry) {
  return {
    pageId: null,
    pixelId: null,
    conversionEvent: null,
    websiteUrl: null,
    leadFormId: null,
    preferredOptimizationGoal: capability.preferredOptimizationGoal ?? null,
  }
}

function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function buildMissingMessage(missing: MissingAssetDetail[]): string {
  const lines = missing.map((m) => `• ${m.reason}`)
  return `Eksik varlıklar nedeniyle taslak oluşturulamaz:\n${lines.join('\n')}`
}
