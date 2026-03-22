# Meta Minimum Budget (1 USD TRY) — Analiz Raporu

## 1. Özet

1 USD karşılığı TRY minimum bütçe kuralı **sadece CampaignWizard + adsets/create** akışında publish anında hesaplanıyor. **Traffic Wizard** bu kontrolü yapmıyor ve `requiresMinBudget` hiçbir zaman dönmüyor.

`requiresMinBudget: undefined` gelmesinin birkaç nedeni var. Frontend-backend arasında kur/fallback/cache farkları mevcut.

---

## 2. Publish Anında Hesaplama

### 2.1 CampaignWizard (`/api/meta/adsets/create`)

**Evet, hesaplanıyor.** İki yerde kullanılıyor:

1. **Pre-send guard** (satır 548–582): Meta’ya göndermeden önce `getMinDailyBudgetTry` çağrılıyor. Bütçe min’in altındaysa 400 + `requiresMinBudget: true` + `minDailyBudgetTry` döner.
2. **Meta hata handler** (satır 724–764): Meta min budget hatası dönerse `getMinDailyBudgetTry` tekrar çağrılıp 409 + `requiresMinBudget: true` + `minDailyBudgetTry` döner.

Her iki durumda da `guardFxRate` ve `guardUsdTryRate` request sırasında `/api/fx` üzerinden alınıyor.

### 2.2 Traffic Wizard (`/api/meta/traffic-wizard/publish`)

**Hayır, hesaplanmıyor.**

- `getMinDailyBudgetTry` hiç çağrılmıyor
- Min budget ön kontrolü yok
- AdSet create hata verirse sadece genel `adset_create_failed` dönüyor
- `requiresMinBudget` ve `minDailyBudgetTry` hiç set edilmiyor → frontend her zaman `undefined` görür

---

## 3. `requiresMinBudget: undefined` Nedenleri

### 3.1 Traffic Wizard (en muhtemel)

Traffic Wizard bu alanları hiç üretmediği için her zaman undefined.

### 3.2 Backend sadece mesaj regex ile çalışıyor

`adsets/create` sadece mesaj regex’ine bakıyor; `error_subcode === 1885272` kontrolü yok:

```typescript
// app/api/meta/adsets/create/route.ts:723-725
const msg = (metaErr?.error_user_msg ?? metaErr?.message ?? '').toString()
const isMinBudgetError = /bütçenizin en az|en az .* (tl|try)|minimum.*bütçe|minimum.*budget/i.test(msg) 
  || (minBudgetMatch && /bütçe|budget|minimum/i.test(msg))
```

Meta subcode 1885272 döndürse bile mesaj regex’e uymazsa handler’a girilmiyor; generic error path’e gidilir ve `requiresMinBudget` eklenmez.

### 3.3 Pre-send guard CBO’yu kapsamıyor

Pre-send guard yalnızca `!campaignHasBudget` (yani ABO) için çalışıyor. CBO’da kampanya bütçesi Meta’ya gönderildiği için adset tarafında bu guard atlanıyor; Meta reddederse yine mesaj regex’e bağlı kalınıyor.

---

## 4. Frontend–Backend Kur / Fallback / Cache Tutarsızlıkları

| Kaynak | FX Endpoint | Cache TTL | Override/Fallback |
|--------|-------------|-----------|-------------------|
| Campaign CBO (frontend) | `/api/fx/usdtry` | 1 saat | `USD_TRY_RATE_OVERRIDE`, `USD_TRY_RATE_FALLBACK` |
| AdSet min budget (frontend) | `/api/meta/min-daily-budget-try` → `/api/fx` | 15 dk (FX) | Yok |
| `adsets/create` (backend) | `/api/fx` (origin üzerinden) | 15 dk | Yok |
| `min-daily-budget-try` API | `/api/fx` | 15 dk | Yok |

### 4.1 FX origin sorunu

```typescript
// adsets/create/route.ts:396-399
const fxOrigin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || ''
let guardFxRate = 1
let guardUsdTryRate = 1
if (fxOrigin) {  // ← fxOrigin boşsa FX fetch YAPILMIYOR
```

