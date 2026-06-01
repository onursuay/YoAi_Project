# Email Marketing — Otomasyon (Aşama Tetikli Otomatik E-postalar)

**Tarih:** 2026-06-01
**Durum:** Tasarım onaylandı — uygulama planına geçilecek
**Modül:** Email Marketing (`/email-marketing` → "Otomasyon" sekmesi)

## Amaç

Email Marketing modülündeki şu an `soon: true` ile devre dışı olan **Otomasyon** sekmesini canlıya almak.
Otomasyon = belirli bir olay gerçekleştiğinde (CRM aşaması değişti / yeni kişi eklendi) ilgili kişiye
**anında** otomatik tek e-posta gönderen kurallar. Çeviri metnindeki senaryolar:
"yeni lead'e hoşgeldin, Uygun'a takip, Dönüşüm'e teşekkür".

## Kararlar (onaylı)

| Karar | Seçim | Gerekçe |
|---|---|---|
| Tetikleyiciler | **CRM aşama girişi** + **Yeni kişi eklendi** | Kullanıcı seçimi |
| Zamanlama | **Anında** | En öngörülür MVP |
| Tekrar koruması | **Her tetiklenmede** (idempotent log yok) | Kullanıcı seçimi — motor basit kalır |
| Motor mimarisi | **Inline fire-and-forget** | Mevcut Meta-sync deseni; az kod, INNGEST_EVENT_KEY gerektirmez |
| Toplu import davranışı | `contact_added` **yalnızca tekil manuel ekleme** tetikler | Timeout/rate-limit/spam koruması; "yeni gerçek kişi" niyeti |
| Gönderim hesabı yoksa | Kampanyalarla tutarlı → paylaşımlı platform domain | `buildDispatch` fallback dalı |

## Mimari / Akış

```
[CRM lead aşaması değişir]                      [Yeni kişi eklenir — tekil/manuel]
PATCH /api/crm/leads/[id]                        POST /api/email/contacts (tek kişi)
   │ status GERÇEKTEN değişti mi?                   │ tekil manuel ekleme mi?
   └────────── fire-and-forget ──┐      ┌────────── ┘
                                 ▼      ▼
                    lib/email/automationRunner.ts
                    • enabled otomasyonları çek (user_id)
                    • trigger eşleşir mi?
                        - crm_stage_enter → trigger.stage === newStage
                        - contact_added   → her zaman
                    • alıcı: e-posta var + opt_out=false
                    • buildDispatch(userId) ile tek alıcıya gönder
                    • email_sends'e kayıt (automation_id, campaign_id NULL)
                    • tüm hatalar yutulur — ana akış ETKİLENMEZ
```

Tetik çağrıları `await` **edilmez** ve `try/catch`/`.catch()` ile sarılır. CRM güncellemesi veya
kişi ekleme işlemi otomasyon hatasından **asla** etkilenmez (mevcut `syncLeadToMeta` deseniyle aynı).

## Veri Modeli

Mevcut `email_automations` tablosu kullanılır (yeni tablo yok) —
[supabase/migrations/20260531010000_create_email_marketing.sql:96](../../../supabase/migrations/20260531010000_create_email_marketing.sql):

```sql
email_automations (
  id, user_id, name,
  trigger jsonb,    -- {type:'crm_stage_enter', stage:'uygun'} | {type:'contact_added'}
  subject text, html text, enabled boolean,
  created_at, updated_at
)
```

**Küçük migration (ek):** `email_sends` tablosuna nullable `automation_id uuid` kolonu eklenir
(FK `email_automations(id) ON DELETE SET NULL`). Böylece otomasyon gönderimleri de kayıt altında
ve raporlanabilir olur. Mevcut `onConflict: 'campaign_id,email'` upsert'i bozmamak için otomasyon
gönderimleri **plain insert** ile yazılır (campaign_id NULL).

> **Migration prod notu (omddq):** Bu kolon omddq'ya da uygulanmalı. `automation_id` nullable +
> default yok → mevcut satırları etkilemez, geriye dönük güvenli. `email_automations` tablosunun
> omddq'da gerçekten var olduğu deploy öncesi doğrulanır (migration gaps riski).

## Gönderim Katmanı Refactor (sender.ts)

Şu an `sendCampaign` içinde gömülü olan **gönderim yolu seçimi** ayrı bir fonksiyona çıkarılır:

```ts
// lib/email/sender.ts
export async function buildDispatch(userId: string): Promise<{ dispatch: Dispatch; via: ... }>
```

- `sendCampaign` bu fonksiyonu çağıracak şekilde refactor edilir (davranış **birebir korunur**).
- `automationRunner` aynı `buildDispatch` + mevcut `buildHtml` + `unsubscribeUrl` yardımcılarını
  yeniden kullanır → tek alıcıya gönderim, zorunlu KVKK unsubscribe footer'ı otomatik.
- Bu, presentation/iş mantığı tekrarını önler ve iki yolun davranışını aynı tutar.

## Dosya Değişiklikleri

