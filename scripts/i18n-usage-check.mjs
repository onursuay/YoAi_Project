// i18n KULLANIM denetçisi: kodda çağrılan her literal t('key') anahtarının
// tr.json'da GERÇEKTEN var olduğunu doğrular. Eksikse (typo/atlanan key) raporlar.
// next-intl eksik anahtarı RUNTIME'da fırlatır; bu script onu deploy ÖNCESİ yakalar.
// Sınırlama: yalnız literal anahtarlar (değişken/şablon anahtarlar atlanır).
// Kullanım: node scripts/i18n-usage-check.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const tr = JSON.parse(readFileSync(join(ROOT, 'locales/tr.json'), 'utf8'))

function hasKey(path) {
  const parts = path.split('.')
  let cur = tr
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p]
    else return false
  }
  return true
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full)
  }
  return out
}

const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'components'))]
const missing = []
let checked = 0

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  // useTranslations('NS') / getTranslations('NS') → değişken adı
  // Desen: const X = useTranslations('NS')  |  const X = await getTranslations('NS')
  const nsMap = {} // varName -> namespace
  const hookRe = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*['"]([^'"]+)['"]\s*\)/g
  let m
  while ((m = hookRe.exec(src))) nsMap[m[1]] = m[2]
  // Namespace'siz useTranslations() → root erişim (atla, nadir)
  const vars = Object.keys(nsMap)
  if (!vars.length) continue
  for (const v of vars) {
    const callRe = new RegExp('\\b' + v.replace(/\$/g, '\\$') + '\\(\\s*([\'"])([A-Za-z0-9_.]+)\\1', 'g')
    let c
    while ((c = callRe.exec(src))) {
      checked++
      const full = nsMap[v] + '.' + c[2]
      if (!hasKey(full)) missing.push({ file: file.replace(ROOT, ''), key: full })
    }
  }
}

console.log(`Kontrol edilen literal t() çağrısı: ${checked}`)
if (!missing.length) {
  console.log('✅ Tüm literal t() anahtarları tr.json\'da mevcut.')
  process.exit(0)
}
console.log(`\n🔴 EKSİK ANAHTAR (kodda kullanılıyor, JSON\'da YOK) — ${missing.length}:`)
for (const x of missing.slice(0, 60)) console.log(`  ${x.key}   ← ${x.file}`)
if (missing.length > 60) console.log(`  … +${missing.length - 60}`)
process.exit(1)
