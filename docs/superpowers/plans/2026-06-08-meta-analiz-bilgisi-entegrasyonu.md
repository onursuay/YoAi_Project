# Meta Ads Analiz Bilgisi Entegrasyonu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `meta-ads-analyzer` reposunun Meta Ads analiz bilgisini (Breakdown Effect, learning phase, auction, pacing, ad relevance) tek Türkçe küratörlü dokümana damıtıp 4 AI motoruna (YoAlgoritma, Optimizasyon, Strateji, sohbet-kreatif) Meta-only enjekte etmek.

**Architecture:** Tek yeni dosya `lib/yoai/ai/docs/meta_analysis_knowledge.ts` iki sabit export eder: `META_ANALYSIS_KNOWLEDGE` (tam teşhis dokümanı, 3 analiz motoru için) + `META_CREATIVE_PRINCIPLES` (kreatif alt-küme, sohbet için) + `metaAnalysisBlock()` (cached system block helper). Her motor yalnız Meta yolunda bu bilgiyi prompt'una ekler; Meta/Google API, fetch, change-set, publish katmanlarına dokunulmaz — yalnız prompt string'leri / system block dizileri zenginleşir.

**Tech Stack:** TypeScript, Next.js, Anthropic SDK (cached system blocks, `cache_control: ephemeral`). Testler: Node `assert` + projedeki mini-runner, `npx tsx src/tests/<x>.test.ts` ile çalışır (jest/vitest YOK).

---

## File Structure

**Yeni dosyalar:**
- `lib/yoai/ai/docs/meta_analysis_knowledge.ts` — Damıtılmış Türkçe bilgi (iki export + helper). Tek sorumluluk: bilgi içeriği + cached block sarmalayıcı.
- `src/tests/metaAnalysisKnowledge.test.ts` — Tüm enjeksiyon noktalarını + içerik kontratını doğrulayan tek test dosyası (görevler boyunca büyür).

**Değişen dosyalar (yalnız prompt/sistem-blok katmanı):**
- `lib/yoai/ai/perCampaignPrompt.ts` — `buildPerCampaignSystemBlocks` (Meta-only block ekler)
- `lib/yoai/ai/perAdPrompt.ts` — `buildPerAdSystemBlocks` (Meta-only block ekler)
- `lib/yoai/ai/systemPrompt.ts` — `buildSystemBlocks` (Meta-only block ekler)
- `lib/meta/optimization/aiRecommender.ts` — systemPrompt'u pure `buildOptimizationSystemPrompt()`'a çıkarır + bilgi ekler (Meta-only modül)
- `lib/strategy/ai-generator.ts` — `buildStrategySystemPrompt(channels)` ekler; Meta kanalı seçiliyse bilgi ekler
- `lib/yoai/prompts.ts` — `buildGenerationPrompt` kreatif kategorilerde `META_CREATIVE_PRINCIPLES` ekler
- `docs/CHANGELOG.md` — giriş

**Dokunulmaz:** `lib/meta/*` ve `lib/google/*` veri/fetch/normalize/change-set/**publish**, çıktı JSON şemaları, `locales/tr.json`/`en.json`, UI bileşenleri.

---

## Task 1: Bilgi dokümanını oluştur (`meta_analysis_knowledge.ts`)

**Files:**
- Create: `lib/yoai/ai/docs/meta_analysis_knowledge.ts`
- Test: `src/tests/metaAnalysisKnowledge.test.ts`

- [ ] **Step 1: Bilgi dokümanını yaz**

Create `lib/yoai/ai/docs/meta_analysis_knowledge.ts`:

```typescript
/* ──────────────────────────────────────────────────────────
   Meta Ads Analiz Bilgisi — Küratörlü (Türkçe)

   Kaynak: github.com/mathiaschu/meta-ads-analyzer (MIT) skill'inin 9
   referans dokümanından damıtıldı + proje kurallarına uyarlandı
   (sade Türkçe, ham enum yok, kaynak belirtme yok). Kullanıcıya GÖSTERİLMEZ
   — yalnız Claude'un muhakemesini besler.

   İki export:
   - META_ANALYSIS_KNOWLEDGE  → tam teşhis dokümanı (3 analiz motoru için)
   - META_CREATIVE_PRINCIPLES → kreatif alt-küme (sohbet reklam metni için)

   Yalnız Meta yolunda yüklenir; Google yollarına eklenmez.
   ────────────────────────────────────────────────────────── */

