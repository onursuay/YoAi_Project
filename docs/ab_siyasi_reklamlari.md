# AB Siyasi Reklamları (EU Political Ads) — YoAI Google Ads Sistemi

## 1. Genel Bakış

Google Ads, AB (Avrupa Birliği) siyasi reklamcılık düzenlemesi kapsamında kampanya oluştururken kullanıcıdan bir **beyan** (declaration) alınmasını zorunlu kılar. Kullanıcı kampanyanın AB siyasi reklamı içerip içermediğini beyan eder; "içeriyor" seçilirse kampanya AB bölgelerinde yayınlanamaz.

**Google Ads API karşılığı:** `campaign.eu_political_advertising` alanı.

---

## 2. Mevcut Implementasyon Durumu

### 2.1 Katman Haritası

| Katman | Dosya | Durum |
|--------|-------|-------|
| **TypeScript Tipi (UI)** | `components/google/wizard/shared/WizardTypes.ts` | ✅ Tanımlı |
| **UI Bileşeni** | `components/google/wizard/steps/StepCampaignSettingsSearch.tsx` | ✅ Gösteriliyor |
| **WizardState default** | `WizardTypes.ts → defaultState` | ✅ `NOT_POLITICAL` |
| **Backend tipi** | `lib/google-ads/create-campaign.ts` | ✅ Tanımlı |
| **Wizard → API mapping** | `create-campaign.ts → CreateCampaignParams` | ⚠️ EKSİK |
| **API payload'a geçiş** | `route.ts` veya `create-campaign.ts` içinde | ⚠️ EKSİK |
| **i18n locales** | `locales/tr.json`, `locales/en.json` | ❌ EKSİK |

---

## 3. Tip Tanımları

### 3.1 UI State Tipi (`WizardTypes.ts`)
```typescript
// UI'da kullanılan değerler
export type EuPoliticalAdsDeclaration = 'NOT_POLITICAL' | 'POLITICAL'

// WizardState içinde
euPoliticalAdsDeclaration: EuPoliticalAdsDeclaration

// defaultState içinde
euPoliticalAdsDeclaration: 'NOT_POLITICAL'
```

### 3.2 Google Ads API Tipi (`create-campaign.ts`)
```typescript
// Google Ads API'ye gönderilecek değerler
export type EuPoliticalAdvertising =
  | 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'
  | 'CONTAINS_EU_POLITICAL_ADVERTISING'

const DEFAULT_EU_POLITICAL_ADVERTISING: EuPoliticalAdvertising =
  'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'
```

### 3.3 UI → API Değer Mapping
```typescript
// Bu mapping create-campaign.ts içine eklenmelidir
const EU_POLITICAL_MAP: Record<EuPoliticalAdsDeclaration, EuPoliticalAdvertising> = {
  NOT_POLITICAL: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
  POLITICAL:     'CONTAINS_EU_POLITICAL_ADVERTISING',
}
```

---

## 4. UI Bileşeni — `StepCampaignSettingsSearch.tsx`

AB Siyasi Reklamları bloğu bu component'ın **4. section'ı** olarak bulunur. Sadece bu step'te gösterilir (Search + diğer campaign type'lar için `StepCampaignSettings.tsx`'de **mevcut değildir**).

### 4.1 Görsel Yapı
```
┌─────────────────────────────────────────────┐
│  🛡️  AB Siyasi Reklamları                   │
│  Kampanyanızda AB ile ilgili siyasi reklam   │
│  var mı?                                     │
│                                              │
│  ○  Hayır, bu kampanyada AB ile ilgili       │
│     siyasi reklam yok                        │
│     [helper note — isteğe bağlı]            │
│                                              │
│  ○  Evet, bu kampanyada AB ile ilgili        │
│     siyasi reklam var                        │
│     ┌─ Uyarı ───────────────────────────┐  │
│     │ ⚠️ Kampanyanız AB'de yayınlanamaz  │  │
│     │ ... politika hakkında daha fazla  │  │
│     └────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 4.2 State Bağlantısı
```typescript
// Okuma
state.euPoliticalAdsDeclaration  // 'NOT_POLITICAL' | 'POLITICAL'

