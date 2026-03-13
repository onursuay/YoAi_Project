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