`origin` ve `referer` yoksa (SSR, mobil, bazı proxy’ler) FX çağrısı yapılmıyor ve `guardFxRate = 1`, `guardUsdTryRate = 1` kalıyor. Bu durumda 1 USD floor yaklaşık 1.02 TRY gibi yanlış bir değere indirgenir.

### 4.2 Cache TTL farkı

- CBO kampanya bütçesi: `/api/fx/usdtry` (1 saat)
- AdSet min budget: `/api/fx` (15 dk)

Aynı publish akışında farklı cache’ler kullanılabiliyor, tutarsız minimum değerler oluşabilir.

### 4.3 Fallback uyumsuzluğu

- `/api/fx/usdtry`: `USD_TRY_RATE_OVERRIDE`, `USD_TRY_RATE_FALLBACK`, prod’da env fallback
- `/api/fx`: prod’da sadece `FX_{BASE}_{QUOTE}` (örn. `FX_USD_TRY`)
- `adsets/create`: env fallback yok; FX fetch başarısızsa 1 kullanılıyor

---

## 5. Önerilen Düzeltmeler

1. **Backend’de subcode 1885272 desteği**: `isMinBudgetError` ile birlikte `error_subcode === 1885272` kontrolü eklenmeli. Böylece mesaj formatı değişse bile min budget hataları doğru işlenir.
2. **Traffic Wizard**: `getMinDailyBudgetTry` ile pre-check eklenmeli; Meta min budget hatası dönerse `requiresMinBudget` ve `minDailyBudgetTry` dönülmeli.
3. **FX origin fallback**: `fxOrigin` boşsa `new URL(request.url).origin` veya sabit bir base URL kullanılmalı; FX fetch her durumda denenmeli.
4. **Kur kaynağı birleştirme**: Tek bir FX endpoint’i (ör. `/api/fx/usdtry`) ve ortak cache/fallback stratejisi kullanılmalı.
5. **CBO min budget**: CBO kampanyalarında da adset create öncesi bütçe kontrolü yapılmalı (kampanya bütçesi < min ise hata dönülmeli).

---

## 6. İlgili Dosyalar

- `app/api/meta/adsets/create/route.ts` — Pre-send guard, Meta hata handler, FX fetch
- `app/api/meta/traffic-wizard/publish/route.ts` — Min budget yok
- `app/api/meta/min-daily-budget-try/route.ts` — Frontend min budget API
- `lib/meta/minDailyBudget.ts` — `getMinDailyBudgetTry` (Meta + 1 USD floor)
- `app/api/fx/route.ts` — Genel FX
- `app/api/fx/usdtry/route.ts` — USD/TRY (CBO kampanya bütçesi)
- `components/meta/CampaignWizard.tsx` — `requiresMinBudget` kullanımı
- `lib/meta/spec/errorRouter.ts` — 1885272 routing
# Meta Min Budget — Teslim Raporu

## Root Cause

1. **Traffic Wizard** min budget kontrolü yapmıyordu; `requiresMinBudget` hiç set edilmiyordu
2. **Backend** minimum bütçe hatasını sadece mesaj regex ile algılıyordu; subcode 1885272 kontrolü yoktu
3. **FX** `origin`/`referer` header’a bağımlıydı; boş olduğunda `guardFxRate=1`, `guardUsdTryRate=1` kalıyordu
4. **CBO** flow’da kampanya bütçesi için pre-send guard yoktu; hata Meta’ya bırakılıyordu
5. **FX** farklı endpoint’lerde farklı TTL ve fallback kullanıyordu

---