**Yeni:**
- `lib/email/automationRunner.ts` — eşleştirme + tek alıcıya gönderim + email_sends kaydı
- `lib/email/automationStore.ts` — `email_automations` CRUD (list/create/update/delete/toggle)
- `app/api/email/automations/route.ts` — GET (list) + POST (create)
- `app/api/email/automations/[id]/route.ts` — PATCH (güncelle/enabled toggle) + DELETE
- `components/email/AutomationsTab.tsx` — UI (CampaignsTab desenine birebir)
- `supabase/migrations/2026060100xxxx_email_sends_automation_id.sql` — automation_id kolonu

**Dokunulan:**
- `lib/email/sender.ts` — `buildDispatch` extract (davranış korunur)
- `app/api/crm/leads/[id]/route.ts` — PATCH'te status değişince fire-and-forget tetik
- `app/api/email/contacts/route.ts` — tekil manuel eklemede fire-and-forget tetik
- `components/email/EmailDashboard.tsx` — `automation` sekmesi `soon: false`, AutomationsTab render
- `locales/tr.json` + `locales/en.json` — `email.automations.*` anahtarları

## Tetikleyici Mantığı Detayı

### CRM aşama girişi
- [app/api/crm/leads/[id]/route.ts](../../../app/api/crm/leads/[id]/route.ts) PATCH içinde,
  status **önceki değerden farklıysa** (gerçek geçiş) tetiklenir.
- `runStageAutomations(userId, lead, newStage)` → trigger.type === 'crm_stage_enter' &&
  trigger.stage === newStage olan enabled otomasyonlar.
- Lead'in `email` alanı yoksa sessiz atlanır.

### Yeni kişi eklendi
- [app/api/email/contacts/route.ts](../../../app/api/email/contacts/route.ts) POST içinde,
  **yalnızca tekil manuel ekleme** (tek kişi, source=manual) yolunda tetiklenir.
- Toplu CSV import ve CRM aktarımı **tetiklemez** (timeout/rate-limit/spam koruması).
- `runContactAddedAutomations(userId, contact)` → trigger.type === 'contact_added' enabled otomasyonlar.

### Geçmişe dönük yok
Otomasyon yalnızca **kurulduktan sonra** gerçekleşen olaylara uygulanır. Mevcut 162 kişiye veya
geçmiş aşama değişimlerine geriye dönük gönderim yapılmaz.

## UI — Otomasyon Sekmesi

[components/email/EmailDashboard.tsx:135](../../../components/email/EmailDashboard.tsx) `soon: true` kaldırılır.

`AutomationsTab.tsx` ([components/email/CampaignsTab.tsx](../../../components/email/CampaignsTab.tsx) deseninde):
- **Liste görünümü:** otomasyon kartları — ad, tetikleyici özeti ("Uygun aşamasına girince" / "Yeni kişi eklenince"),
  enabled toggle (emerald/gray), düzenle, sil. Boş durum kartı.
- **Oluştur/düzenle formu:** solda form, sağda canlı HTML önizleme (CampaignsTab gibi).
  - Tetikleyici seçimi: **WizardSelect** (native select YASAK) — iki seçenek; "Aşamaya girince" seçilince
    ikinci WizardSelect ile aşama (CRM aşamaları: Giriş/Uygun/Dönüşüm/Kayıp/Uygun değil).
  - Konu (subject), İçerik (HTML) + contentHint (unsubscribe otomatik eklenir).
- Standartlar: `max-w` konteyner, `animate-card-enter` kademeli giriş, `hover:shadow-md transition-all`.

## i18n + Proje Standartları

- Tüm metinler `email.automations.*` altında **HEM tr.json HEM en.json** (aynı key path).
- CRM aşama etiketleri mevcut `components/crm/stageMeta.ts` çevirilerinden okunur (ham enum YASAK —
  `giris`/`uygun` UI'da "Giriş"/"Uygun" olarak görünür).
- Renk: amber/sarı YASAK; toggle emerald/gray, CTA primary.
- Dropdown: yalnız WizardSelect.
- Erişim bariyeri: Email Marketing modülünün **mevcut** erişim kuralına tabi — yeni bariyer eklenmez,
  super admin bypass korunur.

## Kapsam Dışı (YAGNI)

- Zaman tabanlı / gecikmeli gönderim (drip sekansı) — sonraki faz.
- İdempotent tekrar koruması (lead başına 1 kez) — kullanıcı "her tetiklenmede" seçti.
- Toplu CSV import'ta otomasyon tetikleme — bilinçli olarak hariç.
- A/B test, açılma/tıklama bazlı dallanma, koşullu akışlar.
- Inngest event mimarisi — inline fire-and-forget tercih edildi.

## Doğrulama / Test

- `npx tsc --noEmit` 0 hata.
- tr/en parity: yeni anahtarların ikisinde de bulunması.
- Manuel akış: bir otomasyon oluştur (Uygun→e-posta) → bir lead'i Uygun'a çek → e-posta gider,
  `email_sends`'e automation_id ile kayıt düşer.
- Negatif: otomasyon hatası (örn. gönderim hesabı sorunu) CRM PATCH yanıtını **bozmaz**.
- Toplu CSV import → otomasyon tetiklenMEZ (doğrulama).
