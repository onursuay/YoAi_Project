# Firecrawl Web Tarama Entegrasyonu — Tasarım (Alt-Proje C)

**Tarih:** 2026-06-09
**Durum:** Onaylandı — uygulama planına hazır
**Bağlam:** Daha büyük "Uzman Reklam Motoru" vizyonunun ilk alt-projesi. Sıra: **C (Firecrawl) → B (Kendini güncelleyen bilgi tabanı) → A (Uzman reklam motoru)**. C ve B, A'yı besleyen yakıttır.

---

## 1. Amaç

Marka ve rakip **web sitelerini** Firecrawl ile derin (JS-render destekli, çok sayfa) tarayarak; mevcut basit HTTP fetch + regex hattının kaçırdığı içeriği (hizmetler, lokasyonlar, hedef kitle sinyalleri, USP'ler, fiyat/CTA ipuçları) yakalamak. Bu zengin içerik, mevcut istihbarat hattını (`businessIntelligenceBuilder` + Claude sentezi) besleyerek nihai hedef olan A motorunun karar kalitesini yükseltir.

## 2. Kapsam Sınırları (KİLİTLİ)

| Görev | Araç | Durum |
|-------|------|-------|
| Marka + rakip **web sitesi** içeriği | **Firecrawl** | YENİ (bu proje) |
| Rakip **Meta Ads** reklamları (Ad Library) | **Apify** (`curious_coder/facebook-ads-library-scraper`) | DEĞİŞMEZ |
| Rakip **Google Ads** reklamları (Transparency) | **Apify** (`solidcode/ads-transparency-scraper`) | DEĞİŞMEZ |
| **Sosyal profiller** (IG/FB/LinkedIn/YT/TikTok) | **Apify** | DEĞİŞMEZ |

**Firecrawl YALNIZCA web sitesi taraması için kullanılır.** Sosyal profiller, Google Ads ve Meta Ads (Apify) eskisi gibi değişmeden devam eder. `socialSourceScanner.ts`, `apifyCompetitorProvider.ts` ve Meta/Google entegrasyonuna **dokunulmaz** ([feedback_no_touch_meta_google]).

## 3. Mimari & Yeni Modül

Tek yeni bağımsız katman: **`lib/firecrawl/`** — Firecrawl API detayı tek yerde kapsüllenir.

```
lib/firecrawl/
  client.ts        → isFirecrawlReady(), API key + flag okuma, base fetch wrapper
  types.ts         → FirecrawlScrapeResult, FirecrawlMapResult, PageContent
  scrapeSite.ts    → akıllı seçki: map → kilit sayfa seçimi → scrape → birleşik temiz markdown
  pageSelector.ts  → map çıktısından kilit sayfa seçen deterministik mantık
```

### 3.1 `client.ts`
- **`isFirecrawlReady(): boolean`** — `FIRECRAWL_API_KEY` mevcut **ve** `FIRECRAWL_ENABLED === 'true'` ise `true`. Apify'daki `isApifyReady()` deseninin birebir aynısı.
- Base fetch wrapper: timeout, 429/5xx hata sınıflandırma, JSON parse.

### 3.2 `scrapeSite(url)` — Akıllı Seçki Akışı
1. `firecrawl_map(url)` → site URL listesi.
2. `pageSelector(urls)` → en fazla `FIRECRAWL_MAX_PAGES` (default 6) kilit sayfa seç.
3. Her seçili sayfa için `firecrawl_scrape(format: markdown)`.
4. Sayfaları tek birleşik temiz markdown metnine indir.
5. Tüm akış 60sn Vercel limitine sığacak şekilde sayfa sayısı ve per-page timeout ile sınırlı.

### 3.3 `pageSelector.ts` — Deterministik Sayfa Seçimi
Map çıktısından öncelik sırasıyla seçer (regex/keyword eşleme):
- Anasayfa (root)
- Hakkımızda / about
- Hizmetler / services / ürünler / products / çözümler
- İletişim / contact
- Fiyatlandırma / pricing / paketler
Üst sınır aşılırsa öncelik düşük olanlar elenir.

## 4. Entegrasyon Noktası

Tek dokunma noktası: **`lib/yoai/businessSourceScanner.ts`** — bu dosya zaten hem kullanıcının kendi web/marketplace/google_business URL'lerini **hem de rakip URL'lerini** tarar. Tek yere Firecrawl eklemek marka + rakip web taramasının ikisini birden kapsar.

**Cerrahi yaklaşım — yalnızca "içerik getirme" adımı değişir, çıkarım değişmez:**

```
web/marketplace/google_business kaynak tipi için:

  ham içerik = isFirecrawlReady()
                 ? await scrapeSite(url)        ← YENİ: derin, JS-render, çok sayfa
                 : await mevcutHttpFetch(url)   ← MEVCUT: aynen korunur (fallback)

  → MEVCUT extraction mantığı (extractLocations / extractCtaHints /
    extractKeywords / brand tone) bu zengin metin üzerinde değişmeden çalışır
```

**Değişmeyenler:**
- `user_business_source_scans` tablo şeması
- `scan_status` değerleri (`pending|running|completed|partial|failed`)
- `deleteSourceScansForProfile` / `insertSourceScans` akışı
- `businessIntelligenceBuilder.ts`, `businessProfileStore.ts`, brand-refresh (`brand/ingest.user`)
- Apify, sosyal tarama, Meta/Google entegrasyonu

**Tek ek (opsiyonel, teşhis):** scan kaydı meta alanında `scanProvider: 'firecrawl' | 'http'` işareti — UI'da gösterilmez.

## 5. Environment & Flag

```
FIRECRAWL_API_KEY=          ← firecrawl.dev console'dan
FIRECRAWL_ENABLED=false     ← default-off flag (owner test → sonra aç)
FIRECRAWL_MAX_PAGES=6       ← akıllı seçki üst sınırı (opsiyonel, default 6)
```

**Rollout:** `FIRECRAWL_ENABLED=false` iken `isFirecrawlReady()` false → sistem bugünküyle **birebir aynı** (HTTP fetch). Önce owner hesabında doğrula, sonra flag aç ([feedback_prod_risk_minimization]).

## 6. Hata Yönetimi (her durumda fallback, asla crash)

| Durum | Davranış |
|-------|----------|
| API key yok / flag kapalı | Sessizce HTTP fetch |
| Firecrawl 4xx/5xx / rate-limit (429) | O URL için HTTP fetch'e düş, logla |
| Tek sayfa timeout | O sayfayı atla, diğerleriyle devam |
| Tüm map boş | HTTP fetch'e düş |
| Toplam süre 60sn'ye yaklaşıyor | Kalan sayfaları kes, eldekiyle bitir (`partial`) |

## 7. Test Stratejisi

- **Birim testleri (`lib/firecrawl/`):** `isFirecrawlReady()` flag mantığı; `pageSelector` öncelik mantığı (about/services/contact); fallback tetikleme koşulları.
- **API mock'ları:** Firecrawl çağrıları mock'lanır (gerçek kredi harcanmaz) — başarı, 429, timeout, boş map senaryoları.
- **Regresyon:** Flag kapalıyken `businessSourceScanner` çıktısı bugünküyle aynı kalır.
- **Manuel canlı doğrulama:** Owner hesabında gerçek bir site taranır; içeriğin HTTP fetch'ten zengin geldiği gözlenir.

## 8. i18n & UI

Bu katman tamamen backend. Kullanıcı-yüzlü yeni metin yok; yeni çeviri anahtarı gerekmez. `scanProvider` meta alanı yalnız teşhis amaçlı, UI'da gösterilmez.

## 9. Tamamlanma Koşulu (Definition of Done)

- [ ] `lib/firecrawl/` modülü + birim testleri yeşil
- [ ] `businessSourceScanner.ts` Firecrawl/HTTP fallback entegrasyonu
- [ ] Flag kapalıyken regresyon yok (mevcut davranış birebir korunur)
- [ ] `.env.local` + Vercel env değişkenleri dokümante edildi
- [ ] Owner hesabında canlı doğrulama yapıldı
- [ ] `docs/CHANGELOG.md` güncellendi
- [ ] Commit + push

## 10. Kapsam Dışı (bu alt-projede YOK)

- B (resmi döküman tarama) ve A (uzman reklam motoru) — ayrı spec'ler.
- Firecrawl `extract` (şema bazlı LLM çıkarımı) — gerekirse zor parse edilen siteler için ileride hedefli eklenir.
- Sosyal/Meta/Google tarafı — değişmez.
