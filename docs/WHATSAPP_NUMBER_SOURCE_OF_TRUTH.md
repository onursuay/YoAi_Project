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

## Changed files

| Dosya | Değişiklik |
|-------|------------|
| `components/meta/wizard/TabDetails.tsx` | Dropdown datasource = sadece `accountInventory?.whatsapp_phone_numbers`; WABA fallback kaldırıldı. No-numbers durumunda bloklayıcı hata. Tek numara auto-select + geçersiz seçimi temizleyen `useEffect`. Validation: seçim sadece page-linked listesinde ise geçerli. |

---

## Not

- `app/api/meta/inventory/route.ts`: Zaten `page_id` ile çağrıldığında sadece page-linked numaraları döndürüyor; değişiklik yok.
- CampaignWizard’daki refetch ve “stale selection clear” (seçili numara yeni sayfa listesinde yoksa temizleme) davranışı aynen kullanılıyor.
