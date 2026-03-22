# Dönüşüm hedefleri (conversion goals)

## Genel bakış

Hesaptaki **dönüşüm eylemleri** (`conversion_action`), Google Ads API üzerinden listelenir; kullanıcı kampanya için bir veya daha fazla eylem seçebilir ve **birincil** bir hedef işaretleyebilir.

**İsteğe bağlı:** Arayüz metninde belirtildiği gibi dönüşüm seçmeden de devam edilebilir (`conversion.description` — Search sihirbazı; PMax giriş adımında da benzer ifade).

---

## Kampanya tipi durum tablosu

Aynı **HTTP endpoint** ve **`listConversionActionsForWizard`** sorgusu kullanılır; farklı olan yalnızca hangi adımın listeyi gösterdiğidir.

| Kampanya tipi | UI bileşeni | Durum |
|---------------|-------------|--------|
| **SEARCH** | `StepConversionAndName` (Google Campaign Wizard adım 1) | Tam |
| **DISPLAY / VIDEO / DEMAND_GEN** | Aynı ortak sihirbaz — dönüşüm yine `StepConversionAndName` (kampanya tipi adım 0’da seçilir; PMax değilse akış devam eder) | Tam |
| **PERFORMANCE_MAX** | `PMaxStepEntry` — dönüşüm listesi (Search ile aynı kart/liste deseni) | Tam |

> **Not:** `StepCampaignSettings.tsx` dosyasında da dönüşüm + AB blokları tanımlıdır ancak şu an **hiçbir yerde import edilmez**; canlı akışta dönüşüm seçimi yukarıdaki iki bileşenle yapılır.

Seçilen `resource_name` değerleri kampanya oluşturma sonrası hedeflere bağlamak için payload’a eklenir (`selectedConversionGoalIds`, `primaryConversionGoalId`). Detay: `WizardHelpers.buildCreatePayload`, ilgili create / post-create akışı.

---

## API endpoint ve lib dosyası

| Katman | Yol |
|--------|-----|
| **Route (GET)** | `app/api/integrations/google-ads/conversion-actions/route.ts` |
| **İş mantığı** | `lib/google-ads/conversion-actions.ts` → `listConversionActionsForWizard` |

**İstek:** `GET /api/integrations/google-ads/conversion-actions`  
**Yanıt:** `{ conversionActions: ConversionActionForWizard[] }` veya `{ error: string }`

GAQL özeti: `conversion_action` alanları `resource_name`, `id`, `name`, `category`, `origin`, `primary_for_goal`, `status`; `status != 'REMOVED'`, isme göre sıralı.

---

## TypeScript tipleri

### `ConversionActionForWizard`

**Dosyalar:** `components/google/wizard/shared/WizardTypes.ts`, `lib/google-ads/conversion-actions.ts` (aynı şekil).

```ts
export interface ConversionActionForWizard {
  resourceName: string
  id: string
  name: string
  category: string
  origin: string
  primaryForGoal: boolean
  status: string
}
```

### `WizardState` alanları (Search)

- `selectedConversionGoalIds: string[]` — `resource_name` listesi  
- `primaryConversionGoalId: string | null` — birincil eylem  
- `conversionActions: ConversionActionForWizard[]` — API’den doldurulur  

PMax tarafında eşdeğer alanlar `PMaxWizardState` içinde (`PMaxConversionAction` satır bazında aynı alanlar).

---

## UI yapısı

1. **Fetch** — `useEffect` ile mount’ta `fetch('/api/integrations/google-ads/conversion-actions', { cache: 'no-store' })`; `update` genelde dependency dışı (eslint-disable ile “sadece mount”).
2. **Loading** — `Loader2` + `conversion.loading`.
3. **Error** — Kırmızı kenarlık kutusu + `AlertCircle` + `conversion.error` + sunucu mesajı.
4. **Empty** — Amber kenarlık + `AlertCircle` + `conversion.empty`.
5. **Liste** — `max-h-56 overflow-y-auto`; her satır: checkbox, **kategori ikonu** (gri kutu içinde Lucide), isim, alt satırda kategori + origin metinleri, `status !== 'ENABLED'` için `conversion.statusUnenabled`.
6. **Birincil hedef** — Seçili satırda ★ `Star` butonu (`conversion.primary` / `conversion.set`); özet: `conversion.goalsSelected` + `conversion.primaryLabel`.

