// i18n TR/EN leaf-key parite + JSON geçerlilik kontrolü.
// Her i18n modülü sonrası çalıştır: tr.json ve en.json'un leaf key SETLERİ
// birebir eşit olmalı (eksik anahtar = locale değişiminde MISSING_MESSAGE).
// Kullanım: node scripts/i18n-parity.mjs
import { readFileSync } from 'node:fs'

function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, out)
    else out.add(path) // leaf (string veya array)
  }
  return out
}

let tr, en
try {
  tr = JSON.parse(readFileSync(new URL('../locales/tr.json', import.meta.url), 'utf8'))
} catch (e) { console.error('❌ tr.json GEÇERSİZ JSON:', e.message); process.exit(1) }
try {
  en = JSON.parse(readFileSync(new URL('../locales/en.json', import.meta.url), 'utf8'))
} catch (e) { console.error('❌ en.json GEÇERSİZ JSON:', e.message); process.exit(1) }

const trKeys = flatten(tr)
const enKeys = flatten(en)
const inTrNotEn = [...trKeys].filter(k => !enKeys.has(k)).sort()
const inEnNotTr = [...enKeys].filter(k => !trKeys.has(k)).sort()

console.log(`tr.json leaf: ${trKeys.size} | en.json leaf: ${enKeys.size}`)
if (inTrNotEn.length === 0 && inEnNotTr.length === 0) {
  console.log('✅ PARİTE TAM — tr/en leaf key setleri birebir eşit.')
  process.exit(0)
}
if (inTrNotEn.length) {
  console.log(`\n🔴 TR'de var EN'de YOK (${inTrNotEn.length}):`)
  inTrNotEn.slice(0, 40).forEach(k => console.log('  ' + k))
  if (inTrNotEn.length > 40) console.log(`  … +${inTrNotEn.length - 40}`)
}
if (inEnNotTr.length) {
  console.log(`\n🔴 EN'de var TR'de YOK (${inEnNotTr.length}):`)
  inEnNotTr.slice(0, 40).forEach(k => console.log('  ' + k))
  if (inEnNotTr.length > 40) console.log(`  … +${inEnNotTr.length - 40}`)
}
process.exit(1)
