import * as XLSX from 'xlsx'

/**
 * CSV / Excel dosyasını kişi satırlarına çevirir (istemci tarafı).
 * Sütunları başlık anahtar kelimelerinden akıllıca algılar; başlık yoksa
 * e-posta benzeri hücreyi e-posta, rakam ağırlıklı hücreyi telefon kabul eder.
 * Türkçe başlıklar desteklenir (e-posta, ad, soyad, telefon …).
 */

export interface ParsedContact {
  email: string
  fullName?: string | null
  phone?: string | null
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function norm(s: unknown): string {
  return String(s ?? '')
    .replace(/[İIı]/g, 'i').replace(/[Şş]/g, 's').replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u').replace(/[Öö]/g, 'o').replace(/[Çç]/g, 'c')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Tırnak içi virgülü koruyan basit CSV ayrıştırıcı. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQ = false
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',' || c === ';' || c === '\t') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* atla */ }
    else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

const isEmail = (v: string) => EMAIL_RE.test(v.trim())
const isPhone = (v: string) => { const d = v.replace(/[^0-9]/g, ''); return d.length >= 7 && d.length / Math.max(v.length, 1) > 0.5 }

export async function parseContactsFile(file: File): Promise<ParsedContact[]> {
  let rows: string[][]
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || file.type.includes('csv')) {
    rows = parseCsv(await file.text())
  } else {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rows = (XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][])
      .map((r) => r.map((c) => String(c ?? '')))
      .filter((r) => r.some((c) => c.trim()))
  }
  if (!rows.length) return []

  // Başlık var mı? İlk satırda e-posta hücresi yoksa başlık kabul edilir.
  const hasHeader = !rows[0].some((c) => isEmail(c))
  const out: ParsedContact[] = []

  if (hasHeader) {
    const H = rows[0].map(norm)
    const findCol = (preds: ((h: string) => boolean)[]) => {
      for (const p of preds) { const i = H.findIndex(p); if (i >= 0) return i }
      return -1
    }
    const emailCol = findCol([(h) => h.includes('mail') || h.includes('eposta') || h.includes('e-posta')])
    const fullCol = findCol([(h) => h === 'ad soyad' || h.includes('adsoyad') || h.includes('ad_soyad') || h === 'isim soyisim' || h === 'name' || h.includes('full')])
    const firstCol = findCol([(h) => h === 'ad' || h === 'adi' || h === 'isim' || h.includes('first')])
    const lastCol = findCol([(h) => h.includes('soyad') || h.includes('last')])
    const phoneCol = findCol([(h) => h.includes('telefon') || h.includes('phone') || h.includes('gsm') || h.includes('cep')])

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      const email = (emailCol >= 0 ? r[emailCol] : r.find(isEmail) || '').trim()
      if (!isEmail(email)) continue
      let fullName: string | null = fullCol >= 0 ? (r[fullCol] || '').trim() : ''
      if (!fullName) fullName = [firstCol >= 0 ? r[firstCol] : '', lastCol >= 0 ? r[lastCol] : ''].map((s) => (s || '').trim()).filter(Boolean).join(' ')
      const phone = phoneCol >= 0 ? (r[phoneCol] || '').trim() : (r.find((c) => c !== email && isPhone(c)) || '').trim()
      out.push({ email, fullName: fullName || null, phone: phone || null })
    }
  } else {
    // Başlıksız: her satırda e-posta + (varsa) telefon + isim
    for (const r of rows) {
      const email = (r.find(isEmail) || '').trim()
      if (!isEmail(email)) continue
      const phone = (r.find((c) => c !== email && isPhone(c)) || '').trim()
      const fullName = (r.find((c) => c !== email && c !== phone && c.trim() && !isEmail(c) && !isPhone(c)) || '').trim()
      out.push({ email, fullName: fullName || null, phone: phone || null })
    }
  }

  // tekilleştir (e-posta)
  const seen = new Set<string>()
  return out.filter((c) => { const e = c.email.toLowerCase(); if (seen.has(e)) return false; seen.add(e); return true })
}
