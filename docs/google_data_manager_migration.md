# Google Ads API → Data Manager API Geçiş Planı (Offline Conversion Import)

> **Tarih:** 2026-06-13 · **Tetikleyici:** Google'ın resmî e-postası — 15 Haziran 2026'dan itibaren
> geliştirici jetonumuzla (müşteri kimliği 135-179-7599) Google Ads API üzerinden
> `UploadClickConversions` çağrıları **başarısız olacak** (son 180 günde hiç istek gönderilmediği için).
> Çevrimdışı dönüşüm içe aktarma (enhanced conversions for leads dahil) bundan sonra
> **yalnız Data Manager API** ile yapılabilir.

---

## 1. Denetim Sonucu — Etkilenen Dosyalar ve Fonksiyonlar

Tüm repo tarandı (`UploadClickConversions`, `ConversionUploadService`, `uploadClickConversions`,
`ClickConversion`, `ConversionAdjustment`, `offlineUserDataJob`, `gclid/gbraid/wbraid`,
`enhanced conversion`, `customer match`, `userIdentifier`, `hashed_email` ve tüm
`customers/{id}/...:method` endpoint kalıpları).

### 1a. KOD: Etkilenen dosya YOK ✅

Projede `UploadClickConversions` / `ConversionUploadService` / `offlineUserDataJobs` /
`conversionAdjustments` çağrısı **hiçbir yerde yoktur**. Kullanılan tüm Google Ads API
endpoint'leri şunlardır ve **hiçbiri 15 Haziran 2026 engelinden etkilenmez**:

