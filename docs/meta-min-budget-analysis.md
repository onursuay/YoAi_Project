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
