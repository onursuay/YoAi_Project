# Meta Ads Analiz Bilgisinin Tüm AI Üretim Motorlarına Entegrasyonu

**Tarih:** 2026-06-08
**Kaynak repo:** https://github.com/mathiaschu/meta-ads-analyzer (MIT)
**Durum:** Tasarım onaylandı — spec inceleme aşaması

---

## 1. Amaç ve Bağlam

`meta-ads-analyzer` reposu **uygulama kodu değil**, bir **uzmanlık bilgi paketidir**: Claude için bir skill (`skill/SKILL.md` + 9 referans doküman) + bir MCP server config örneği + token script'leri. Reponun gerçek değeri, Meta Ads performansını **doğru teşhis etmeyi** öğreten analiz çerçevesidir (Breakdown Effect, marjinal vs. ortalama CPA, learning phase, auction dinamikleri, pacing, ad relevance tanıları).

YoAi'de Meta kampanyalarını analiz edip öneri üreten **dört AI motoru** var. Bu motorlar şu an bu çerçeveye sahip değil — örneğin "yüksek ortalama CPA'lı segmenti durdur" gibi Breakdown Effect hatasına düşebiliyorlar. Bu reponun bilgisini damıtıp **tek bir paylaşılan Türkçe bilgi dokümanı** olarak bu dört motorun AI prompt'larına enjekte ederek, öneri kalitesini Meta'nın sistem mekaniğiyle hizalamak hedefleniyor.

**Hedef:** Reponun bilgisini **maksimum değerle** kullanmak — özü eksiksiz damıtmak, dört motora da Meta-only olarak bağlamak, Meta/Google API ve publish altyapısına **hiç dokunmamak**.

---

## 2. Kapsam

### Dahil (4 üretim motoru — hepsi Meta-only enjeksiyon)
1. **YoAlgoritma** — hiyerarşik kampanya analizi + geliştirme kartları (aktif ana yol + per-ad + legacy)
2. **Optimizasyon (Meta)** — kampanya sorun taraması + AI öneri üretimi
3. **Strateji** — pazarlama blueprint üretimi
4. **YoAi sohbet / komuta merkezi** — içerik/yanıt üretimi (Meta-ilgili kategoriler)

### Hariç (kapsam dışı — gerekçeli)
- **MCP server** (`mcp/mcp.json.example`, `npx meta-ads-mcp`): Claude Code dev aracını Meta API'ye bağlar; YoAi'nin kendi Meta entegrasyonu (`lib/meta/*`) zaten var. Ürüne girmez.
- **Token script'leri** (`scripts/setup.sh`, `scripts/refresh_token.sh`): MCP'ye bağlı, dev aracı.
- **İngilizce metrik adlandırma tablosu** + ABD-yasal terimler ("Accounts Center accounts", "person") + "Meta'ya göre…" kaynak-belirtme dili: Proje kurallarıyla (sade Türkçe, ham enum yok, kaynak belirtme yasağı) çelişir → **alınmaz**.

### Opsiyonel ek (kullanıcı isterse)
- Skill klasörünü `.claude/skills/meta-ads-analyzer/`'a kurmak — yalnız geliştirme sırasında Claude Code'un dev-time kullanması için. Ürün davranışını etkilemez. **Varsayılan: yapılmaz** (kullanıcı ayrıca isterse eklenir).

---

## 3. Damıtılan Bilgi (payload içeriği)

Tek dosyada toplanacak Türkçe küratörlü bilgi. 9 referans dokümanın **tamamından** çıkarılan öz (madde başlıkları + her birinin taşıyacağı kilit içerik):

