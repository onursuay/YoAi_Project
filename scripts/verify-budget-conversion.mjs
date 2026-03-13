/**
 * Meta budget conversion regression verification.
 * Run: node scripts/verify-budget-conversion.mjs
 * Verifies: 1 TRY->100, 44 TRY->4400, 111 TRY->11100
 */
const ZERO_DECIMAL = new Set(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF'])
function factor(c) { return ZERO_DECIMAL.has((c||'').toUpperCase()) ? 1 : 100 }
function toMinor(amount, currency) { return Math.round(amount * factor(currency)).toString() }

const cases = [
  [1, 'TRY', '100'],
  [44, 'TRY', '4400'],
  [111, 'TRY', '11100'],
  [1.5, 'TRY', '150'],
  [1, 'JPY', '1'],
  [111, 'JPY', '111'],
]

let failed = 0
for (const [amount, currency, expected] of cases) {
  const got = toMinor(amount, currency)
  const ok = got === expected
  if (!ok) {
    console.error(`FAIL: ${amount} ${currency} -> expected ${expected}, got ${got}`)
    failed++
  } else {
    console.log(`OK: ${amount} ${currency} -> ${got}`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll budget conversion assertions passed.')
