// keyMap birleştirici: [{path, tr, en}] listesini tr.json + en.json'a güvenli
// yazar. Mevcut key'i FARKLI değerle ezmez (uyarır). Kullanım:
//   node scripts/i18n-merge.mjs /tmp/keymap.json
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const mapPath = process.argv[2]
if (!mapPath) { console.error('Kullanım: node scripts/i18n-merge.mjs <keymap.json>'); process.exit(1) }

const entries = JSON.parse(readFileSync(mapPath, 'utf8'))
const tr = JSON.parse(readFileSync(join(ROOT, 'locales/tr.json'), 'utf8'))
const en = JSON.parse(readFileSync(join(ROOT, 'locales/en.json'), 'utf8'))

function getNode(obj, parts) {
  let cur = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p]
    else return { exists: false }
  }
  return { exists: true, value: cur }
}
function setNested(obj, path, value) {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (typeof cur[p] !== 'object' || cur[p] === null || Array.isArray(cur[p])) {
      if (p in cur && typeof cur[p] !== 'object') return { conflict: `ara düğüm string: ${parts.slice(0, i + 1).join('.')}` }
      cur[p] = cur[p] || {}
    }
    cur = cur[p]
  }
  cur[parts[parts.length - 1]] = value
  return { ok: true }
}

let added = 0, skipSame = 0, conflicts = []
for (const e of entries) {
  if (!e || !e.path) continue
  const parts = e.path.split('.')
  const exTr = getNode(tr, parts)
  if (exTr.exists) {
    if (exTr.value !== e.tr) conflicts.push(`${e.path}: TR mevcut "${String(exTr.value).slice(0,40)}" ≠ yeni "${String(e.tr).slice(0,40)}" (ATLANDI)`)
    else skipSame++
    continue
  }
  const r1 = setNested(tr, e.path, e.tr)
  const r2 = setNested(en, e.path, e.en)
  if (r1.conflict || r2.conflict) { conflicts.push(`${e.path}: ${r1.conflict || r2.conflict}`); continue }
  added++
}

writeFileSync(join(ROOT, 'locales/tr.json'), JSON.stringify(tr, null, 2) + '\n')
writeFileSync(join(ROOT, 'locales/en.json'), JSON.stringify(en, null, 2) + '\n')

console.log(`Eklenen yeni key: ${added} | zaten aynı: ${skipSame} | çakışma (atlandı): ${conflicts.length}`)
if (conflicts.length) { console.log('\n⚠️ ÇAKIŞMALAR (elle kontrol):'); conflicts.slice(0, 30).forEach(c => console.log('  ' + c)) }