1. **Breakdown Effect (en kritik)**
   - Sistem **marjinal verimliliği** maksimize eder, ortalama verimliliği değil.
   - Yüksek ortalama CPA'lı segment, başka yerdeki daha yüksek marjinal maliyeti önlüyor olabilir → **yalnız ortalama CPA'ya bakarak segment durdurma/bütçe kısma ÖNERME.**
   - Doğru değerlendirme seviyesi tablosu: CBO (Advantage+ Campaign Budget) → **kampanya seviyesi**; CBO'suz otomatik yayın yeri → **ad set seviyesi**; tek ad set içinde çok reklam → **ad set seviyesi**.
2. **Ad Auction — Total Value mantığı**
   - Kazanan = (Teklif) × (Tahmini Aksiyon Oranı) + (Reklam Kalitesi).
   - Düşük teklif, yüksek alaka/kalite ile kazanabilir → **alaka maliyeti düşürür.** Düşük teslimat = düşük toplam değer olabilir (sadece düşük teklif değil).
3. **Learning Phase**
   - ≈50 optimizasyon olayı / 7 gün ile çıkılır; Shops istisnası (17 site + 5 Meta satın alma).
   - Öğrenme sırasında CPA dalgalı/yüksek; **kesin yargı verme.**
   - Önemli düzenleme (bütçe/teklif/hedefleme/kreatif/optimizasyon hedefi) öğrenmeyi **sıfırlar.** "Learning Limited" = yeterli sonuç alınamıyor.
4. **Auction Overlap**
   - Kendi ad set'lerin örtüşen kitlelerde aynı açık artırmaya girince Meta yalnız en yüksek değerlisini seçer → diğerleri teslimat/bütçe/öğrenme kaybeder.
   - Çözüm: benzer ad set'leri birleştir veya örtüşen (genelde learning limited) olanı kapat, bütçeyi aktife taşı.
5. **Pacing**
   - Bütçe pacing (süreye yayar) + teklif pacing (maliyet hedefini korur).
   - Sistem pahalı dönemde bütçeyi **tutabilir** → günlük değil **kampanya geneli** pencerede değerlendir.
6. **Performans Dalgalanmaları — normal vs. endişe verici**
   - Normal: gün-içi CPA %20-30 oynama, hafta sonu/içi farkı, haftalara yayılan kademeli değişim, öğrenme dönemi.
   - Endişe verici: ani+sürekli >%50 maliyet artışı (birkaç gün), teslimatın sıfıra düşmesi, harcama artarken dönüşüm düşmesi, değişiklik olmadan bozulma.
   - Teşhis öncesi 4 kontrol: öğrenme fazında mı, normal baz oynama ne, dış etken var mı, örneklem yeterli mi (genelde 7+ gün).
7. **Ad Relevance Diagnostics**
   - Üç tanı: Kalite Sıralaması, Etkileşim Oranı Sıralaması, Dönüşüm Oranı Sıralaması (açık artırma girdisi DEĞİL — tanı aracı; <500 gösterimde yok).
   - Tanı kılavuzu: Düşük Kalite → kreatif; Düşük Etkileşim → hook/açı; Düşük Dönüşüm → landing/teklif-kitle uyumu; Hepsi düşük → kitle-kreatif uyumsuzluğu.
8. **Bid Strategies**
   - Harcama-bazlı (En Yüksek Hacim / En Yüksek Değer), hedef-bazlı (Sonuç Başına Maliyet Hedefi / ROAS Hedefi — birebir garanti değil), manuel (Teklif Üst Sınırı).
9. **Analiz İlkeleri (çerçeve özeti)**
   - Önce bütüne (aggregate), sonra detaya. Statik değil dinamik (zaman serisi). Ortalama değil marjinal.

**Dil/uyum kuralları (doküman içeriğine gömülü):** Tamamı **Türkçe**; ham enum yok; **kullanıcıya gösterilmez** — yalnız Claude'un muhakemesini besler. Bu yüzden i18n (tr.json/en.json) gerektirmez (kullanıcı-yüzlü string değil). Kaynak belirtme dili kullanılmaz (proje kuralı). Amber/sarı söz konusu değil (metin dokümanı).

---

## 4. Mimari