| Endpoint | Kullanım yeri | Durum |
|---|---|---|
| `googleAds:search` (GAQL) | Raporlama, kampanya/hesap okuma (tüm fetcher'lar) | ✅ Etkilenmez |
| `campaigns / adGroups / adGroupAds / campaignBudgets / *Criteria / *Assets :mutate` | Kampanya oluşturma/yayınlama wizard'ları | ✅ Etkilenmez |
| `conversionActions:mutate` (create) | [lib/marketing-setup/googleAdsConversionsClient.ts](../lib/marketing-setup/googleAdsConversionsClient.ts) → `deployGoogleAdsConversions` | ✅ Etkilenmez (dönüşüm *eylemi tanımı* oluşturur, upload değil) |
| `conversionActions:mutate` (update) | [lib/google-ads/attribution.ts](../lib/google-ads/attribution.ts) → `updateAttributionModel` | ✅ Etkilenmez |
| `userLists:mutate` | googleAdsConversionsClient.ts → kural-tabanlı remarketing listeleri | ✅ Etkilenmez (rule-based; Customer Match verisi yüklemez) |
| `conversionGoalCampaignConfigs / customConversionGoals :mutate` | Kampanya hedef yapılandırması | ✅ Etkilenmez |
| `:generateKeywordIdeas` | Anahtar kelime fikirleri | ✅ Etkilenmez |

Yanlış pozitifler (ilgisiz):
- [app/api/integrations/google-ads/assets/scrape/route.ts:241](../app/api/integrations/google-ads/assets/scrape/route.ts) — `gclid` yalnız görsel URL parametre filtresi (scraping temizliği).
- `app/api/meta/offline-event-sets/route.ts` — **Meta** Offline Event Sets (Meta CAPI tarafı; Google ile ilgisiz).

### 1b. DOKÜMAN / AI BİLGİ KATMANI: Planlı kullanım izleri (kod değil)

| Dosya | İçerik |
|---|---|
| [lib/yoai/ai/docs/google_ads_rules_curated.ts](../lib/yoai/ai/docs/google_ads_rules_curated.ts) (satır 50-52) | AI danışman bilgisi: "offline import + CRM geri besleme" en iyi pratik olarak öneriliyor (kullanıcıya tavsiye metni — API çağrısı değil) |
| [docs/google_ads_resmi_dokumanlari.md](google_ads_resmi_dokumanlari.md) (90, 261, 437, 556…) | Aynı bilgi tabanının kaynak dokümanı; GCLID/GBRAID/WBRAID saklama, hash formatı vb. |
| [docs/hedef-kitle-ve-optimizasyon.md:93](hedef-kitle-ve-optimizasyon.md) | "Google Customer Match (CRM upload) arayüzü yok — istenirse ayrı, gerçek bir akış olarak eklenebilir" → **gelecek özellik adayı** |
| [docs/google_search_wizard.md:265](google_search_wizard.md) | Lifecycle goals önkoşulu olarak Customer Match listelerine atıf (bilgi) |

## 2. Sonuç: Gerçek kullanım mı, plan mı?

**Proje çevrimdışı dönüşüm yüklemeyi BUGÜN KULLANMIYOR — yalnız gelecekte kullanmayı planlıyor.**

- Google'ın e-postası da bunu doğruluyor: "son 180 gün içinde geliştirici jetonunuzla
  UploadClickConversions isteği gönderilmediği için" engelleniyoruz. Hiç göndermedik.
- **15 Haziran 2026'da hiçbir şey kırılmaz.** Acil aksiyon gerekmez.
- CRM modülü ([lib/crm/](../lib/crm/)) bugün **Meta-only** (lead ingest/sync). Google tarafına
  lead geri beslemesi henüz yazılmadı.
- Tek etki: gelecekte "CRM → Google dönüşüm geri beslemesi" veya "Customer Match upload"
  özelliği yazılırken **Google Ads API değil, doğrudan Data Manager API** kullanılmalı.
  Eski yol bizim jeton için kalıcı olarak kapalı olacak.

## 3. Önerilen Data Manager API Servis Mimarisi (Gelecek Uygulama)

> Kaynak: https://developers.google.com/data-manager/api — `datamanager.googleapis.com` v1.
> Geliştirici jetonu (developer token) **gerektirmez**; OAuth yeterli.

```
lib/google/dataManager/
├── client.ts          # ingestEvents / ingestAudienceMembers fetch wrapper'ları
├── hashing.ts         # normalize + SHA-256 (email lowercase/trim, telefon E.164)
├── types.ts           # IngestEventsRequest, Destination, UserData, Consent tipleri
└── leadConversionSync.ts  # CRM lead → AdsConversionEvent dönüştürücü

inngest/functions/
└── crmGoogleConversionSync.ts  # 'crm/google-conversions.sync' (batch, concurrency düşük)
```

**Temel akış (events:ingest):**
```
POST https://datamanager.googleapis.com/v1/events:ingest
{
  "destinations": [{
    "operatingAccount": { "product": "GOOGLE_ADS", "accountId": "<customerId>" },
    "loginAccount":     { "product": "GOOGLE_ADS", "accountId": "<managerId>" },   // MCC üzerinden erişimde
    "productDestinationId": "<conversionActionId>"   // YoAi'nin oluşturduğu conversion action
  }],
  "events": [{
    "transactionId": "<lead_id / order_id>",          // dedup anahtarı
    "eventTimestamp": "2026-06-13T10:00:00+03:00",    // tıklamadan SONRA olmalı
    "conversionValue": 1500.0,
    "currency": "TRY",
    "adIdentifiers": { "gclid": "...", "gbraid": "...", "wbraid": "..." },
    "userData": { "userIdentifiers": [
      { "emailAddress": "<sha256(normalize(email))>" },
      { "phoneNumber":  "<sha256(E.164)>" }
    ]},
    "consent": { "adUserData": "CONSENT_GRANTED", "adPersonalization": "CONSENT_GRANTED" }
  }]
}
```

**Kritik mimari notlar:**
1. **Yeni OAuth scope gerekir:** `https://www.googleapis.com/auth/datamanager`. Mevcut
   `adwords` scope'u Data Manager API'yi **kapsamaz** → incremental consent / yeniden
   bağlama akışı gerekecek. Mevcut Google OAuth bağlantısına dokunulmaz; ek scope ayrı
   onayla istenir (default-off flag — [feedback_prod_risk_minimization]).
2. **Google Cloud projesinde Data Manager API enable edilmeli** (Marketing Kurulum
   Sihirbazı'ndaki bekleyen dış kurulum listesine eklendi — bkz. memory `project_marketing_setup_wizard`).
3. **Mevcut Google Ads API akışlarına SIFIR dokunuş:** `lib/googleAdsAuth.ts`, fetcher'lar,
   kampanya publish, `deployGoogleAdsConversions`, `attribution.ts` aynen kalır
   ([feedback_no_touch_meta_google]). Data Manager istemcisi tamamen **yeni ve ayrı** modüldür.
4. **Enhanced conversions for leads** aynı `events:ingest` ucuyla yapılır: gclid yoksa
   `userData` (hashed email/telefon) ile eşleşme sağlanır — bu yüzden CRM'de iki veri
   sınıfı da tutulmalı (aşağıda).
5. **Customer Match** (gelecekteki Hedef Kitle özelliği) için de aynı API:
   `audienceMembers:ingest` — `OfflineUserDataJobService`'e hiç başlamadan doğrudan
   Data Manager ile yazılmalı.

## 4. Başarılı Upload İçin Gerekli CRM Alanları

Mevcut CRM lead şemasına ([lib/crm/leadFields.ts](../lib/crm/leadFields.ts) /
`leadStore.ts`) eklenecek alanlar:

| Alan | Tip | Zorunluluk | Not |
|---|---|---|---|
| `gclid` | text | gclid/gbraid/wbraid'den en az biri **veya** email/telefon | Form gönderiminde URL'den / `_gcl_aw` cookie'sinden yakala |
| `gbraid` | text | ″ | iOS App-ads kaynaklı tıklamalar |
| `wbraid` | text | ″ | ″ |
| `email` | text | Enhanced conversions for leads için önerilir | Upload öncesi normalize (lowercase/trim) + SHA-256 — düz halde Google'a **gönderilmez** |
| `phone` | text | ″ | E.164'e çevir + SHA-256 |
| `conversion_time` | timestamptz | ZORUNLU | Lead'in nitelik kazandığı an; tıklama zamanından sonra olmalı |
| `conversion_value` | numeric | Önerilir | Satış/anlaşma değeri; yoksa varsayılan 1 |
| `currency_code` | text | Önerilir | Varsayılan `TRY` |
| `transaction_id` | text | ZORUNLU (dedup) | `lead_id` veya sipariş no — tekrar gönderim çift saymaz |
| `consent_ad_user_data` | boolean | ZORUNLU (KVKK/GDPR + Consent Mode v2) | Form onay kutusundan |
| `consent_ad_personalization` | boolean | ZORUNLU | ″ |
| `google_conversion_action_id` | text | ZORUNLU | Hangi conversion action'a yazılacak (wizard'ın oluşturduğu) |
| `google_sync_status` | enum | İç takip | `pending / uploaded / failed / skipped` |

Lead statü eşlemesi (curated rules satır 261 ile uyumlu): `qualified` → "Nitelikli Lead"
conversion action, `sale` → "Satış" conversion action (+ değer). `spam/lost` gönderilmez.

## 5. TODO — Uygulama Noktaları (hiçbiri mevcut akışı bozmaz)

> Hepsi **yeni dosya / yeni kolon / default-off flag**. Mevcut Google Ads API raporlama,
> kampanya okuma/yayınlama, hesap listeleme, GA4 ve GTM akışlarına dokunulmaz.

- [ ] **TODO-DM-1:** `lib/google/dataManager/client.ts` — `ingestEvents()` + `ingestAudienceMembers()`
      wrapper (yeni dosya; `datamanager.googleapis.com/v1`, developer token YOK, OAuth Bearer).
- [ ] **TODO-DM-2:** OAuth incremental consent — `datamanager` scope'u için ayrı bağlama
      adımı (`app/api/oauth/setup-google/` kalıbı örnek alınabilir; mevcut adwords akışına dokunma).
- [ ] **TODO-DM-3:** Google Cloud projesinde **Data Manager API enable** (dış kurulum —
      Marketing Setup bekleyenler listesi). omddq migration'ları deploy öncesi DB'de doğrula.
- [ ] **TODO-DM-4:** CRM şema migration — bölüm 4'teki kolonlar (`gclid/gbraid/wbraid`,
      consent, sync status…). Prod-risk kuralı: migration ertelenebilirse default-off flag ile.
