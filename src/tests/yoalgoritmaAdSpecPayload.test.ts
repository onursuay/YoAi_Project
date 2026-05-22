/**
 * YoAlgoritma — Ad Spec Payload (A5) Tests + Örnek Çıktı Raporu
 *
 * Çalıştırma:
 *   npx tsx src/tests/yoalgoritmaAdSpecPayload.test.ts
 *
 * validateAdSpecPayload — Claude payload çıktısının AdSpecPayload'a
 * toleranslı normalize edildiğini; eksik/bozuk ad_spec'in optimization'a
 * düştüğünü; geçerli spec'in korunduğunu doğrular. Canlı scan
 * yapılamadığından (Anthropic key boş + DB ölü) 3 temsili ad_spec
 * raporda gösterilir.
 */

import assert from 'assert'
import { validateAdSpecPayload } from '../../lib/yoai/ai/adSpecPayload'
import type { AdSpecPayload } from '../../lib/yoai/ai/types'

let passed = 0
let failed = 0
const pending: Array<() => Promise<void>> = []

function test(name: string, fn: () => void | Promise<void>): void {
  pending.push(async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
      passed++
    } catch (e) {
      console.error(`  ✗ ${name}`)
      console.error(`    ${e instanceof Error ? e.message : e}`)
      failed++
    }
  })
}

function validNewAdProposal(): unknown {
  return {
    kind: 'new_ad_proposal',
    ad_spec: {
      platform: 'meta',
      campaign_type: 'Leads',
      conversion_goal: 'Telefon araması',
      cta: 'Send Message',
      budget: { daily: 250, currency: 'TRY' },
      targeting: {
        locations: ['Ankara', 'Türkiye'],
        demographics: { age_min: 18, age_max: 50, genders: ['male'] },
        placements: ['Advantage+ Placements'],
      },
      creative: {
        brief: 'Mevzuat zorunluluğu vurgulu, güven veren MYK belgesi mesajı.',
        headlines: ['MYK Belgeni Hızlı Al', 'Mevzuata Uygun Belgelendirme'],
        descriptions: ['Uzman danışmanlık, resmi süreç.'],
        asset_requirements: { format: 'image', dimensions: '1080x1080' },
      },
      compliance_notes: ['Garanti vaadi yok'],
    },
  }
}

test('Geçerli new_ad_proposal korunuyor', () => {
  const p = validateAdSpecPayload(validNewAdProposal())
  assert.strictEqual(p.kind, 'new_ad_proposal')
  assert.ok(p.ad_spec, 'ad_spec olmalı')
  assert.strictEqual(p.ad_spec!.platform, 'meta')
  assert.strictEqual(p.ad_spec!.campaign_type, 'Leads')
  assert.strictEqual(p.ad_spec!.budget.currency, 'TRY')
  assert.deepStrictEqual(p.ad_spec!.targeting.demographics!.genders, ['male'])
  assert.strictEqual(p.ad_spec!.creative.headlines.length, 2)
})

test('headlines boş → ad_spec geçersiz, optimization fallback', () => {
  const raw = validNewAdProposal() as any
  raw.ad_spec.creative.headlines = []
  const p = validateAdSpecPayload(raw)
  assert.strictEqual(p.kind, 'optimization')
  assert.strictEqual(p.ad_spec, null)
})

test('platform geçersiz → optimization fallback', () => {
  const raw = validNewAdProposal() as any
  raw.ad_spec.platform = 'tiktok'
  const p = validateAdSpecPayload(raw)
  assert.strictEqual(p.kind, 'optimization')
  assert.strictEqual(p.ad_spec, null)
})

test('asset format geçersiz → optimization fallback', () => {
  const raw = validNewAdProposal() as any
  raw.ad_spec.creative.asset_requirements.format = 'gif'
  const p = validateAdSpecPayload(raw)
  assert.strictEqual(p.kind, 'optimization')
})

test('Sadece optimization action payload korunuyor', () => {
  const p = validateAdSpecPayload({
    kind: 'optimization',
    action: { type: 'pause_campaign', target_id: 'c123', current_metric: { name: 'ROAS', value: 0.8, benchmark: 3 } },
  })
  assert.strictEqual(p.kind, 'optimization')
  assert.ok(p.action, 'action korunmalı')
  assert.strictEqual(p.action!.type, 'pause_campaign')
  assert.strictEqual(p.action!.current_metric!.benchmark, 3)
})

