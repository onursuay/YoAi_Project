# SEO Site-Bazlı İçerik Brief'i — Çoklu İşletme Tasarımı

**Tarih:** 2026-06-03
**Durum:** Onaylandı (uygulama planı bekliyor)
**Modül:** SEO Otomatik Makale (SEO Plus)

## Problem

SEO otomatik makale üretiminde konu/anahtar kelime seçimi kullanıcının **tek (legacy) işletme profilinden** besleniyor:

- `lib/seo/runScheduleArticle.ts:116` → `selectDailyTopic(userId, ...)` (siteyi değil, yalnız `userId`'yi geçiyor)
- `lib/seo/topicSelector.ts:92-97` → `getProfileByUserId(userId)` + `getIntelligenceByUserId(userId)`

Veriyle doğrulanan canlı vaka (omddq):
- Hedef site bağlantısı `37e085bc…` = **ustasiniyolla.com** (WordPress, default, active) — doğru.
- `article_schedules.keyword_pool` = **`[]`** (boş) — kullanıcının "Koltuk Yıkama" kelimesi hiç kaydedilmemiş.
- Kullanıcının tek işletme profili = **"Belgemod" / sektör: eğitim**.
- Sonuç: havuz boş → AI konu seçimi devreye girdi → Belgemod profilinden "Mesleki Yeterlilik Sınavı / MYK Belgesi" konuları üretilip **ustasiniyolla.com'a** yayınlandı.

Sistem birden fazla işletme + farklı reklam hesabı olan kullanıcılarda kullanılacak. Konuyu tek işletme profiline bağlamak temelden yanlış: bir kullanıcının her sitesi farklı bir işletme olabilir.

## Hedef

SEO içeriğinin kimliğini **hedef sitenin kendisinden** türetmek; merkezi tek işletme profiline olan bağımlılığı kaldırmak. Her SEO sitesi kendi kendine yeten, siteye özgü bir içerik kimliğine sahip olur → çoklu işletme/site doğal olarak desteklenir.

## Kararlar (brainstorming çıktısı)

1. **İçerik kimliği kaynağı:** Hedef site taranıp brief otomatik türetilir (merkezi profile bağlı değil).
2. **Tarama zamanı:** Site bağlandığında ilk tarama + ondan sonra **aylık (ayda 1)** otomatik tazeleme. Halihazırda bağlı/aktif siteler ilk deploy'da **geri-doldurma (backfill)** ile taranır.
3. **Brief derinliği:** Claude sentezi (zengin) — mevcut marka sentez hattı yeniden kullanılır.
4. **Kategori hedefleme:** Brief sitedeki tüm hizmet/kategorileri otomatik çıkarır; kullanıcı UI'da hangilerine yazılacağını seçer (varsayılan: hepsi). Havuz boşken AI **seçili kategoriler arasında rotasyonla** konu üretir (hepsi zamanla kapsanır).
5. **Yayın takvimi:** Mevcut Her gün / Hafta içi / Haftada bir yerine esnek model: **Her gün** kısayolu + **haftanın belirli günleri** (çoklu) + **ayın belirli günleri** (çoklu).
6. **Devreye alım:** Herkese canlı, güvenli fallback ile (flag yok). Brief yoksa/başarısızsa bugünkü profil+kelime mantığına düşer → sıfır regresyon.

## Mimari

### 1. Veri modeli — yeni tablo `site_content_briefs`

Mevcut `site_connections` / `user_business_profiles` / `article_schedules` tablolarına **dokunulmaz**. Tamamen yeni, additive tablo (omddq'ya `IF NOT EXISTS` migration):

```
site_content_briefs
  id                  uuid primary key
  user_id             uuid not null
  site_connection_id  uuid not null  -- FK → site_connections(id), UNIQUE (site başına 1 brief)
  scan_status         text not null default 'pending'  -- pending|running|completed|partial|failed
  company_name        text
  sector              text
  brand_tone          text
  target_audience     text
  products_or_services text[]   default '{}'
  categories          text[]    default '{}'  -- sitedeki hizmet/kategoriler (Kombi, Petek, Koltuk Yıkama…)
  keyword_themes      text[]    default '{}'
  content_angles      text[]    default '{}'
  audience_pains      text[]    default '{}'
  summary_text        text      -- topicSelector'ın kullanacağı businessContext özeti
  last_error          text
  scanned_at          timestamptz
  created_at          timestamptz default now()
  updated_at          timestamptz default now()
```

İndeksler: `(site_connection_id)` UNIQUE, `(user_id)`. Site silinince brief cascade silinir.

### 1b. `article_schedules`'e eklenecek kolonlar (additive)

```
target_categories  text[]  default '{}'   -- kullanıcının seçtiği kategoriler; boş = hepsi
schedule_mode      text    default 'daily' -- 'daily' | 'weekly_days' | 'monthly_days'
days_of_week       int[]   default '{}'    -- 0=Pazar … 6=Cumartesi (weekly_days modunda)
days_of_month      int[]   default '{}'    -- 1..31 (monthly_days modunda; 29-31 kısa ayda son güne clamp)
```

Mevcut `frequency` / `weekday` kolonları geriye uyum için bırakılır; yeni `schedule_mode` öncelikli okunur, yoksa eski alanlardan türetilir (geçiş için).

### 2. Brief üretim hattı — `lib/seo/siteBriefPipeline.ts` → `runSiteBriefPipeline(siteConnectionId, userId)`

1. `site_connections.base_url` çözülür.
2. Mevcut **`lib/yoai/businessSourceScanner.ts`** ile site sayfaları taranır (HTTP scrape, LLM yok).
3. **Claude sentezi:** mevcut `runBrandProfilePipeline` / marka sentez deseni yeniden kullanılır; scrape edilen içerikten yapılandırılmış brief üretilir. Sentez, sitenin menü/navigasyon ve sayfa başlıklarından **hizmet/kategori listesini** (`categories[]`) de çıkarır (örn. Kombi Servisi, Petek Temizleme, Koltuk Yıkama, Halı Yıkama, Klima Servisi).
4. `site_content_briefs`'e upsert + `scan_status` güncellenir. Hata olursa `failed` + `last_error`, asla throw ile akışı kırmaz.

İdempotent ve fire-and-forget güvenli.

### 3. Tetikleyiciler

- **Site bağlanınca:** `POST /api/seo/site-connections` (veya mevcut bağlama endpoint'i) sonrası `runSiteBriefPipeline` fire-and-forget.
- **Otomasyon kaydında:** `POST /api/seo/schedules` → hedef sitenin brief'i yoksa fire-and-forget tetikle.
- **Aylık cron:** mevcut SEO cron altyapısına ek bir adım veya ayrı route → `scanned_at` 30 günden eski (veya `pending`/`failed`) brief'leri yeniden üretir. (Vercel cron; mevcut `app/api/cron/seo-article-run` deseniyle uyumlu ayrı/iç adım.)
- **Backfill (ilk deploy):** Halihazırda bağlı/aktif tüm `site_connections` için brief yoksa bir kerelik tarama tetiklenir (idempotent — brief'i olan atlanır). Böylece ustasiniyolla.com gibi mevcut siteler hemen taranır.
- **(Opsiyonel) On-demand:** İçerik brief kartında "Yeniden Tara" butonu → aynı pipeline.

### 4. Konu seçimi değişikliği — `lib/seo/topicSelector.ts`

`selectDailyTopic(userId, opts)` imzasına `siteConnectionId?: string` ve `targetCategories?: string[]` eklenir. Yeni öncelik:

1. **Anahtar Kelime Havuzu doluysa → kullanıcının kelimesi her zaman kazanır** (`pickFromPool`, mevcut davranış korunur — orijinal şikayetin garantisi).
2. `businessContext` kaynağı:
   - `siteConnectionId` verilmiş ve `site_content_briefs` kaydı `completed` ise → **site brief'inden** (`summary_text` + alanlar) kurulur.
   - Aksi halde (brief yok / `failed` / tablo boş) → **fallback:** mevcut `getProfileByUserId` + `getIntelligenceByUserId` mantığı (bugünkü davranış).
3. Havuz boşsa → **kategori rotasyonu:**
   - Aday kategoriler = `targetCategories` (boşsa brief'in `categories[]`'i; o da boşsa kategori yok → düz site bağlamı).
   - `recentTitles` ile son makalelerde **en az kullanılmış** kategori seçilir (basit round-robin; başlık eşleştirme `includes` ile).
   - `aiSelectKeyword` o kategoriye odaklı çağrılır (site brief bağlamı + "şu kategoriye yaz: X").

`runScheduleArticle.ts:116` çağrısı `siteConnectionId: site.id` ve `targetCategories: s.target_categories` geçirecek şekilde güncellenir.

### 4b. Yayın takvimi — `schedule_mode` ve `isScheduleDue`

`lib/seo/scheduleStore.ts`'teki "bugün çalışmalı mı" mantığı (`isScheduleDue`) yeni modeli okur:

- `daily` → her gün due.
- `weekly_days` → bugünün yerel haftagünü `days_of_week` içinde ise due.
- `monthly_days` → bugünün yerel ayın günü `days_of_month` içinde ise due (29-31 kısa ayda ayın son gününe clamp).
- `schedule_mode` boşsa → eski `frequency`/`weekday`'den türet (geçiş uyumluluğu).

Saat kontrolü (`publish_time`/`timezone`) ve günlük idempotency (`claimScheduleRun`/`last_run_date`) mevcut haliyle korunur.

### 5. Anahtar kelime havuzu kalıcılığı — KOD İNCELENDİ: zaten doğru

`components/seo/SeoAutomationPanel.tsx` incelendi: havuz kalıcılığı **zaten sağlam** —
- `addKeyword` (`:155-163`) kelime eklenince anında `handleSave(next)` ile kaydeder.
- `handleSave` (`:104-115`) "Enter'a basılmamış bekleyen input'taki kelimeyi" de payload'a katar.

Yani persistence bug'ı **yok**. DB'deki `keyword_pool: []`, kullanıcının "Koltuk Yıkama"yı hiç başarıyla eklememiş olduğunu gösterir (ekrandaki boş alanla tutarlı). **Bu bölümde kod değişikliği gerekmez** — kullanıcı kelimeyi ekleyince kalıcı olacaktır. Asıl düzeltme site-brief'tir: havuz boş kalsa bile AI artık ustasiniyolla.com'un kendi kimliğine göre yazar.

## Veri Akışı

```
Site bağla ──▶ runSiteBriefPipeline ──▶ businessSourceScanner (scrape)
                                     └─▶ Claude sentezi ──▶ site_content_briefs (categories[], completed)

İlk deploy ──▶ backfill: brief'i olmayan aktif siteler ──▶ runSiteBriefPipeline
Aylık cron ──▶ scanned_at > 30g olanları ──▶ runSiteBriefPipeline (yeniden)

Cron (saatlik) ──▶ isScheduleDue(schedule_mode: daily|weekly_days|monthly_days) ──▶ due ise:
  runScheduleArticle ──▶ selectDailyTopic(userId, { keywordPool, siteConnectionId, targetCategories })
       ├─ havuz dolu  → kullanıcı kelimesi
       └─ havuz boş   → kategori rotasyonu (seçili kategoriler) → AI(site brief bağlamı)
                        | fallback(profil bağlamı, brief yoksa)
  ──▶ generateArticle(businessContext = site brief | fallback) ──▶ yayınla
```

## Hata Yönetimi & Güvenlik

- Brief üretimi başarısız → `failed` kaydı; makale akışı **fallback** ile çalışmaya devam eder, hiç kırılmaz.
- Tarama Vercel limitlerini aşmaz (mevcut scanner `waitForFinish`/timeout desenleri korunur); brief üretimi makale üretiminden **ayrı** çalışır, üretim taramayı beklemez.
- Meta/Google reklam entegrasyonlarına **dokunulmaz** — değişiklik tamamen SEO modülü içi.

## Test

- `site_content_briefs` migration omddq'da doğrulanır (read-only probe + self-cleaning smoke), repo migration'ının uygulandığı teyit edilir.
- `runSiteBriefPipeline` ustasiniyolla.com üzerinde çalıştırılıp brief'in gerçekten site kimliğini (kombi/petek/koltuk yıkama servis) yansıttığı doğrulanır — Belgemod sızması olmamalı.
- `selectDailyTopic` birim davranışı: (a) havuz dolu → kullanıcı kelimesi; (b) brief var → site bağlamı; (c) brief yok → fallback profil; (d) havuz boş + kategoriler → rotasyon farklı kategorilere dağılıyor.
- `isScheduleDue`: daily / weekly_days (seçili gün) / monthly_days (seçili gün + kısa ay clamp) doğru due hesaplıyor; eski `frequency` kayıtları hâlâ çalışıyor.
- Havuz kalıcılığı: UI'dan kelime ekle + kaydet → DB'de `keyword_pool` dolu görünmeli.
- Kategori çıkarımı: ustasiniyolla.com brief'i Kombi/Petek/Koltuk/Halı/Klima kategorilerini yakalamalı.

## UI / i18n

- Yeni metinler **`locales/tr.json` + `locales/en.json`** ikisine birden, aynı key path.
- İçerik brief durum kartı/etiketleri proje standardı: `max-w-7xl`, `animate-card-enter`, no-amber palet, dropdown gerekiyorsa `WizardSelect`.
- `scan_status` gösterimi mevcut tarama etiketleriyle tutarlı (Taranıyor… / Tarandı / Kısmi / başarısız).
- **Kategori seçimi:** Üretim Ayarları'nda, brief'ten gelen kategoriler checkbox/chip listesi olarak gösterilir; kullanıcı hangilerine yazılacağını işaretler (varsayılan hepsi seçili). Brief henüz hazır değilse "Kategoriler taranıyor…" durumu gösterilir.
- **Yayın takvimi seçici:** "Her gün" / "Haftanın günleri" / "Ayın günleri" mod seçimi; haftanın günleri çoklu toggle (Pzt…Paz), ayın günleri çoklu (1…31) grid. `WizardSelect` + chip toggle deseni; amber yok.

## Kapsam Dışı (YAGNI)

- `site_connections`'ı reklam hesabı (Meta/Google) işletme grubuna bağlama — bu tasarım siteyi kendi başına ele alır, ad-account scope'a bağlamaz.
- `YOAI_PER_ACCOUNT_SCOPE` flag mekaniğine müdahale — bu çözüm o flag'den bağımsız çalışır.
- Manuel per-site işletme profili oluşturma UI'ı — brief otomatik türetildiği için gerekmez.

## Etkilenecek Dosyalar (tahmini)

- **Yeni:** `supabase/migrations/<ts>_create_site_content_briefs.sql` (+ `article_schedules`'e additive kolonlar), `lib/seo/siteContentBriefStore.ts`, `lib/seo/siteBriefPipeline.ts`, aylık cron + backfill route (veya mevcut cron'a adım), gerekirse kategori-seçici ve takvim-seçici bileşenleri.
- **Değişen:** `lib/seo/topicSelector.ts` (site brief + kategori rotasyonu), `lib/seo/runScheduleArticle.ts` (siteConnectionId + targetCategories geçişi), `lib/seo/scheduleStore.ts` (`schedule_mode`/`days_of_week`/`days_of_month` + `isScheduleDue`), site bağlama endpoint'i + `POST /api/seo/schedules` (fire-and-forget tetik + yeni alanlar), `app/api/cron/seo-article-run` (yeni due mantığı), `components/seo/SeoAutomationPanel.tsx` (havuz kalıcılığı + kategori + takvim UI), `locales/tr.json` + `locales/en.json`.