Referans: `StepConversionAndName.tsx`, `PMaxStepEntry.tsx` (dönüşüm bölümü).

---

## Kategori → ikon mapping

`getCategoryIcon(category)` ile (varsayılan **Globe**):

| Kategori(ler) | İkon (lucide-react) |
|-----------------|---------------------|
| `PURCHASE`, `STORE_SALE` | `ShoppingCart` |
| `PAGE_VIEW` | `FileText` |
| `PHONE_CALL_LEAD` | `Phone` |
| `LEAD`, `IMPORTED_LEAD`, `QUALIFIED_LEAD`, `CONVERTED_LEAD`, `SUBMIT_LEAD_FORM` | `Target` |
| `ADD_TO_CART`, `BEGIN_CHECKOUT` | `CreditCard` |
| `DOWNLOAD` | `Download` |
| `OUTBOUND_CLICK`, `CONTACT` | `MousePointer` |
| `GET_DIRECTIONS`, `STORE_VISIT` | `MapPin` |
| `ENGAGEMENT`, `BOOK_APPOINTMENT`, `REQUEST_QUOTE` | `Mail` |
| `SIGNUP`, `SUBSCRIBE_PAID` | `BarChart2` |
| *(diğer / bilinmeyen)* | `Globe` |

Çeviri anahtarları: `conversion.categoryLabels.<CATEGORY>`, `conversion.originLabels.<ORIGIN>`; eksikse kelime `UNKNOWN` formatlanır (`formatUnknownValue`).

---

## `toggleGoal` / `setPrimary` mantığı

**`toggleGoal(resourceName)`**

- Seçiliyse listeden çıkar; çıkarılan birincil ise → yeni birincil `nextSelected[0]` veya `null`.
- Seçili değilse listeye ekle; **ilk eklenen tek seçim** ise otomatik birincil: `primaryConversionGoalId = resourceName`.
- Diğer durumlarda mevcut `primaryConversionGoalId` korunur (ilk seçilen otomatik birincil kuralı).

**`setPrimary(resourceName)`**

- Yalnızca `selectedConversionGoalIds` içindeyse `update({ primaryConversionGoalId: resourceName })`.

---

## Locale keyleri

### Search wizard

Namespace: `dashboard.google.wizard` → `conversion.*`

Örnek anahtarlar: `conversion.title`, `conversion.description`, `conversion.loading`, `conversion.error`, `conversion.empty`, `conversion.statusUnenabled`, `conversion.primary`, `conversion.primaryGoalTitle`, `conversion.setAsPrimaryTitle`, `conversion.set`, `conversion.goalsSelected`, `conversion.primaryLabel`, `conversion.uiOnlyNote` (opsiyonel bilgi; boş string ile gizlenebilir), `conversion.categoryLabels.*`, `conversion.originLabels.*`, istenen sonuçlar için `conversion.desiredOutcomesTitle` vb.

### PMax wizard

Namespace: `dashboard.google.pmaxWizard` → `conversion.*` (aynı mantık; giriş ekranında `conversion.campaignName`, `conversion.finalUrl`, `entry.*` ile birlikte kullanılır.)

---

## Yeni kampanya tipi / yeni sihirbaz eklerken checklist

1. [ ] State’e `conversionActions`, `selectedConversionGoalIds`, `primaryConversionGoalId` ekle veya mevcut `WizardState` / `PMaxWizardState` ile paylaş.
2. [ ] Mount’ta `GET /api/integrations/google-ads/conversion-actions` ile listeyi çek; loading / error / empty / liste UI’sını Search ile hizala.
3. [ ] `toggleGoal` / `setPrimary` mantığını ve birincil özet satırını kopyala veya ortak hook’a taşı.
4. [ ] `buildCreatePayload` (veya PMax eşdeğeri) içinde `selectedConversionGoalIds` / `primaryConversionGoalId` alanlarının create veya post-create hedef bağlama akışına girdiğini doğrula.