// Yazma
update({ euPoliticalAdsDeclaration: 'NOT_POLITICAL' })
update({ euPoliticalAdsDeclaration: 'POLITICAL' })
```

### 4.3 Koşullu Rendering

- `NOT_POLITICAL` seçiliyken: Helper note gösterilir (isteğe bağlı bilgi)
- `POLITICAL` seçiliyken: **Amber uyarı kutusu** gösterilir, AB'de yayınlanamayacağı bildirilir, Google policy URL linki sunulur

### 4.4 Policy URL
```typescript
const EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'
// Locale'e göre: ?hl=tr veya ?hl=en
```

---

## 5. i18n Anahtarları (Locales)

`StepCampaignSettingsSearch.tsx` şu `t()` anahtarlarını kullanır. **Mevcut locales dosyalarında eksiktir, eklenmesi gerekir.**

### `locales/tr.json` — eklenecek keyler:
```json
{
  "settings": {
    "euPoliticalTitle": "AB Siyasi Reklamları",
    "euPoliticalQuestion": "Kampanyanızda Avrupa Birliği ile ilgili siyasi reklam var mı?",
    "euPoliticalNotPolitical": "Hayır, bu kampanyada AB ile ilgili siyasi reklam yok",
    "euPoliticalPolitical": "Evet, bu kampanyada AB ile ilgili siyasi reklam var",
    "euPoliticalHelperNote": "Bu kampanya AB siyasi reklamı içermiyor.",
    "euPoliticalHelperNoteOptional": "(isteğe bağlı)",
    "euPoliticalWarningLine1": "Kampanyanız Avrupa Birliği'nde yayınlanamaz.",
    "euPoliticalWarningLine2": "Google Ads, AB siyasi reklamları içeren kampanyaların AB'de yayınlanmasına izin vermez. Kampanyanızı diğer bölgelerde yayınlamaya devam edebilirsiniz.",
    "euPoliticalWarningLearnMore": "AB'deki siyasi reklamlar ile ilgili politika hakkında daha fazla bilgi"
  }
}
```

### `locales/en.json` — eklenecek keyler:
```json
{
  "settings": {
    "euPoliticalTitle": "EU Political Ads",
    "euPoliticalQuestion": "Does your campaign contain EU political advertising?",
    "euPoliticalNotPolitical": "No, this campaign does not contain EU political advertising",
    "euPoliticalPolitical": "Yes, this campaign contains EU political advertising",
    "euPoliticalHelperNote": "This campaign does not contain EU political advertising.",
    "euPoliticalHelperNoteOptional": "(optional)",
    "euPoliticalWarningLine1": "Your campaign cannot be served in the European Union.",
    "euPoliticalWarningLine2": "Google Ads does not allow campaigns containing EU political advertising to be served in the EU. You can still serve your campaign in other regions.",
    "euPoliticalWarningLearnMore": "Learn more about the policy on political ads in the EU"
  }
}
```

---

## 6. Backend — `create-campaign.ts`

### 6.1 Mevcut Durum

`CreateCampaignParams` interface'inde `euPoliticalAdsDeclaration` alanı **henüz yok**. API her zaman `DEFAULT_EU_POLITICAL_ADVERTISING` (`DOES_NOT_CONTAIN_...`) kullanıyor.

### 6.2 Eklenmesi Gereken Değişiklikler

**`CreateCampaignParams` interface'ine ekle:**
```typescript
export interface CreateCampaignParams {
  // ... mevcut alanlar ...
  euPoliticalAdsDeclaration?: EuPoliticalAdsDeclaration
}
```

**Campaign oluşturma sırasında mapping:**
```typescript
const EU_POLITICAL_MAP: Record<EuPoliticalAdsDeclaration, EuPoliticalAdvertising> = {
  NOT_POLITICAL: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
  POLITICAL:     'CONTAINS_EU_POLITICAL_ADVERTISING',
}

const euPolitical = params.euPoliticalAdsDeclaration
  ? EU_POLITICAL_MAP[params.euPoliticalAdsDeclaration]
  : DEFAULT_EU_POLITICAL_ADVERTISING

// Campaign resource'a ekle:
campaign: {
  // ...
  eu_political_advertising: euPolitical,
}
```

---

## 7. Wizard → API Route Akışı
```
StepCampaignSettingsSearch
  │  state.euPoliticalAdsDeclaration = 'NOT_POLITICAL' | 'POLITICAL'
  │
  ▼
WizardSummary / Submit
  │  params.euPoliticalAdsDeclaration gönderilmeli
  │
  ▼
POST /api/integrations/google-ads/campaigns/create
  │  params.euPoliticalAdsDeclaration alınmalı
  │
  ▼
createFullCampaign(ctx, params)
  │  EU_POLITICAL_MAP ile dönüştürülmeli
  │
  ▼
Google Ads API
  │  campaign.eu_political_advertising = 'DOES_NOT_CONTAIN...' | 'CONTAINS...'
```

---

## 8. Kampanya Tipi Kapsamı

| Campaign Type | Google Ads'de Var mı? | YOAI'de Eklenecek mi? |
|---------------|----------------------|----------------------|
| SEARCH | ✅ Evet | ✅ Zaten var |
| DISPLAY | ✅ Evet | Eklenebilir |
| VIDEO | ✅ Evet | Eklenebilir |
| SHOPPING | ❌ Hayır | — |
| PERFORMANCE_MAX | ✅ Evet | ✅ Tam entegre |
| DEMAND_GEN | ✅ Evet | Eklenebilir |

**Mevcut durum:** Yalnızca `StepCampaignSettingsSearch.tsx` içinde görünüyor. `StepCampaignSettings.tsx` (DISPLAY, VIDEO, DEMAND_GEN için) içinde **yok**.

---

## 9. Entegrasyon Yapılacaklar Listesi

### Kritik (Şu an eksik — işlevselliği etkiler)

- [ ] `locales/tr.json` ve `locales/en.json` dosyalarına `euPolitical` keylerini ekle
- [ ] `CreateCampaignParams` interface'ine `euPoliticalAdsDeclaration?: EuPoliticalAdsDeclaration` ekle
- [ ] `create-campaign.ts` içinde `EU_POLITICAL_MAP` ile Google API değerine mapping yap
- [ ] Wizard submit akışında `euPoliticalAdsDeclaration` alanını API payload'a dahil et

### İsteğe Bağlı (Kapsam genişletme)

- [ ] `StepCampaignSettings.tsx` (non-Search campaign'ler) içine de AB Siyasi Reklamları bloğu ekle
- [ ] POLITICAL seçildiğinde `İleri` butonunu disable etme davranışı değerlendirilebilir

---

## 10. Google Ads API Referansı

- **Alan:** `Campaign.eu_political_advertising`
- **Enum:** `EuPoliticalAdvertisingEnum.EuPoliticalAdvertising`
  - `DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING`
  - `CONTAINS_EU_POLITICAL_ADVERTISING`
- **Politika sayfası:** https://support.google.com/adspolicy/answer/6014595
- **API dokümantasyonu:** https://developers.google.com/google-ads/api/reference/rpc/v18/Campaign
