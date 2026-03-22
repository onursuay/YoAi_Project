# Google Ads API - Kapsamli Uygulama Dokumani & Gelistirme Plani

---

## Kritik Koruma Kuralı

> **⛔ DO-NOT-TOUCH — ZORUNLU GUARDRAIL**

Google Ads Search campaign flow, dosya yapısı, state yapısı, validation zinciri, payload builder, route zinciri ve çalışan UI yapısı korunacaktır. Search tarafında hiçbir dosya değiştirilmeyecektir.

Google Ads > Hedef Kitleler > Kitle Segmentlerini Düzenle alanı ve buna bağlı hedef kitle çalışma kod yapısı korunacaktır. Audience manager, audience criteria, audience segment ve ilgili hedef kitle altyapısı refactor edilmeyecek, taşınmayacak ve bozulmayacaktır.

Hedef kitle, konum ve AB siyasi reklamları gibi ortak alanlar gerekiyorsa shared/common yaklaşımı Search implementasyonunu değiştirmeden ele alınacaktır. Search akışını etkileyen kırıcı refactor kesinlikle yasaktır.

**Korunan dosyalar (kesinlikle dokunulmayacak):**

- `components/google/wizard/GoogleCampaignWizard.tsx` (Search wizard)
- `components/google/wizard/shared/WizardTypes.ts` (Search state)
- `components/google/wizard/shared/WizardValidation.ts` (Search validation)
- `components/google/wizard/shared/WizardHelpers.ts` (Search helpers)
- `components/google/wizard/steps/Step*.tsx` (Tüm Search step dosyaları)
- `components/google/detail/AudienceSegmentEditor.tsx` (Audience editor)
- `components/google/wizard/steps/StepAudience.tsx` (Audience step)

**Bu kural future work, code review ve her türlü refactoring için geçerlidir.**

---

## BOLUM 0: PRODUCTION KURULUM

## 1. Apply migration (one-time)

Run the migration SQL in your Supabase project:

1. Open **Supabase Dashboard** → **SQL Editor** → **New query**
2. Paste and run the contents of `supabase/migrations/20260315000000_create_google_ads_connections.sql`:

```sql
CREATE TABLE IF NOT EXISTS google_ads_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider text NOT NULL DEFAULT 'google_ads',
  google_ads_refresh_token text,
  google_ads_customer_id text,
  google_ads_login_customer_id text,
  token_scope text,
  connected_email text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_connected_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_ads_connections_user ON google_ads_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_connections_status ON google_ads_connections (status) WHERE status = 'active';
COMMENT ON TABLE google_ads_connections IS 'Persistent Google Ads OAuth context per user (session_id). Used by admin refresh and background jobs when cookies unavailable.';
```

3. Click **Run**

## 2. Production env vars (Vercel / hosting)

Add these to your production environment:

| Variable | Required | Notes |
|----------|----------|-------|
| `ADMIN_SECRET` | Yes | Random 32+ char secret for admin endpoints. Generate: `openssl rand -hex 32` |
| `EDGE_CONFIG` | Yes | Already in .env.local – Edge Config connection for reads |
| `AUDIENCE_EDGE_CONFIG_ID` | Yes | Edge Config ID (e.g. `ecfg_xxx`) – from Storage → Edge Config → your config |
| `VERCEL_API_TOKEN` | Yes | Vercel API token (Dashboard → Settings → Tokens) scoped to team if applicable |
| `VERCEL_TEAM_ID` | If team | Required when Edge Config is team-scoped. Team Settings → General → Team ID |
| `GOOGLE_ADS_REFRESH_TOKEN` | Optional | Env override for admin refresh (avoids DB) |
| `GOOGLE_ADS_CUSTOMER_ID` | Optional | With above, for admin refresh |
| `DATABASE_URL` | Optional | For `npm run db:migrate:google-ads` – migration can also be run via Supabase SQL Editor |

## 3. Connect flow (creates DB row)

1. Go to **Entegrasyon** (integrations)
2. Click **Google Ads'i Bağla**
3. Complete OAuth and choose an account
4. This will create an active row in `google_ads_connections`

## 4. Run admin refresh

```bash
curl -X POST https://yoai.yodijital.com/api/admin/google-audiences/refresh \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json"
```

## 5. Verify

```bash
npm run verify:google-ads
```

Or set `VERIFY_BASE_URL` to test against a specific URL.

---

## Context

YoAi platformunda Meta Ads dashboard'una benzer sekilde, tam kapsamli bir **Google Ads yonetim paneli** gelistirilecek. Mevcut projede zaten temel bir altyapi mevcut (OAuth, kampanya listeleme, basit kampanya olusturma wizard'i). Ancak Google Ads'in gercek gucunu yansitan, profesyonel bir dashboard icin onemli eksikler var. Bu dokuman, Google Ads API v23/v23.1 (Mart 2026 guncel) ile tam uyumlu, uretim seviyesinde bir uygulama icin teknik referans ve gelistirme plani niteligindedir.

**URL:** `https://yoai.yodijital.com/google-ads`

---

## BOLUM 1: GOOGLE ADS API MIMARISI

### 1.1 API Versiyonu & Endpoint Yapisi

```
Base URL: https://googleads.googleapis.com/v23
```

| Versiyon | Durum | Sunset Tarihi |
|----------|-------|---------------|
| v23.1 | **GUNCEL (Onerilen)** | - |
| v23 | Aktif | - |
| v22.1 | Aktif | ~Agustos 2026 |
| v21.1 | Aktif | ~Mayis 2026 |
| v20.2 | Aktif | ~Subat 2026 |
| v19 | **KAPANDI** | 11 Subat 2026 |

> **KRITIK:** Projede `v20` kullaniliyor (`lib/googleAdsAuth.ts:75`). **v23'e yukseltilmeli.** v20'nin sunset tarihi yaklasmasina ragmen v20.2 ile uzatildi, ancak v23 onerilen surume gecilmeli.

### 1.2 Kimlik Dogrulama (Authentication)

```
Authorization: Bearer <access_token>
developer-token: <GOOGLE_ADS_DEVELOPER_TOKEN>
login-customer-id: <manager_customer_id>  (yalnizca MCC hesaplarinda)
Content-Type: application/json
```

