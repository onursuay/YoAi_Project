function pickRotatingCategory(categories, recentTitles) {
  const cats = categories.map((c) => c.trim()).filter(Boolean)
  if (!cats.length) return null
  const lowered = recentTitles.map((t) => t.toLowerCase())
  let best = cats[0], bestCount = Infinity
  for (const cat of cats) {
    const c = cat.toLowerCase()
    const count = lowered.filter((t) => t.includes(c)).length
    if (count < bestCount) { bestCount = count; best = cat }
  }
  return best
}
const cats = ['Koltuk Yıkama', 'Halı Yıkama', 'Klima Servisi']
let pass = true
if (pickRotatingCategory(cats, []) !== 'Koltuk Yıkama') { console.error('FAIL: empty'); pass = false }
const recent = ['Koltuk Yıkama nasıl yapılır', 'Koltuk Yıkama fiyatları', 'Halı Yıkama rehberi']
if (pickRotatingCategory(cats, recent) !== 'Klima Servisi') { console.error('FAIL: rotation'); pass = false }
if (pickRotatingCategory([], recent) !== null) { console.error('FAIL: null'); pass = false }
console.log(pass ? '✅ pickRotatingCategory PASS' : '❌ FAIL')
process.exit(pass ? 0 : 1)