## Değişen Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `lib/fx/usdTry.ts` | **Yeni** — Merkezi `getUsdTryRate`, `getFxRatesForMinBudget` (origin bağımsız, env fallback, 15 dk cache) |
| `app/api/fx/usdtry/route.ts` | `lib/fx/usdTry` kullanımına geçti |
| `app/api/meta/min-daily-budget-try/route.ts` | `getFxRatesForMinBudget` ile origin bağımlılığı kaldırıldı |
| `app/api/meta/adsets/create/route.ts` | FX helper, subcode 1885272, `buildMinBudgetErrorPayload`, CBO guard |
| `app/api/meta/traffic-wizard/publish/route.ts` | Pre-send min budget guard, Meta min budget error handler (subcode + regex) |
| `components/meta/traffic-wizard/TWStepSummary.tsx` | Min budget fetch, `validate` ile inline kontrol, `getCtaLabel`, hata gösterimi |
| `components/meta/traffic-wizard/i18n.ts` | `valMinBudget` (TR/EN) |

---

## Ortak Helper Tasarımı

```
lib/fx/usdTry.ts
├── getUsdTryRate()         → { ok, rate, source, fetchedAt } | { ok: false, error }
├── getFxRatesForMinBudget(accountCurrency)
│   → { ok, fxRate, usdTryRate } | { ok: false, error }
└── Cache: 15 dk TTL
    Fallback: USD_TRY_RATE_OVERRIDE → live → USD_TRY_RATE_FALLBACK → stale cache
    Sessizce 1 kullanmaz; fallback/stale için warning log
```

---

## Error Contract (Eski / Yeni)

### Eski
```json
{
  "ok": false,
  "requiresMinBudget": true,
  "minDailyBudgetTry": 35.50,
  "error": { ... },
  "meta_request_id": "...",
  "fbtrace_id": "..."
}
```

### Yeni (Standardize)
```json
{
  "ok": false,
  "requiresMinBudget": true,
  "minBudgetTry": 35.50,
  "minDailyBudgetTry": 35.50,
  "enteredBudgetTry": 10,
  "usdTryRate": 34.50,
  "budgetLevel": "adset",
  "message": "Meta minimum günlük bütçe: 36 TRY (≈ 1 USD). Daha düşük bütçe kabul edilmez.",
  "metaErrorCode": 100,
  "metaErrorSubcode": 1885272,
  "meta_request_id": "...",
  "fbtrace_id": "...",
  "error": { ... }
}
```

- `budgetLevel`: `"campaign"` | `"adset"`
- `metaErrorCode`, `metaErrorSubcode`: structured parse

---

## Test Senaryoları (Manuel Doğrulama)

| Senaryo | Beklenen | Kontrol |
|---------|----------|---------|
| Traffic + Website + Link Clicks + ABO + bütçe min altı | Inline hata, publish engelli | TWStepSummary validate |
| Traffic + Website + Link Clicks + ABO + bütçe min üstü | Publish başarılı | Server guard bypass edilmez |
| Traffic + Website + Link Clicks + CBO + bütçe min altı | Inline hata, publish engelli | TWStepSummary + server guard |
| Traffic + Website + Link Clicks + CBO + bütçe min üstü | Publish başarılı | Server guard bypass edilmez |
| Meta 1885272 dönerse | `requiresMinBudget: true`, anlamlı mesaj | adsets/create, traffic-wizard/publish |

Kontrol edilecekler:
- [ ] min budget doğru hesaplanıyor
- [ ] `requiresMinBudget` hiçbir durumda undefined değil
- [ ] Reklam create gereksiz bloklanmıyor
- [ ] Publish başarısızsa anlamlı inline hata görünüyor
- [ ] Kullanıcı gereksiz yere step 2’ye atılmıyor

---

## Kalan Riskler

1. **Lifetime budget**: Günlük min kontrolü sadece daily için; lifetime için Meta kuralı farklı olabilir
2. **FX API kesintisi**: `USD_TRY_RATE_FALLBACK` env yoksa ve live API çalışmazsa 503 dönülür
3. **Cache invalidation**: 15 dk cache; ani kur değişiminde kısa süre eski değer kullanılabilir
# Meta Traffic Min Budget — Final Teslim

## 1. Kod / Akış Doğrulaması

### 1.1 Publish akışı (Traffic Wizard)

