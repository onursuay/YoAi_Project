# YoAi Project — Claude Code Instructions

## Meta & Google Ads API / Altyapı Koruması (KRİTİK — Proje Geneli)
Bu projede yapılan **HİÇBİR değişiklik** (UI, layout, stil, sütun, refactor dahil) Meta Ads ve Google Ads **API entegrasyonunu veya altyapısını bozmamalı / sorun yaşatmamalı.** Reklam Yöneticisi, kampanya çekme / oluşturma / yayınlama akışları her zaman çalışır kalır.
- Bir tablo/stil/sütun/arka plan değişikliği yaparken bile veri çeken API çağrıları, fetcher'lar (`lib/meta/*`, `lib/google/*`) ve publish akışları **KORUNUR** — yalnız sunum (presentation) katmanı değişir.
- Şüphe varsa entegrasyon koduna **dokunma**; sadece görünüm katmanını düzenle.
- İlgili: [feedback_no_touch_meta_google](memory).

## Otomatik Commit + Push
Her değişiklik tamamlandıktan sonra otomatik olarak:
1. Değiştirilen dosyaları stage et
2. Kısa ve açıklayıcı commit mesajı ile commit at
3. `git push` ile remote'a gönder

Kullanıcı ayrıca "commit + push" demesine gerek yok.

## Değişiklik Günlüğü
Her başarılı değişiklik sonrasında `docs/CHANGELOG.md` dosyasını güncelle.
Şu formatta yeni bir giriş ekle (en üste):

```
## YYYY-MM-DD — [Kısa başlık]
- **Sorun:** Ne sorundu / ne istendi
- **Çözüm:** Ne yapıldı
- **Dosyalar:** Etkilenen dosyalar
```

Sadece net olumlu sonuçları kaydet: düzeltilen buglar, tamamlanan özellikler, çözülen sorunlar.
Başarısız denemeler, geçici fixler veya geri alınan değişiklikler eklenmez.

## Kredi / Abonelik Erişim Bariyeri (Proje Geneli Standart)
YoAi'de ücretli erişim gerektiren alanlar **iki kategoriye** ayrılır: **kredi gerektiren** ve **abonelik gerektiren**. Kredi veya abonelik gerektiren **hiçbir** alanda düz inline hata mesajı gösterilmez. Kullanıcıya blur arkalıklı, kapatılamayan, premium tasarımlı bir **AccessRequiredModal** gösterilir. Kredi gereken alanlarda kredi yükleme odaklı modal; abonelik gereken alanlarda plan/abonelik yükseltme odaklı modal kullanılır. İki modal aynı tasarım ailesinden olup ikon, başlık, badge ve CTA metniyle birbirinden ayrılır.

**Reusable component:** [components/billing/AccessRequiredModal.tsx](components/billing/AccessRequiredModal.tsx)
- `type="credit"` → Sparkles + Zap ikonları, "AI KREDİ" rozeti, "Kredi Yükle" CTA → `/abonelik#krediler`
- `type="subscription"` → ShieldCheck + Lock ikonları, "ABONELİK" rozeti, "Planları İncele" CTA → `/abonelik`

**Eski API:** [components/billing/CreditRequiredModal.tsx](components/billing/CreditRequiredModal.tsx) — yeni `AccessRequiredModal type="credit"`'a delege eden ince wrapper olarak korunur (geriye dönük uyumluluk için).

**Feature kayıt defteri:** [lib/billing/featureAccessMap.ts](lib/billing/featureAccessMap.ts) — her ücretli alan tek noktada `tier` (credit_required | subscription_required) ile tanımlanır. Yeni alan eklenince modal'a `featureKey` props ile bağlanır.

**Abonelik zorunlu alanlar:**
- ✅ Optimizasyon (modül erişimi)
- ✅ Strateji
- ✅ YoAlgoritma
- ✅ SEO
- ✅ Hedef Kitle > AI Tabanlı Hedef Kitle

**Kredi zorunlu alanlar:**
- ✅ Optimizasyon > AI ile Tara Pro (günlük AI scan limiti aşıldığında)
- ✅ Tasarım (AI üretim)
- ✅ Strateji > Aylık limit aşımı (overage)
- ✅ YoAlgoritma > Sohbet/içerik üretimi