### 4.1 Tek kaynak (DRY)
Yeni dosya: **`lib/yoai/ai/docs/meta_analysis_knowledge.ts`**
- Mevcut `lib/yoai/ai/docs/meta_ad_rules_curated.ts` ile **birebir aynı kalıp**: tek `export const META_ANALYSIS_KNOWLEDGE = \`...\`` (backtick template string).
- Bu dizin, projede AI küratörlü bilgi dokümanlarının yerleşik evi olduğu için seçildi (`*_rules_curated.ts` kardeşi). Üç modül (lib/yoai, lib/meta, lib/strategy) buradan import eder — string sabit olduğu için katman ihlali sorun değil.
- (İsteğe bağlı) ufak yardımcı: `export const metaAnalysisBlock = () => ({ type: 'text', text: META_ANALYSIS_KNOWLEDGE, cache_control: { type: 'ephemeral' as const } })` — cached block ekleyen motorlar için tek satırlık kullanım.

### 4.2 Enjeksiyon noktaları (hepsi Meta-only)

| # | Modül | Dosya / fonksiyon | Yöntem |
|---|---|---|---|
| 1 | YoAlgoritma (aktif ana yol) | `lib/yoai/ai/perCampaignPrompt.ts` → `buildPerCampaignSystemBlocks(platform, …)` | `if (platform === 'Meta')` → blocks dizisine ek cached block |
| 2 | YoAlgoritma (per-ad) | `lib/yoai/ai/perAdPrompt.ts` → `buildPerAdSystemBlocks(platform, …)` | aynı Meta-only cached block |
| 3 | YoAlgoritma (legacy/account-wide) | `lib/yoai/ai/systemPrompt.ts` → `buildSystemBlocks(platform)` | aynı Meta-only cached block |
| 4 | Optimizasyon (Meta) | `lib/meta/optimization/aiRecommender.ts` → `generateWithAI()` | `systemPrompt` string'inin **sonuna** `META_ANALYSIS_KNOWLEDGE` eklenir |
| 5 | Strateji | `lib/strategy/ai-generator.ts` → `SYSTEM_PROMPT` | string sonuna `META_ANALYSIS_KNOWLEDGE` eklenir |
| 6 | YoAi sohbet | `lib/yoai/prompts.ts` → `buildGenerationPrompt(category, params)` | yalnız **Meta-ilgili kategorilerde** prompt sonuna eklenir (kategori eşlemesi implementasyonda netleştirilir) |

**Notlar:**
- `lib/strategy/claude.ts` (`strategyClaudeText`) ve `app/api/yoai/chat/route.ts` (POST) yalnız **transport** katmanı — bunlara dokunulmaz; enjeksiyon yukarı akıştaki prompt kurucularında yapılır.
- `app/api/yoai/command-center/route.ts` salt-okunur veri döndürür — AI prompt yok; üretim yukarı akışta (YoAlgoritma) zaten kapsanır.
- Strateji ve sohbet "shared" yollar; ama bilgi Meta'ya özgü olduğu için: Strateji'de SYSTEM_PROMPT zaten Meta/Google ortak bir stratejisti tanımlıyor — Meta bilgisi eklemek Google üretimini bozmaz (yalnız Meta muhakemesini zenginleştirir); yine de mümkünse platform bağlamına göre koşullu eklenir. Sohbette yalnız Meta kategorileri hedeflenir.

---

## 5. Korunan Alanlar (KRİTİK — dokunulmaz)

CLAUDE.md "Meta & Google Ads API / Altyapı Koruması" ve `feedback_no_touch_meta_google` gereği:
- `lib/meta/*` ve `lib/google/*` **veri çekiciler, insight normalizasyon, change-set, publish** akışları — hiçbiri değişmez.
- Bu işte yalnız **prompt string'leri / system block dizileri** zenginleşir. Veri akışı, fetch, şema, enum, publish **aynen kalır.**
- `aiRecommender.ts`'de yalnız `systemPrompt` metni uzatılır; `generateWithAI`'nin veri girişi, çıkış parsing'i, `Recommendation[]` şeması **değişmez.**
- Çıktı JSON şemaları (YoAlgoritma 4 seviyeli çıktı, optimizasyon recommendation) **değişmez.**