**Mevcut Implementasyon:** `lib/googleAdsAuth.ts`
- OAuth 2.0 flow: `app/api/integrations/google-ads/start/route.ts` → Google Auth
- Callback: `app/api/integrations/google-ads/callback/route.ts`
- Token yenileme: `getGoogleAdsAccessToken()` (refresh_token → access_token)
- Context builder: `getGoogleAdsContext()` (cookie'lerden okur)

**Cookie'ler:**
- `google_refresh_token` - OAuth refresh token
- `google_ads_customer_id` - Secili musteri ID (10 haneli, tiresiz)
- `google_ads_login_customer_id` - MCC/Manager hesap ID

### 1.3 Kaynak Hiyerarsisi (Resource Hierarchy)

```
Customer (Musteri Hesabi)
├── Campaign (Kampanya)
│   ├── CampaignBudget (Butce)
│   ├── CampaignCriterion (Hedefleme Kriterleri)
│   │   ├── Location (Konum Hedefleme)
│   │   ├── AdSchedule (Reklam Zamanlama)
│   │   ├── Keyword (Negatif Anahtar Kelime - Kampanya Seviyesi)
│   │   ├── Device (Cihaz Hedefleme)
│   │   ├── Language (Dil Hedefleme)
│   │   └── AudienceSegment (Kitle Hedefleme)
│   ├── AdGroup (Reklam Grubu)
│   │   ├── AdGroupCriterion (Reklam Grubu Kriterleri)
│   │   │   ├── Keyword (Anahtar Kelime)
│   │   │   ├── Placement (Yerlesim)
│   │   │   ├── Topic (Konu)
│   │   │   └── AudienceSegment (Kitle)
│   │   └── AdGroupAd (Reklam)
│   │       └── Ad (Reklam Icerigi)
│   │           ├── ResponsiveSearchAd (RSA)
│   │           ├── ResponsiveDisplayAd (RDA)
│   │           ├── VideoAd
│   │           ├── AppAd
│   │           └── SmartCampaignAd
│   ├── AssetGroup (Varlik Grubu - PMax icin)
│   │   ├── AssetGroupAsset (Varlik Grubu Varliklari)
│   │   ├── AssetGroupSignal (Sinyal)
│   │   └── AssetGroupListingGroupFilter (Listeleme Grubu Filtresi)
│   └── CampaignAsset (Kampanya Varliklari / Uzantilar)
│       ├── SitelinkAsset (Site Baglantisi)
│       ├── CallAsset (Arama)
│       ├── CalloutAsset (Ek Aciklama)
│       ├── StructuredSnippetAsset (Yapilandirilmis Snippet)
│       ├── PriceAsset (Fiyat)
│       ├── PromotionAsset (Tanitim)
│       ├── LocationAsset (Konum)
│       ├── ImageAsset (Gorsel)
│       └── LeadFormAsset (Potansiyel Musteri Formu)
├── ConversionAction (Donusum Eylemi)
├── UserList (Kullanici Listesi / Remarketing)
├── SharedSet (Paylasilan Kume - Neg. Keyword Listeleri)
├── Label (Etiket)
├── BiddingStrategy (Teklif Stratejisi - Portfoy)
└── CustomerAsset (Hesap Seviyesi Varliklar)
```

### 1.4 Resource Name Formati

Google Ads API'de her nesne bir `resourceName` ile tanimlanir:

```
customers/{customer_id}/campaigns/{campaign_id}
customers/{customer_id}/adGroups/{ad_group_id}
customers/{customer_id}/adGroupAds/{ad_group_id}~{ad_id}
customers/{customer_id}/campaignBudgets/{budget_id}
customers/{customer_id}/assets/{asset_id}
customers/{customer_id}/campaignCriteria/{campaign_id}~{criterion_id}
```

### 1.5 GAQL - Google Ads Query Language

GAQL, Google Ads verilerini sorgulamak icin kullanilan SQL-benzeri dildir.

**Sorgulama Endpoint:**
```
POST /v23/customers/{customerId}/googleAds:search
Body: { "query": "SELECT ... FROM ... WHERE ..." }
```

**Yapi:**
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros
FROM campaign
WHERE
  campaign.status != 'REMOVED'
  AND segments.date DURING LAST_30_DAYS
ORDER BY metrics.impressions DESC
LIMIT 100
```

**Temel Kaynaklar (FROM clause):**

| Kaynak | Aciklama |
|--------|----------|
| `campaign` | Kampanya verileri |
| `ad_group` | Reklam grubu verileri |
| `ad_group_ad` | Reklam verileri |
| `ad_group_criterion` | Anahtar kelime, kitle vb. |
| `campaign_criterion` | Kampanya seviyesi kriterler |
| `campaign_budget` | Butce bilgileri |
| `customer` | Hesap seviyesi metrikler |
| `search_term_view` | Arama terimi raporu |
| `keyword_view` | Anahtar kelime gorunumu |
| `gender_view` | Cinsiyet raporu |
| `age_range_view` | Yas araligi raporu |
| `geographic_view` | Cografi rapor |
| `user_location_view` | Kullanici konum raporu |
| `landing_page_view` | Varis sayfasi raporu |
| `shopping_performance_view` | Alisveris performansi |
| `asset_group` | PMax varlik gruplari |
| `asset_group_asset` | PMax varliklari |
| `change_event` | Degisiklik gecmisi |
| `recommendation` | Optimizasyon onerileri |
| `conversion_action` | Donusum eylemleri |
| `bidding_strategy` | Teklif stratejileri |

**Tarih Filtresi Sabitleri:**
```
LAST_7_DAYS, LAST_14_DAYS, LAST_30_DAYS, LAST_90_DAYS
THIS_MONTH, LAST_MONTH, THIS_QUARTER, LAST_QUARTER
THIS_YEAR, LAST_YEAR
PREVIOUS_30_DAYS (onceki 30 gun - karsilastirma icin)
```

**Segment Alanlari (Metrik Kirilimlari):**
```
segments.date                    -- Gunluk kirilim
segments.day_of_week             -- Hafta gunu kirilimi
segments.device                  -- Cihaz kirilimi
segments.ad_network_type         -- Ag turu kirilimi
segments.click_type              -- Tiklama turu kirilimi
segments.conversion_action       -- Donusum eylemi kirilimi
segments.hour                    -- Saat kirilimi
segments.ad_destination_type     -- Hedef turu
```

### 1.6 Mutate (Degisiklik) Islemleri

**Endpoint Sablonu:**
```
POST /v23/customers/{customerId}/{resource}:mutate
Body: { "operations": [ { "create": {...} }, { "update": {...}, "updateMask": "field1,field2" }, { "remove": "resourceName" } ] }
```

**Onemli Kurallar:**
- `create`: Yeni kaynak olusturur, resourceName otomatik atanir
- `update`: Mevcut kaynagi gunceller, `updateMask` zorunlu
- `remove`: resourceName ile siler (geri alinamaz)
- Tek istekte birden fazla operation gonderilebilir (toplu islem)
- Partial failure: `partialFailure: true` ile kismen basarili islemler

**Micro Birim Sistemi:**
```
1 TRY = 1,000,000 micro
50.75 TRY = 50,750,000 micro

Donusum: amount_micros / 1_000_000 = gercek para birimi
```

---

## BOLUM 2: KAMPANYA TIPLERI & YAPILANDIRMA

### 2.1 Kampanya Tipleri (AdvertisingChannelType)

| Tip | Enum | Desteklenen Reklam Formatlari |
|-----|------|------------------------------|
| **Search** | `SEARCH` | ResponsiveSearchAd (RSA), DynamicSearchAd (DSA) |
| **Display** | `DISPLAY` | ResponsiveDisplayAd (RDA), ImageAd |
| **Video** | `VIDEO` | InStreamAd, BumperAd, VideoDiscoveryAd, ShortsAd |
| **Shopping** | `SHOPPING` | ProductShoppingAd, ShowcaseShoppingAd |
| **Performance Max** | `PERFORMANCE_MAX` | Tum formatlar (otomatik) |
| **Demand Gen** | `DEMAND_GEN` | DemandGenMultiAssetAd, DemandGenCarouselAd, DemandGenVideoAd |
| **App** | `MULTI_CHANNEL` | AppAd (otomatik) |
| **Smart** | `SMART` | SmartCampaignAd |
| **Local** | `LOCAL` | LocalAd |

### 2.2 Teklif Stratejileri (Bidding Strategies)

| Strateji | Enum Adi | Aciklama | Kullanim |
|----------|----------|----------|----------|
| Tiklama Sayisini Artir | `targetSpend` (MAXIMIZE_CLICKS) | Butce dahilinde maks. tiklama | Search, Display |
| Donusumleri Artir | `maximizeConversions` | Maks. donusum sayisi | Search, Display, PMax |
| Donusum Degerini Artir | `maximizeConversionValue` | Maks. donusum degeri | Search, PMax |
| Hedef CPA | `targetCpa` | Belirlenen CPA hedefi | Search, Display |
| Hedef ROAS | `targetRoas` | Belirlenen ROAS hedefi | Search, Shopping, PMax |
| Manuel CPC | `manualCpc` | Manuel tiklama basina maliyet | Search, Display |
| Manuel CPM | `manualCpm` | Manuel bin gosterim maliyeti | Display, Video |
| Hedef CPM | `targetCpm` | Hedef bin gosterim maliyeti | Video (Awareness) |
| Hedef Gosterim Payi | `targetImpressionShare` | Sayfa ust pozisyon hedefi | Search |
| Goruntulenebilir CPM | `cpmGoalMicros` | Goruntulenebilir gosterim | Display |

**Teklif Stratejisi API Yapisi (Kampanya Olusturma):**
```json
// MAXIMIZE_CLICKS
{ "targetSpend": { "cpcBidCeilingMicros": "5000000" } }

// MAXIMIZE_CONVERSIONS
{ "maximizeConversions": { "targetCpaMicros": "10000000" } }

// MAXIMIZE_CONVERSION_VALUE
{ "maximizeConversionValue": { "targetRoas": 4.0 } }

// TARGET_CPA
{ "targetCpa": { "targetCpaMicros": "10000000" } }

// TARGET_ROAS
{ "targetRoas": { "targetRoas": 4.0 } }

// MANUAL_CPC
{ "manualCpc": { "enhancedCpcEnabled": true } }

// TARGET_IMPRESSION_SHARE
{ "targetImpressionShare": {
    "location": "TOP_OF_PAGE",
    "locationFractionMicros": "700000",
    "cpcBidCeilingMicros": "5000000"
  }
}
```

### 2.3 Search Kampanya Detaylari

**Ag Ayarlari:**
```json
{
  "networkSettings": {
    "targetGoogleSearch": true,
    "targetSearchNetwork": true,
    "targetContentNetwork": false,
    "targetPartnerSearchNetwork": false
  }
}
```

**Responsive Search Ad (RSA) Kurallari:**
- Min 3, max 15 headline (her biri max 30 karakter)
- Min 2, max 4 description (her biri max 90 karakter)
- Headlines ve descriptions sabitlenebilir (pinning): `HEADLINE_1`, `HEADLINE_2`, `HEADLINE_3`, `DESCRIPTION_1`, `DESCRIPTION_2`
- Path1: max 15 karakter, Path2: max 15 karakter
- Final URL zorunlu

**Keyword Match Types:**
| Tur | Soz Dizimi | Aciklama |
|-----|------------|----------|
| Broad | `keyword` | Genis eslesme, tum ilgili aramalar |
| Phrase | `"keyword"` | Ifade eslesmesi, anlam korunur |
| Exact | `[keyword]` | Tam eslesme, en dar kapsam |

### 2.4 Display Kampanya Detaylari

**Responsive Display Ad (RDA):**
```json
{
  "ad": {
    "responsiveDisplayAd": {
      "headlines": [{ "text": "Baslik 1" }],
      "longHeadline": { "text": "Uzun Baslik Buraya" },
      "descriptions": [{ "text": "Aciklama 1" }],
      "businessName": "Sirket Adi",
      "marketingImages": [{ "asset": "customers/123/assets/456" }],
      "squareMarketingImages": [{ "asset": "customers/123/assets/789" }],
      "logoImages": [{ "asset": "customers/123/assets/101" }],
      "callToActionText": "Simdi Incele"
    },
    "finalUrls": ["https://example.com"]
  }
}
```

**Gorsel Gereksinimleri:**
| Tip | Boyut | En-Boy Orani |
|-----|-------|--------------|
| Marketing Image | 1200x628 | 1.91:1 |
| Square Marketing | 1200x1200 | 1:1 |
| Logo | 1200x1200 | 1:1 |
| Landscape Logo | 1200x300 | 4:1 |

### 2.5 Performance Max (PMax) Kampanya Detaylari

PMax, Google'in tum kanallarinda (Search, Display, YouTube, Gmail, Maps, Discover) reklam veren otomatik kampanya turudur.

**Yapi: Campaign → AssetGroup → AssetGroupAsset**

```json
// 1. PMax Kampanya Olusturma
{
  "create": {
    "name": "PMax Kampanyam",
    "advertisingChannelType": "PERFORMANCE_MAX",
    "campaignBudget": "customers/123/campaignBudgets/456",
    "status": "PAUSED",
    "maximizeConversionValue": { "targetRoas": 3.0 },
    "urlExpansionOptOut": false
  }
}

// 2. Asset Group Olusturma
{
  "create": {
    "campaign": "customers/123/campaigns/789",
    "name": "Varlik Grubu 1",
    "status": "ENABLED",
    "finalUrls": ["https://example.com"],
    "finalMobileUrls": ["https://m.example.com"]
  }
}

// 3. Asset Group'a Varlik Ekleme
{
  "create": {
    "assetGroup": "customers/123/assetGroups/101",
    "asset": "customers/123/assets/202",
    "fieldType": "HEADLINE"  // HEADLINE, DESCRIPTION, LONG_HEADLINE,
                              // MARKETING_IMAGE, SQUARE_MARKETING_IMAGE,
                              // LOGO, YOUTUBE_VIDEO, BUSINESS_NAME,
                              // CALL_TO_ACTION_SELECTION
  }
}
```

**PMax Varlik Gereksinimleri:**
| Varlik Turu | Min | Max | Karakter/Boyut |
|-------------|-----|-----|----------------|
| Headline | 3 | 15 | Max 30 karakter |
| Long Headline | 1 | 5 | Max 90 karakter |
| Description | 2 | 5 | Max 90 karakter |
| Marketing Image (1.91:1) | 1 | 20 | Min 600x314 |
| Square Marketing Image (1:1) | 1 | 20 | Min 300x300 |
| Logo (1:1) | 1 | 5 | Min 128x128 |
| YouTube Video | 0 | 5 | - |
| Business Name | 1 | 1 | Max 25 karakter |
| Call to Action | 0 | 1 | Enum secimi |

**PMax v23 Kanal Kirilimi (YENi):**
```sql
SELECT
  campaign.id,
  segments.ad_network_type,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions
FROM campaign
WHERE
  campaign.advertising_channel_type = 'PERFORMANCE_MAX'
  AND segments.date DURING LAST_30_DAYS
```

### 2.6 Video (YouTube) Kampanya Detaylari

**Alt Tipler (AdvertisingChannelSubType):**
- `VIDEO_ACTION` - Video aksiyon kampanyasi
- `VIDEO_REACH_TARGET_FREQUENCY` - Hedef frekans
- `VIDEO_OUTSTREAM` - Outstream
- `VIDEO_BUMPER` - 6sn bumper

**Video Reklam Olusturma:**
```json
{
  "ad": {
    "type": "VIDEO_RESPONSIVE_AD",
    "videoResponsiveAd": {
      "headlines": [{ "text": "Baslik" }],
      "longHeadlines": [{ "text": "Uzun Baslik" }],
      "descriptions": [{ "text": "Aciklama" }],
      "callToActions": [{ "text": "Simdi Dene" }],
      "videos": [{ "asset": "customers/123/assets/456" }]
    },
    "finalUrls": ["https://example.com"]
  }
}
```

### 2.7 Shopping Kampanya Detaylari

**Gereksinimler:**
- Google Merchant Center hesabi baglantisi
- Urun feed'i
- `campaign.shopping_setting.merchant_id` zorunlu

```json
{
  "create": {
    "name": "Shopping Kampanyam",
    "advertisingChannelType": "SHOPPING",
    "campaignBudget": "customers/123/campaignBudgets/456",
    "shoppingSetting": {
      "merchantId": "MERCHANT_CENTER_ID",
      "salesCountry": "TR",
      "feedLabel": "online",
      "enableLocal": true
    },
    "manualCpc": { "enhancedCpcEnabled": true }
  }
}
```

---

## BOLUM 3: METRIKLER & RAPORLAMA

### 3.1 Temel Metrikler

| Metrik | GAQL Alani | Aciklama | Donusum |
|--------|------------|----------|---------|
| Gosterim | `metrics.impressions` | Reklam gosterim sayisi | Sayi |
| Tiklama | `metrics.clicks` | Tiklama sayisi | Sayi |
| Maliyet | `metrics.cost_micros` | Toplam harcama | / 1,000,000 |
| CTR | `metrics.ctr` | Tiklama orani | * 100 (%) |
| Ort. CPC | `metrics.average_cpc` | Ort. tiklama maliyeti | / 1,000,000 |
| Donusum | `metrics.conversions` | Donusum sayisi | Float |
| Donusum Degeri | `metrics.conversions_value` | Toplam donusum degeri | Float |
| Donusum Orani | `metrics.conversions_from_interactions_rate` | Donusum/tiklama | * 100 |
| Gosterim Payi | `metrics.search_impression_share` | Arama gosterim payi | Float |
| Kayip Gosterim (Butce) | `metrics.search_budget_lost_impression_share` | Butce nedeniyle kayip | Float |
| Kayip Gosterim (Siralama) | `metrics.search_rank_lost_impression_share` | Siralama nedeniyle kayip | Float |
| Kalite Puani | `ad_group_criterion.quality_info.quality_score` | 1-10 arasi | Sayi |
| Etkilesim | `metrics.engagements` | Etkilesim sayisi | Sayi |
| Video Goruntulenme | `metrics.video_views` | Video izleme sayisi | Sayi |
| Video Izleme Orani | `metrics.video_view_rate` | Izleme orani | Float |
| Benzersiz Kullanici | `metrics.unique_users` | Tekil kullanici | Sayi |
| ROAS | Hesaplama | conversions_value / cost | Manuel hesaplama |

### 3.2 Rapor Turleri & GAQL Sorgulari

**Hesap Ozeti (Dashboard KPI):**
```sql
SELECT
  segments.date,
  metrics.cost_micros,
  metrics.clicks,
  metrics.impressions,
  metrics.conversions,
  metrics.conversions_value,
  metrics.ctr,
  metrics.average_cpc
FROM customer
WHERE segments.date BETWEEN '{from}' AND '{to}'
ORDER BY segments.date ASC
```

**Kampanya Performansi:**
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  campaign.bidding_strategy_type,
  campaign.optimization_score,
  campaign.campaign_budget,
  campaign_budget.amount_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.ctr,
  metrics.average_cpc,
  metrics.conversions,
  metrics.conversions_value,
  metrics.search_impression_share,
  metrics.search_budget_lost_impression_share
FROM campaign
WHERE
  segments.date BETWEEN '{from}' AND '{to}'
  AND campaign.status != 'REMOVED'
ORDER BY metrics.cost_micros DESC
LIMIT 200
```

**Cihaz Kirilim Raporu:**
```sql
SELECT
  segments.device,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
```

**Cografi Rapor:**
```sql
SELECT
  geographic_view.country_criterion_id,
  geographic_view.location_type,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions
FROM geographic_view
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.clicks DESC
```

**Saat Bazli Rapor:**
```sql
SELECT
  segments.hour,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions
FROM campaign
WHERE segments.date DURING LAST_7_DAYS
```

**Degisiklik Gecmisi:**
```sql
SELECT
  change_event.change_date_time,
  change_event.change_resource_type,
  change_event.change_resource_name,
  change_event.client_type,
  change_event.user_email,
  change_event.old_resource,
  change_event.new_resource
FROM change_event
WHERE
  change_event.change_date_time DURING LAST_14_DAYS
ORDER BY change_event.change_date_time DESC
LIMIT 100
```

---

## BOLUM 4: VARLIKLAR (ASSETS) & UZANTILAR (EXTENSIONS)

### 4.1 Asset Sistemi (v23)

Google Ads artik "Extensions" yerine "Assets" kullaniyor. Tum uzantilar Asset olarak olusturulur ve kampanya/reklam grubu/hesap seviyesinde eklenir.

**Asset Olusturma Endpoint:**
```
POST /v23/customers/{customerId}/assets:mutate
```

**Asset Turleri:**

| Asset Turu | Field Type | Aciklama |
|------------|------------|----------|
| SitelinkAsset | `SITELINK` | Site baglantisi uzantisi |
| CallAsset | `CALL` | Telefon arama uzantisi |
| CalloutAsset | `CALLOUT` | Ek aciklama uzantisi |
| StructuredSnippetAsset | `STRUCTURED_SNIPPET` | Yapilandirilmis snippet |
| PriceAsset | `PRICE` | Fiyat uzantisi |
| PromotionAsset | `PROMOTION` | Tanitim uzantisi |
| ImageAsset | `IMAGE` | Gorsel varlik |
| TextAsset | `TEXT` | Metin varligi (inline) |
| LeadFormAsset | `LEAD_FORM` | Potansiyel musteri formu |
| YoutubeVideoAsset | `YOUTUBE_VIDEO` | YouTube video varligi |
| LocationAsset | `LOCATION` | Konum varligi |

**Sitelink Ornegi:**
```json
{
  "operations": [{
    "create": {
      "sitelinkAsset": {
        "linkText": "Urunler",
        "description1": "En yeni urunlerimiz",
        "description2": "Hemen inceleyin"
      },
      "finalUrls": ["https://example.com/urunler"]
    }
  }]
}
```

**Kampanyaya Asset Baglama:**
```
POST /v23/customers/{customerId}/campaignAssets:mutate
```
```json
{
  "operations": [{
    "create": {
      "campaign": "customers/123/campaigns/456",
      "asset": "customers/123/assets/789",
      "fieldType": "SITELINK"
    }
  }]
}
```

### 4.2 Gorsel Asset Yukleme

```
POST /v23/customers/{customerId}/assets:mutate
```
```json
{
  "operations": [{
    "create": {
      "type": "IMAGE",
      "imageAsset": {
        "data": "<base64_encoded_image>",
        "fullSize": {
          "heightPixels": 628,
          "widthPixels": 1200,
          "url": ""
        }
      },
      "name": "marketing-image-1"
    }
  }]
}
```

---

## BOLUM 5: HEDEFLEME (TARGETING)

### 5.1 Konum Hedefleme

**Geo Target Arama:**
```
POST /v23/geoTargetConstants:suggest
Body: { "locale": "tr", "countryCode": "TR", "searchTerm": "Istanbul" }
```

**Mevcut:** `lib/google-ads/locations.ts` - `searchGeoTargets()`, `addCampaignLocation()`

### 5.2 Kitle Hedefleme (Audience Targeting) — DETAYLI

Google Ads'te kitle hedefleme 7 farkli API kaynagina dayanir. Google Ads web panelindeki "Kitle segmentlerini duzenle" penceresi bu 7 kaynagi tek bir arayuzde sunar.

#### 5.2.1 Kitle Segment Turleri ve API Kaynaklari

| # | Kategori | API Kaynagi (GAQL FROM) | Aciklama | Hiyerarsik |
|---|----------|------------------------|----------|------------|
| 1 | **Yakin Ilgi Alani (Affinity)** | `user_interest` (taxonomy_type=AFFINITY) | Kullanicilarin uzun sureli ilgi alanlari ve aliskanlikları | Evet (parent/child) |
| 2 | **Pazardaki Kitle (In-Market)** | `user_interest` (taxonomy_type=IN_MARKET) | Aktif olarak arastiran/satin almak isteyen kullanicilar | Evet (parent/child) |
| 3 | **Ayrintili Demografi** | `detailed_demographic` | Kullanicilarin demografik ozellikleri (yas, gelir, egitim, ev sahipligi, medeni durum) | Evet (parent/child) |
| 4 | **Yasam Olaylari** | `life_event` | Hayatta onemli degisiklikler geciren kullanicilar (evlenme, tasınma, mezuniyet, emeklilik) | Evet (parent/child) |
| 5 | **Kullanici Listeleri (Remarketing/CRM)** | `user_list` | Reklamverenin kendi verileri (website ziyaretcileri, uygulama kullanicilari, musteri eslestirme) | Duz (flat) |
| 6 | **Ozel Kitleler** | `custom_audience` | Reklamverenin olusturdugu anahtar kelime/URL bazli kitleler | Duz (flat) |
| 7 | **Birlesik Kitleler** | `combined_audience` | Birden fazla kitle segmentini AND/OR mantigi ile birlestiren kitleler | Duz (flat) |

> **ONEMLI NOT:** `user_interest` kaynagi hem AFFINITY hem IN_MARKET segmentlerini icerir. `taxonomy_type` alani ile ayirt edilir. Ayrica `MOBILE_APP_INSTALL_USER` ve `BRAND` taxonomy tipleri de vardir.

#### 5.2.2 GAQL Sorgulari

**user_interest (Affinity + In-Market):**
```sql
-- Tum ust seviye ilgi alanlari (parent'i olmayan root'lar)
SELECT
  user_interest.user_interest_id,
  user_interest.name,
  user_interest.taxonomy_type,
  user_interest.user_interest_parent,
  user_interest.resource_name
FROM user_interest
WHERE
  user_interest.taxonomy_type IN ('AFFINITY', 'IN_MARKET')
  AND user_interest.user_interest_parent = ''
ORDER BY user_interest.name

-- Belirli parent altindaki cocuklar
SELECT
  user_interest.user_interest_id,
  user_interest.name,
  user_interest.taxonomy_type,
  user_interest.user_interest_parent,
  user_interest.resource_name
FROM user_interest
WHERE
  user_interest.taxonomy_type = 'AFFINITY'
  AND user_interest.user_interest_parent = 'customers/{customerId}/userInterests/{parentId}'

-- Arama (isim bazli)
SELECT
  user_interest.user_interest_id,
  user_interest.name,
  user_interest.taxonomy_type,
  user_interest.resource_name
FROM user_interest
WHERE
  user_interest.name LIKE '%spor%'
  AND user_interest.taxonomy_type IN ('AFFINITY', 'IN_MARKET')
```

**detailed_demographic:**
```sql
SELECT
  detailed_demographic.resource_name,
  detailed_demographic.id,
  detailed_demographic.name,
  detailed_demographic.parent,
  detailed_demographic.launched_to_all,
  detailed_demographic.availabilities
FROM detailed_demographic
WHERE detailed_demographic.launched_to_all = true
```

**life_event:**
```sql
SELECT
  life_event.resource_name,
  life_event.id,
  life_event.name,
  life_event.parent,
  life_event.launched_to_all,
  life_event.availabilities
FROM life_event
WHERE life_event.launched_to_all = true
```

**user_list (Remarketing):**
```sql
SELECT
  user_list.resource_name,
  user_list.id,
  user_list.name,
  user_list.type,
  user_list.size_range_for_display,
  user_list.description,
  user_list.membership_status
FROM user_list
WHERE user_list.membership_status = 'OPEN'
```

**custom_audience:**
```sql
SELECT
  custom_audience.resource_name,
  custom_audience.id,
  custom_audience.name,
  custom_audience.type,
  custom_audience.status,
  custom_audience.description
FROM custom_audience
```

**combined_audience:**
```sql
SELECT
  combined_audience.resource_name,
  combined_audience.id,
  combined_audience.name,
  combined_audience.status,
  combined_audience.description
FROM combined_audience
```

#### 5.2.3 Kampanya Kriterlerine Kitle Ekleme (CampaignCriteria Mutate)

Her kitle turu farkli bir alan kullanir:

```json
// 1. User List (Remarketing/CRM)
{
  "create": {
    "campaign": "customers/123/campaigns/456",
    "userList": {
      "userList": "customers/123/userLists/789"
    },
    "bidOnly": true  // OBSERVATION modu (true) vs TARGETING modu (false)
  }
}

// 2. User Interest (Affinity / In-Market)
{
  "create": {
    "campaign": "customers/123/campaigns/456",
    "userInterest": {
      "userInterestCategory": "customers/123/userInterests/80432"
    },
    "bidOnly": true
  }
}

// 3. Custom Audience
{
  "create": {
    "campaign": "customers/123/campaigns/456",
    "customAudience": {
      "customAudience": "customers/123/customAudiences/567"
    },
    "bidOnly": true
  }
}

// 4. Combined Audience
{
  "create": {
    "campaign": "customers/123/campaigns/456",
    "combinedAudience": {
      "combinedAudience": "customers/123/combinedAudiences/890"
    },
    "bidOnly": true
  }
}
```

> **OBSERVATION vs TARGETING:** `bidOnly: true` (Gozlem) = Hedef kitlenin disindaki kullanicilara da gosterilir ama kitleye ozel teklif ayarlanabilir. `bidOnly: false` (Hedefleme) = Sadece secilen kitlelere gosterilir.

#### 5.2.4 Hiyerarsik Yapi (Parent-Child)

`user_interest`, `detailed_demographic` ve `life_event` kaynaklari hiyerarsik yapidadir:

```
user_interest (AFFINITY)
├── Bankacilik ve Finans         (root - parent yok)
│   ├── Yatirimcilar             (parent = Bankacilik ve Finans)
│   │   ├── Kripto Para          (parent = Yatirimcilar)
│   │   └── Hisse Senedi         (parent = Yatirimcilar)
│   └── Sigorta                  (parent = Bankacilik ve Finans)
├── Spor ve Fitness              (root)
│   ├── Fitness Tutkunlari       (parent = Spor ve Fitness)
│   └── Takim Sporlari           (parent = Spor ve Fitness)
└── ...

detailed_demographic
├── Ev Sahipligi Durumu          (root)
│   ├── Ev Sahipleri             (child)
│   └── Kiracılar                (child)
├── Egitim Durumu                (root)
│   ├── Universite Mezunlari     (child)
│   └── Lise Mezunlari          (child)
├── Medeni Durumu                (root)
│   ├── Bekarlar                 (child)
│   └── Evliler                  (child)
└── Hane Geliri                  (root)
    ├── Ust %10                  (child)
    └── ...

life_event
├── Is Degisikligi               (root)
├── Universite Mezuniyeti         (root)
├── Evlenme                      (root)
├── Tasinma                      (root)
├── Ev Satin Alma                (root)
├── Emeklilik                    (root)
└── ...
```

**Parent alanları:**
- `user_interest.user_interest_parent` → `customers/{cid}/userInterests/{parentId}` (bos string = root)
- `detailed_demographic.parent` → `detailedDemographics/{parentId}` (bos = root)
- `life_event.parent` → `lifeEvents/{parentId}` (bos = root)

#### 5.2.5 Lokalizasyon (Cevirilmis Isimler) Sorunu

**KRITIK BULGU:** Google Ads API, `user_interest`, `detailed_demographic` ve `life_event` gibi sabit kaynaklarin (constant resources) isimlerini **HER ZAMAN INGILIZCE** dondurur. Bu kaynaklarin isimleri API'de lokalize edilmez.

**Denenen ve Basarisiz Olan Yontemler:**
1. `Accept-Language: tr` header'i → Etkisiz
2. `?hl=tr` query parametresi (Google system param) → Etkisiz
3. `searchGAds` fonksiyonunda locale gecme → Etkisiz

**Nedeni:** Bu sabit kaynaklar (constant resources) Google'in global katalogudur. API katmaninda lokalizasyon DESTEKLENMEZ. Google Ads web paneli, bu isimleri istemci tarafinda (client-side) kendi iç cevirileri ile Turkceye cevirir. Bu ceviri tablolari API uzerinden erisime ACIK DEGILDIR.

**Cozum Yaklasimlari:**
1. **Statik ceviri haritasi (JSON):** En yaygin ~100-200 ust seviye kategori icin manuel ceviri dosyasi olusturmak. Dezavantaj: bakım gerektirir, alt kategoriler binlerce olabilir.
2. **Google Cloud Translation API:** Isimleri dinamik olarak cevirmek. Dezavantaj: ek maliyet, gecikme, API kurulumu.
3. **Hibrit:** Ust seviye (top-level) kategorileri statik cevirirken, alt kategoriler icin Translation API kullanmak.

#### 5.2.6 Mevcut Implementasyon (YoAi)

| Dosya | Islem |
|-------|-------|
| `lib/google-ads/audience-segments.ts` | 7 kitle turu icin GAQL sorgulari, arama/gozat/cocuk fonksiyonlari |
| `app/api/integrations/google-ads/tools/audience-segments/route.ts` | API route: `mode=search`, `mode=browse`, `mode=children` |
| `components/google/wizard/steps/StepAudience.tsx` | Ara/Gozat sekmeleri, hiyerarsik agac, kategori rozetleri |
| `lib/google-ads/create-campaign.ts` | Kampanya kriterlerine kitle ekleme (userList, userInterest, customAudience, combinedAudience) |
| `components/google/wizard/shared/WizardHelpers.ts` | Payload builder: kitle segmentlerini kategoriye gore ayirir |

**AudienceSegment Interface:**
```typescript
export type AudienceSegmentCategory =
  | 'AFFINITY' | 'IN_MARKET' | 'DETAILED_DEMOGRAPHIC' | 'LIFE_EVENT'
  | 'USER_LIST' | 'CUSTOM_AUDIENCE' | 'COMBINED_AUDIENCE'

export interface AudienceSegment {
  id: string
  name: string
  category: AudienceSegmentCategory
  resourceName: string
  parentId?: string
  subType?: string
  sizeRange?: string
  description?: string
}

export interface SelectedAudienceSegment {
  id: string
  name: string
  category: AudienceSegmentCategory
  resourceName: string
}
```

**Wizard StepAudience UI Yapisi:**
- **Ara sekmesi:** Tum kitle turlerinde debounced arama
- **Gozat sekmesi:** 7 katlanabilir bolum, her biri hiyerarsik agac (parent-child genisletilebilir)
- Kategori renkleri: Mor=Affinity, Yesil=In-Market, Turuncu=Demografi, Pembe=Yasam Olayı, Mavi=UserList, Gri=Ozel/Birlesik
- Secilen segmentler cikarilabilir pill'ler olarak gosterilir
- Gozlem vs Hedefleme modu secimi

#### 5.2.5 Kitle Segment Isim Ceviri Sistemi (TR Lokalizasyon)

Google Ads API `Accept-Language: tr` header'i ile segment isimlerinin ~%60'ini Turkce donduruyor. Kalan ~%40'i Ingilizce veya karisik (TR/EN) geliyor. Bu isimler display katmaninda Turkce'ye cevrilir.

**Mimari: 3 Katmanli Ceviri**

```
Google API sonucu → STATIC_TR harita → Trips pattern → dynamicCache (dosya) → OpenAI (sadece yeni isimler)
```

| Katman | Kaynak | Hiz | Aciklama |
|--------|--------|-----|----------|
| 1. STATIC_TR | `lib/google-ads/audience-translations.ts` | Aninda | ~400 bilinen Ingilizce isim → Turkce eslesmesi |
| 2. Trips pattern | Ayni dosya, `TRIP_DEST_TR` | Aninda | "Trips to X" → "{Ulke} Seyahatleri" (~60 destinasyon) |
| 3. dynamicCache | `data/audience-translation-cache.json` | Aninda | 463 on-yuklu ceviri + runtime'da eklenenler |
| 4. OpenAI | `gpt-4o-mini` API | ~1-2sn | Sadece cache'te OLMAYAN yeni Ingilizce isimler icin |

**Isleyis:**
1. Segment isimleri `translateSegmentsBatch()` fonksiyonuna girer
2. Her isim sirayla kontrol edilir: STATIC_TR → Trips → cache → Turkce mi? → Marka mi?
3. Kalan bilinmeyen isimler 50'lik batch'ler halinde OpenAI'a gonderilir
4. OpenAI sonuclari `data/audience-translation-cache.json` dosyasina yazilir (kalici)
5. Ayni isim bir daha geldiginde cache'ten okunur, OpenAI cagirilmaz

**Dosyalar:**

| Dosya | Islem |
|-------|-------|
| `lib/google-ads/audience-translations.ts` | Ceviri motoru: STATIC_TR, TRIP_DEST_TR, OpenAI entegrasyonu, cache yonetimi |
| `data/audience-translation-cache.json` | Kalici ceviri cache dosyasi (463 on-yuklu + dinamik eklenenler) |
| `app/api/.../audience-segments/route.ts` | `translateSegments()` → batch ceviri + per-segment uygulama |

**Onemli Notlar:**
- Ceviri SADECE display katmaninda. Google'a gonderilen verilerde orijinal ID/resourceName kullanilir
- Vercel'de `writeFileSync` calismayabilir (read-only filesystem) — bu durumda cache sadece in-memory kalir
- OpenAI API key: `OPENAI_API_KEY` (.env.local), model: `gpt-4o-mini`
- Cache dosyasi repo'da commit edilir (on-yuklu haliyle deploy edilir)

### 5.3 Demografik Hedefleme

```sql
-- Yas ve cinsiyet raporu
SELECT
  ad_group_criterion.age_range.type,
  ad_group_criterion.gender.type,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions
FROM gender_view  -- veya age_range_view
WHERE segments.date DURING LAST_30_DAYS
```

### 5.4 Cihaz Hedefleme

```json
{
  "create": {
    "campaign": "customers/123/campaigns/456",
    "device": { "type": "MOBILE" },
    "bidModifier": 1.2  // %20 artis
  }
}
```

### 5.5 Dil Hedefleme

```json
{
  "create": {
    "campaign": "customers/123/campaigns/456",
    "language": {
      "languageConstant": "languageConstants/1037"  // Turkce
    }
  }
}
```

**Yaygin Dil Kodlari:**
| Dil | ID |
|-----|----|
| Turkce | 1037 |
| Ingilizce | 1000 |
| Almanca | 1001 |
| Fransizca | 1002 |
| Ispanyolca | 1003 |

---

## BOLUM 6: DONUSUM IZLEME & OPTIMIZASYON

### 6.1 Conversion Actions

**Mevcut:** `lib/google-ads/attribution.ts`

```sql
SELECT
  conversion_action.resource_name,
  conversion_action.name,
  conversion_action.type,
  conversion_action.status,
  conversion_action.category,
  conversion_action.attribution_model_settings.attribution_model,
  conversion_action.click_through_lookback_window_days,
  conversion_action.view_through_lookback_window_days,
  conversion_action.value_settings.default_value,
  conversion_action.value_settings.always_use_default_value
FROM conversion_action
WHERE conversion_action.status != 'REMOVED'
```

**Attribution Modelleri:**
- `LAST_CLICK` - Son tiklama
- `FIRST_CLICK` - Ilk tiklama
- `LINEAR` - Dogrusal
- `TIME_DECAY` - Zaman azalmasi
- `POSITION_BASED` - Pozisyon bazli
- `DATA_DRIVEN` - Veri odakli (onerilen)

### 6.2 Optimization Score & Recommendations

```sql
-- Optimizasyon puani
SELECT
  customer.optimization_score,
  customer.optimization_score_weight
FROM customer

-- Oneriler
SELECT
  recommendation.resource_name,
  recommendation.type,
  recommendation.impact.base_metrics.impressions,
  recommendation.impact.potential_metrics.impressions,
  recommendation.campaign_budget_recommendation,
  recommendation.keyword_recommendation,
  recommendation.text_ad_recommendation,
  recommendation.target_cpa_opt_in_recommendation,
  recommendation.target_roas_opt_in_recommendation
FROM recommendation
WHERE recommendation.campaign IS NOT NULL
```

**Oneri Turleri:**
- `CAMPAIGN_BUDGET` - Butce artirma
- `KEYWORD` - Yeni anahtar kelime
- `TEXT_AD` - Reklam metni iyilestirme
- `TARGET_CPA_OPT_IN` - Hedef CPA gecisi
- `TARGET_ROAS_OPT_IN` - Hedef ROAS gecisi
- `MAXIMIZE_CONVERSIONS_OPT_IN` - Donusum maksimizasyonu
- `RESPONSIVE_SEARCH_AD` - RSA ekleme/iyilestirme
- `SITELINK_EXTENSION` - Sitelink ekleme
- `CALLOUT_EXTENSION` - Callout ekleme
- `PERFORMANCE_MAX_OPT_IN` - PMax gecisi

---

## BOLUM 7: MEVCUT DURUM ANALIZI & EKSIKLER

### 7.1 Mevcut Implementasyon (Tamamlanan)

| Ozellik | Dosya | Durum |
|---------|-------|-------|
| OAuth Flow | `app/api/integrations/google-ads/start/route.ts`, `callback/route.ts` | OK |
| Hesap Secimi (MCC) | `accounts/route.ts`, `children/route.ts`, `select-account/route.ts` | OK |
| Kampanya Listeleme | `campaigns/route.ts` | OK |
| Reklam Grubu Listeleme | `ad-groups/route.ts` | OK |
| Reklam Listeleme | `ads/route.ts` | OK |
| Kampanya Olusturma (Search) | `campaigns/create/route.ts`, `lib/google-ads/create-campaign.ts` | OK |
| Kampanya Status Toggle | `campaigns/[campaignId]/status/route.ts` | OK |
| Kampanya Butce Guncelleme | `campaigns/[campaignId]/budget/route.ts` | OK |
| Dashboard KPI'lar | `dashboard-kpis/route.ts`, `dashboard/summary/route.ts` | OK |
| Konum Hedefleme | `geo-targets/route.ts`, `campaigns/[campaignId]/locations/route.ts` | OK |
| Anahtar Kelime Yonetimi | `adgroups/[adGroupId]/keywords/route.ts`, `lib/google-ads/keywords.ts` | OK |
| Reklam Zamanlama | `campaigns/[campaignId]/ad-schedule/route.ts`, `lib/google-ads/adschedule.ts` | OK |
| Keyword Planner | `tools/keyword-planner/route.ts`, `lib/google-ads/keyword-planner.ts` | OK |
| Audience Manager | `tools/audience-manager/route.ts`, `lib/google-ads/audience-manager.ts` | OK |
| Arama Terimleri | `search-terms/route.ts`, `lib/google-ads/reports.ts` | OK |
| Attribution | `goals/attribution/route.ts`, `lib/google-ads/attribution.ts` | OK |
| Disconnect | `disconnect/route.ts` | OK |
| CampaignWizard (Search) | `components/google/wizard/GoogleCampaignWizard.tsx` | OK |
| KPI Spark Cards | `components/google/KpiSparkCard.tsx` | OK |

### 7.2 Eksik Ozellikler (Gelistirilecek)

**ONCELIK 1 - Kritik (Dashboard Fonksiyonellik):**

| # | Ozellik | Aciklama |
|---|---------|----------|
| 1 | API Versiyonu v23'e Yukseltme | `googleAdsAuth.ts` icindeki `v20` -> `v23` |
| 2 | Kampanya Duzenleme (Edit Overlay) | Meta'daki `CampaignEditOverlay` benzeri - isim, butce, teklif stratejisi, tarih, hedefleme |
| 3 | Reklam Grubu Duzenleme | Ad group isim, CPC bid, status duzenleme |
| 4 | Reklam Duzenleme | RSA headlines/descriptions, URL, path duzenleme |
| 5 | Kampanya Silme | Kampanya remove operasyonu |
| 6 | Reklam Grubu Silme | Ad group remove operasyonu |
| 7 | Reklam Silme | Ad remove operasyonu |
| 8 | Kampanya Kopyalama (Duplicate) | Mevcut kampanyayi kopyalama |
| 9 | Reklam Grubu Status Toggle | Ad group ENABLED/PAUSED toggle |
| 10 | Reklam Status Toggle | Ad ENABLED/PAUSED toggle |

**ONCELIK 2 - Onemli (Gelismis Yonetim):**

| # | Ozellik | Aciklama |
|---|---------|----------|
| 11 | Display Kampanya Olusturma | RDA destegi, gorsel yukleme, kitle hedefleme |
| 12 | Performance Max Kampanya Olusturma | AssetGroup yonetimi, sinyal ayarlari |
| 13 | Video Kampanya Olusturma | YouTube video reklamlari |
| 14 | Asset/Uzanti Yonetimi | Sitelink, Callout, Call, StructuredSnippet, Image |
| 15 | Gosterim Payi Metrikleri | search_impression_share, lost_impression_share |
| 16 | Kalite Puani Goruntuleme | Quality Score, Expected CTR, Ad Relevance, Landing Page |
| 17 | Cihaz Kirilim Raporu | Desktop/Mobile/Tablet performans |
| 18 | Cografi Rapor | Ulke/sehir bazli performans |
| 19 | Saat/Gun Kirilim Raporu | Saat ve gun bazli metrikler |
| 20 | Donusum Eylem Yonetimi | Conversion action CRUD |

**ONCELIK 3 - Ileri Seviye:**

| # | Ozellik | Aciklama |
|---|---------|----------|
| 21 | Optimizasyon Onerileri | Recommendations API entegrasyonu |
| 22 | Degisiklik Gecmisi | Change History raporu |
| 23 | Varis Sayfasi Raporu | Landing page performance |
| 24 | Negatif Keyword Listeleri | SharedSet ile merkezi yonetim |
| 25 | Customer Match | Musteri listesi yukleme |
| 26 | Toplu Islemler (Bulk) | Coklu kampanya/ad group islemleri |
| 27 | Etiket Yonetimi | Label CRUD ve filtreleme |
| 28 | A/B Test (Experiments) | Campaign experiments |
| 29 | Reklam Kuvveti (Ad Strength) | RSA ad strength gosterimi |
| 30 | PMax Kanal Kirilimi (v23) | Kanal bazli performans raporu |

---

## BOLUM 8: GELISTIRME PLANI

### Faz 1: Temel Iyilestirmeler (API Guncelleme + CRUD)

**1. API Versiyonu Guncelleme**
- Dosya: `lib/googleAdsAuth.ts:75`
- Degisiklik: `GOOGLE_ADS_API_VERSION` default degerini `v23` yap
- Tum hardcoded `/v20/` referanslarini kaldir:
  - `app/api/integrations/google-ads/campaigns/route.ts:103`
  - `app/api/integrations/google-ads/ad-groups/route.ts:99`
  - `app/api/integrations/google-ads/ads/route.ts:103`
  - `app/api/integrations/google-ads/children/route.ts:53`
  - `app/api/integrations/google-ads/summary/route.ts:63`
- Bu dosyalar `GOOGLE_ADS_BASE` yerine hardcoded URL kullaniyor - `GOOGLE_ADS_BASE` kullanacak sekilde guncelle

**2. Kampanya Edit Overlay**
- Yeni dosya: `components/google/GoogleCampaignEditOverlay.tsx`
- Ozellikler: Isim duzenleme, butce, teklif stratejisi, ag ayarlari, tarih, konum
- API: Mevcut `campaigns:mutate` (update), `campaignBudgets:mutate` (update)
- Ornek: Meta'daki `components/meta/CampaignEditOverlay.tsx` yapisini takip et

**3. Ad Group Edit Drawer**
- Yeni dosya: `components/google/GoogleAdGroupEditDrawer.tsx`
- API route: `app/api/integrations/google-ads/ad-groups/update/route.ts`
- Ozellikler: Isim, CPC bid, status, keyword yonetimi

**4. Ad Edit Drawer**
- Yeni dosya: `components/google/GoogleAdEditDrawer.tsx`
- API route: `app/api/integrations/google-ads/ads/update/route.ts`
- Ozellikler: RSA headlines/descriptions, URL, path duzenleme

**5. Delete Islemleri**
- API routes:
  - `campaigns/[campaignId]/delete/route.ts`
  - `ad-groups/[adGroupId]/delete/route.ts`
  - `ads/[adId]/delete/route.ts`

**6. Status Toggle (Ad Group & Ad)**
- API routes:
  - `ad-groups/[adGroupId]/status/route.ts`
  - `ads/[adId]/status/route.ts`

### Faz 2: Yeni Kampanya Tipleri

**7. Display Kampanya Wizard**
- Yeni dosya: `components/google/wizard/GoogleDisplayWizard.tsx`
- API: Asset yukleme (image), RDA olusturma
- Hedefleme: Kitle, konu, yerlesim

**8. Performance Max Wizard**
- Yeni dosya: `components/google/wizard/GooglePMaxWizard.tsx`
- API: AssetGroup CRUD, AssetGroupAsset CRUD, Signal
- Karmasik UI: Coklu varlik tipi yukleme

**9. Video Kampanya Wizard**
- Yeni dosya: `components/google/wizard/GoogleVideoWizard.tsx`
- API: YouTube video asset, video ad olusturma

### Faz 3: Gelismis Raporlama & Araçlar

**10. Gelismis Metrikler**
- Gosterim payi, kalite puani, reklam kuvveti
- Cihaz, cografi, saat bazli kirilimlar

**11. Asset/Uzanti Yonetimi**
- Yeni dosya: `components/google/GoogleAssetManager.tsx`
- CRUD: Sitelink, Callout, Call, StructuredSnippet, Image, Price

**12. Optimizasyon Onerileri**
- API: `recommendation` resource sorgulama
- UI: Oneri kartlari, tek tikla uygulama

**13. Degisiklik Gecmisi**
- API: `change_event` resource sorgulama
- UI: Timeline goruntuleme

---

## BOLUM 9: DOSYA YAPISI (HEDEF)

```
components/google/
├── GoogleCampaignEditOverlay.tsx     [YENi]
├── GoogleAdGroupEditDrawer.tsx       [YENi]
├── GoogleAdEditDrawer.tsx            [YENi]
├── GoogleAssetManager.tsx            [YENi]
├── GoogleCampaignTreeSidebar.tsx     [YENi]
├── KpiSparkCard.tsx                  [MEVCUT]
├── wizard/
│   ├── GoogleCampaignWizard.tsx      [MEVCUT - genisletilecek]
│   ├── GoogleDisplayWizard.tsx       [YENi]
│   ├── GooglePMaxWizard.tsx          [YENi]
│   ├── GoogleVideoWizard.tsx         [YENi]
│   └── GoogleShoppingWizard.tsx      [YENi]

app/api/integrations/google-ads/
├── campaigns/
│   ├── route.ts                     [MEVCUT]
│   ├── create/route.ts              [MEVCUT]
│   ├── [campaignId]/
│   │   ├── status/route.ts          [MEVCUT]
│   │   ├── budget/route.ts          [MEVCUT]
│   │   ├── locations/route.ts       [MEVCUT]
│   │   ├── ad-schedule/route.ts     [MEVCUT]
│   │   ├── delete/route.ts          [YENi]
│   │   ├── update/route.ts          [YENi]
│   │   ├── duplicate/route.ts       [YENi]
│   │   └── details/route.ts         [YENi]
├── ad-groups/
│   ├── route.ts                     [MEVCUT]
│   ├── [adGroupId]/
│   │   ├── status/route.ts          [YENi]
│   │   ├── update/route.ts          [YENi]
│   │   ├── delete/route.ts          [YENi]
│   │   └── details/route.ts         [YENi]
├── ads/
│   ├── route.ts                     [MEVCUT]
│   ├── [adId]/
│   │   ├── status/route.ts          [YENi]
│   │   ├── update/route.ts          [YENi]
│   │   ├── delete/route.ts          [YENi]
│   │   └── details/route.ts         [YENi]
├── assets/
│   ├── route.ts                     [YENi] - Asset listeleme
│   ├── create/route.ts              [YENi] - Asset olusturma
│   ├── upload/route.ts              [YENi] - Gorsel yukleme
│   └── link/route.ts                [YENi] - Kampanya/AG'ye baglama
├── reports/
│   ├── device/route.ts              [YENi]
│   ├── geographic/route.ts          [YENi]
│   ├── hourly/route.ts              [YENi]
│   ├── landing-page/route.ts        [YENi]
│   └── change-history/route.ts      [YENi]
├── recommendations/route.ts         [YENi]
├── pmax/
│   ├── asset-groups/route.ts        [YENi]
│   └── create/route.ts              [YENi]
└── conversion-actions/route.ts      [YENi]

lib/google-ads/
├── googleAdsAuth.ts                 [MEVCUT - v23 guncelleme]
├── campaigns.ts                     [MEVCUT]
├── create-campaign.ts               [MEVCUT]
├── keywords.ts                      [MEVCUT]
├── locations.ts                     [MEVCUT]
├── reports.ts                       [MEVCUT]
├── adschedule.ts                    [MEVCUT]
├── attribution.ts                   [MEVCUT]
├── audience-manager.ts              [MEVCUT]
├── keyword-planner.ts               [MEVCUT]
├── types.ts                         [MEVCUT - genisletilecek]
├── assets.ts                        [YENi]
├── ad-groups.ts                     [YENi]
├── ads.ts                           [YENi]
├── pmax.ts                          [YENi]
├── display.ts                       [YENi]
├── video.ts                         [YENi]
├── recommendations.ts               [YENi]
└── change-history.ts                [YENi]
```

---

## BOLUM 10: DOGRULAMA & TEST

### Test Stratejisi

1. **API Versiyonu:** `v23` ile tum mevcut endpoint'lerin calistigini dogrula
2. **CRUD Islemleri:** Her kaynak tipi icin create/read/update/delete test et
3. **Hata Yonetimi:** Rate limiting (429), invalid token (401), permission denied (403) senaryolari
4. **Micro Donusum:** Tum para birimi hesaplamalarinin dogru yapildigini dogrula
5. **PMax:** AssetGroup olusturma ve varlik eklemenin basarili oldugunu test et
6. **UI:** Meta dashboard ile tutarli kullanici deneyimi

### Dogrulama Adimlari

1. Google Ads hesabina baglan (OAuth flow)
2. MCC altindaki hesaplari listele ve sec
3. Dashboard KPI kartlarinin dogru veri gosterdigini kontrol et
4. Kampanya listesinde CRUD islemlerini test et
5. Search kampanya olusturma wizard'ini test et (keyword + RSA)
6. Edit overlay'de kampanya duzenle (butce, teklif, tarih)
7. Reklam grubu ve reklam duzenleme/silme islemlerini test et
8. Tarih filtresi ve showInactive toggle'ini dogrula

---

---

## BOLUM 11: HATA YONETIMI & RATE LIMITING

### 11.1 HTTP Durum Kodlari

| Kod | Anlam | Aksiyon |
|-----|-------|---------|
| 200 | Basarili | - |
| 400 | Gecersiz istek | Parametreleri kontrol et |
| 401 | Yetkisiz | Token yenile (refresh) |
| 403 | Erisim engeli | Izinleri kontrol et, developer-token durumunu dogrula |
| 404 | Bulunamadi | Resource name'i kontrol et |
| 429 | Rate limit | Exponential backoff ile tekrar dene |
| 500 | Sunucu hatasi | Tekrar dene |
| 503 | Servis kullanilamaz | Tekrar dene |

### 11.2 Google Ads Hata Yapisi

```json
{
  "error": {
    "code": 400,
    "message": "Request contains an invalid argument.",
    "status": "INVALID_ARGUMENT",
    "details": [{
      "@type": "type.googleapis.com/google.ads.googleads.v23.errors.GoogleAdsFailure",
      "errors": [{
        "errorCode": { "campaignBudgetError": "BUDGET_BELOW_DAILY_MINIMUM_ERROR_DETAILS" },
        "message": "The budget amount is too low.",
        "trigger": { "stringValue": "500000" },
        "location": {
          "fieldPathElements": [
            { "fieldName": "operations", "index": 0 },
            { "fieldName": "create" },
            { "fieldName": "amount_micros" }
          ]
        }
      }],
      "requestId": "abc123xyz"
    }]
  }
}
```

### 11.3 Yaygin Hata Kodlari

| Hata Kategorisi | Hata Kodu | Aciklama |
|-----------------|-----------|----------|
| AuthenticationError | `CUSTOMER_NOT_FOUND` | Musteri ID bulunamadi |
| AuthenticationError | `NOT_ADS_USER` | Kullanici Google Ads kullanicisi degil |
| AuthorizationError | `DEVELOPER_TOKEN_NOT_APPROVED` | Developer token onaylanmamis |
| AuthorizationError | `USER_PERMISSION_DENIED` | Kullanici izni yok |
| CampaignBudgetError | `BUDGET_BELOW_DAILY_MINIMUM` | Min. butce altinda |
| CampaignError | `DUPLICATE_CAMPAIGN_NAME` | Ayni isimde kampanya var |
| AdGroupError | `DUPLICATE_ADGROUP_NAME` | Ayni isimde reklam grubu var |
| AdError | `TOO_MANY_AD_CUSTOMIZERS` | Cok fazla ozellesstirici |
| KeywordError | `DUPLICATE_KEYWORD` | Ayni anahtar kelime var |
| PolicyViolationError | `POLICY_FINDING` | Politika ihlali |
| QuotaError | `RESOURCE_EXHAUSTED` | Kota asimi |
| MutateError | `RESOURCE_NOT_FOUND` | Kaynak bulunamadi |
| DatabaseError | `CONCURRENT_MODIFICATION` | Esanli degisiklik |

### 11.4 Rate Limiting & Best Practices

**Limitler:**
- **Gunluk istek limiti:** ~15,000 istek/gun (normal developer token)
- **Saniye basi:** ~1,000 istek/saniye (pratikte daha dusuk)
- **GAQL pageSize:** Max 10,000 satir (default 10,000)
- **Mutate batch:** Max 5,000 operation/istek (onerilen: 1,000)
- **SearchStream:** Buyuk sorgular icin tercih edilmeli (tek response, pagination yok)

**Retry Stratejisi (Mevcut: `lib/googleAdsAuth.ts:89`):**
```
Retry 1: 1s + random(0-200ms)
Retry 2: 2s + random(0-200ms)
Retry 3: 4s + random(0-200ms)
Retry 4: 8s + random(0-200ms)
Sadece 429 ve 5xx hatalarda retry
```

### 11.5 Developer Token Seviyeleri

| Seviye | Gunluk Istek | Ozellikler |
|--------|-------------|------------|
| Test Account | Sinirsiz (test) | Sadece test hesaplarinda |
| Basic Access | 15,000/gun | Uretim hesaplarinda |
| Standard Access | 15,000/gun | Tum ozellikler |

---

## BOLUM 12: EU POLITIK REKLAM UYUMLULUGU

v23'te zorunlu hale gelen `containsEuPoliticalAdvertising` alani:

```json
{
  "containsEuPoliticalAdvertising": "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING"
}
```

**Mevcut:** `lib/google-ads/create-campaign.ts:12-14` - Zaten implemente edilmis.

---

## BOLUM 13: DEMAND GEN KAMPANYALARI (v23 YENI)

### Demand Gen Kampanya Yapisi

Demand Gen, Google Discover, YouTube ve Gmail'de gorunen reklam kampanyasidir.

```json
{
  "create": {
    "name": "Demand Gen Kampanyam",
    "advertisingChannelType": "DEMAND_GEN",
    "campaignBudget": "customers/123/campaignBudgets/456",
    "status": "PAUSED",
    "maximizeConversions": {},
    "geoTargetTypeSetting": {
      "positiveGeoTargetType": "PRESENCE_OR_INTEREST",
      "negativeGeoTargetType": "PRESENCE_OR_INTEREST"
    }
  }
}
```

**Demand Gen Reklam Formatlari:**
1. **Multi-Asset Ad:** Birden fazla gorsel/video + metin
2. **Carousel Ad:** Kayan gorsel karti
3. **Video Ad:** YouTube video reklami

**v23 Reach Planning Yeniligi:**
```
ReachPlanService.GenerateConversionRates - Gmail, Shorts gibi yuzeyler icin donusum orani onerileri
```

---

## BOLUM 14: PLANLANAN DOSYA YAPISI & AKSIYONLAR

### Ilk Aksiyon: Dokümanı Projeye Kaydet

Bu dokuman `docs/GOOGLE_ADS_API.md` olarak projeye kaydedilecek ve gelistirme surecinde referans olarak kullanilacak.

### Gelistirme Sırası

**Sprint 1 (1-2 hafta):**
1. API v23 guncelleme (`googleAdsAuth.ts`)
2. Hardcoded URL'leri GOOGLE_ADS_BASE'e cevir
3. Kampanya Edit Overlay
4. Kampanya/AdGroup/Ad silme
5. AdGroup ve Ad status toggle

**Sprint 2 (2-3 hafta):**
6. Ad Group Edit Drawer
7. Ad Edit Drawer (RSA duzenleme)
8. Asset/Uzanti yonetimi (Sitelink, Callout, Call)
9. Kampanya kopyalama

**Sprint 3 (3-4 hafta):**
10. Display kampanya wizard
11. PMax kampanya wizard
12. Gorsel yukleme altyapisi
13. Gelismis metrikler (gosterim payi, kalite puani)

**Sprint 4 (4-5 hafta):**
14. Video kampanya wizard
15. Gelismis raporlar (cihaz, cografi, saat)
16. Optimizasyon onerileri
17. Degisiklik gecmisi

---

**Referanslar:**
- Google Ads API v23 Dokumantasyonu: https://developers.google.com/google-ads/api/docs
- GAQL Referansi: https://developers.google.com/google-ads/api/docs/query/overview
- Release Notes: https://developers.google.com/google-ads/api/docs/release-notes
- v23 Duyurusu: https://ads-developers.googleblog.com/2026/01/announcing-v23-of-google-ads-api.html
- v23.1 Duyurusu: https://ads-developers.googleblog.com/2026/02/announcing-v231-of-google-ads-api.html
- API Yapisi: https://developers.google.com/google-ads/api/docs/concepts/api-structure
- Mutate Best Practices: https://developers.google.com/google-ads/api/docs/mutating/best-practices
- Asset Yonetimi: https://developers.google.com/google-ads/api/docs/assets/working-with-assets