**Davranış (her iki tür için ortak):**
- Blur backdrop (`backdrop-blur-md` + `bg-black/50`)
- Kapatma X **yok**, ESC kapatmaz, dış tıklama kapatmaz
- Body scroll lock
- CTA tıklanmadan modal kapanmaz
- Backend guard ayrıca korunur — modal sadece UX katmanı, güvenlik backend'de kalır

**Owner / Süper Admin bypass:**
- `SUPER_ADMIN_EMAILS` allowlist (default `onursuay@hotmail.com`) hem kredi hem abonelik modalını **hem de İşletme Profili kurulumunu (BusinessProfileGuard)** görmez
- `/api/billing/current` → `isOwner: true` döner; `useSubscription().isOwner` ve `useCredits().isOwner` bayrakları true olur
- `useCredits().hasEnoughCredits()` owner için her zaman true; `canUseOptimizationAI` vb. flag'ler enterprise stub üzerinden true
- Bypass yalnızca allowlist için — normal kullanıcı güvenliği gevşetilmez

**BusinessProfileGuard önceliği:**
1. Önce `BusinessProfileGuard` (işletme profili eksikse onun modalı çıkar)
2. Sonra `AccessRequiredModal` (kredi/abonelik kontrolü)
İki guard birbirini ezmez — sıra korunur.

**BusinessProfileGuard owner bypass (KRİTİK):** `GET /api/yoai/business-profile` owner için `onboarding_completed: true` + `isOwner: true` döner (`getIsCurrentUserSuperAdmin` → `signups.email` → `SUPER_ADMIN_EMAILS`). Owner profil kurulumuna **ASLA zorlanmaz**; normal kullanıcılarda zorunluluk **korunur**. Çoklu işletme (`YOAI_PER_ACCOUNT_SCOPE`) açıkken bu şart — flag açıkken guard her aktif hesabın profilini arar; owner bypass olmadan owner'a zorla kurulum çıkar. İlgili: [project_multi_business_phase](memory).

## UI Renk Kuralı (YASAK)
Bu projede **amber / sarı / hardal / bej ton uyarı renkleri KESİNLİKLE kullanılmaz**.
Şu Tailwind class'ları yasaktır:
- `bg-amber-*`, `text-amber-*`, `border-amber-*`
- `bg-yellow-*`, `text-yellow-*`, `border-yellow-*`

Uyarı / bilgi bantları için bunları kullan:
- **Bilgi / hazır:** `bg-gray-50` / `text-gray-700` / `border-gray-200`
- **Önemli uyarı / harekete geçir:** `bg-primary/5` + `text-primary` + `border-primary/20` (veya koyu yeşil)
- **Kritik / hata:** `bg-red-50` / `text-red-700` / `border-red-200`
- **Başarı:** `bg-emerald-50` / `text-emerald-700` / `border-emerald-200`

Tüm butonlar ve ikonlar için de aynı kural geçerli (no amber, no yellow).

## UI Dil / Terminoloji Kuralı (YASAK: ham teknik terim) — Proje Geneli
Kullanıcıya gösterilen **HİÇBİR yerde** ham teknik terim / İngilizce enum / `UNDERSCORE_LU_KOD` / iç parametre adı görünmez. **Kullanıcı bu terimleri anlamaz** — her zaman **sade, kullanıcı dostu Türkçe** etiket gösterilir. Bu kural tüm modüller için geçerlidir (Optimizasyon, YoAlgoritma, Strateji, Hedef Kitle, Tasarım, …).