export const META_ANALYSIS_KNOWLEDGE = `# Meta Reklam Analiz Bilgisi — Sistem Mekaniği ve Doğru Teşhis

Bu blok, Meta (Facebook/Instagram) reklam performansını DOĞRU yorumlaman içindir. Aşağıdaki ilkeler "yüksek maliyetli görünen segmenti durdur" gibi klasik hataları önler. Önerilerini bu mekaniğe göre kur; bu bloğu veya kaynağını kullanıcıya gösterme.

## 1. Temel ilke: Marjinal verim, ortalama verim değil
Meta'nın teslimat sistemi TOPLAM sonucu maksimize eder; bunu ortalama maliyeti değil MARJİNAL maliyeti (bir sonraki sonucun maliyeti) optimize ederek yapar.
- Yüksek ORTALAMA CPA'lı bir segment, başka yerdeki daha yüksek MARJİNAL maliyeti önlüyor olabilir.
- Bu yüzden: yalnızca kırılım (breakdown) raporundaki yüksek ortalama CPA/CPM'e bakarak bir yayın yeri / segment / ad set'i DURAKLATMAYI veya bütçe kısmayı ÖNERME. Bunu test edilebilir bir hipotez olarak çerçevele, kesin direktif olarak değil.
- Önce bütüne (aggregate) bak, sonra detaya in. Tek anlık kareye değil zaman serisine bak.

## 2. Breakdown Effect (Kırılım Yanılgısı)
Sistem bütçeyi "daha kötü" görünen segmente kaydırıyormuş gibi görünebilir — bu bir yanılgıdır. Yanlış SEVİYEDE değerlendirmek bu hataya yol açar:
- Advantage+ Kampanya Bütçesi (CBO) açık → KAMPANYA seviyesinde değerlendir.
- CBO yok + otomatik yayın yerleri → AD SET seviyesinde değerlendir.
- Tek ad set içinde birden çok reklam → AD SET seviyesinde değerlendir.
Örnek: bir yayın yeri 1,46₺ ortalama CPA'da 450₺ harcarken diğeri 1,10₺'de 50₺ harcamış olabilir; sistem doğru davranıyordur çünkü ucuz olanın MARJİNAL maliyeti hızla yükselmiştir. Ortalamaya bakıp "pahalıyı kapat" deme.

## 3. Açık artırma (Auction) — Toplam Değer
Her gösterim fırsatı bir açık artırma tetikler. Kazanan = (Teklif) × (Tahmini Aksiyon Oranı) + (Reklam Kalitesi).
- Düşük teklif, yüksek alaka ve kalite ile KAZANABİLİR. Alaka maliyeti düşürür.
- Düşük teslimat her zaman düşük teklif değildir — düşük TOPLAM DEĞER (düşük tahmini aksiyon oranı veya kalite) olabilir.
- Yüksek CPA'nın kökeni çoğu zaman teklif değil; düşük kalite/alaka veya kitle-kreatif uyumsuzluğudur. Kreatif kalitesini iyileştirmek teklifi artırmaktan çoğu zaman daha etkilidir.

## 4. Öğrenme Fazı (Learning Phase)
Yeni veya önemli ölçüde düzenlenmiş ad set öğrenme fazına girer.
- ~50 optimizasyon olayı / 7 gün ile çıkılır (Shops reklamları istisnası: 17 site + 5 Meta satın alma). Bu sürede CPA dalgalı ve genelde yüksektir; sonuçlar uzun vadeyi temsil etmez.
- Önemli düzenleme (bütçe, teklif, hedefleme, kreatif, optimizasyon hedefi) öğrenmeyi SIFIRLAR → tekrar ~50 olay gerekir.
- "Learning Limited" (Sınırlı Öğrenme): ad set öğrenmeyi tamamlayacak kadar sonuç alamıyor.
- Teşhis kuralı: ad set öğrenmedeyse bulguları geçici/ön bulgu olarak şerh düş; öğrenme sırasında kesin yargı verme; gereksiz düzenleme önerme; öğrenmeyi çok sayıda ad set'e bölme.

## 5. Açık artırma kesişimi (Auction Overlap)
Kendi ad set'lerin örtüşen kitlelere sahipse aynı açık artırmaya girer; Meta yalnız en yüksek değerli olanı seçer (kendinle yarışmazsın), diğerleri elenir.
- Etki: bazı ad set'ler bütçesini harcayamaz, öğrenmeyi tamamlayamaz; ölçeklerken performans öngörülemez olur.
- Çözüm: benzer ad set'leri BİRLEŞTİR (öğrenmeyi toplar, daha hızlı kararlı sonuç) veya örtüşen (genelde learning limited / en az sonuçlu) olanı KAPAT, bütçeyi aktife taşı.

## 6. Pacing (bütçe/teklif yayma)
- Bütçe pacing bütçeyi süreye yayar; teklif pacing maliyet hedefini korurken teklifi ayarlar.
- Sistem pahalı dönemde bütçeyi bilinçli TUTABİLİR (sonra daha ucuz fırsatlar için). Bu yüzden günlük harcama dalgalanır.
- Teşhis kuralı: maliyet verimliliğini günlük kareye göre değil KAMPANYA GENELİ pencereye göre değerlendir.

## 7. Performans dalgalanmaları — normal vs. endişe verici
- Normal: gün-içi CPA %20-30 oynama; hafta sonu/içi farkı; haftalara yayılan kademeli değişim; öğrenme dönemi oynamaları.
- Endişe verici: ani+sürekli >%50 maliyet artışı (birkaç gün); teslimatın sıfıra düşmesi; harcama artarken dönüşümün düşmesi; değişiklik olmadan performans bozulması.
- Yaygın nedenler: öğrenme fazı; kitle doygunluğu (yüksek sıklık → kitleyi genişlet/kreatif yenile); açık artırma rekabeti; mevsimsellik; kreatif yorgunluğu (düzenli kreatif döndür); dış etkenler.
- Teşhis ÖNCESİ 4 kontrol: (a) ad set öğrenmede mi? (b) normal oynama bazı ne? (c) dış etken var mı? (d) örneklem yeterli mi? (kararlı ad set için genelde 7+ gün penceresi).

## 8. Reklam uygunluk tanıları (Ad Relevance Diagnostics)
Üç tanı, reklamını AYNI kitleyi hedefleyen rakiplerle kıyaslar — açık artırma GİRDİSİ DEĞİL, yalnız tanı aracıdır (500 gösterim altında gösterilmez):
- Kalite Sıralaması: algılanan kalite. Düşükse → kreatifi iyileştir, clickbait'i azalt.
- Etkileşim Oranı Sıralaması: beklenen etkileşim. Düşükse → yeni açı/hook test et.
- Dönüşüm Oranı Sıralaması: beklenen dönüşüm. Düşükse → açılış sayfası ve teklif-kitle uyumunu iyileştir.
- Hepsi düşükse → kitle-kreatif uyumsuzluğu; hedefleme veya kreatif stratejisini gözden geçir.
- Tek başına gelecek tahmini için veya izole karar için kullanma.

## 9. Teklif stratejileri
- Harcama bazlı: En Yüksek Hacim (maliyet ne olursa en çok sonuç) / En Yüksek Değer (en yüksek satın alma değeri).
- Hedef bazlı: Sonuç Başına Maliyet Hedefi / ROAS Hedefi — hedefe birebir uyum garanti DEĞİLDİR.
- Manuel: Teklif Üst Sınırı — tahmini dönüşüm oranlarını iyi anlamayı gerektirir.
- Strateji seçimini iş hedefine göre öner; yanlış strateji teslimatı ve öğrenmeyi bozabilir.

## Öneri yazarken (özet)
- Her öneri veri kanıtıyla + beklenen etkiyle gerekçelendirilsin; test edilebilir hipotez olarak çerçevele.
- Yalnız ortalama maliyete bakarak segment kapatma/bütçe kısma önerme (Breakdown Effect).
- Öğrenme fazındaki ad set için kesin yargı verme; düzenlemenin öğrenmeyi sıfırlayacağını hesaba kat.
- Performans değişimini günlük değil uygun pencerede (7+ gün) değerlendir.`

