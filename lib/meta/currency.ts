/**
 * Meta Ads API: bütçe ve teklif tutarları hesap biriminde (minor unit) gönderilir.
 * Çoğu para birimi 2 ondalıklı (factor 100); sıfır ondalıklı para birimleri factor 1.
 * @see https://developers.facebook.com/docs/marketing-api/currencies/
 *
 * Tek merkezi kaynak — tüm Meta payload dönüşümleri bu fonksiyonları kullanmalı.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

/**
 * Para birimi için minor unit çarpanı.
 * TRY, USD, EUR: 100. JPY, KRW: 1.
 */
export function getCurrencyMinorUnitFactor(currency: string): number {
  if (!currency || typeof currency !== 'string') return 100
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100
}

/**
 * Ana birim tutarını Meta API minor unit'e çevirir.
 * Örn: 111 TRY (main) -> 11100 (minor)
 */
export function toMetaMinorUnits(amount: number, currency: string): string {
  const factor = getCurrencyMinorUnitFactor(currency)
  return Math.round(amount * factor).toString()
}

/**
 * Meta API minor unit'i ana birime çevirir.
 * Örn: 11100 (minor) -> 111 (main) TRY
 */
export function fromMetaMinorUnits(minorAmount: number | string, currency: string): number {
  const factor = getCurrencyMinorUnitFactor(currency)
  const n = typeof minorAmount === 'string' ? parseFloat(minorAmount) : minorAmount
  return Number.isFinite(n) ? n / factor : 0
}