test('Boş / çöp payload → { kind: optimization }', () => {
  assert.strictEqual(validateAdSpecPayload(undefined).kind, 'optimization')
  assert.strictEqual(validateAdSpecPayload({}).kind, 'optimization')
  assert.strictEqual(validateAdSpecPayload('garbage').kind, 'optimization')
  assert.strictEqual(validateAdSpecPayload(null).kind, 'optimization')
})

test('new_ad_proposal + action birlikte: ikisi de korunur', () => {
  const raw = validNewAdProposal() as any
  raw.action = { type: 'refresh_creative', target_id: 'ad99' }
  const p = validateAdSpecPayload(raw)
  assert.strictEqual(p.kind, 'new_ad_proposal')
  assert.ok(p.ad_spec)
  assert.strictEqual(p.action!.type, 'refresh_creative')
})

test('genders eksikse default ["all"]', () => {
  const raw = validNewAdProposal() as any
  delete raw.ad_spec.targeting.demographics.genders
  const p = validateAdSpecPayload(raw)
  assert.deepStrictEqual(p.ad_spec!.targeting.demographics!.genders, ['all'])
})

test('Google Arama Ağı: asset_requirements + demographics olmadan GEÇERLİ', () => {
  const raw: unknown = {
    kind: 'new_ad_proposal',
    ad_spec: {
      platform: 'google', campaign_type: 'Arama Ağı', conversion_goal: 'Potansiyel müşteri', cta: 'Teklif Al',
      budget: { daily: 300, currency: 'TRY' },
      targeting: { locations: ['Ankara'], placements: ['Google Arama Ağı'], keywords: ['myk belgesi', 'belgelendirme'] },
      creative: {
        brief: 'Aktif niyetli aramalara MYK belgesi cevabı.',
        headlines: ['MYK Belgesi Ankara', 'Hızlı Belgelendirme'],
        descriptions: ['Resmi süreç, uzman danışmanlık.'],
      },
    },
  }
  const p = validateAdSpecPayload(raw)
  assert.strictEqual(p.kind, 'new_ad_proposal')
  assert.ok(p.ad_spec, 'Google Search ad_spec geçerli olmalı')
  assert.strictEqual(p.ad_spec!.creative.asset_requirements, undefined)
  assert.strictEqual(p.ad_spec!.targeting.demographics, undefined)
  assert.deepStrictEqual(p.ad_spec!.targeting.keywords, ['myk belgesi', 'belgelendirme'])
})

test('Meta: asset_requirements eksikse hâlâ optimization fallback', () => {
  const raw = validNewAdProposal() as any
  delete raw.ad_spec.creative.asset_requirements
  const p = validateAdSpecPayload(raw)
  assert.strictEqual(p.kind, 'optimization')
  assert.strictEqual(p.ad_spec, null)
})

test('Meta: demographics eksikse hâlâ optimization fallback', () => {
  const raw = validNewAdProposal() as any
  delete raw.ad_spec.targeting.demographics
  const p = validateAdSpecPayload(raw)
  assert.strictEqual(p.kind, 'optimization')
  assert.strictEqual(p.ad_spec, null)
})

/* ── Örnek çıktı raporu (3 temsili ad_spec) ── */