---

## 6. Risk ve Güvenlik

- **Tamamen eklemeli (additive):** Yeni şema yok, yeni API çağrısı yok, migration yok. `feedback_prod_risk_minimization` ile uyumlu.
- **Token maliyeti:** Bilgi cached system block (Anthropic `cache_control: ephemeral`) → ilk çağrıdan sonra yalnız "cache-read" maliyeti. Doküman ~6-9 KB hedeflenir (damıtılmış, şişirilmemiş).
- **Geri alınabilirlik:** Tek dosya + her motorda tek import/tek ek satır → istenirse tek commit'le geri alınır. Runtime flag eklenmez (basitlik; istenirse sonradan eklenebilir).
- **Davranış değişikliği:** Bilgi yalnız muhakemeyi yönlendirir; kullanıcı-yüzlü string/şema değişmez, dolayısıyla i18n ve UI etkilenmez.

---

## 7. Doğrulama Planı

1. **Tip/derleme:** `npx tsc --noEmit` (veya proje type-check script'i) — yeni import'lar ve dokunulan dosyalar temiz derlenmeli.
2. **Lint:** Dokunulan dosyalarda lint hatası olmamalı.
3. **Statik doğrulama:** Her enjeksiyon noktasında bilgi bloğunun yalnız Meta yolunda eklendiğini (Google yolunda eklenmediğini) kodla doğrula.
4. **Davranışsal (mümkünse):** YoAlgoritma per-campaign için bir Meta kampanyasıyla üretim çalıştırıp önerilerin Breakdown Effect'e aykırı ("yüksek ortalama CPA segmentini kapat") tavsiye **vermediğini** kontrol et. (Canlı veri/gerçek hesap gerektirir; yoksa prompt birleştirme çıktısını manuel incele.)
5. **Koruma kontrolü:** `lib/meta/*` ve `lib/google/*` içinde veri/fetch/publish satırlarının diff'te yer almadığını doğrula (yalnız prompt string'i değişmeli).

---

## 8. Etkilenen Dosyalar

**Yeni:**
- `lib/yoai/ai/docs/meta_analysis_knowledge.ts`

**Değişen (yalnız prompt/sistem-blok katmanı):**
- `lib/yoai/ai/perCampaignPrompt.ts`
- `lib/yoai/ai/perAdPrompt.ts`
- `lib/yoai/ai/systemPrompt.ts`
- `lib/meta/optimization/aiRecommender.ts`
- `lib/strategy/ai-generator.ts`
- `lib/yoai/prompts.ts`

**Dokümantasyon:**
- `docs/CHANGELOG.md` (giriş eklenir)

**Dokunulmaz:** `lib/meta/*` ve `lib/google/*` veri/fetch/publish, çıktı şemaları, i18n dosyaları, UI.

---

## 9. Açık Sorular / İmplementasyonda Netleşecek

1. **Sohbet kategori eşlemesi:** `buildGenerationPrompt`'taki hangi `category` değerleri "Meta-ilgili" sayılıp bilgi alacak — implementasyon planında `lib/yoai/prompts.ts` okunup kesin liste çıkarılacak.
2. **Strateji platform koşulu:** SYSTEM_PROMPT'a koşulsuz mu yoksa platform bağlamına göre mi ekleneceği — `generateBlueprintWithAI` input'unda platform bilgisi varsa koşullu, yoksa koşulsuz (Google'a zarar vermez).
3. **Yardımcı fonksiyon:** `metaAnalysisBlock()` helper'ı eklensin mi yoksa her motor inline mı kullansın — küçük tercih, plan aşamasında.
