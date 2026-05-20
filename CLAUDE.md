# YoAi Project — Claude Code Instructions

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
- `SUPER_ADMIN_EMAILS` allowlist (default `onursuay@hotmail.com`) hem kredi hem abonelik modalını görmez
- `/api/billing/current` → `isOwner: true` döner; `useSubscription().isOwner` ve `useCredits().isOwner` bayrakları true olur
- `useCredits().hasEnoughCredits()` owner için her zaman true; `canUseOptimizationAI` vb. flag'ler enterprise stub üzerinden true
- Bypass yalnızca allowlist için — normal kullanıcı güvenliği gevşetilmez

**BusinessProfileGuard önceliği:**
1. Önce `BusinessProfileGuard` (işletme profili eksikse onun modalı çıkar)
2. Sonra `AccessRequiredModal` (kredi/abonelik kontrolü)
İki guard birbirini ezmez — sıra korunur.

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