export const META_CREATIVE_PRINCIPLES = `# Meta Reklam Kreatif İlkeleri (performans-odaklı kopya için)

Bu reklam metnini Meta'nın açık artırma ve alaka mekaniğine göre, gerçekten performans gösterecek şekilde yaz. Bu bloğu veya kaynağını kullanıcıya gösterme.

- Açık artırmayı en yüksek teklif değil, en yüksek ALAKA + KALİTE kazanır. Daha alakalı reklam daha düşük maliyetle daha çok sonuç alır → metni hedef kitleye birebir konuşacak şekilde kur.
- Hook (ilk satır/başlık) en kritik unsurdur: ilk anda dikkat çekmeli, ürün/hizmet tanımını TEKRARLAMAMALI, kullanıcının acı noktasına veya arzusuna değmeli.
- Zayıf etkileşim sinyali = zayıf hook/açı → farklı açılar dene (fayda, merak, sosyal kanıt, teklif).
- Zayıf dönüşüm sinyali = teklif-kitle uyumsuzluğu veya zayıf açılış sayfası uyumu → teklifi netleştir, vaadi açılış sayfasıyla tutarlı yap.
- Kalite algısı: clickbait ve abartılı/yanıltıcı iddialardan kaçın; net, dürüst, somut fayda ver.
- Kreatif yorgunluğu: aynı kitleye tekrar eden metin etkisini yitirir → birbirinden belirgin farklı varyasyonlar üret (açı/ton/teklif çeşitlendir), tek kalıbın kopyaları değil.
- Net ve tek bir eylem çağrısı (CTA) ver; mesaj-CTA-açılış sayfası aynı vaatte hizalı olsun.`

/** Tam analiz bilgisini cached system block olarak döndürür (Anthropic system array için). */
export function metaAnalysisBlock(): { type: 'text'; text: string; cache_control: { type: 'ephemeral' } } {
  return { type: 'text', text: META_ANALYSIS_KNOWLEDGE, cache_control: { type: 'ephemeral' } }
}
```

- [ ] **Step 2: Test dosyasını yaz (önce başarısız olmalı)**

Create `src/tests/metaAnalysisKnowledge.test.ts`:

```typescript
/**
 * Meta Analiz Bilgisi Entegrasyonu — Unit Tests
 * Çalıştırma: npx tsx src/tests/metaAnalysisKnowledge.test.ts
 * Test framework gerektirmez; Node assert modülü kullanır.
 */
import assert from 'assert'
import {
  META_ANALYSIS_KNOWLEDGE,
  META_CREATIVE_PRINCIPLES,
  metaAnalysisBlock,
} from '../../lib/yoai/ai/docs/meta_analysis_knowledge'
// <<BUILDER IMPORTS — yeni import'ları BU SATIRIN ÜSTÜNE ekle>>

const FULL_MARKER = 'Meta Reklam Analiz Bilgisi'
const CREATIVE_MARKER = 'Meta Reklam Kreatif İlkeleri'

let passed = 0
let failed = 0
const queue: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  queue.push(async () => {
    try { await fn(); console.log(`  ✓  ${name}`); passed++ }
    catch (err) {
      const msg = err instanceof assert.AssertionError ? err.message : String(err)
      console.error(`  ✗  ${name}`); console.error(`     ${msg}`); failed++
    }
  })
}

// ── Task 1: içerik kontratı ──
test('META_ANALYSIS_KNOWLEDGE ana başlığı ve kilit kavramları içerir', () => {
  assert.ok(META_ANALYSIS_KNOWLEDGE.includes(FULL_MARKER), 'ana başlık yok')
  const lower = META_ANALYSIS_KNOWLEDGE.toLowerCase()
  for (const m of ['marjinal', 'breakdown', 'öğrenme faz', 'auction', 'pacing', 'uygunluk tan']) {
    assert.ok(lower.includes(m), `eksik kavram: ${m}`)
  }
})
test('META_CREATIVE_PRINCIPLES kreatif odaklı, teşhis dolgusu içermez', () => {
  assert.ok(META_CREATIVE_PRINCIPLES.includes(CREATIVE_MARKER), 'kreatif başlık yok')
  assert.ok(META_CREATIVE_PRINCIPLES.toLowerCase().includes('hook'), 'hook yok')
  assert.ok(!META_CREATIVE_PRINCIPLES.includes('Öğrenme Fazı'), 'kreatif alt-küme learning phase içermemeli')
  assert.ok(!META_CREATIVE_PRINCIPLES.includes('Pacing'), 'kreatif alt-küme pacing içermemeli')
})
test('metaAnalysisBlock() cached system block döndürür', () => {
  const b = metaAnalysisBlock()
  assert.strictEqual(b.type, 'text')
  assert.strictEqual(b.cache_control.type, 'ephemeral')
  assert.ok(b.text.includes(FULL_MARKER))
})