**Yasak örnekler (UI'da ASLA):**
- Optimizasyon/analiz sinyalleri: `LOW_ROAS`, `SINGLE_ADSET_RISK`, `QUALITY_BELOW_AVERAGE`, `HIGH_CPC`, `NO_DELIVERY` …
- Platform enum'ları: `OUTCOME_SALES`, `MAXIMIZE_CONVERSIONS`, `TARGET_ROAS`, `RESPONSIVE_SEARCH_AD`, `SEARCH`, `primary_text` …
- Teklif stratejisi / kampanya türü / hedef / yayın yeri ham kodları.

**Doğru karşılıklar:**
- `LOW_ROAS` → "Düşük getiri", `SINGLE_ADSET_RISK` → "Tek grup riski", `QUALITY_BELOW_AVERAGE` → "Reklam kalitesi düşük"
- `MAXIMIZE_CONVERSIONS` → "Dönüşümleri En Üst Düzeye Çıkar", `SEARCH` → "Arama Ağı"

**Çeviri kaynakları (yeni UI eklerken KULLAN):**
- Platform enum'ları (Meta/Google objective, bidding, channel, CTA, placement, ad format): [lib/yoai/translations/](lib/yoai/translations/) → `translateEnum(value, 'tr', platform)`.
- Optimizasyon sorun etiketleri (ProblemTagId): [lib/google/optimization/labels.ts](lib/google/optimization/labels.ts) → `problemLabel(id)`.
- Yeni bir enum/parametre türü UI'a girecekse önce çeviri katmanına ekle, sonra göster. Ham değeri doğrudan `{value}` ile basmak YASAK.

## EN/TR İki Dil Uyumu (ZORUNLU — Proje Geneli)
Bu projede yapılan **her değişiklik EN/TR uyumlu olmak zorundadır.** Kullanıcıya gösterilen **hiçbir** metin tek dile gömülü (hardcoded) bırakılamaz. Tüm kullanıcı-yüzlü string'ler `next-intl` üzerinden çeviri dosyalarından okunur.

**Altyapı:**
- `next-intl` (^4.7.0). Çeviri dosyaları: [locales/tr.json](locales/tr.json) ve [locales/en.json](locales/en.json).
- Locale `NEXT_LOCALE` cookie'sinden okunur, **default `tr`** ([i18n.ts](i18n.ts)).
- Client component: `const t = useTranslations('namespace.path')` → `t('key')`.
- Server component / route: `const t = await getTranslations('namespace.path')`.

**Kurallar (istisnasız):**
1. Yeni bir UI metni eklenince anahtarı **HEM `tr.json` HEM `en.json`** dosyasına, **aynı key path** ile ekle. Birini eklemek diğerini unutmak = eksik iş.
2. JSX/TSX içinde düz string yazma (`<span>Reklam Hesapları</span>` YASAK) → `t('...')` kullan. Tek istisna: marka adı ("YoAi") ve teknik olmayan sembol/sayı.
3. Toast/alert/hata mesajları, buton etiketleri, placeholder, aria-label, başlık, boş-durum metinleri — **hepsi** çeviriden gelir.
4. Dinamik değerler `t('key', { count, name })` ile interpolasyon; string concat ile cümle kurma YASAK (dil bilgisi sırası dile göre değişir).
5. Var olan bir alanın yakınında değişiklik yapıyorsan ve orada hardcoded string görürsen, dokunduğun kısmı çeviriye taşı (boy scout kuralı).
6. Çeviri anahtarı isimleri açıklayıcı ve namespace'li olmalı (örn. `account.switcher.selectBusiness`), magic literal değil.

**Tamamlanmış sayılma koşulu:** Bir iş, hem `tr.json` hem `en.json` güncellenmeden ve dil değiştirince (NEXT_LOCALE) tüm yeni metinler doğru dilde görünmeden **bitmiş sayılmaz.**

## Dropdown / Select Görsel Standardı (ZORUNLU — Proje Geneli)
Projedeki **kullanıcıya gösterilen TÜM dropdown / select alanları birebir Meta Ads dropdown'u gibi görünmek zorundadır.** Ham native `<select>` (tarayıcı varsayılan görünümü) **YASAKTIR** — tasarım, yazı ailesi, yazı boyutu (`text-sm`), renkler (yalnız primary/emerald/gray), köşe yuvarlaklığı, gölge ve ok (chevron) ikonu Meta kampanya wizard'ı ile aynı olmalı.

**Tek kanonik bileşen:** [components/meta/wizard/WizardSelect.tsx](components/meta/wizard/WizardSelect.tsx)
- `rounded-xl` + ince border + `shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)]`
- Açıkken `border-primary ring-2 ring-primary/20`; `ChevronDown` ok açılınca 180° döner ve primary'ye boyanır
- Seçili öğede yeşil `Check`; option hover `bg-gray-50`, seçili `bg-primary/8 text-primary`
- Dış tıklama kapatır; `value: string` + `onChange(v: string)` + `options: {value,label,disabled?}[]` + opsiyonel `placeholder`/`disabled`/`error`

**Kurallar (istisnasız):**
1. Yeni bir dropdown eklenirken **WizardSelect kullan** — yeni native `<select>` yazma.
2. Var olan bir native `<select>` alanına dokunuyorsan onu WizardSelect'e taşı (boy scout).
3. Option etiketleri sade Türkçe/EN olmalı (ham enum YASAK — [feedback_no_raw_enums_ui](memory)); placeholder dahil tüm metinler i18n'den gelir.
4. **İSTİSNA — Meta/Google reklam entegrasyon wizard'ları:** `components/meta/*` ve `components/google/*` içindeki kampanya/ad set/reklam oluşturma-düzenleme select'lerine bu refactor için **dokunulmaz** (API/publish koruması — [feedback_no_touch_meta_google](memory)). Bunlar zaten Meta tarzındadır; yeni alan eklenirken yine WizardSelect tercih edilir ama mevcut entegrasyon select'leri toplu dönüştürülmez.

## Kitle Hedefleme Picker UX (Dropdown davranışı) — Proje Geneli
Projedeki **TÜM "Kitle Hedefleme" picker'ları** (Arama / Göz at sekmeli kitle segmenti UI'ı) — kampanya türünden ve bağlamdan bağımsız olarak — aynı dropdown davranışına sahiptir:

1. **Default açık başlar** (kullanıcı seçim yapabilsin)
2. **Picker dışına tıklandığında otomatik kapanır** — `useEffect` + `mousedown` listener, `ref.current.contains(target)` kontrolü
3. **Kapalıyken tetikleyici buton** görünür: seçim sayısı (örn. "4 kitle segmenti seçildi") + chevron; tıklanınca yeniden açılır
4. **Seçili chip'ler picker durumundan bağımsız** her zaman görünür kalır

**Uygulama (istisnasız):**
- ✅ `components/google/wizard/steps/StepAudience.tsx` (Search + Display wizard ortak)
- ✅ `components/google/wizard/pmax/steps/PMaxStepAssetGroup.tsx` (PMax wizard — `CollapsibleSection` içinde olsa bile dropdown davranışı uygulanır)
- ✅ `components/google/detail/AudienceSegmentEditor.tsx` (modal içinde olsa bile dropdown davranışı uygulanır)

## Apify Entegrasyonu — Kritik Kurallar

### Actor ID Encoding (KESİNLİKLE DEĞİŞTİRİLMEZ)
Apify API, actor ID'lerindeki `/` karakterini `~` olarak bekler. `encodeURIComponent` **yasaktır** — `apify%2Finstagram-profile-scraper` yerine `apify~instagram-profile-scraper` gönderilmeli.
- **Doğru:** `actorId.replace(/\//g, '~')`
- **Yanlış:** `encodeURIComponent(actorId)`
Bu kural `lib/yoai/apifySocialRunner.ts`'de `encodeActorId()` fonksiyonu ile uygulanır.

### waitForFinish Stratejisi (Polling Yasak)
Apify social runner `?waitForFinish=50` parametresi kullanır — Apify bağlantıyı açık tutar, iş bitince döner. Polling loop Vercel 60s limitini aşar, **kullanılmaz**.

