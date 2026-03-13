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