// <<INJECTION TESTS — yeni test()'leri BU SATIRIN ÜSTÜNE ekle>>

async function run() {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız\n`)
  if (failed > 0) process.exit(1)
}
run()
```

- [ ] **Step 3: Testi çalıştır — GEÇMELİ (doküman bu görevde oluşturuluyor)**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: `3 test: 3 geçti, 0 başarısız` (Task 1 hem dosyayı hem testi aynı anda oluşturduğu için bu görevde testler geçer; sonraki görevlerde önce-fail döngüsü uygulanır).

> Not: Bu ilk görevde doküman + içerik testi birlikte yazıldığı için "önce fail" adımı yoktur (test edilecek saf içerik sabiti). Sonraki tüm görevler gerçek TDD döngüsü (önce fail) uygular.

- [ ] **Step 4: Commit**

```bash
git add lib/yoai/ai/docs/meta_analysis_knowledge.ts src/tests/metaAnalysisKnowledge.test.ts
git commit -m "feat(yoai): Meta Ads analiz bilgisi küratörlü dokümanı + içerik testleri"
```

---

## Task 2: YoAlgoritma — perCampaign enjeksiyonu (aktif ana yol)

**Files:**
- Modify: `lib/yoai/ai/perCampaignPrompt.ts:16-18` (import) ve `:162-179` (`buildPerCampaignSystemBlocks`)
- Modify: `src/tests/metaAnalysisKnowledge.test.ts` (test + import ekle)

- [ ] **Step 1: Başarısız testi ekle**

`src/tests/metaAnalysisKnowledge.test.ts` içinde `// <<BUILDER IMPORTS ...>>` satırının ÜSTÜNE ekle:

```typescript
import { buildPerCampaignSystemBlocks } from '../../lib/yoai/ai/perCampaignPrompt'
```

Aynı dosyada `// <<INJECTION TESTS ...>>` satırının ÜSTÜNE ekle:

```typescript
test('perCampaign: Meta system block bilgi içerir, Google içermez', () => {
  const meta = buildPerCampaignSystemBlocks('Meta')
  const google = buildPerCampaignSystemBlocks('Google')
  assert.ok(meta.some((b) => b.text.includes(FULL_MARKER)), 'Meta bloğunda bilgi yok')
  assert.ok(!google.some((b) => b.text.includes(FULL_MARKER)), 'Google bloğunda bilgi OLMAMALI')
})
```

- [ ] **Step 2: Testi çalıştır — FAIL beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: FAIL — "Meta bloğunda bilgi yok" (henüz enjekte edilmedi).

- [ ] **Step 3: Import ekle**

`lib/yoai/ai/perCampaignPrompt.ts` — mevcut satır 16-18:

```typescript
import { META_AD_RULES_CURATED } from './docs/meta_ad_rules_curated'
import { GOOGLE_ADS_RULES_CURATED } from './docs/google_ads_rules_curated'
import { BENCHMARKS } from './accountSerializer'
```

şununla değiştir (bir satır ekle):

```typescript
import { META_AD_RULES_CURATED } from './docs/meta_ad_rules_curated'
import { GOOGLE_ADS_RULES_CURATED } from './docs/google_ads_rules_curated'
import { metaAnalysisBlock } from './docs/meta_analysis_knowledge'
import { BENCHMARKS } from './accountSerializer'
```

- [ ] **Step 4: Meta-only block enjekte et**

`lib/yoai/ai/perCampaignPrompt.ts` `buildPerCampaignSystemBlocks` içinde — mevcut:

```typescript
  const rules = platform === 'Meta' ? META_AD_RULES_CURATED : GOOGLE_ADS_RULES_CURATED
  const blocks: Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }> = [
    { type: 'text', text: PER_CAMPAIGN_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: rules, cache_control: { type: 'ephemeral' } },
  ]
  if (businessContext) {
```

şununla değiştir:

```typescript
  const rules = platform === 'Meta' ? META_AD_RULES_CURATED : GOOGLE_ADS_RULES_CURATED
  const blocks: Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }> = [
    { type: 'text', text: PER_CAMPAIGN_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: rules, cache_control: { type: 'ephemeral' } },
  ]
  if (platform === 'Meta') {
    blocks.push(metaAnalysisBlock())
  }
  if (businessContext) {
```

- [ ] **Step 5: Testi çalıştır — PASS beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: PASS — perCampaign testi geçer (toplam 4 test geçti).

- [ ] **Step 6: Commit**

```bash
git add lib/yoai/ai/perCampaignPrompt.ts src/tests/metaAnalysisKnowledge.test.ts
git commit -m "feat(yoai): perCampaign Meta yoluna analiz bilgisi bloğu"
```

---

## Task 3: YoAlgoritma — perAd enjeksiyonu

**Files:**
- Modify: `lib/yoai/ai/perAdPrompt.ts:16-18` (import) ve `:100-104` (`buildPerAdSystemBlocks`)
- Modify: `src/tests/metaAnalysisKnowledge.test.ts`

- [ ] **Step 1: Başarısız testi ekle**

`// <<BUILDER IMPORTS ...>>` üstüne ekle:

```typescript
import { buildPerAdSystemBlocks } from '../../lib/yoai/ai/perAdPrompt'
```

`// <<INJECTION TESTS ...>>` üstüne ekle:

```typescript
test('perAd: Meta system block bilgi içerir, Google içermez', () => {
  const meta = buildPerAdSystemBlocks('Meta')
  const google = buildPerAdSystemBlocks('Google')
  assert.ok(meta.some((b) => b.text.includes(FULL_MARKER)), 'Meta bloğunda bilgi yok')
  assert.ok(!google.some((b) => b.text.includes(FULL_MARKER)), 'Google bloğunda bilgi OLMAMALI')
})
```

- [ ] **Step 2: Testi çalıştır — FAIL beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: FAIL — "Meta bloğunda bilgi yok" (perAd).

- [ ] **Step 3: Import ekle**

`lib/yoai/ai/perAdPrompt.ts` — mevcut satır 16-18:

```typescript
import { META_AD_RULES_CURATED } from './docs/meta_ad_rules_curated'
import { GOOGLE_ADS_RULES_CURATED } from './docs/google_ads_rules_curated'
import { BENCHMARKS } from './accountSerializer'
```

şununla değiştir:

```typescript
import { META_AD_RULES_CURATED } from './docs/meta_ad_rules_curated'
import { GOOGLE_ADS_RULES_CURATED } from './docs/google_ads_rules_curated'
import { metaAnalysisBlock } from './docs/meta_analysis_knowledge'
import { BENCHMARKS } from './accountSerializer'
```

- [ ] **Step 4: Meta-only block enjekte et**

`lib/yoai/ai/perAdPrompt.ts` `buildPerAdSystemBlocks` içinde — mevcut:

```typescript
  const rules = platform === 'Meta' ? META_AD_RULES_CURATED : GOOGLE_ADS_RULES_CURATED
  const blocks: Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }> = [
    { type: 'text', text: PER_AD_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: rules, cache_control: { type: 'ephemeral' } },
  ]
  if (businessContext) {
```

şununla değiştir:

```typescript
  const rules = platform === 'Meta' ? META_AD_RULES_CURATED : GOOGLE_ADS_RULES_CURATED
  const blocks: Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }> = [
    { type: 'text', text: PER_AD_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: rules, cache_control: { type: 'ephemeral' } },
  ]
  if (platform === 'Meta') {
    blocks.push(metaAnalysisBlock())
  }
  if (businessContext) {
```

- [ ] **Step 5: Testi çalıştır — PASS beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: PASS (5 test geçti).

- [ ] **Step 6: Commit**

```bash
git add lib/yoai/ai/perAdPrompt.ts src/tests/metaAnalysisKnowledge.test.ts
git commit -m "feat(yoai): perAd Meta yoluna analiz bilgisi bloğu"
```

---

## Task 4: YoAlgoritma — legacy `buildSystemBlocks` enjeksiyonu

**Files:**
- Modify: `lib/yoai/ai/systemPrompt.ts:9-10` (import) ve `:236-244` (`buildSystemBlocks`)
- Modify: `src/tests/metaAnalysisKnowledge.test.ts`

- [ ] **Step 1: Başarısız testi ekle**

`// <<BUILDER IMPORTS ...>>` üstüne ekle:

```typescript
import { buildSystemBlocks } from '../../lib/yoai/ai/systemPrompt'
```

`// <<INJECTION TESTS ...>>` üstüne ekle:

```typescript
test('legacy buildSystemBlocks: Meta bilgi içerir, Google içermez', () => {
  const meta = buildSystemBlocks('Meta')
  const google = buildSystemBlocks('Google')
  assert.ok(meta.some((b) => b.text.includes(FULL_MARKER)), 'Meta bloğunda bilgi yok')
  assert.ok(!google.some((b) => b.text.includes(FULL_MARKER)), 'Google bloğunda bilgi OLMAMALI')
})
```

- [ ] **Step 2: Testi çalıştır — FAIL beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: FAIL — "Meta bloğunda bilgi yok" (legacy buildSystemBlocks).

- [ ] **Step 3: Import ekle**

`lib/yoai/ai/systemPrompt.ts` — mevcut satır 9-10:

```typescript
import { META_AD_RULES_CURATED } from './docs/meta_ad_rules_curated'
import { GOOGLE_ADS_RULES_CURATED } from './docs/google_ads_rules_curated'
```

şununla değiştir:

```typescript
import { META_AD_RULES_CURATED } from './docs/meta_ad_rules_curated'
import { GOOGLE_ADS_RULES_CURATED } from './docs/google_ads_rules_curated'
import { metaAnalysisBlock } from './docs/meta_analysis_knowledge'
```

- [ ] **Step 4: Meta-only block enjekte et**

`lib/yoai/ai/systemPrompt.ts` `buildSystemBlocks` içinde — mevcut:

```typescript
  const rules = platform === 'Meta' ? META_AD_RULES_CURATED : GOOGLE_ADS_RULES_CURATED
  return [
    { type: 'text', text: AI_ENGINE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: rules, cache_control: { type: 'ephemeral' } },
  ]
}
```

şununla değiştir:

```typescript
  const rules = platform === 'Meta' ? META_AD_RULES_CURATED : GOOGLE_ADS_RULES_CURATED
  const blocks: Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }> = [
    { type: 'text', text: AI_ENGINE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: rules, cache_control: { type: 'ephemeral' } },
  ]
  if (platform === 'Meta') {
    blocks.push(metaAnalysisBlock())
  }
  return blocks
}
```

- [ ] **Step 5: Testi çalıştır — PASS beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: PASS (6 test geçti).

- [ ] **Step 6: Commit**

```bash
git add lib/yoai/ai/systemPrompt.ts src/tests/metaAnalysisKnowledge.test.ts
git commit -m "feat(yoai): legacy buildSystemBlocks Meta yoluna analiz bilgisi"
```

---

## Task 5: Optimizasyon (Meta) — `buildOptimizationSystemPrompt` + enjeksiyon

**Files:**
- Modify: `lib/meta/optimization/aiRecommender.ts:11` (import) ve `:327-356` (systemPrompt'u pure fonksiyona çıkar + bilgi ekle)
- Modify: `src/tests/metaAnalysisKnowledge.test.ts`

> Bu modül Meta-only'dir (platform dalı yok), dolayısıyla bilgi koşulsuz eklenir. `generateWithAI`'nin veri girişi, API çağrısı ve çıktı parsing'i DEĞİŞMEZ — yalnız systemPrompt metni pure bir fonksiyona taşınıp bilgi eklenir.

- [ ] **Step 1: Başarısız testi ekle**

`// <<BUILDER IMPORTS ...>>` üstüne ekle:

```typescript
import { buildOptimizationSystemPrompt } from '../../lib/meta/optimization/aiRecommender'
```

`// <<INJECTION TESTS ...>>` üstüne ekle:

```typescript
test('optimizasyon systemPrompt bilgi + temel rolü içerir', () => {
  const sp = buildOptimizationSystemPrompt('Turkish')
  assert.ok(sp.includes(FULL_MARKER), 'optimizasyon prompt bilgi içermiyor')
  assert.ok(sp.includes('Meta Ads optimization expert'), 'temel rol metni kaybolmuş')
  assert.ok(sp.includes('Turkish'), 'dil parametresi uygulanmamış')
})
```

- [ ] **Step 2: Testi çalıştır — FAIL beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: FAIL — `buildOptimizationSystemPrompt` export edilmemiş (import hatası veya tanımsız).

- [ ] **Step 3: Import ekle**

`lib/meta/optimization/aiRecommender.ts` — mevcut satır 11:

```typescript
import { getAnthropicClient, getAiEngineModel, isAnthropicReady } from '@/lib/anthropic/client'
```

bu satırın ALTINA ekle:

```typescript
import { META_ANALYSIS_KNOWLEDGE } from '@/lib/yoai/ai/docs/meta_analysis_knowledge'
```

- [ ] **Step 4: systemPrompt'u pure fonksiyona çıkar + bilgi ekle**

`lib/meta/optimization/aiRecommender.ts` — mevcut (satır 327-356):

```typescript
async function generateWithAI(
  campaign: OptimizationCampaign,
  problemTags: ProblemTag[],
  locale: string,
): Promise<Recommendation[]> {
  if (!isAnthropicReady()) throw new Error('ANTHROPIC_API_KEY yok')

  const lang = locale === 'en' ? 'English' : 'Turkish'

  const systemPrompt = `You are a Meta Ads optimization expert. Given campaign data and detected problems, generate actionable recommendations in ${lang}.

Output ONLY a JSON array of objects with this exact schema:
[{
  "title": "short title",
  "problemTag": "EXACT_TAG_ID",
  "rootCause": "1-2 sentence explanation",
  "action": "specific actionable recommendation",
  "risk": "low" | "medium" | "high",
  "expectedImpact": "expected outcome",
  "confidence": 0.0-1.0,
  "category": "AUTO_APPLY_SAFE" | "REVIEW_REQUIRED" | "TASK",
  "changeType": "pause" | "budget_decrease_20" | "budget_decrease_30" | "budget_increase_30" | "budget_increase_50" | null
}]

Category rules:
- AUTO_APPLY_SAFE: only for pause campaign (when ROAS<1) or small budget decrease
- REVIEW_REQUIRED: for significant budget changes, targeting changes
- TASK: for creative refresh, landing page, audience expansion (non-API actions)

Keep recommendations concise and metric-backed.`
```

şununla değiştir (systemPrompt sabitini fonksiyon çağrısına çevir; metni yukarı taşı):

```typescript
/** Optimizasyon AI system prompt'unu üretir (Meta analiz bilgisi dahil — Meta-only modül). */
export function buildOptimizationSystemPrompt(lang: string): string {
  return `You are a Meta Ads optimization expert. Given campaign data and detected problems, generate actionable recommendations in ${lang}.

Output ONLY a JSON array of objects with this exact schema:
[{
  "title": "short title",
  "problemTag": "EXACT_TAG_ID",
  "rootCause": "1-2 sentence explanation",
  "action": "specific actionable recommendation",
  "risk": "low" | "medium" | "high",
  "expectedImpact": "expected outcome",
  "confidence": 0.0-1.0,
  "category": "AUTO_APPLY_SAFE" | "REVIEW_REQUIRED" | "TASK",
  "changeType": "pause" | "budget_decrease_20" | "budget_decrease_30" | "budget_increase_30" | "budget_increase_50" | null
}]

Category rules:
- AUTO_APPLY_SAFE: only for pause campaign (when ROAS<1) or small budget decrease
- REVIEW_REQUIRED: for significant budget changes, targeting changes
- TASK: for creative refresh, landing page, audience expansion (non-API actions)

Keep recommendations concise and metric-backed.

${META_ANALYSIS_KNOWLEDGE}`
}

async function generateWithAI(
  campaign: OptimizationCampaign,
  problemTags: ProblemTag[],
  locale: string,
): Promise<Recommendation[]> {
  if (!isAnthropicReady()) throw new Error('ANTHROPIC_API_KEY yok')

  const lang = locale === 'en' ? 'English' : 'Turkish'

  const systemPrompt = buildOptimizationSystemPrompt(lang)
```

> DİKKAT: Yalnız `systemPrompt` tanımı değişti. `generateWithAI`'nin geri kalanı (`const i = campaign.insights`, `userPrompt`, `client.messages.create`, parsing) AYNEN korunur — dokunma.

- [ ] **Step 5: Testi çalıştır — PASS beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: PASS (7 test geçti).

- [ ] **Step 6: Commit**

```bash
git add lib/meta/optimization/aiRecommender.ts src/tests/metaAnalysisKnowledge.test.ts
git commit -m "feat(meta-opt): optimizasyon AI prompt'una Meta analiz bilgisi (publish akışı korunur)"
```

---

## Task 6: Strateji — `buildStrategySystemPrompt(channels)` + Meta koşullu enjeksiyon

**Files:**
- Modify: `lib/strategy/ai-generator.ts:1-4` (import), `:78` sonrası (helper ekle), `:134` (`system:` çağrısı)
- Modify: `src/tests/metaAnalysisKnowledge.test.ts`

> Strateji hem Meta hem Google kanalı işleyebilir. Bilgi yalnız `input.channels.meta` seçiliyse eklenir (Google-only stratejiyi etkilemez).

- [ ] **Step 1: Başarısız testi ekle**

`// <<BUILDER IMPORTS ...>>` üstüne ekle:

```typescript
import { buildStrategySystemPrompt } from '../../lib/strategy/ai-generator'
```

`// <<INJECTION TESTS ...>>` üstüne ekle:

```typescript
test('strateji: Meta kanalı bilgi içerir, sadece-Google içermez', () => {
  const withMeta = buildStrategySystemPrompt({ meta: true, google: true })
  const googleOnly = buildStrategySystemPrompt({ meta: false, google: true })
  assert.ok(withMeta.includes(FULL_MARKER), 'Meta kanalı bilgi içermiyor')
  assert.ok(withMeta.includes('dijital pazarlama stratejisti'), 'temel system prompt kaybolmuş')
  assert.ok(!googleOnly.includes(FULL_MARKER), 'sadece-Google strateji bilgi içermemeli')
})
```

- [ ] **Step 2: Testi çalıştır — FAIL beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: FAIL — `buildStrategySystemPrompt` export edilmemiş.

- [ ] **Step 3: Import ekle**

`lib/strategy/ai-generator.ts` — mevcut satır 1-4:

```typescript
import type { InputPayload, Blueprint, Persona, CreativeTheme, Experiment, Risk, TaskSeed } from './types'
import { generateBlueprint as generateTemplateBased } from './blueprint-generator'
import { strategyClaudeText, isAnthropicReady } from './claude'
import { extractJsonObject } from '@/lib/anthropic/text'
```

`extractJsonObject` satırının ALTINA ekle:

```typescript
import { META_ANALYSIS_KNOWLEDGE } from '@/lib/yoai/ai/docs/meta_analysis_knowledge'
```

- [ ] **Step 4: Helper fonksiyonu ekle**

`lib/strategy/ai-generator.ts` — `SYSTEM_PROMPT` sabitinin kapanış backtick'inden (satır 78, `...tekrarlamamalı.\`` ) HEMEN SONRA, `buildUserPrompt` fonksiyonundan ÖNCE şu fonksiyonu ekle:

```typescript
/** Strateji system prompt'unu üretir; Meta kanalı seçiliyse Meta analiz bilgisini ekler. */
export function buildStrategySystemPrompt(channels: { meta?: boolean }): string {
  return channels?.meta ? `${SYSTEM_PROMPT}\n\n${META_ANALYSIS_KNOWLEDGE}` : SYSTEM_PROMPT
}
```

- [ ] **Step 5: `system:` çağrısını helper'a bağla**

`lib/strategy/ai-generator.ts` `generateBlueprintWithAI` içinde — mevcut (satır 133-134):

```typescript
    const content = await strategyClaudeText({
      system: SYSTEM_PROMPT,
```

şununla değiştir:

```typescript
    const content = await strategyClaudeText({
      system: buildStrategySystemPrompt(input.channels),
```

- [ ] **Step 6: Testi çalıştır — PASS beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: PASS (8 test geçti).

- [ ] **Step 7: Commit**

```bash
git add lib/strategy/ai-generator.ts src/tests/metaAnalysisKnowledge.test.ts
git commit -m "feat(strategy): Meta kanalı seçiliyse stratejiye Meta analiz bilgisi"
```

---

## Task 7: YoAi sohbet — kreatif kategorilere `META_CREATIVE_PRINCIPLES`

**Files:**
- Modify: `lib/yoai/prompts.ts:1` (import) ve `:147` (`return categoryPrompts[category]`)
- Modify: `src/tests/metaAnalysisKnowledge.test.ts`

> Yalnız `ad_copy`, `social_media`, `landing_page` kategorilerine eklenir. `seo_article`, `email_marketing`, `product_description`, `slogan` ETKİLENMEZ.

- [ ] **Step 1: Başarısız testi ekle**

`// <<BUILDER IMPORTS ...>>` üstüne ekle:

```typescript
import { buildGenerationPrompt } from '../../lib/yoai/prompts'
```

`// <<INJECTION TESTS ...>>` üstüne ekle:

```typescript
test('sohbet: kreatif kategoriler kreatif ilkeleri içerir, diğerleri içermez', () => {
  const p: Record<string, string> = {}
  for (const cat of ['ad_copy', 'social_media', 'landing_page'] as const) {
    assert.ok(buildGenerationPrompt(cat, p).includes(CREATIVE_MARKER), `${cat} kreatif ilke içermeli`)
  }
  for (const cat of ['seo_article', 'email_marketing', 'product_description', 'slogan'] as const) {
    assert.ok(!buildGenerationPrompt(cat, p).includes(CREATIVE_MARKER), `${cat} kreatif ilke İÇERMEMELİ`)
  }
})
```

- [ ] **Step 2: Testi çalıştır — FAIL beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: FAIL — "ad_copy kreatif ilke içermeli".

- [ ] **Step 3: Import ekle**

`lib/yoai/prompts.ts` — mevcut satır 1:

```typescript
import type { ContentCategory } from './types'
```

bu satırın ALTINA ekle:

```typescript
import { META_CREATIVE_PRINCIPLES } from './ai/docs/meta_analysis_knowledge'
```

- [ ] **Step 4: Kreatif kategorilerde ekle**

`lib/yoai/prompts.ts` `buildGenerationPrompt` sonunda — mevcut (satır 147):

```typescript
  return categoryPrompts[category]
}
```

şununla değiştir:

```typescript
  const CREATIVE_CATEGORIES: ReadonlyArray<typeof category> = ['ad_copy', 'social_media', 'landing_page']
  if (CREATIVE_CATEGORIES.includes(category)) {
    return `${categoryPrompts[category]}\n\n${META_CREATIVE_PRINCIPLES}`
  }
  return categoryPrompts[category]
}
```

- [ ] **Step 5: Testi çalıştır — PASS beklenir**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: PASS (9 test geçti).

- [ ] **Step 6: Commit**

```bash
git add lib/yoai/prompts.ts src/tests/metaAnalysisKnowledge.test.ts
git commit -m "feat(yoai): sohbet kreatif kategorilerine Meta kreatif ilkeleri"
```

---

## Task 8: Bütünsel doğrulama + CHANGELOG + koruma kontrolü

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Tüm testleri çalıştır**

Run: `npx tsx src/tests/metaAnalysisKnowledge.test.ts`
Expected: `9 test: 9 geçti, 0 başarısız`

- [ ] **Step 2: Tip kontrolü (yalnız hata olup olmadığına bak)**

Run: `npx tsc --noEmit`
Expected: Dokunulan dosyalardan kaynaklı YENİ hata yok. (Repoda önceden var olan, alakasız hatalar olabilir — yalnız bizim dosyalarımızın temiz olduğunu doğrula: çıktıda `meta_analysis_knowledge.ts`, `perCampaignPrompt.ts`, `perAdPrompt.ts`, `systemPrompt.ts`, `aiRecommender.ts`, `ai-generator.ts`, `prompts.ts` geçmemeli.)

- [ ] **Step 3: Lint (dokunulan dosyalar)**

Run: `npx next lint --file lib/yoai/ai/docs/meta_analysis_knowledge.ts --file lib/yoai/ai/perCampaignPrompt.ts --file lib/yoai/ai/perAdPrompt.ts --file lib/yoai/ai/systemPrompt.ts --file lib/meta/optimization/aiRecommender.ts --file lib/strategy/ai-generator.ts --file lib/yoai/prompts.ts`
Expected: Hata yok (uyarı kabul edilebilir).

- [ ] **Step 4: Koruma kontrolü — Meta/Google API/publish dokunulmamış**

Run: `git diff --stat main -- lib/meta lib/google`
Expected: SADECE `lib/meta/optimization/aiRecommender.ts` görünür (prompt katmanı). `lib/meta/*` veya `lib/google/*` içinde herhangi bir fetch/insights/changeSet/publish dosyası listede OLMAMALI.

Run: `git diff main -- lib/meta/optimization/aiRecommender.ts | grep -E "^\+" | grep -iE "messages\.create|fetch\(|insights|changeSet|publish|client\." | grep -v "buildOptimizationSystemPrompt"`
Expected: Boş çıktı (yalnız prompt string + helper eklendi; API/veri satırı eklenmedi).

- [ ] **Step 5: CHANGELOG güncelle**

`docs/CHANGELOG.md` dosyasının EN ÜSTÜNE ekle:

```markdown
## 2026-06-08 — Meta Ads analiz bilgisi 4 AI motoruna entegre edildi
- **Sorun:** YoAlgoritma/Optimizasyon/Strateji/sohbet, Meta'nın sistem mekaniğini (Breakdown Effect, learning phase, marjinal CPA, pacing, ad relevance) bilmeden öneri/kopya üretiyordu.
- **Çözüm:** `meta-ads-analyzer` reposunun 9 dokümanı tek Türkçe küratörlü dosyaya damıtıldı (`meta_analysis_knowledge.ts`); 3 analiz motoruna tam doküman (Meta-only cached block), sohbetin kreatif kategorilerine (reklam metni/sosyal/landing) kreatif alt-küme enjekte edildi. Meta/Google API, fetch ve publish akışlarına dokunulmadı (yalnız prompt katmanı).
- **Dosyalar:** `lib/yoai/ai/docs/meta_analysis_knowledge.ts` (yeni), `lib/yoai/ai/perCampaignPrompt.ts`, `lib/yoai/ai/perAdPrompt.ts`, `lib/yoai/ai/systemPrompt.ts`, `lib/meta/optimization/aiRecommender.ts`, `lib/strategy/ai-generator.ts`, `lib/yoai/prompts.ts`, `src/tests/metaAnalysisKnowledge.test.ts`
```

- [ ] **Step 6: Commit + push**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): Meta analiz bilgisi entegrasyonu"
git push
```

---

## Self-Review (yazar kontrolü)

**Spec kapsamı:** 4 motor → Task 2-4 (YoAlgoritma: perCampaign/perAd/legacy; agent'lar otomatik), Task 5 (Optimizasyon), Task 6 (Strateji), Task 7 (sohbet-kreatif). Bilgi dokümanı Task 1. Kapsam dışı (MCP/scripts) hiçbir task'ta yok ✓. CHANGELOG + koruma kontrolü Task 8 ✓.

**Placeholder taraması:** Tüm test ve kaynak kodları tam yazıldı; "TODO/TBD" yok ✓.

**Tip tutarlılığı:** `metaAnalysisBlock()`, `buildOptimizationSystemPrompt(lang)`, `buildStrategySystemPrompt(channels)` isimleri test ve kaynakta birebir aynı. Marker sabitleri `FULL_MARKER`/`CREATIVE_MARKER` tek yerde tanımlı, içerik dokümanındaki başlıklarla eşleşiyor ✓.

**Meta/Google koruması:** Yalnız prompt string'leri/system block dizileri değişiyor; `aiRecommender.ts`'de API çağrısı ve parsing korunuyor (Task 5 uyarısı + Task 8 grep guard) ✓.