### Gerekli Environment Variable'lar
`.env.local` VE Vercel dashboard'da bulunması gerekenler:
```
APIFY_API_TOKEN=                    ← Apify console'dan al
APIFY_INSTAGRAM_PROFILE_ACTOR_ID=apify/instagram-profile-scraper
APIFY_FACEBOOK_PAGE_ACTOR_ID=apify/facebook-pages-scraper
APIFY_LINKEDIN_COMPANY_ACTOR_ID=dev_fusion/Linkedin-Company-Scraper   ← Full permissions onayı gerekli (tek seferlik)
APIFY_YOUTUBE_CHANNEL_ACTOR_ID=streamers/youtube-channel-scraper
APIFY_TIKTOK_PROFILE_ACTOR_ID=clockworks/tiktok-profile-scraper
APIFY_META_AD_LIBRARY_ACTOR_ID=curious_coder/facebook-ads-library-scraper
APIFY_GOOGLE_ADS_TRANSPARENCY_ACTOR_ID=solidcode/ads-transparency-scraper
```
Token eksikse `isApifyReady()` false döner, sistem public metadata fallback'e geçer — hiç crash olmaz.

## YoAlgoritma Geliştirme Kartları — Hiyerarşik Mimari (Faz 3)
YoAlgoritma artık "düz per-ad öneri listesi" yerine **hesap → kampanya → ad set → reklam** hiyerarşik kart modeli kullanır.

**Tablolar (omddq — eski `ai_ad_improvements` PARALEL, birkaç hafta sonra silinecek):**
- `account_alerts` (SEVİYE 0 — Pixel/CAPI/dönüşüm takibi/bütçe dağılımı/eksik kampanya türü)
- `campaign_improvements` (SEVİYE 1 — kampanya türü doğrulama + öneriler) — `user_id + campaign_id`
- `adset_improvements` (SEVİYE 2) — FK `campaign_improvement_id`
- `ad_improvements` (SEVİYE 3 — `ad_spec`) — FK `adset_improvement_id`
- Status enum (7): `pending | approved | applied | rejected | rejected_by_user | cancelled | superseded`. Reddet → `rejected_by_user` (soft-delete), "Geri Al" → `pending`.

**Motor:** [perCampaignPrompt.ts](lib/yoai/ai/perCampaignPrompt.ts) + [perCampaignAgent.ts](lib/yoai/ai/perCampaignAgent.ts) — kampanya başına 1 Batch API isteği, 4 seviyeli JSON çıktı. `account_alerts` yalnız platformun ilk kampanya isteğinde üretilir. Direktifler: kampanya türü uyumsuzluğu en üstte; İngilizce enum YASAK; "kaynak belirtme" yasağı; off-brand ürün/hizmet kontrolü; three-pillar.

**Inngest:** `yoalgoritma/campaign-improvements.user` → [perCampaignImprovements.ts](inngest/functions/perCampaignImprovements.ts) (fetch → reconcile → batch → poll → FK zinciri persist; concurrency 5). Lifecycle: **freeze-on-decision** (karar verilmiş kampanya dondurulur), kararsız kampanyanın pending alt-ağacı haftalık supersede, pasif kampanya cancel. Eski `yoalgoritma/improvements.user` (per-ad) function rollback için kayıtlı ama cron artık tetiklemez.

**Enum çeviri katmanı:** [lib/yoai/translations/](lib/yoai/translations/) — `translateEnum(value, locale, platform?)` her Meta/Google enum'unu TR+EN'e çevirir; UI'da ham enum **ASLA** görünmez. `humanizeTr.ts` bu katmana delege eder.

**UI:** [components/yoai/hierarchy/](components/yoai/hierarchy/) — drill-down (breadcrumb), tüm detaylar AÇIK (collapse yok), durum bazlı butonlar (pending: Onayla+Reddet; approved: Yayınla[ad]/Uygulandı[advisory]+Reddet; applied: Reddet; rejected_by_user: gri+Geri Al). Endpoint'ler: `GET /api/yoai/improvements/hierarchy`, `POST .../hierarchy/decision`. Ad onayı → mevcut `AdCreationWizard` (Meta/Google entegrasyonuna **dokunulmaz**).

## İşletme Profili Tarama Kuralları (Otomatik Tarama)

