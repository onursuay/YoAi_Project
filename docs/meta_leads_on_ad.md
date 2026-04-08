# Meta Leads ON_AD — Teknik Notlar ve Fix Geçmişi

## Sorun Özeti

`OUTCOME_LEADS + ON_AD` (Potansiyel Müşteri / Instant Form) reklam akışında creative oluşturma 400 hatası veriyordu.

---

## Kök Nedenler ve Çözümler

### 1. `destination_type=ON_AD` adset'e gönderilmiyordu (subcode 1892040)

**Dosya:** `app/api/meta/adsets/create/route.ts`

`resolveDestinationConfig` fonksiyonunda ON_AD, ON_PAGE, CALL destination type'ları tüm objective'ler için bastırılıyordu (subcode 1815715'i önlemek için). Ancak `OUTCOME_LEADS + ON_AD` kombinasyonunda Meta adset'i ON_AD olarak tanımak için `destination_type=ON_AD` alanını **zorunlu** tutuyor.

**Fix:**
```ts
if (['ON_AD', 'ON_PAGE', 'CALL', 'PHONE_CALL'].includes(destinationType)) {
  if (objective === 'OUTCOME_LEADS' && destinationType === 'ON_AD') {
    needsDestinationType = true  // ← LEADS için ON_AD gönderilmeli
  } else {
    needsDestinationType = false
  }
}
```

---

### 2. Creative `link_data`'da `link` alanı zorunlu (subcode 2061015)

**Dosya:** `app/api/meta/ads/create/route.ts`

Meta, Leads ON_AD creative'inde `link_data.link` alanının dolu olmasını zorunlu tutuyor. Ancak `link_data` içine `facebook.com` URL'si gönderilince başka bir hata alınıyor (subcode 1815316).

**Çözüm:** Harici HTTPS URL fallback zinciri:
1. `creative.websiteUrl` (kullanıcıdan)
2. `pageWebsite` (body'den, yoksa Meta Graph API `/{pageId}?fields=website` ile çekiliyor)
3. `tenantDefaultLeadUrl`
4. `tenantPrivacyPolicyUrl`
5. `formPrivacyPolicyUrl` (lead formun privacy policy URL'si)
6. **`https://yoai.yodijital.com/en/privacy-policy`** ← son halka, her zaman dolu

**Dosya:** `lib/meta/resolveLeadCreativeLink.ts`

```ts
// Fallback chain — ilk geçerli harici HTTPS URL kullanılır
// facebook.com ve fb.me reddedilir
```

---

### 3. `lead_gen_form_id` yanlış yerlere eklendi (subcode 1443050)

**Dosya:** `app/api/meta/ads/create/route.ts`

- `link_data` içine `lead_gen_form_id` eklemek **hata veriyor** — Meta bu alanı link_data'da desteklemiyor.
- Doğru yerler: **CTA value** (`call_to_action.value.lead_gen_form_id`) ve **ad payload** (`lead_gen_form_id`).

```ts
// DOĞRU: CTA value'da
ctaValue = { lead_gen_form_id: leadFormId }  // link yoksa
ctaValue = { link: linkUrl, lead_gen_form_id: leadFormId }  // link varsa

// DOĞRU: ad payload'da
adFormData.append('lead_gen_form_id', leadFormId)

// YANLIŞ: link_data içinde
linkData.lead_gen_form_id = leadFormId  // ← subcode 1443050 hatası
```

---

### 4. CTA value boş `link` gönderme (subcode 2061015)

`linkUrl` boş string olunca `ctaValue: { link: "", lead_gen_form_id: "..." }` gidiyordu. Boş string de geçersiz sayılıyor.

**Fix:** `linkUrl` boşsa veya `facebook.com` içeriyorsa CTA value'ya `link` alanı hiç eklenmez.

---

## Meta API Kuralları (OUTCOME_LEADS + ON_AD)

| Alan | Nerede | Zorunlu? | Not |
|------|--------|----------|-----|
| `destination_type=ON_AD` | adset payload | ✅ Evet | Olmadan adset ON_AD olarak tanınmıyor |
| `lead_gen_form_id` | adset `promoted_object` | ❌ Hayır | Adset seviyesinde değil, ad seviyesinde |
| `lead_gen_form_id` | ad CTA value | ✅ Evet | `call_to_action.value.lead_gen_form_id` |
| `lead_gen_form_id` | ad payload | ✅ Evet | Ayrı alan olarak |
| `link_data.link` | creative | ✅ Evet | Harici HTTPS olmalı, facebook.com olamaz |
| `lead_gen_form_id` | `link_data` | ❌ Yasak | subcode 1443050 hatası verir |

---

---

## WhatsApp Reklamlarında Chat Greeting Gösterilmemeli

**Etkilenen dosyalar:**
- `components/meta/wizard/StepAd.tsx`
- `components/meta/CampaignWizard.tsx`
- `lib/meta/spec/preflightValidator.ts`
- `app/api/meta/ads/create/route.ts`

Meta `page_welcome_message` alanını **sadece Messenger** için destekliyor. WhatsApp reklamlarında bu alan gönderilse bile dikkate alınmıyor — ve UI'da gösterilmesi kullanıcıyı yanıltıyor.

**Belirtiler:**
- Dönüşüm konumu WhatsApp seçilince "Chat Greeting" alanı çıkıyor
- Alan zorunlu tutulduğu için Next / Publish butonu aktif olmuyor

**Çözüm:**

1. `StepAd.tsx` — `isEngagementMessaging`, `isLeadsMessaging`, `isSalesMessaging` değişkenleri WHATSAPP'ı dışarıda bırakacak şekilde sadece `MESSENGER` kontrol edecek:
```ts
const isEngagementMessaging = campaignObjective === 'OUTCOME_ENGAGEMENT' && conversionLocation === 'MESSENGER'
const isLeadsMessaging = isLeads && conversionLocation === 'MESSENGER'
const isSalesMessaging = campaignObjective === 'OUTCOME_SALES' && conversionLocation === 'MESSENGER'
```

2. `CampaignWizard.tsx` — `canGoNext` koşullarında WHATSAPP için chatGreeting zorunluluğu kaldırıldı.

3. `preflightValidator.ts` — Leads/Sales/Engagement + WHATSAPP kombinasyonunda chatGreeting zorunlu tutulmaz.

4. `ads/create/route.ts` — `needsWelcomeMsg` koşulu `!isWhatsApp` ile sınırlandırıldı:
```ts
const needsWelcomeMsg = !!(chatGreeting && !isWhatsApp && (
  isEngagementMessaging || isLeadsMessaging || isSalesMessaging
))
```

**Kural:** Hangi objective olursa olsun, `conversionLocation === 'WHATSAPP'` ise Chat Greeting gösterilmez, gönderilmez, zorunlu tutulmaz.

---

## İlgili Meta Hata Kodları

| Subcode | Açıklama | Çözüm |
|---------|----------|-------|
| 1892040 | Creative with lead form can only be used for Lead Generation + ON_AD | adset'e `destination_type=ON_AD` ekle |
| 2061015 | The link field is required | `link_data.link` harici HTTPS URL ile doldur |
| 1815316 | Lead Generation Ads should link to external content | facebook.com URL kullanma |
| 1443050 | lead_gen_form_id not supported in link_data | link_data'ya ekleme, sadece CTA value'ya |
| 1815715 | Invalid destination_type enum | ON_AD'i diğer objective'lerde gönderme |
