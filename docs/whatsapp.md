# WhatsApp — Son Doğrulama (Backend & Eşitlik Kanıtı)

## 1) Real inventory response sample

`GET /api/meta/inventory?page_id={pageId}` çağrıldığında sunucu log'unda şu satır yazılır:

```
[Inventory][{requestId}] INVENTORY_RESPONSE_SAMPLE (page-linked): { ... }
```

Örnek payload (telefonlar maskeli — `maskPhoneForLog` ile son 4 hane görünür):

```json
{
  "ok": true,
  "page_id": "123456789",
  "whatsapp_phone_numbers": [
    {
      "phoneNumberId": "108428661888121",
      "displayPhone": "********6147",
      "verifiedName": "My Busi...",
      "wabaId": "123456789012345"
    }
  ],
  "page_whatsapp_number": "********6147",
  "page_whatsapp_number_source": "page_access_token",
  "whatsapp_diagnostics": {
    "mode": "page_scoped",
    "page_id": "123456789",
    "business_id": "123456789012345",
    "mapping_source": "owner_business",
    "wabas_scanned": 1
  },
  "whatsapp_error": null
}
```

Bu örnek, yanıtın yapısını ve **sadece o sayfaya ait** WhatsApp verisini kanıtlar.

---

## 2) Page-linked numbers proof

`whatsapp_phone_numbers` dizisi **yalnızca** `fetchWhatsAppPhoneNumbers(client, requestId, pageId, pageAccessToken)` çıktısından doldurulur. Bu fonksiyon:

- Sadece **tek bir Graph çağrısı** yapar: **o sayfaya** ait `whatsapp_business_account`:
  - `GET /{pageId}?fields=whatsapp_business_account{id,name,phone_numbers{id,display_phone_number,...}}`
- Business/portfolio veya başka sayfaların WABA'ları **hiç** sorgulanmaz.
- Sonuç: Dönen `whatsapp_phone_numbers` **tanım gereği** sadece **seçili page'e bağlı** numaralardır.

Backend'de "page-linked olmayan numara" ekleyen bir yol yok; kanıt zinciri tek kaynağa (o page'in WABA'sına) dayanır.

---

## 3) Backend resolution — exact fallback (whatsapp_business_account)

`whatsapp_business_account` alanı için kullanılan akış (`app/api/meta/inventory/route.ts` → `fetchWhatsAppPhoneNumbers`):

| Adım | Kaynak | Davranış |
|------|--------|----------|
| 1 | **Page Access Token** | `GET https://graph.facebook.com/v24.0/{pageId}?fields=whatsapp_business_account{id,name,phone_numbers{...}}&access_token={pageAccessToken}`. Meta bu alanı **genelde sadece Page Token ile** doldurur. Başarılıysa bu numaralar döner, fallback'e girilmez. |
| 2 | **Fallback: User Token** | Page token yoksa veya WABA dönmüyorsa: `client.get(\`/${pageId}\`, { fields: 'whatsapp_business_account{...}' })` (User Access Token). Birçok hesapta User Token ile `whatsapp_business_account` **null** döner; o zaman liste boş. |
| 3 | Sonuç | Liste ya Page Token'dan gelen **page-linked** numaralar ya da boş. Business/portfolio listesi **hiç** kullanılmaz. |

Geçmişte sorun çıkaran kısım genelde User Token fallback'te `whatsapp_business_account === null` olmasıdır; bu durumda zaten boş dizi dönüyoruz, UI'da "Bu sayfaya bağlı numara yok" mesajı çıkar.

---

## 4) Ads Manager vs YoAi equality check

Aynı sayfa için Ads Manager'da görünen numara ile YoAi dropdown'unun aynı olduğunu doğrulamak:

1. **Ads Manager:** Meta Ads Manager → Reklam oluştur → Hedef "Mesajlar" / WhatsApp → Aynı Facebook Sayfası'nı seç → Reklam ayarlarında gösterilen WhatsApp numarasını not et (veya "Sayfa ayarlarından alınır" gibi bir ifade varsa sayfanın bağlı numarası).
2. **YoAi:** Aynı sayfayı seç → Ad set adımında Dönüşüm konumu WhatsApp → Dropdown'da listelenen numara(lar).
3. **Karşılaştır:**
   - Dropdown'da **tek numara** varsa: Ads Manager'daki numara ile aynı olmalı (son 4–7 hane veya tam format).
   - Dropdown'da **birden fazla** varsa: Hepsi o sayfaya bağlı WABA'ya ait olmalı; Ads Manager'da hangi numara seçiliyse YoAi'deki listede de olmalı.
   - Dropdown **boş** ama "Meta sayfaya bağlı numarayı (X) otomatik kullanacaktır" bilgisi varsa: X, Ads Manager'da kullanılan sayfa numarası ile aynı olmalı.

Eşitsizlik görürsen: Backend log'unda `INVENTORY_RESPONSE_SAMPLE` ile gelen `whatsapp_phone_numbers` ve `page_whatsapp_number` değerlerini (maskeli) kontrol et; token'ın Page mi User mı olduğu ve `mapping_source` değeri resolution'ı açıklar.

---

## 5) Teslim özeti

| Teslim | Açıklama |
|--------|----------|
| **Real inventory response sample** | Log: `[Inventory][{id}] INVENTORY_RESPONSE_SAMPLE (page-linked):` — yapı ve maskeli numaralar yukarıdaki gibi. |
| **Page-linked numbers sample** | Aynı log'daki `whatsapp_phone_numbers` dizisi; tek kaynak = `/{pageId}?fields=whatsapp_business_account{...}`. |
| **Ads Manager vs YoAi equality check** | Yukarıdaki 4. maddede adım adım karşılaştırma kuralı. |
| **Backend resolution proof** | Yukarıdaki 2. ve 3. maddeler: tek Graph kaynağı, fallback zinciri, business/portfolio kullanılmıyor. |

---

## 6) `page_welcome_message` — Düz string değil, JSON object gönderilmeli

### Sorun
`page_welcome_message` alanı düz string olarak gönderildiğinde Meta API `PERMISSION_DENIED` hatası döndürür.

### Çözüm (commit `4a1ddb3`)
`app/api/meta/ads/create/route.ts` içinde `buildPageWelcomeMessage` helper'ı eklendi.
`linkData`, `videoData` ve `carouselLinkData` içindeki tüm `page_welcome_message` atamaları bu helper ile sarmalandı.

```typescript
function buildPageWelcomeMessage(greeting: unknown) {
  if (typeof greeting !== 'string') return greeting
  return {
    type: 'VISUAL_EDITOR',
    version: 2,
    landing_screen_type: 'welcome_message',
    media_type: 'text',
    text_format: {
      customer_action_type: 'autofill_message',
      message: {
        autofill_message: { content: greeting },
        text: greeting,
      },
    },
  }
}
```

### Etkilenen satırlar
```diff
- linkData.page_welcome_message = chatGreeting
+ linkData.page_welcome_message = buildPageWelcomeMessage(chatGreeting)

- videoData.page_welcome_message = chatGreeting
+ videoData.page_welcome_message = buildPageWelcomeMessage(chatGreeting)

- carouselLinkData.page_welcome_message = chatGreeting
+ carouselLinkData.page_welcome_message = buildPageWelcomeMessage(chatGreeting)
```

# WhatsApp numara seçimi — Source of Truth

## Kural (KESİN KARAR)

- **Doğru kaynak:** Seçili Facebook Sayfası'na bağlı WhatsApp numarası / numaraları (page-linked).
- **Yanlış kaynak:** Meta Business Suite / business portfolio / WABA inventory'deki tüm numaralar (reklam seçeneği olarak sunulmaz).

Meta Ads davranışı: Kullanıcı sayfa seçer → Ads Manager o sayfaya bağlı WhatsApp numarasını getirir; portfolio'daki alakasız numaraları reklam seçeneği gibi göstermez.