function exampleSpecs(): AdSpecPayload[] {
  // Google Arama Ağı (RSA) — metin tabanlı: görsel asset YOK, anahtar kelimeyle
  // hedefleme. asset_requirements/demographics bilerek atlanır.
  const search: unknown = {
    kind: 'new_ad_proposal',
    ad_spec: {
      platform: 'google', campaign_type: 'Arama Ağı', conversion_goal: 'Potansiyel müşteri (form)', cta: 'Teklif Al',
      budget: { daily: 300, currency: 'TRY' },
      targeting: { locations: ['Ankara'], placements: ['Google Arama Ağı'], keywords: ['myk belgesi', 'mesleki yeterlilik belgesi', 'belgelendirme ankara'] },
      creative: {
        brief: 'Aktif niyetli aramalara MYK belgesi cevabı; QS için landing uyumu vurgulu.',
        headlines: ['MYK Belgesi Ankara', 'Mesleki Yeterlilik Belgesi', 'Hızlı Belgelendirme'],
        descriptions: ['Resmi süreç, uzman danışmanlık.', 'Tehlikeli işler için zorunlu belge.'],
      },
      compliance_notes: ['RSA başlık 30 karakter altında', 'Garanti vaadi yok'],
    },
  }
  const pmax: unknown = {
    kind: 'new_ad_proposal',
    ad_spec: {
      platform: 'google', campaign_type: 'Performance Max', conversion_goal: 'Qualified lead', cta: 'Kayıt Ol',
      budget: { daily: 400, currency: 'TRY' },
      targeting: { locations: ['Türkiye'], demographics: { age_min: 18, age_max: 50, genders: ['male'] }, placements: ['Tüm Google envanteri'] },
      creative: {
        brief: 'Kurumsal toplu belgelendirme açısı; asset group iş güvenliği temalı.',
        headlines: ['Kurumsal MYK Belgelendirme', 'Toplu Belge Çözümü'],
        descriptions: ['İşletmeler için uyum paketi.'],
        asset_requirements: { format: 'image', dimensions: '1200x628' },
      },
      compliance_notes: ['Feed/asset kalitesi şart'],
    },
  }
  const meta: unknown = {
    kind: 'new_ad_proposal',
    ad_spec: {
      platform: 'meta', campaign_type: 'Leads', conversion_goal: 'Telefon araması', cta: 'Call Now',
      budget: { daily: 250, currency: 'TRY' },
      targeting: { locations: ['Ankara', 'Türkiye'], demographics: { age_min: 25, age_max: 50, genders: ['male'] }, placements: ['Advantage+ Placements'] },
      creative: {
        brief: 'Aciliyet + mevzuat zorunluluğu; ilk satırda fayda.',
        headlines: ['Belgeni Bugün Al', 'MYK Belgesi Fırsatı'],
        descriptions: ['Hızlı, resmi, güvenilir.'],
        primary_text: 'Tehlikeli işte belgesiz çalışmak ceza riski taşır. MYK belgeni uzman ekiple hızlıca al.',
        asset_requirements: { format: 'video', duration_seconds: 15, notes: '9:16 Reels' },
      },
      compliance_notes: ['Yasaklı iddia yok', 'İlk 125 karakter teklif odaklı'],
    },
  }
  return [search, pmax, meta].map(validateAdSpecPayload)
}

async function runAll(): Promise<void> {
  console.log('\nYoAlgoritma Ad Spec Payload (A5) testleri:\n')
  for (const t of pending) await t()
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)

  const specs = exampleSpecs()
  console.log(`\n${'─'.repeat(64)}`)
  console.log('A5 ÖRNEK AD SPEC ÇIKTILARI (3 adet — şema doğrulamasından geçti)')
  console.log('─'.repeat(64))
  specs.forEach((s, i) => {
    const a = s.ad_spec!
    console.log(`\n[${i + 1}] kind=${s.kind} · ${a.platform} · ${a.campaign_type}`)
    console.log(`    hedef: ${a.conversion_goal} · CTA: ${a.cta} · bütçe: ${a.budget.daily} ${a.budget.currency}/gün`)
    const hedefleme = a.targeting.demographics
      ? `yaş: ${a.targeting.demographics.age_min}-${a.targeting.demographics.age_max} · cinsiyet: ${a.targeting.demographics.genders.join('/')}`
      : `anahtar kelime: ${(a.targeting.keywords ?? []).join(', ')}`
    console.log(`    lokasyon: ${a.targeting.locations.join(', ')} · ${hedefleme}`)
    console.log(`    başlıklar: ${a.creative.headlines.join(' | ')}`)
    const asset = a.creative.asset_requirements
      ? `${a.creative.asset_requirements.format}${a.creative.asset_requirements.dimensions ? ' ' + a.creative.asset_requirements.dimensions : ''}`
      : 'metin (RSA — görsel yok)'
    console.log(`    asset: ${asset}`)
    console.log(`    uyum: ${a.compliance_notes.join('; ')}`)
  })
  console.log('─'.repeat(64))
  console.log('NOT: Bunlar şema/parser doğrulaması için temsili örnek. Gerçek üretim')
  console.log('Claude scan çıktısından gelecek (canlı scan env nedeniyle bu oturumda çalıştırılamadı).')

  if (failed > 0) process.exit(1)
}

runAll()