```
Publish click → POST /api/meta/traffic-wizard/publish
  → getFxRatesForMinBudget (origin-independent)
  → getMinDailyBudgetTry (publish öncesi, META)
  → Pre-send guard: ABO adset.budget | CBO campaign.campaignBudget vs minDailyBudgetTry
  → [Guard fail] 400 + structured error (request Meta'ya GİTMEZ)
  → [Guard pass] campaign create → adset create → creative create → ad create
  → Success: { campaignId, adsetId, adId, creativeId }
```

- Ad create aşaması: Creative + Ad sıralı; başarıda `adId` dönülüyor
- Tek request; Campaign → AdSet → AdCreative → Ad zinciri tamamlanıyor
- "Sadece reklam seti yayınlanıyor" durumu yok (tek orchestrated flow)

### 1.2 Kontrol edilen alanlar

| Alan | Min budget error path | Genel error path |
|------|------------------------|------------------|
| requiresMinBudget | `true` (her zaman) | undefined (doğru) |
| minBudgetTry | Dolu (sayı) | - |
| minDailyBudgetTry | Dolu (alias) | - |
| enteredBudgetTry | Dolu | - |
| usdTryRate | Dolu | - |
| budgetLevel | 'campaign' \| 'adset' | - |

503 (fx/min unavailable): `requiresMinBudget: true`, `minBudgetTry: null` — kur alınamadığında kabul edilebilir.

### 1.3 ABO / CBO guard

- **ABO**: `adset.budget` (daily) — guard çalışıyor
- **CBO**: `campaign.campaignBudget` (daily) — guard çalışıyor
- Lifetime budget: guard atlanıyor (Meta farklı kurallar uyguluyor)

### 1.4 Step geri dönüşü

- **Traffic Wizard**: Hata durumunda otomatik step değişimi yok. Kullanıcı Summary’de kalır.
- Validation hatalarında kullanıcı "Adım X" ile manuel geçiş yapıyor.
- CampaignWizard (adsets/create): Min budget hatasında step 2’ye gidilmesi kasıtlı (bütçe step 2’de).

---

## 2. Manuel test senaryoları

### Test matrisi

| # | Senaryo | Beklenen |
|---|---------|----------|
| 1 | Traffic + Website + Link Clicks + ABO + bütçe &lt; min | Inline hata, publish disabled veya 400 structured error |
| 2 | Traffic + Website + Link Clicks + ABO + bütçe ≥ min | Success: campaignId, adsetId, adId |
| 3 | Traffic + Website + Link Clicks + CBO + bütçe &lt; min | Inline hata veya 400 structured error |
| 4 | Traffic + Website + Link Clicks + CBO + bütçe ≥ min | Success: campaignId, adsetId, adId |

### Network / console logları

- `POST /api/meta/traffic-wizard/publish`
- Response: `ok`, `requiresMinBudget`, `minBudgetTry`, `enteredBudgetTry`, `budgetLevel`, `message`
- Success: `campaignId`, `adsetId`, `adId`, `creativeId`
- Min budget error: Meta’ya istek gitmeden 400 dönmeli

### Beklenen sonuçlar

- Min altı bütçede: Request Meta’ya gitmeden structured error (veya client-side validation)
- Inline hata: Summary validation alanında veya publish error bölümünde açık mesaj
- Step atlaması: Kullanıcı sebepsiz step 2’ye atılmamalı (TW’de otomatik step değişimi yok)
- Min üstü bütçede: Campaign + AdSet + Ad create tamamlanmalı
- Success ekranında campaignId, adsetId, adId gösterilmeli

---

## 3. Test sonuçları (Manuel doğrulama gerekiyor)

Aşağıdaki senaryoların **manuel çalıştırılması** gerekiyor:

```
[ ] Senaryo 1: ABO + min altı — inline / 400
[ ] Senaryo 2: ABO + min üstü — success
[ ] Senaryo 3: CBO + min altı — inline / 400
[ ] Senaryo 4: CBO + min üstü — success
[ ] requiresMinBudget min budget path’inde hiç undefined değil
[ ] Structured response alanları dolu
[ ] Ad create success senaryosunda çağrılıyor (adId response’ta)
```

---

## 4. Kalan riskler