- [ ] **TODO-DM-5:** Click-id yakalama — Dönüşüm Sihirbazı snippet'i / GTM'e form gönderiminde
      `gclid/gbraid/wbraid`'i lead payload'ına ekleyen küçük katman (gtag `_gcl_*` cookie'leri).
- [ ] **TODO-DM-6:** `inngest/functions/crmGoogleConversionSync.ts` — nitelikli lead'leri
      batch'leyip `events:ingest`'e gönderen fonksiyon (`google_sync_status` günceller;
      kök neden olmadan "başarılı" yazılmaz — gerçek API yanıtı loglanır).
- [ ] **TODO-DM-7:** Gelecek Customer Match (Hedef Kitle) özelliği yazılırsa
      `audienceMembers:ingest` kullan — `OfflineUserDataJobService` YASAK (aynı deprecation hattı).
- [ ] **TODO-DM-8 (opsiyonel, danışman metni):** `lib/yoai/ai/docs/google_ads_rules_curated.ts`
      + `docs/google_ads_resmi_dokumanlari.md` offline import anlatımına "API ile gönderim
      artık Data Manager API üzerinden" notu ekle (yalnız metin; AI engine koduna dokunma).

## 6. Korunanlar (değişmeyecek)

- ✅ Google Ads API **raporlama + GAQL okuma** (tüm modüller) — normal devam eder.
- ✅ Kampanya oluşturma/yayınlama/düzenleme mutate akışları — normal devam eder.
- ✅ `deployGoogleAdsConversions` (conversion action + remarketing list oluşturma) — normal devam eder.
- ✅ GA4 / GTM / Meta CAPI kurulum akışları — kapsam dışı, dokunulmadı.
- ✅ Meta Offline Event Sets — Meta tarafı, Google deprecation'la ilgisiz.
