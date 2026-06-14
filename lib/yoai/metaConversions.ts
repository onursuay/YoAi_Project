/* ──────────────────────────────────────────────────────────
   Meta dönüşüm sayımı — çift-sayım korumalı, geniş kapsam.

   Meta `actions` dizisinde aynı dönüşüm hem birleşik (örn. 'purchase')
   hem piksel-özel (örn. 'offsite_conversion.fb_pixel_purchase') olarak
   gelebilir → bunları TOPLAMAK çift-sayımdır. Bu helper her "aile" içinde
   birleşik değeri tercih eder (?? ile), aileler arası standart event'leri
   toplar. Böylece mesajlaşma/kayıt/abonelik/iletişim de sayılır ama
   tek dönüşüm iki kez sayılmaz.
   ────────────────────────────────────────────────────────── */

/** Bir dönüşüm ailesi için birleşik değeri tercih et (ilk dolu olanı al — toplama yok). */
function pick(actions: Record<string, number>, keys: string[]): number {
  for (const k of keys) {
    const v = actions[k]
    if (typeof v === 'number' && v > 0) return v
  }
  return 0
}

/**
 * Toplam dönüşüm (standart event aileleri). Her aile içinde dedup, aileler arası toplam.
 * Mesajlaşma/Potansiyel Müşteri/Satış/Kayıt/Abonelik/İletişim hedeflerini kapsar.
 */
export function countMetaConversions(actions: Record<string, number> | undefined | null): number {
  if (!actions) return 0
  const purchase = pick(actions, ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'])
  const lead = pick(actions, ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped'])
  const registration = pick(actions, ['complete_registration', 'offsite_conversion.fb_pixel_complete_registration'])
  const subscribe = pick(actions, ['subscribe', 'offsite_conversion.fb_pixel_subscribe'])
  const contact = pick(actions, ['contact', 'offsite_conversion.fb_pixel_contact'])
  const application = pick(actions, ['submit_application'])
  const messaging = pick(actions, [
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.total_messaging_connection',
  ])
  return purchase + lead + registration + subscribe + contact + application + messaging
}