### Tarama Ne Zaman Çalışır
1. **İlk kurulum tamamlandığında**: `POST /api/yoai/business-profile` → onboarding bitince `runProfileScansAndIntelligence` fire-and-forget olarak tetiklenir.
2. **Her revizyondan sonra**: Aynı POST endpoint'i edit modda da kullanılır → her kayıtta otomatik yeniden tarama başlar.

### Manuel Tara Butonu — kapsam netleştirmesi
Bu kural **yalnızca haftalık YoAlgoritma AI scan** (reklam hesabı taraması — `yoalgoritma/scan.user` hesap-geneli + `yoalgoritma/campaign-improvements.user` hiyerarşik geliştirme kartları) için geçerlidir: o akışlarda UI'da "Tara"/"Yeniden Tara" butonu **bulunmaz**, yalnızca otomatik (Pazar gece cron + admin on-demand event) tetiklenir. (Faz 3'te per-ad akışı hiyerarşik per-campaign akışına geçti — manuel tara butonu yine **yok**.)

**İstisna — Brand Intelligence Refresh (ayrı akış):** İşletme Profili sayfasındaki **"Marka Bilgilerini Yenile"** butonu bu kuralın dışındadır. Bu buton reklam hesabını değil, kullanıcının KENDİ marka kaynaklarını (website + Instagram + Facebook …) yeniden tarayıp Claude marka sentezini günceller (`brand/ingest.user`). Manuel buton burada **kasıtlı olarak vardır**.
- Endpoint: `POST /api/yoai/business-profile/brand-refresh`
- Inngest: `brandIngestionUser` (`brand/ingest.user`, concurrency 3) → `runBrandProfilePipeline(userId, { withSynthesis: true })`
- Profil kaydetme/revizyon hâlâ otomatik deterministik taramayı tetikler (route değişmedi); bu buton ek olarak Claude sentezini de çalıştırır.

### Tarama Nasıl Çalışır
- `businessSourceScanner.ts` + `socialSourceScanner.ts` ile HTTP scraping (LLM kullanılmaz)
- Kendi marka URL'leri (website, instagram, facebook, linkedin, youtube, tiktok, google_business, marketplace) + her rakibin URL'leri taranır
- Sonuçlar `user_business_source_scans` tablosuna yazılır — **her taramada eski kayıtlar silinir** (`deleteSourceScansForProfile` çağrılır), duplicate birikmez
- `buildBusinessIntelligenceRow` ile deterministic intelligence üretilir, `user_business_intelligence` tablosuna kaydedilir

### scan_status Değerleri (UI'da gösterim)
| Değer | Gösterim |
|-------|----------|
| `pending` | "Tarama bekleniyor" |
| `running` | "Taranıyor…" (spinner) |
| `completed` | "Tarandı" (yeşil) |
| `partial` | "Kısmi" (kaynak bir kısmı tarandı) |
| `failed` | "Tarama başarısız" (kırmızı) |

### Taramayı Etkileyen Dosyalar
- `app/api/yoai/business-profile/route.ts` — POST: kayıt + `runProfileScansAndIntelligence` fire-and-forget
- `app/api/yoai/business-profile/scan/route.ts` — programmatik tetikleyici (UI'a açık değil)
- `lib/yoai/businessProfileStore.ts` — `deleteSourceScansForProfile` + `insertSourceScans`
- `lib/yoai/businessSourceScanner.ts` — web/marketplace/google_business HTTP scraping
- `lib/yoai/socialSourceScanner.ts` — Instagram/Facebook/LinkedIn/YouTube/TikTok scraping
- `lib/yoai/businessIntelligenceBuilder.ts` — deterministic intelligence synthesis

## Kitle Segmenti Chip Renk Kuralı
Tüm kategori (AFFINITY, IN_MARKET, DETAILED_DEMOGRAPHIC, LIFE_EVENT, USER_LIST, CUSTOM_AUDIENCE, COMBINED_AUDIENCE) chip'leri tek tip `bg-emerald-50` + `text-emerald-700` kullanır. Kategoriye göre değişen mor/turuncu/pembe/mavi/teal/indigo renkler **kullanılmaz**.

Yeni bir kitle picker UI'ı eklenirse hem dropdown davranışını hem chip rengi kuralını uygula.
