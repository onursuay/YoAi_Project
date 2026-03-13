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
