# AB siyasi reklamları (EU political ads)

## Genel bakış

Kullanıcıdan, kampanyanın **Avrupa Birliği ile ilgili siyasi reklam** içerip içermediğini beyan etmesi istenir. Bu beyan, Google Ads kampanya oluşturma isteğinde **`contains_eu_political_advertising`** alanına yazılır.

- Amaç: AB bölgesinde siyasi reklam politikalarına uyum.
- Uygulama: UI’da iki seçenek (`NOT_POLITICAL` / `POLITICAL`); backend’de API enum değerlerine map edilir.

## Google Ads API karşılığı

| Uygulama (wizard) | Google Ads API (`Campaign`) |
|-------------------|-----------------------------|
| `EuPoliticalAdsDeclaration` / `PMaxEuPoliticalAdsDeclaration` | Alan: **`contains_eu_political_advertising`** |
| `'NOT_POLITICAL'` | `DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING` |
| `'POLITICAL'` | `CONTAINS_EU_POLITICAL_ADVERTISING` |

**Kod referansları**

- Standart kampanya oluşturma: `lib/google-ads/create-campaign.ts` — `CreateCampaignParams.containsEuPoliticalAdvertising`, varsayılan `DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING`.
- Search (ve ortak) sihirbaz payload: `components/google/wizard/shared/WizardHelpers.ts` → `buildCreatePayload` içinde `containsEuPoliticalAdvertising`.
- PMax payload: `components/google/wizard/pmax/shared/PMaxCreatePayload.ts` → `containsEuPoliticalAdvertising`.

---

## Kampanya tipi durum tablosu

Ortak **Google Campaign Wizard** akışında (PMax hariç) adım 3’te `StepCampaignSettingsSearch` kullanılır; **DISPLAY / VIDEO / DEMAND_GEN** seçildiğinde de aynı adım ve aynı AB bloğu gösterilir. **PMax** ayrı sihirbazdadır.

| Kampanya tipi | UI | Backend / payload |
|---------------|----|-------------------|
| **SEARCH** | `StepCampaignSettingsSearch` — AB bölümü | `buildCreatePayload` → `POST .../campaigns/create` |
| **DISPLAY** | Aynı (ortak sihirbaz, adım 3) | Aynı |
| **VIDEO** | Aynı | Aynı |
| **DEMAND_GEN** | Aynı | Aynı |
| **PERFORMANCE_MAX (PMax)** | `PMaxStepCampaignSettings` (collapsible bölüm) | `PMaxCreatePayload` → PMax create akışı |

---

## TypeScript tipleri

### `EuPoliticalAdsDeclaration` (Search / ortak wizard)

**Dosya:** `components/google/wizard/shared/WizardTypes.ts`

```ts
export type EuPoliticalAdsDeclaration = 'NOT_POLITICAL' | 'POLITICAL'
```

`WizardState.euPoliticalAdsDeclaration` varsayılan: `'NOT_POLITICAL'`.

### `PMaxEuPoliticalAdsDeclaration` (PMax)

**Dosya:** `components/google/wizard/pmax/shared/PMaxWizardTypes.ts`

```ts
export type PMaxEuPoliticalAdsDeclaration = 'NOT_POLITICAL' | 'POLITICAL'
```

`PMaxWizardState.euPoliticalAdsDeclaration` başlangıç: `null` (kullanıcı seçene kadar); PMax özet/validasyonda zorunlu seçim için `settings.euPoliticalValidation` kullanılır.

---

## UI yapısı

1. **Radio kartlar** — Her seçenek `<label>` içinde `type="radio"`, tıklanabilir kart.
2. **Border highlight** — Seçili kart: `border-blue-300 bg-blue-50/50`; diğeri: `border-gray-100` + hover.
3. **Helper note** — Sadece **“Hayır / NOT_POLITICAL”** seçiliyken, ikinci satırda gri küçük metin: `euPoliticalHelperNote` + `euPoliticalHelperNoteOptional`.
4. **Amber uyarı kutusu** — **“Evet / POLITICAL”** seçilince: `border-amber-200`, `bg-amber-50/60`, `Info` ikonu, iki satır uyarı metni.
5. **Policy link** — Uyarı kutusunda, `euPoliticalWarningLearnMore` metniyle `target="_blank"` bağlantı.

**Dosyalar:**  
`StepCampaignSettingsSearch.tsx`, `StepCampaignSettings.tsx` (ortak desen), `PMaxStepCampaignSettings.tsx` (PMax; radio `name` farklı: `pmaxEuPoliticalAdsDeclaration`).

---

## Policy URL sabiti ve `useLocale`

**Sabit:** `EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'`

**Locale’e göre `hl`:** `next-intl` `useLocale()` ile; `tr` ise `?hl=tr`, aksi halde `?hl=en`.

```ts
const locale = useLocale()
const euPolicyUrl = `${EU_POLICY_URL}?hl=${locale === 'tr' ? 'tr' : 'en'}`
```

Örnek dosyalar: `StepCampaignSettings.tsx` (satır ~37–65), `StepCampaignSettingsSearch.tsx`, `PMaxStepCampaignSettings.tsx`.

---

## Locale keyleri (9 adet)

Namespace: `dashboard.google.wizard` → `settings.*` (çeviri fonksiyonu: `t('settings.euPolitical…')`).

| # | Key |
|---|-----|
| 1 | `settings.euPoliticalTitle` |
| 2 | `settings.euPoliticalQuestion` |
| 3 | `settings.euPoliticalNotPolitical` |
| 4 | `settings.euPoliticalPolitical` |
| 5 | `settings.euPoliticalHelperNote` |
| 6 | `settings.euPoliticalHelperNoteOptional` |
| 7 | `settings.euPoliticalWarningLine1` |
| 8 | `settings.euPoliticalWarningLine2` |
| 9 | `settings.euPoliticalWarningLearnMore` |

> **Not:** PMax sihirbazında ek olarak `settings.euPoliticalValidation` (zorunlu seçim) vb. kullanılabilir; yukarıdaki 9 anahtar AB bloğunun tam metin setidir.

---

## Yeni kampanya tipi / yeni sihirbaz eklerken checklist

1. [ ] State’e `EuPoliticalAdsDeclaration` (veya PMax için `| null` başlangıç) ve `update` ile senkronize et.
2. [ ] İlgili ayarlar adımına **radio kart + helper + amber uyarı + policy link** (`EU_POLICY_URL` + `useLocale`) UI’ını ekle veya ortak bileşeni yeniden kullan.
3. [ ] `locales/tr.json` ve `locales/en.json` içinde yukarıdaki **9 `settings.euPolitical*`** anahtarının tanımlı olduğundan emin ol (namespace farkı varsa kopyala).
4. [ ] Oluşturma payload’ında `containsEuPoliticalAdvertising` → `DOES_NOT_CONTAIN_*` / `CONTAINS_*` map’ini ekle (`WizardHelpers` / `PMaxCreatePayload` örnekleri).
5. [ ] Özet adımında seçimi göster; PMax’te `null` ise hata göstergesi (`PMaxStepSummary`).
6. [ ] `lib/google-ads/create-campaign.ts` (veya ilgili mutate) tarafında API alanının gerçekten gönderildiğini doğrula.