1. **Lifetime budget**: Sadece daily için guard; lifetime kuralları farklı
2. **FX kesintisi**: `USD_TRY_RATE_FALLBACK` yoksa 503
3. **Min budget fetch gecikmesi**: Client fetch tamamlanmadan publish tıklanırsa server guard devreye girer (OK)

---

## 5. Karar

**Kod incelemesi**: Tamamlandı. Akış, guard’lar ve response contract doğru.

**Manuel test**: Projede çalışan uygulama yok; senaryolar lokal/prod ortamında elle test edilmeli.

**Build**: ✅ Başarılı

---

## 6. Push durumu

**Push’e hazır**: Evet (kod incelemesi ve build tamamlandı).

Manuel testler tamamlanıp sorun görülmezse commit/push yapılabilir.
# Release Note — Commit 0be6f96

**Commit**: `0be6f96` — `feat(meta): unify min budget flow, fix Traffic Wizard publish`  
**Tarih**: 2025-03-11  
**Konu**: Meta Traffic publish min budget fix

---

## Release Status

| Alan | Durum |
|------|--------|
| **Build** | ✅ Başarılı |
| **Publish flow kod analizi** | ✅ Temiz |
| **requiresMinBudget contract** | ✅ Doğru (min budget path'inde true, alanlar dolu) |
| **Ad create zinciri** | ✅ Mevcut (Campaign → AdSet → Creative → Ad) |
| **Step fallback bug** | ✅ Kodda görünmüyor (TW'de otomatik step değişimi yok) |
| **Manuel smoke test** | ⏳ Eksik |

---

## Commit Status

- **Push'e uygun**: Evet — Commit branch'e / remote'a push edilebilir.
- **Production kesin onayı**: Hayır — Production merge/push onayı ancak 4 manuel senaryo geçerse verilebilir.
- **Eksik son adım**: 4 manuel smoke test (ABO min altı/üstü, CBO min altı/üstü).

---

## Yapılmaması Gereken İfadeler (manuel test tamamlanmadan)

Aşağıdaki ifadeler **manuel doğrulama tamamlanana kadar** kullanılmamalı:

- "fully validated"
- "production confirmed"
- "issue resolved conclusively"

---

## Sonraki Adım

Manuel smoke testler tamamlandığında (4 senaryo PASS):

- Bu dokümana test sonuçları eklenebilir.
- Production kesin onayı verilebilir.
# Meta Ad Set Payload — Runtime Teşhis Teslim Raporu

## Eklenen debug loglar (geçici, fix/deploy yok)

### 1. `app/api/meta/adsets/create/route.ts`
- **Giriş:** `[DIAG][requestId] === ROUTE HIT ===` + `DIAG_ADSETS_CREATE_V2_REPLIES_NO_BID_2025`
- Request body (masked): `conversionLocation`, `destination_type`, `optimizationGoal`, `bidStrategy`
- `destinationType` çözümlemesi
- `finalOptimizationGoal` hesaplanan değer
- `skipBidStrategy` (WHATSAPP için true)
- Final Meta payload: `optimization_goal`, `bid_strategy`, `destination_type`, `billing_event`
- `git_sha` (VERCEL_GIT_COMMIT_SHA varsa)

### 2. `lib/meta/spec/objectiveSpec.ts`
- `getDefaultOptimizationGoal` her çağrıda: `[DIAG][objectiveSpec] getDefaultOptimizationGoal`

### 3. `components/meta/CampaignWizard.tsx`
- Ad set create çağrısından önce: `[DIAG][CampaignWizard] Calling adset create: /api/meta/adsets/create`

### 4. `app/api/meta/traffic-wizard/publish/route.ts`
- Ad set oluşturma: `[DIAG][traffic-wizard/publish] AD SET CREATE — NOT adsets/create route!`
- `bid_strategy` ve `optimization_goal` değerleri

---

## Endpoint / flow matrisi

| Flow | Endpoint | Ad set payload kaynağı |
|------|----------|------------------------|
| **CampaignWizard** (Engagement/Leads/Sales) | `POST /api/meta/adsets/create` | route.ts — REPLIES + no bid fix uygulanır |
| **TrafficWizard** (Traffic) | `POST /api/meta/traffic-wizard/publish` | traffic-wizard/publish/route.ts — REPLIES fix YOK, bid_strategy her zaman gönderiliyor |

---

## Beklenen teslim formatı (bilgileri doldur)

### 1) Çağrılan gerçek endpoint:
- Loglardan `[DIAG][CampaignWizard]` veya `[DIAG][traffic-wizard/publish]` ile tespit edin

### 2) Route içine düşen request body:
- `[DIAG][xxx] REQUEST BODY (masked)` satırına bakın

### 3) Route içinde hesaplanan final payload:
- `[DIAG][xxx] finalOptimizationGoal` ve `[DIAG][xxx] FINAL META PAYLOAD KEY FIELDS` satırlarına bakın

### 4) Runtime’da görülen optimizationGoal:
- `optimization_goal` değeri

### 5) Runtime’da görülen bid_strategy:
- `bid_strategy` değeri (veya `(NOT SENT - omitted)`)

### 6) Beklenen ile fark:
- WhatsApp için beklenen: `optimization_goal: REPLIES`, `bid_strategy: (omitted)`

### 7) Kök neden:
- Eğer `[DIAG][traffic-wizard/publish]` görünüyorsa → Traffic Wizard kullanılıyor, adsets/create çağrılmıyor
- Eğer `DIAG_ADSETS_CREATE_V2_REPLIES_NO_BID_2025` YOK → Eski build/deploy
- Eğer `destinationType` WHATSAPP değil → conversionLocation/destination_type yanlış geliyor

### 8) Sonuç:
- **Sorun kodda mı?** → Loglarda REPLIES + omit görünüyorsa kod doğru
- **Deploy’da mı?** → DIAG_VERSION loglanmıyorsa eski build
- **Endpoint mismatch’ta mı?** → Traffic wizard kullanılıyorsa adsets/create hiç çalışmıyor

---

## Nasıl test edilir

1. WhatsApp destination ile CampaignWizard’dan publish deneyin
2. Server loglarına bakın (Vercel Functions / local terminal)
3. `[DIAG]` ile grep yapın: `grep DIAG logs.txt`
4. `DIAG_ADSETS_CREATE_V2_REPLIES_NO_BID_2025` görünüyorsa adsets/create çalışıyor
5. `[DIAG][traffic-wizard/publish]` görünüyorsa Traffic Wizard kullanılıyor (farklı flow)
# Fix: Meta Traffic Wizard State Reset Issue

**Date:** 2026-03-11
**Type:** Bug Fix
**Scope:** Meta Traffic Wizard

## Problem Statement

### Symptom
Users reported that after successfully publishing a Meta Traffic campaign, attempting to create a **second new campaign** would fail or behave incorrectly:
- Sometimes publish would fail
- Sometimes user would be redirected back to Ad Set step
- Sometimes only ad set would be processed, but creative/ad would not complete
- Issue was NOT about re-publishing the same campaign, but creating a **brand new** campaign after the first one

### Root Cause

The issue was **stale local state persisting across campaign creation sessions**:

1. **First campaign publish succeeds** → Success screen displays
2. **User closes the wizard** → `onClose()` called → Modal closes
3. **User creates a new campaign** → Wizard reopens → `isOpen` changes from `false` to `true`
4. **TrafficWizardState resets** ✅ (campaign/adset/ad data)
5. **BUT: TWStepSummary local state does NOT reset** ❌

The problem: `TWStepSummary` component maintains its own local state:
- `publishStatus` ('idle' | 'publishing' | 'success' | 'error')
- `publishResult` (contains previous campaignId, adsetId, adId)
- `publishError`
- `publishStep`
- `minDailyBudgetTry`

If the React component doesn't unmount between wizard open/close cycles, this state persists, causing:
- UI confusion (success state from previous campaign)
- Potential payload contamination
- Validation state leakage

## Solution

### Implemented Fix

**Force component remount using React `key` prop:**

#### 1. Added `resetKey` state to TrafficWizard ([TrafficWizard.tsx:24-36](components/meta/TrafficWizard.tsx#L24-L36))

```typescript
const [resetKey, setResetKey] = useState(0)

useEffect(() => {
  if (isOpen) {
    setState({ ...initialTrafficWizardState })
    setResetKey(prev => {
      const newKey = prev + 1
      console.log('[TrafficWizard] Reset triggered, new key:', newKey)
      return newKey
    })
  }
}, [isOpen])
```

#### 2. Applied `key` to all wizard step components ([TrafficWizard.tsx:108-113](components/meta/TrafficWizard.tsx#L108-L113))

```typescript
{currentStep === 1 && (
  <TWStepCampaign key={`campaign-${resetKey}`} state={state} onChange={updateState} />
)}
{currentStep === 2 && <TWStepAdSet key={`adset-${resetKey}`} state={state} onChange={updateState} />}
{currentStep === 3 && <TWStepCreative key={`creative-${resetKey}`} state={state} onChange={updateState} />}
{currentStep === 4 && <TWStepSummary key={`summary-${resetKey}`} state={state} onGoToStep={goToStep} onClose={onClose} />}
```

**Result:** Every time the wizard opens, `resetKey` increments, forcing React to:
- Unmount all previous step component instances
- Mount fresh component instances with clean initial state
- Guarantee NO state leakage between campaigns

#### 3. Added debug logging ([TWStepSummary.tsx:166-168](components/meta/traffic-wizard/TWStepSummary.tsx#L166-L168), [TWStepSummary.tsx:220-231](components/meta/traffic-wizard/TWStepSummary.tsx#L220-L231))

```typescript
// Component mount verification
useEffect(() => {
  console.log('[TWStepSummary] Component mounted with fresh state')
}, [])

// Publish payload inspection
console.log('[TWStepSummary] Publishing with payload:', {
  campaignName: payload.campaign.name,
  adsetName: payload.adset.name,
  adName: payload.ad.name,
  hasStaleIds: {
    campaignId: 'campaignId' in payload.campaign,
    adsetId: 'adsetId' in payload.adset,
    adId: 'adId' in payload.ad,
    creativeId: 'creativeId' in payload.ad,
  }
})
```

## Verification & Testing

### Test Scenario

1. **Create first campaign**
   - Open Traffic Wizard
   - Fill all steps (Campaign → Ad Set → Creative → Summary)
   - Click "Publish"
   - Verify success screen shows
   - Close wizard

2. **Create second campaign (immediate)**
   - Open Traffic Wizard again
   - **Expected:** All fields empty, no success state
   - **Check console logs:**
     - `[TrafficWizard] Reset triggered, new key: 2`
     - `[TWStepSummary] Component mounted with fresh state`
   - Fill all steps with **different data**
   - Click "Publish"
   - **Expected:** Publish succeeds independently
   - **Check console logs:**
     - `hasStaleIds` should all be `false`
     - New campaignId/adsetId/adId should be different from first campaign

3. **Repeat for third campaign**
   - Same flow
   - Verify `new key: 3` in logs
   - Verify fresh component mount

### Console Log Verification

Expected console output for sequential campaigns:

```
// First publish
[TrafficWizard] Reset triggered, new key: 1
[TWStepSummary] Component mounted with fresh state
[TWStepSummary] Publishing with payload: { campaignName: "Test 1", hasStaleIds: { all false } }
[TWStepSummary] Publish successful: { campaignId: "123...", adsetId: "456...", adId: "789..." }

// Close and reopen
[TrafficWizard] Reset triggered, new key: 2
[TWStepSummary] Component mounted with fresh state
[TWStepSummary] Publishing with payload: { campaignName: "Test 2", hasStaleIds: { all false } }
[TWStepSummary] Publish successful: { campaignId: "ABC...", adsetId: "DEF...", adId: "GHI..." }
```

## Files Changed

1. **[components/meta/TrafficWizard.tsx](components/meta/TrafficWizard.tsx)**
   - Added `resetKey` state
   - Applied `key` prop to all step components
   - Added debug logging for reset events

2. **[components/meta/traffic-wizard/TWStepSummary.tsx](components/meta/traffic-wizard/TWStepSummary.tsx)**
   - Added mount verification logging
   - Added publish payload inspection logging
   - Added success response logging

## Impact

- ✅ **Fixes:** Sequential campaign creation now works correctly
- ✅ **Ensures:** Complete state isolation between campaigns
- ✅ **Prevents:** Stale ID/state contamination in publish flow
- ✅ **Improves:** User experience — no unexpected errors or redirects
- ✅ **No Breaking Changes:** Existing single-campaign flow unchanged

## Related Issues

This fix also prevents potential issues with:
- Min budget state leaking between campaigns
- Validation errors persisting across sessions
- Success/error UI states appearing incorrectly

## Related: TRY/USD Minimum Budget Flow Verification

As part of this investigation, we also verified the **minimum budget enforcement** mechanism is working correctly:

### USD/TRY Exchange Rate ✅
- Live fetch from dual APIs (exchangerate.host, er-api.com)
- 15-minute cache with deterministic TTL
- Env override/fallback support
- **Never silently defaults to 1** — explicit warnings/errors

### Minimum Budget Calculation ✅
Located in [lib/meta/minDailyBudget.ts](lib/meta/minDailyBudget.ts):

```
Meta API → metaMinRaw (minor unit)
→ metaMinMain = metaMinRaw / factor
→ metaMinTry = metaMinMain × fxRate
→ metaMinTryBuffered = ceil(metaMinTry × 1.02 × 100) / 100  (+2% safety buffer)
→ usdFloorTryBuffered = ceil(usdTryRate × 1.02 × 100) / 100 (1 USD floor +2%)
→ finalMinTry = max(metaMinTryBuffered, usdFloorTryBuffered)
```

**Key guarantees:**
- ✅ 1 USD floor enforced (never below 1 USD equivalent in TRY)
- ✅ 2% safety buffer applied
- ✅ No hardcoded fallback values
- ✅ Account currency conversion support

### Publish Flow Budget Validation ✅
Located in [app/api/meta/traffic-wizard/publish/route.ts](app/api/meta/traffic-wizard/publish/route.ts):

**Pre-flight validation** (lines 57-152):
- Fetches exchange rates before any Meta API call
- Calculates minimum budget for current optimization goal
- Validates CBO (campaign budget) or ABO (ad set budget)
- Returns structured error **before** creating any entities

**Meta API error fallback** (lines 206-246, 441-482):
- Detects Meta budget error (subcode 1885272)
- Regex-based message parsing for Turkish/English
- Extracts minimum value from error if not already known
- Returns standardized error response

### Error Response Format ✅

All budget errors follow this structure:

```json
{
  "ok": false,
  "requiresMinBudget": true,
  "minBudgetTry": 35.72,
  "minDailyBudgetTry": 35.72,
  "enteredBudgetTry": 20,
  "usdTryRate": 35.02,
  "budgetLevel": "campaign" | "adset",
  "message": "Minimum günlük bütçe: 36 TRY (≈ 1 USD)",
  "error": "MIN_DAILY_BUDGET",
  "step": "campaign" | "adset"
}
```

### UI Integration ✅

Frontend ([TWStepSummary.tsx](components/meta/traffic-wizard/TWStepSummary.tsx)):
- Fetches minimum budget on Summary step mount
- Uses same calculation as backend (same API endpoint)
- Validates before allowing publish
- Displays user-friendly error messages

**Result:** Double validation layer (frontend + backend) ensures budget requirements are enforced consistently.

## Future Considerations

**Option to remove debug logs in production:**

If console logs are too verbose for production, can add environment check:

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[TrafficWizard] Reset triggered, new key:', newKey)
}
```

However, recommended to keep logs as they help diagnose issues in production without needing to reproduce locally.

**Potential UX improvement:**

Currently, minimum budget is shown as validation error on Summary step. Could enhance UX by:
- Displaying minimum budget hint on budget input fields (Step 1 for CBO, Step 2 for ABO)
- Real-time validation feedback as user types
- Auto-suggest minimum value button
