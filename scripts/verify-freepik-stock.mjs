#!/usr/bin/env node
/**
 * Freepik/Magnific Stock Content API doğrulaması.
 * .env.local'dan FREEPIK_API_KEY (+ ops. FREEPIK_API_BASE) okur, gerçek bir arama yapar.
 * Anahtar eklendikten sonra: npm run verify:freepik
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = process.cwd()
try {
  const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {}

const key = process.env.FREEPIK_API_KEY
const base = process.env.FREEPIK_API_BASE || 'https://api.freepik.com'
const headerName = base.includes('magnific') ? 'x-magnific-api-key' : 'x-freepik-api-key'

if (!key) {
  console.log('\n⚠️  FREEPIK_API_KEY .env.local\'da yok. Anahtarı ekleyince tekrar çalıştır.\n')
  process.exit(0)
}

const term = process.argv[2] || 'modern dental clinic interior'
const url =
  `${base}/v1/resources?term=${encodeURIComponent(term)}&limit=3` +
  `&order=relevance&filters[content_type][photo]=1&filters[orientation][landscape]=1`

console.log(`\n🔎  ${headerName} → ${base}/v1/resources`)
console.log(`    arama: "${term}"\n`)

try {
  const res = await fetch(url, { headers: { [headerName]: key, 'Accept-Language': 'en-US' } })
  if (!res.ok) {
    console.error(`❌  HTTP ${res.status} — ${(await res.text()).slice(0, 300)}\n`)
    process.exit(1)
  }
  const data = await res.json()
  const items = Array.isArray(data?.data) ? data.data : []
  const photos = items.filter((r) => r?.image?.type === 'photo' && r?.image?.source?.url)
  console.log(`✓  ${items.length} sonuç, ${photos.length} fotoğraf`)
  for (const p of photos) {
    console.log(`   - ${p.image.source.size}  ${p.image.source.url}`)
  }
  console.log(photos.length ? '\n✓  Entegrasyon çalışıyor — siteler bu görselleri kullanacak.\n' : '\n⚠️  Fotoğraf dönmedi (filtre/plan kontrol et).\n')
} catch (e) {
  console.error('❌ ', e.message, '\n')
  process.exit(1)
}
