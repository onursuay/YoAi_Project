/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Page Resolver (v1)

   Kritik: Mevcut create-ad route'u pages[0].id alıyordu (sessiz bug).
   Bu resolver şu öncelik sırasını uygular:

   1) inherited   — Kaynak kampanyadaki ad'lerden çıkarılan page_id
   2) explicit    — Çağırıcı (UI / orchestrator) açıkça page_id verdiyse
   3) single      — Hesabın tek bir page'i varsa, onu kullan ama işaretle
   4) ambiguous   — Birden fazla page var → kullanıcıya sor (AMBIGUOUS_PAGE)
   5) missing     — Hiç page yok → preflight hata döndürür

   Hiçbir koşulda "ilk page'i al ve devam et" yapmaz.
   ────────────────────────────────────────────────────────── */

export type PageSelectionSource =
  | 'inherited_from_source'
  | 'explicit'
  | 'single_available'
  | 'ambiguous'
  | 'missing'

export interface PageOption {
  id: string
  name: string
}

export interface PageSelectionResult {
  source: PageSelectionSource
  pageId: string | null
  /** ambiguous/missing durumlarında kullanıcıya sunulacak seçenekler */
  options?: PageOption[]
  /** kullanıcıya gösterilecek mesaj */
  message?: string
}

export interface ResolvePageInput {
  /** Mevcut sayfa listesi (capabilities'den) */
  availablePages: PageOption[]
  /** Kaynak kampanyanın reklamlarından çıkarılan page_id (varsa) */
  inheritedPageId?: string | null
  /** UI'dan gelen explicit seçim */
  explicitPageId?: string | null
}

export function resolvePage(input: ResolvePageInput): PageSelectionResult {
  const { availablePages, inheritedPageId, explicitPageId } = input

  if (!availablePages || availablePages.length === 0) {
    return {
      source: 'missing',
      pageId: null,
      options: [],
      message:
        'Meta hesabında bağlı Facebook sayfası bulunamadı. Önce bir sayfa bağlayın.',
    }
  }

  // 1) Explicit seçim (UI'dan geldi) — en güçlü sinyal
  if (explicitPageId) {
    const match = availablePages.find((p) => p.id === explicitPageId)
    if (match) {
      return {
        source: 'explicit',
        pageId: match.id,
        message: `Sayfa seçildi: ${match.name}`,
      }
    }
    // Explicit verildi ama listede yok — düşüp diğer kurallara geç
  }

  // 2) Kaynak kampanyadan miras
  if (inheritedPageId) {
    const match = availablePages.find((p) => p.id === inheritedPageId)
    if (match) {
      return {
        source: 'inherited_from_source',
        pageId: match.id,
        message: `Sayfa kaynak kampanyadan alındı: ${match.name}`,
      }
    }
    // Miras page artık erişilemez (bağlantısı kaldırılmış olabilir) — devam
  }

  // 3) Tek page varsa onu kullan ama bildir
  if (availablePages.length === 1) {
    const only = availablePages[0]
    return {
      source: 'single_available',
      pageId: only.id,
      message: `Hesapta tek sayfa mevcut: ${only.name}. Otomatik seçildi.`,
    }
  }

  // 4) Birden fazla page — kullanıcıya sor
  return {
    source: 'ambiguous',
    pageId: null,
    options: availablePages,
    message:
      'Birden fazla Facebook sayfası bulundu. Hangi sayfayı kullanacağınızı seçin.',
  }
}
