# PMax Production Stabilization – Teslim Özeti

## 1. Changed Files

| Dosya | Değişiklik |
|-------|------------|
| `lib/google-ads/create-performance-max-campaign.ts` | Image validation (sharp), double fetch kaldırıldı, PreFetchedImages |
| `app/api/integrations/google-ads/campaigns/create-performance-max/route.ts` | Error mesajları (PMax_INVALID_ASPECT_RATIO_*), X-Smoke-Test admin path |
| `lib/google-ads/verify-pmax-created.ts` | **Yeni** – Post-create parity GAQL verification |
| `app/api/admin/pmax-verify/route.ts` | **Yeni** – Admin GET endpoint for parity check |
| `scripts/pmax-smoke-test.mjs` | **Yeni** – PMax create smoke test |
| `scripts/search-isolation-check.mjs` | **Yeni** – Search flow isolation validation |
| `package.json` | `pmax:smoke`, `search:isolation` scripts |

## 2. Bulunan Buglar

- **Double fetch**: `validateImageUrls` sonucu create sırasında tekrar fetch ediliyordu → düzeltildi.
- **Eksik aspect ratio validation**: Marketing (1.91:1) ve logo (1:1) kontrolü yoktu → eklendi.
- **Search sızıntı riski**: PMax değişikliklerinin Search flow’u bozup bozmadığı doğrulanmadı → Search isolation script eklendi.

## 3. Düzeltilen Buglar

1. **Image validation**: `fetchAndValidateImage()` ile:
   - Marketing: 1.91:1 landscape (±0.25 tolerans)
   - Logo: 1:1 square (±0.15 tolerans)
   - sharp ile width/height bazlı doğrulama
   - Invalid ise create başlamadan hata

2. **Double fetch**: `validateAndFetchImages()` tek seferde fetch ediyor, `createAssetGroupWithAssets` pre-fetched base64 kullanıyor.

3. **Post-create verification**: `verifyPmaxCreated()` GAQL ile campaign, asset group, signals, location/language/ad schedule kontrolü yapıyor.

## 4. Kalan Riskler

- **placehold.co URL**: Smoke test harici URL kullanıyor; production’da gerçek CDN URL’leri kullanılmalı.
- **Conversion goals**: `selectedConversionGoalIds` hâlâ opsiyonel; hata durumunda warning dönüyor, campaign oluşuyor.
- **Gerçek hesap testi**: `npm run pmax:smoke` dev server + GOOGLE_ADS_* veya active DB connection ile manuel çalıştırılmalı.

## 5. Search Flow Korunuyor mu?

**Evet.** `npm run search:isolation` ile doğrulandı:

- Search: `create/route.ts` → `createFullCampaign` (create-campaign.ts)
- PMax: `create-performance-max/route.ts` → `createPerformanceMaxCampaign` (create-performance-max-campaign.ts)
- Ortak bağımlılık sadece `postMutate` (create-campaign.ts); PMax’a özgü mantık değişmedi.

## 6. PMax Gerçek Hesapta Oluşturuluyor mu?

- **Dry-run**: `node scripts/pmax-smoke-test.mjs --dry-run` ✅
- **Gerçek test**:
  1. `npm run dev` başlat
  2. `.env.local` içinde `ADMIN_SECRET`, `GOOGLE_ADS_*` veya active DB connection
  3. `npm run pmax:smoke` veya `npm run pmax:smoke -- --verify` (parity check ile)
  4. `campaignResourceName` ve `assetGroupResourceName` dönmeli

---

## Komutlar

```bash
# PMax smoke test (dry-run, API çağrısı yok)
npm run pmax:smoke -- --dry-run

# PMax gerçek create (dev server çalışırken)
npm run pmax:smoke

# Post-create parity ile
npm run pmax:smoke -- --verify

# Search isolation check
npm run search:isolation
```
