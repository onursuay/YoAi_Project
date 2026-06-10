/* ──────────────────────────────────────────────────────────
   YoAi — İkna Edici Reklam Metni Kalite Rehberi (Alt-Proje A)

   "Uzman reklamcı" metin/CTA ilkeleri TEK kaynak. Hem Strateji
   (expertPlan) hem YoAlgoritma (perCampaignPrompt) bu rehberi
   kullanır → "A kalitesi" iki yerde birebir aynıdır (DRY).
   ────────────────────────────────────────────────────────── */

export const COPY_QUALITY_GUIDE = [
  '# İKNA EDİCİ REKLAM METNİ KALİTE İLKELERİ (uzman seviye)',
  'Reklam metinleri sonuç getirmeli; sıradan/jenerik metin YAZMA. Şu ilkelere uy:',
  '- HOOK: İlk satır dikkat çeksin — çarpıcı fayda, net soru veya somut sorun. Zayıf/genel açılış yok.',
  '- FAYDA ODAKLI: Özellik değil, kullanıcının kazanacağı SONUCU yaz ("X özelliği" değil, "X ile şunu kazanırsın").',
  '- NET CTA: Eylem fiili açık, kampanya amacına uygun ("Hemen Satın Al", "Ücretsiz Dene", "Randevu Al"). Belirsiz CTA yok.',
  '- ÇOKLU VARYANT: 3-5 farklı tonda metin üret (rasyonel/fayda, duygusal, sosyal kanıt, aciliyet/fırsat). Tek tip tekrar yok.',
  '- SOMUTLUK: Varsa gerçek rakam/teklif/garanti kullan; ASLA uydurma rakam veya kanıtlanamaz iddia yazma.',
  '- MARKA SESİ: Verilen marka tonuna/diline uygun yaz; tutarlı ol.',
  '- SADE TÜRKÇE: Kullanıcıya gösterilecek; ham teknik enum/İngilizce terim KULLANMA, doğru Türkçe imla.',
  '- LİMİTLER: Platform karakter limitlerine uy (Google başlık ≤30, açıklama ≤90; Meta metinleri kısa-vurucu).',
].join('\n')

export type SystemBlock = { type: 'text'; text: string; cache_control: { type: 'ephemeral' } }

/** perCampaignPrompt / systemPrompt'a eklenebilen ephemeral-cache'li blok. */
export function copyQualityBlock(): SystemBlock {
  return { type: 'text', text: COPY_QUALITY_GUIDE, cache_control: { type: 'ephemeral' } }
}

/** YoAlgoritma ad_spec üretiminde uzman metin rehberi açık mı (default-off). */
export function isExpertCopyEnabledForYoAlgoritma(): boolean {
  return process.env.YOALGORITHM_EXPERT_COPY_ENABLED === 'true'
}
