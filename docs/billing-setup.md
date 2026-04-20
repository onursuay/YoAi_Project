# Ödeme Sistemi Kurulumu (İyzico)

## 1. Supabase tabloları
Dashboard → SQL Editor'da `supabase/migrations/20260420000000_create_billing_tables.sql` dosyasındaki SQL'i çalıştırın. 3 tablo oluşur:
- `subscriptions` — aktif plan (user başına 1 satır)
- `credit_balances` — kredi bakiyesi (user başına 1 satır)
- `payment_transactions` — ödeme kayıtları (idempotent kontrol için)

## 2. İyzico hesabı
İyzico'ya başvuru tamamlandığında aşağıdaki değerleri `.env.local`'a ekleyin:

```bash
# Sandbox için: https://sandbox-api.iyzipay.com
# Production için: https://api.iyzipay.com
IYZICO_API_KEY=sandbox-xxx
IYZICO_SECRET_KEY=sandbox-xxx
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com

# Callback URL'nin public olabilmesi için (zorunlu)
NEXT_PUBLIC_APP_URL=https://yoai.example.com
```

Bu değişkenler yokken `/api/billing/iyzico/start` 503 `iyzico_not_configured` döner ve UI kullanıcıya nazik bir hata gösterir.

## 3. Akış

1. Kullanıcı `/abonelik` sayfasında plan seçer → frontend `POST /api/billing/iyzico/start` çağırır, body'de **sadece** `{ type, planId, billingCycle, adAccounts }` (veya `{ type: 'credit_pack', packageId }`) gönderir
2. Backend `lib/billing/catalog.ts`'ten fiyatı **kendisi** hesaplar, `payment_transactions` tablosuna `status='pending'` satır açar, iyzipay `checkoutFormInitialize` çağırır, gelen `paymentPageUrl`'i döner
3. Frontend `window.location.href = paymentPageUrl` ile kullanıcıyı İyzico'ya yönlendirir (kart bilgisi **bize değmez**)
4. İyzico ödeme sonrası `POST /api/billing/iyzico/callback`'e `token` ile POST eder
5. Callback endpoint'i:
   - `retrieveCheckoutForm(token)` ile İyzico'dan ödeme durumunu doğrular
   - `conversationId` DB'deki transaction ile eşleşmeli
   - `paidPrice` backend'deki fiyat kataloguyla eşleşmeli (tampering koruması)
   - `pending→succeeded` transition sadece 1 kez başarılı olur (idempotent — Supabase update `.eq('status','pending')` guard'ı sayesinde)
   - Başarılıysa `subscriptions` / `credit_balances` güncellenir
6. Kullanıcı `/abonelik?payment=success` veya `/abonelik?payment=failed`'e yönlendirilir — bu query sadece **görsel toast** için, gerçek state `/api/billing/current`'tan okunur

## 4. Güvenlik notları

- Kart bilgisi hiçbir şekilde bizim frontend/backend/log'umuza girmez (hosted checkout)
- Frontend'den gelen `price` / `credits` / `planName` alanlarına **güvenilmez** — sadece `planId` / `packageId` / `billingCycle` / `adAccounts` dikkate alınır
- Callback doğrulanmadan abonelik aktifleştirilmez
- `conversation_id` ve `iyzico_payment_id` UNIQUE → aynı ödeme iki kez işlenmez
- User eşlemesi: `conversationId` formatı `<user_id>:<random>` ve `payment_transactions.user_id` doğrudan cookie'deki kalıcı `user_id`'den alınır (`session_id` değil)

## 5. Test akışı (sandbox)

1. İyzico sandbox test kartları: https://dev.iyzipay.com/tr/test-kartlari
2. `/abonelik` → Starter plan → Aylık → Satın Al
3. Sandbox ödeme sayfasında test kartı gir
4. Otomatik callback → `/abonelik?payment=success`
5. Sayfa yenilendiğinde aktif plan "Starter (Active)" olarak görünmeli
6. `payment_transactions` tablosunda `status='succeeded'` satır olmalı

## 6. Kaldırılanlar

- `localStorage: yoai-credits` — artık `/api/billing/current` ve `/api/credits/spend` kullanılıyor
- `localStorage: yoai-subscription` — artık `/api/billing/current` kullanılıyor
- `SubscriptionProvider.updateSubscription()` — API'den kaldırıldı, yerine `refresh()` var
- `CreditProvider.addCredits()` / `resetCredits()` — API'den kaldırıldı (kredi sadece ödeme callback'inde ve plan satın almada artar)
