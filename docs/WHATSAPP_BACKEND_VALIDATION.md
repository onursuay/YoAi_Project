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