---

## Old datasource (önceki)

- Dropdown seçenekleri: `accountInventory?.whatsapp_phone_numbers` **veya** (boşsa) `inventory?.whatsapp_phone_numbers` (capabilities / WABA).
- Yani: Önce sayfa-scoped refetch; yoksa capabilities’taki WhatsApp numaraları (iş portfolio’su) kullanılıyordu.
- Sorun: Portfolio’daki sayfaya bağlı olmayan numaralar da listelenebiliyordu.

## New datasource (şimdiki)

- Dropdown seçenekleri: **yalnızca** `accountInventory?.whatsapp_phone_numbers` (page-linked).
- `inventory?.whatsapp_phone_numbers` (capabilities) artık **hiç** dropdown’da kullanılmıyor.
- WABA / business inventory sadece diagnostics (log, mismatch analizi, yetki analizi) için kullanılabilir.

---

## Page-linked number resolution rule

- **Backend:** `GET /api/meta/inventory?page_id={pageId}` çağrıldığında `fetchWhatsAppPhoneNumbers(client, requestId, pageId, pageAccessToken)` çalışır.
- Kaynak: `/{pageId}?fields=whatsapp_business_account{id,name,phone_numbers{...}}` — yani **sadece o sayfaya bağlı WABA** ve onun numaraları.
- Dönüş: `whatsapp_phone_numbers` = o sayfaya bağlı numaralar; `page_whatsapp_number` = sayfa ayarındaki display numara (opsiyonel).
- CampaignWizard sayfa değişince aynı endpoint’i `page_id` ile tekrar çağırır; gelen liste **page-linked** listedir.

---

## Exact dropdown filtering rule

1. **Dropdown datasource:**  
   `pageLinkedNumbers = accountInventory?.whatsapp_phone_numbers ?? []`  
   Başka kaynak (capabilities, portfolio) **eklenmez**.

2. **Gösterim:**
   - `pageLinkedNumbers.length > 0` → Sadece bu listeden seçim (dropdown).
   - `pageLinkedNumbers.length === 0` ve `page_whatsapp_number` var → Sadece bilgi: “Meta sayfaya bağlı numarayı (X) otomatik kullanacaktır”; dropdown yok.
   - `pageLinkedNumbers.length === 0` ve `page_whatsapp_number` yok → **Bloklayıcı hata:** “Bu Facebook sayfasına bağlı WhatsApp numarası yok.”

3. **Geçerlilik:**  
   `selectedPhoneId` yalnızca `pageLinkedNumbers` içindeki bir `phoneNumberId` ise geçerli; değilse seçim geçersiz sayılır ve temizlenir / uyarı gösterilir.

4. **Auto-select:**  
   `pageLinkedNumbers.length === 1` ise bu tek numara otomatik seçilir.

---

## Son doğrulama (backend & eşitlik)

Response örneği, page-linked kanıtı, fallback zinciri ve Ads Manager vs YoAi karşılaştırması için: **[WHATSAPP_BACKEND_VALIDATION.md](./WHATSAPP_BACKEND_VALIDATION.md)**.

---

## Changed files

| Dosya | Değişiklik |
|-------|------------|
| `components/meta/wizard/TabDetails.tsx` | Dropdown datasource = sadece `accountInventory?.whatsapp_phone_numbers`; WABA fallback kaldırıldı. No-numbers durumunda bloklayıcı hata. Tek numara auto-select + geçersiz seçimi temizleyen `useEffect`. Validation: seçim sadece page-linked listesinde ise geçerli. |

---

## Not

- `app/api/meta/inventory/route.ts`: Zaten `page_id` ile çağrıldığında sadece page-linked numaraları döndürüyor; değişiklik yok.
- CampaignWizard’daki refetch ve “stale selection clear” (seçili numara yeni sayfa listesinde yoksa temizleme) davranışı aynen kullanılıyor.
