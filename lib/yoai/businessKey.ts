/* ──────────────────────────────────────────────────────────
   YoAi — İşletme Anahtarı (business_key) — Faz 1 (çoklu işletme)

   Bir işletmenin KALICI anahtarı, kayıtlı reklam hesabı kimliğine
   dayanır (isim bazlı businessGroups.id'den FARKLI — o isim eşleştirmeyle
   üretilir ve değişebilir; bu anahtar account_id'ye sabitlenir).

   Konvansiyon:
     • Meta hesabı varsa → `meta:<normalizedMetaId>`
     • yoksa Google varsa → `google:<normalizedGoogleId>`
   Normalize, business-scope route'taki ile AYNI (act_ ve - soyma) →
   yazarken ve ararken tutarlı eşleşme.

   SAF modül (next/headers / supabase yok) → store, inngest ve route
   tarafından serbestçe import edilebilir.
   ────────────────────────────────────────────────────────── */

/** Meta hesap id'sinden `act_` ön ekini soyar (act_123 → 123). */
export const normalizeMetaAccountId = (v: string | null | undefined): string | null => {
  const s = v?.trim()
  return s ? s.replace(/^act_/, '') : null
}

/** Google müşteri id'sinden tireleri soyar (123-456-7890 → 1234567890). */
export const normalizeGoogleCustomerId = (v: string | null | undefined): string | null => {
  const s = v?.trim()
  return s ? s.replace(/-/g, '') : null
}

/**
 * İşletme anahtarını üretir. Meta öncelikli; yoksa Google.
 * İkisi de boşsa null (anahtarsız = legacy/global profil).
 */
export function buildBusinessKey(
  metaAccountId?: string | null,
  googleCustomerId?: string | null,
): string | null {
  const meta = normalizeMetaAccountId(metaAccountId)
  if (meta) return `meta:${meta}`
  const google = normalizeGoogleCustomerId(googleCustomerId)
  if (google) return `google:${google}`
  return null
}
