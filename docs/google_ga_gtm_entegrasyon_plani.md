# Google Analytics 4 (GA4) + Google Tag Manager (GTM) Entegrasyon Planı

> **Durum:** Planlama fazı (kod yazılmadı). Bu doküman Aşama 2'de implementasyon referansı olarak okunacaktır.
> **Tarih:** 2026-05-20
> **Kapsam:** GA4 ve GTM'in YoAi'ye OAuth tabanlı API entegrasyonu (Google OAuth uygulama doğrulaması / verification dahil).
> **Temel prensip:** Mevcut Meta (DB-first) ve Google Ads/GA/GSC pattern'leri **birebir** mirror edilir; yeni paradigma icat edilmez.

---

## 0. Yönetici Özeti — Önce Bunu Oku

Keşif sonucu üç kritik gerçek belirledi; tüm plan bunların üzerine kurulu:

1. **GA4 sunucu-taraflı OAuth + raporlama ZATEN VAR ve çalışıyor.** `google_analytics_connections` tablosu, tam route ağacı (`start/callback/status/properties/select-property/reports/disconnect`), `lib/google-analytics/connectionStore.ts` + `service.ts` mevcut. Scope **salt-okunur** (`analytics.readonly`). GA4 için "sıfırdan kurulum" gerekmez — mevcut taban üzerine inşa edilir.
2. **GTM kodu HİÇ YOK (greenfield).** `lib/google-tag-manager/**` yok, `app/api/integrations/google-tag-manager/**` yok, `ProviderKey`'de `google_tag_manager` yok, `tagmanager` scope/const yok. Tek eşleşmeler privacy policy metni ve bir scraper blocklist'i (fonksiyonel kod değil). GTM, GA/GSC üçlüsü kopyalanarak kurulur.
3. **Hiçbir client-side ölçüm tag'i yok.** `gtag.js`, `dataLayer`, `GTM-XXXX` snippet'i repoda yok. Bu plan **OAuth API entegrasyonu** içindir (kullanıcının GA4 property'lerini / GTM container'larını YoAi adına okuma/yönetme), client-side measurement tagging için değil. Bu, "OAuth verification", "scope demo videosu", "data deletion" gereksinimleriyle ve son commit'lerle (`4342f6e` — privacy policy GA4/GTM bölümleri) tutarlıdır.

**En kritik açık karar:** GA4 ve GTM **salt-okunur** mu kalacak yoksa **yazma/admin** yetkileri (property/container *oluşturma*, conversion/event *konfigürasyonu*) de istenecek mi? Görev tanımı "oluşturma" ve "ölçüm planı konfigürasyonu" dediği için yazma scope'ları ima ediliyor — bu, OAuth doğrulamasını ciddi ölçüde ağırlaştırır (restricted scope + güvenlik değerlendirmesi). Bkz. [§4](#4-oauth-scope-yönetimi) ve [Açık Sorular](#açık-sorular-implementasyon-öncesi).

---

## 1. Mevcut Google Yapısının Teknik Özeti

### 1.1 Supabase Tabloları

Tüm Google bağlantı tabloları **aynı pattern'i** izler: `user_id TEXT` (= `signups.id`, `user_id` cookie), tek satır/kullanıcı (unique index), `status` CHECK, **RLS YOK** (izolasyon uygulama katmanında `.eq('user_id', userId)` + service-role key ile sağlanır).

| Tablo | Migration | Token modeli | Önemli kolonlar |
|---|---|---|---|
| `google_ads_connections` | [20260315000000](../supabase/migrations/20260315000000_create_google_ads_connections.sql) | `refresh_token` | `google_ads_refresh_token`, `google_ads_customer_id`, `google_ads_login_customer_id`, `token_scope`, `connected_email`, `status` |
| `google_analytics_connections` ✅ VAR | [20260328000000](../supabase/migrations/20260328000000_create_analytics_and_search_console.sql) | `refresh_token` (+ kullanılmayan `access_token`/`token_expires_at` kolonları) | `refresh_token`, `selected_property_id`, `selected_property_name`, `account_id`, `token_scope`, `connected_email`, `status`, `last_sync_at`, `last_error` |
| `google_search_console_connections` ✅ VAR | aynı dosya | `refresh_token` | `selected_site_url`, `selected_site_name`, diğerleri GA ile aynı |
| `report_cache` (paylaşımlı) | aynı dosya | — | `user_id`, `provider`, `report_type`, `date_from`, `date_to`, `payload JSONB`, `fetched_at` |

`google_analytics_connections` şeması (doğrulanmış, [migration:2-22](../supabase/migrations/20260328000000_create_analytics_and_search_console.sql)):

```sql
CREATE TABLE IF NOT EXISTS google_analytics_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google_analytics',
  refresh_token TEXT,
  access_token TEXT,                 -- şu an YAZILMIYOR (callback sadece refresh_token kaydeder)
  token_expires_at TIMESTAMPTZ,      -- şu an KULLANILMIYOR (her istekte taze token alınır)
  token_scope TEXT,
  connected_email TEXT,
  selected_property_id TEXT,
  selected_property_name TEXT,
  account_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_ga_connections_user_id ON google_analytics_connections(user_id);
CREATE INDEX idx_ga_connections_status ON google_analytics_connections(status) WHERE status = 'active';
```

> **Not (RLS):** Hiçbir Google/Meta bağlantı tablosunda RLS yok. Bu, tutarlı bir mevcut konvansiyon. GTM tablosu da aynı konvansiyonu izlemeli (aksi takdirde tek tablo farklı davranır). RLS'i tüm bağlantı tablolarına eklemek **ayrı bir cross-cutting sertleştirme görevi** olarak ele alınmalı, bu entegrasyonun parçası değil (scope creep + prod riski).

### 1.2 OAuth Akışı

- **Tek paylaşımlı Google OAuth client'ı:** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Ads, GA, GSC hepsi aynı client'ı kullanır).
- **Per-product start/callback route'ları.** Scope her ürün için sabit kodlu ([lib/integrations/constants.ts:8-14](../lib/integrations/constants.ts)).
- **Auth URL** ([google-analytics/start/route.ts](../app/api/integrations/google-analytics/start/route.ts)): `https://accounts.google.com/o/oauth2/v2/auth`, `access_type=offline` + `prompt=consent` (refresh token almak için), `state=ga_<hex>` (CSRF, httpOnly cookie `ga_oauth_state`, 10dk), `hl=<locale>`. **PKCE yok.** `redirect_uri = GOOGLE_ANALYTICS_REDIRECT_URI || {origin}/api/integrations/google-analytics/callback`.
- **Callback** ([google-analytics/callback/route.ts](../app/api/integrations/google-analytics/callback/route.ts)): state doğrula → `exchangeCodeForTokens` → `user_id` cookie oku → `refresh_token` zorunlu → `upsertGAConnection` → locale-aware redirect: TR `/entegrasyon?ga=connected`, EN `/en/integration?ga=connected`. **Cookie'ye token yazmaz (DB-only)** — bu, Meta'nın `fbece82`'de ulaştığı temiz pattern'le aynı.
- **Token storage:** Ads = cookie + DB; **GA/GSC = sadece DB** (tercih edilen, temiz pattern).
- **Refresh:** [googleOAuthHelpers.ts:53-78](../lib/integrations/googleOAuthHelpers.ts) `refreshAccessToken(refreshToken)` — her istekte taze access token alır; **caching yok, expiry takibi yok** (`token_expires_at` kolonu var ama kullanılmıyor). Hata davranışı: `throw`.

### 1.3 Helper / Context Modülleri

| Modül | Fonksiyon | İmza / kontrat |
|---|---|---|
| [lib/googleAdsUserId.ts](../lib/googleAdsUserId.ts) | `getGoogleAdsUserId(cookieStore)` | `user_id` cookie'sini (= `signups.id`) okur; yoksa `null`. **Tüm Google ürünleri bunu kimlik anahtarı olarak kullanır.** |
| [lib/integrations/googleOAuthHelpers.ts](../lib/integrations/googleOAuthHelpers.ts) | `exchangeCodeForTokens(code, redirectUri)` | `Promise<GoogleTokenResponse>`; başarısızlıkta **throw**. |
| | `refreshAccessToken(refreshToken)` | `Promise<string>` (access token); **throw** on fail. |
| | `fetchWithRetry(url, init, maxRetries=3)` | 429/5xx'te exponential backoff. |
| [lib/google-analytics/connectionStore.ts](../lib/google-analytics/connectionStore.ts) | `getGAConnection(userId)` | `Promise<GAConnectionContext \| null>` — hata/eksik token'da **null döner, throw etmez**. |
| | `getGAConnectionStatus(userId)` | `Promise<{connected, propertyId, propertyName, lastSyncAt, error}>` |
| | `upsertGAConnection(userId, input)` | `Promise<boolean>` — idempotent, kısmi update'te mevcut token korunur. |
| | `revokeGAConnection(userId)` | `Promise<void>` — `status='revoked'`, `refresh_token=null`. |
| [lib/google-analytics/service.ts](../lib/google-analytics/service.ts) | `listProperties / getSummaryKpis / getDailySeries / ...` | `(refreshToken, propertyId, ...)` alır, içeride `refreshAccessToken` çağırır; API hatasında **throw**. |
| [lib/integrations/constants.ts](../lib/integrations/constants.ts) | sabitler | `GOOGLE_AUTH_URL`, `GOOGLE_TOKEN_URL`, `GOOGLE_ANALYTICS_SCOPES`, `GA_DATA_API_BASE`, `GA_ADMIN_API_BASE`, `REPORT_CACHE_TTL_MS=15dk`, `RETRY` |
| [lib/integrations/types.ts](../lib/integrations/types.ts) | tipler | `ProviderKey = 'meta_ads' \| 'google_ads' \| 'google_analytics' \| 'google_search_console'` (**`google_tag_manager` YOK — eklenecek**) |

> **İsimlendirme notu:** Görev tanımındaki `resolveGoogleAdsContext` / `getUserGoogleConnection` literal olarak yok. Gerçek karşılıklar: Ads'te `getGoogleAdsContext()` (cookie-first + DB fallback, `throw`'lu), GA/GSC'de `getGAConnection()`/`getGSCConnection()` (store, **null döner**). Meta'da `resolveMetaContext()` (client + context döndüren wrapper) var.

### 1.4 API Route Yapısı (Mevcut)

`app/api/integrations/<provider>/` konvansiyonu (NOT: Görev'de yazılan `/api/ga/*` ve `/api/gtm/*` mevcut yapıyı parçalar — bkz. [§6](#6-api-route-yapısı)):

- **google-ads** — 64 route (tam CRUD): `start, callback, select-account, disconnect, accounts, campaigns/*, ad-groups, ads, dashboard-kpis, tools/*`.
- **google-analytics** (7 route, hepsi `user_id` cookie-gated): `start, callback, status, properties, select-property, reports, disconnect`.
- **google-search-console** (7 route, GA'nın aynısı): `start, callback, status, sites, select-site, reports, disconnect`.

### 1.5 Wizard UI + Entegrasyon Sayfası

- **Wizard state:** [components/google/wizard/shared/WizardTypes.ts](../components/google/wizard/shared/WizardTypes.ts) — **reducer/context/store YOK**; parent'ta `useState<WizardState>` + `update(partial)` merge. Step kontratı:
  ```ts
  export interface StepProps {
    state: WizardState
    update: (partial: Partial<WizardState>) => void
    t: (key: string, params?: any) => string
  }
  ```
  Parent ([GoogleCampaignWizard.tsx](../components/google/wizard/GoogleCampaignWizard.tsx)) `step` index'i ile koşullu render eder, `validateStep` ile ilerler, `submit()` ile POST eder.
- **Entegrasyon sayfası:** [app/entegrasyon/page.tsx](../app/entegrasyon/page.tsx) (`'use client'`, ~1080 satır). İki kart grid'i: **"Reklam Platformları"** (Meta, Google Ads, TikTok) + **"Raporlama Platformları"** (Google Analytics ✅, Google Search Console ✅). GA kartı zaten var (`gaStatus`, `handleGAConnect`, property-picker modal). **GTM kartı bu grid'e GA bloğu klonlanarak eklenir.** Sayfa locale-routed DEĞİL (`app/entegrasyon/`, locale cookie ile).
  > ⚠️ Mevcut amber ihlali: [page.tsx:475](../app/entegrasyon/page.tsx) ve `:757` `bg-amber-*` kullanıyor — CLAUDE.md kuralı gereği yeni GTM UI'da amber/sarı kullanılmaz; bu iki satır da düzeltilebilir.

### 1.6 i18n

- **next-intl** (v4.7). [i18n.ts](../i18n.ts) locale'i `NEXT_LOCALE` cookie'den okur (default `tr`), mesajları `locales/${locale}.json`'dan import eder.
- `locales/tr.json` + `locales/en.json` — **2451 key, birebir aynı ağaç (single-source)**. **Otomatik parity tooling YOK**, manuel korunuyor → yeni key'ler **her iki dosyaya** eklenmeli.
- Namespace'ler: `dashboard.google.wizard.*` (695 key — Google Ads wizard), `dashboard.entegrasyon.*` (provider kartları: `meta, google, googleAnalytics, googleSearchConsole, tiktok`).
- Kullanım: client'ta `useTranslations('dashboard.google.wizard')`; `t` fonksiyonu step'lere prop olarak geçer.
- **Privacy policy single-source:** [components/legal/PrivacyPolicyContent.tsx](../components/legal/PrivacyPolicyContent.tsx) GA4/GTM bölümlerini i18n key'leri (`legal` namespace) üzerinden render eder (örn. `section3GTMTitle`). Bu pattern korunur.

---

## 2. GA4 + GTM Tablo Şema Önerisi

### 2.1 GA4 — Mevcut tabloyu KORU, gerekirse additive genişlet

`google_analytics_connections` zaten var ve salt-okunur akış için yeterli. **Yazma/ölçüm-planı** istenirse, mevcut satırlara **sadece additive** kolonlar eklenir (yeni tablo değil):

```sql
-- SADECE GA4 yazma/ölçüm planı kapsama girerse (Faz 2):
ALTER TABLE google_analytics_connections
  ADD COLUMN IF NOT EXISTS measurement_id TEXT,            -- "G-XXXXXXX"
  ADD COLUMN IF NOT EXISTS data_stream_id TEXT,
  ADD COLUMN IF NOT EXISTS measurement_plan JSONB DEFAULT '{}';  -- custom events + conversions config
```
> **prod-risk-min:** Şema oturana kadar konfigürasyonu tipli kolon yerine `measurement_plan JSONB` içinde tut; yaygınlaşan alanlar 1-2 ay sonra tipli kolona terfi eder (Meta `ai_suggestions.payload` JSONB yaklaşımıyla aynı).

### 2.2 GTM — Yeni tablo (GA'yı birebir mirror et)

```sql
-- supabase/migrations/<TS>_create_google_tag_manager_connections.sql
CREATE TABLE IF NOT EXISTS google_tag_manager_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google_tag_manager',
  refresh_token TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  token_scope TEXT,
  connected_email TEXT,
  selected_account_id TEXT,
  selected_account_name TEXT,
  selected_container_id TEXT,
  selected_container_name TEXT,
  selected_container_public_id TEXT,   -- "GTM-XXXXXX"
  selected_workspace_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gtm_connections_user_id ON google_tag_manager_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_gtm_connections_status ON google_tag_manager_connections(status) WHERE status = 'active';
-- RLS: mevcut konvansiyon gereği YOK (service-role + uygulama katmanı .eq('user_id', ...))
```

---

## 3. KRİTİK KARAR — Tek Tablo mu, Üç Ayrı Tablo mu?

**Bağlam:** Üç ayrı Google tablosu (`google_ads_connections`, `google_analytics_connections`, `google_search_console_connections`) **zaten var ve canlıda çalışıyor**. Yani "ayrı tablo" precedent'i çoktan kurulmuş.

### Seçenek A — Tek birleşik `google_connections` (Ads + GA + GTM kolonları)
- **Artı:** Tek "kullanıcı herhangi bir Google ürününe bağlı mı?" sorgusu; tek satır/kullanıcı.
- **Eksi:**
  - Çalışan GA/GSC/Ads kodunun **refactor'ı** gerekir → **yüksek prod riski** (canlı, kullanıcılı sistem; `prod-risk-min` tercihine aykırı).
  - Geniş, seyrek (sparse) tablo; salt-okunur ve yazma semantiği aynı satırda karışır.
  - **Her ürünün ayrı refresh token + ayrı scope'u** var → tek satırda token yönetimi karmaşıklaşır (kullanıcı GA'ya bağlı ama GTM'e değilse?).
  - Migration belirsizliği (canonical DB = omddq) altında büyük şema değişikliği riskli.

### Seçenek B — Ayrı per-product tablolar (öneri) ✅
- Yeni `google_tag_manager_connections` eklenir, mevcut tablolar dokunulmaz.
- **Artı:** Mevcut precedent'le uyumlu; **tamamen additive** (refactor yok → düşük prod riski); per-product token + scope izolasyonu; GA/GSC'nin temiz mirror'ı.
- **Eksi:** Hafif şema tekrarı; "herhangi bir Google'a bağlı mı" için birden çok sorgu (önemsiz; gerekirse aşağıdaki VIEW çözer).

### ✅ ÖNERİ: Seçenek B (ayrı tablolar)
**Gerekçe:** (1) Mevcut precedent + additive → canlı kod refactor'ı yok; (2) `prod-risk-min` ile uyumlu; (3) per-product scope/token izolasyonu doğal; (4) GA/GSC mirror'ı zaten kanıtlanmış. Birleşik tablo, çalışan kodu riskli şekilde refactor etmek pahasına yalnızca teorik bir zariflik sağlar. İleride birleşik bir "bağlantı kaydı" görünümü istenirse bunu **fiziksel merge değil, salt-okunur SQL VIEW** olarak yap:

```sql
CREATE VIEW google_connection_overview AS
  SELECT user_id, 'google_ads' AS provider, status FROM google_ads_connections
  UNION ALL SELECT user_id, 'google_analytics', status FROM google_analytics_connections
  UNION ALL SELECT user_id, 'google_search_console', status FROM google_search_console_connections
  UNION ALL SELECT user_id, 'google_tag_manager', status FROM google_tag_manager_connections;
```

---

## 4. OAuth Scope Yönetimi

### 4.1 Mevcut ve hedef scope'lar

| Ürün | Mevcut scope | Salt-okunur hedef | Yazma/admin hedef (Faz 2, opsiyonel) |
|---|---|---|---|
| Google Ads | `…/auth/adwords` | — | — |
| GA4 | `…/auth/analytics.readonly` ✅ | (mevcut yeterli) | `…/auth/analytics.edit` (property/conversion/event yönetimi) — **restricted** |
| GTM (yeni) | — | `…/auth/tagmanager.readonly` | `…/auth/tagmanager.edit.containers` + `…/auth/tagmanager.publish` — **sensitive/restricted** |

> **Doğrulama maliyeti uyarısı:** `analytics.readonly` ve `tagmanager.readonly` "sensitive" scope'lardır (privacy policy + uygulama doğrulaması yeterli, görece hafif). `analytics.edit`, `tagmanager.edit.containers`, `tagmanager.publish` ise **restricted scope** olabilir → Google **güvenlik değerlendirmesi (CASA / 3rd-party assessment)** ve yıllık tekrar isteyebilir, ciddi maliyet/zaman. Yazma yetkileri istenecekse bu ayrı bir iş kalemi olarak planlanmalı.

### 4.2 Incremental Authorization (mevcut müşteri refresh token'larına yeni scope ekleme)

**Temel kural:** Bir refresh token, kullanıcının **onayladığı scope'larla** kilitlidir; yeni scope **kendiliğinden eklenemez**. Mevcut GA4 müşterileri yalnızca `analytics.readonly` onayladı. Yazma eklemek için:

1. Yeniden OAuth akışı tetiklenir; auth URL'ine **`include_granted_scopes=true`** eklenir (Google önceki onayları korur, yenisini ekler).
2. `prompt=consent` ile kullanıcı **yeniden onay** verir.
3. Dönen yeni refresh token eski scope + yeni scope'u kapsar → `upsert…Connection` ile `token_scope` güncellenir, token değiştirilir.

> **Öneri:** Auth URL'lerine `include_granted_scopes=true` parametresini **şimdiden ekle** (mevcut start route'larına additive). Böylece gelecekte scope genişletme tek consent ekranında temiz birleşir.

### 4.3 Yeni müşteri — tek akışta tüm scope'lar?

Teknik olarak GA + GTM (+ Ads) scope'ları tek consent ekranında istenebilir. **Ancak** mevcut mimari per-product connect butonu kullanır (her ürün ayrı kart, ayrı `start` route'u), Google aşırı scope istemeyi (over-asking) doğrulamada cezalandırır ve verification scope-bazlıdır.

✅ **ÖNERİ:** **Per-product consent'i koru** (mevcut UX + scope-creep'i önler + doğrulama kolaylaşır). `include_granted_scopes=true` sayesinde her yeni grant aynı Google hesabında additive birleşir.

### 4.4 Scope eksik → hata handling / UX

- Route bir scope'a ihtiyaç duyup token'da yoksa → Google API **403 (insufficient permissions)** döner.
- Pattern: çağrı öncesi `token_scope`'u kontrol et **veya** 403'ü yakala → tipli hata (`{ error: 'insufficient_scope', neededScope }`) → UI'da "ek izinle yeniden bağlan" CTA'sı göster.
- **CLAUDE.md uyumu:** Bu bir **abonelik/kredi bariyeri değil**, teknik bir reconnect akışıdır → `AccessRequiredModal` kullanılmaz; entegrasyon kartında inline reconnect butonu uygundur (kırmızı/primary palet, amber yasak).

---

## 5. Helper Modül İmzaları (TypeScript)

Mevcut GA/GSC pattern'i birebir mirror edilir. Meta ergonomisine uymak için ince `resolve…Context()` wrapper'ları **additive** olarak eklenir (route'ları DRY'lar; mevcut store'lar değişmez).

### 5.1 GTM connection store — `lib/google-tag-manager/connectionStore.ts`

```ts
export type GTMConnectionStatus = 'active' | 'revoked' | 'error'

export interface GTMConnectionContext {
  refreshToken: string
  accountId: string | null
  containerId: string | null
  containerPublicId: string | null   // "GTM-XXXXXX"
  workspaceId: string | null
}

export async function getGTMConnection(userId: string): Promise<GTMConnectionContext | null>
export async function getGTMConnectionStatus(userId: string): Promise<{
  connected: boolean
  accountId: string | null
  containerId: string | null
  containerName: string | null
  lastSyncAt: string | null
  error: string | null
}>
export interface UpsertGTMConnectionInput {
  refreshToken?: string
  tokenScope?: string
  connectedEmail?: string
  selectedAccountId?: string
  selectedAccountName?: string
  selectedContainerId?: string
  selectedContainerName?: string
  selectedContainerPublicId?: string
  selectedWorkspaceId?: string
  status?: GTMConnectionStatus
  lastSyncAt?: string
  lastError?: string | null
}
export async function upsertGTMConnection(userId: string, input: UpsertGTMConnectionInput): Promise<boolean>
export async function revokeGTMConnection(userId: string): Promise<void>
```
**Kontrat:** `getGTMConnection` hata/eksik token'da **null** döner (throw etmez); `upsert` **boolean**; `revoke` `status='revoked'` + `refresh_token=null`. (= `connectionStore.ts` GA ile birebir.)

### 5.2 Context resolver'lar — `lib/google-analytics/context.ts` + `lib/google-tag-manager/context.ts`

Meta'nın `resolveMetaContext()` pattern'iyle uyumlu; cookie fallback **yok** (Meta'nın `fbece82` güvenlik düzeltmesiyle aynı — sadece `user_id` → DB):

```ts
// lib/google-analytics/context.ts
export interface GAContext {
  refreshToken: string
  propertyId: string | null
  userId: string
}
export async function resolveGAContext(): Promise<GAContext | null>
// user_id cookie oku → getGAConnection → typed context | null. Route null'ı 401'e çevirir.

// lib/google-tag-manager/context.ts
export interface GTMContext {
  refreshToken: string
  accountId: string | null
  containerId: string | null
  workspaceId: string | null
  userId: string
}
export async function resolveGTMContext(): Promise<GTMContext | null>
```

### 5.3 GTM service — `lib/google-tag-manager/service.ts`

Tag Manager API v2 (`https://tagmanager.googleapis.com/tagmanager/v2`); her fonksiyon `refreshToken` alır, içeride `refreshAccessToken` çağırır, API hatasında **throw** eder (= GA `service.ts`).

```ts
// Salt-okunur (Faz 1):
export async function listAccounts(refreshToken: string): Promise<GtmAccount[]>
export async function listContainers(refreshToken: string, accountId: string): Promise<GtmContainer[]>
export async function listWorkspaces(refreshToken: string, accountId: string, containerId: string): Promise<GtmWorkspace[]>
export async function listTags(refreshToken: string, accountId: string, containerId: string, workspaceId: string): Promise<GtmTag[]>
// Yazma (Faz 2, flag-gated):
export async function createTag(refreshToken: string, path: GtmPath, tag: GtmTagInput): Promise<GtmTag>
export async function publishContainer(refreshToken: string, path: GtmPath): Promise<GtmVersion>
```

### 5.4 `ProviderKey` genişletme

[lib/integrations/types.ts:6](../lib/integrations/types.ts) → `google_tag_manager` eklenir:
```ts
export type ProviderKey = 'meta_ads' | 'google_ads' | 'google_analytics' | 'google_search_console' | 'google_tag_manager'
```
[lib/integrations/constants.ts](../lib/integrations/constants.ts) → eklenir:
```ts
export const GOOGLE_TAG_MANAGER_SCOPES = ['https://www.googleapis.com/auth/tagmanager.readonly'] // Faz 2'de edit.containers + publish
export const GTM_API_BASE = 'https://tagmanager.googleapis.com/tagmanager/v2'
```

---

## 6. API Route Yapısı

> **Namespace kararı:** Görev tanımı `/api/ga/*` ve `/api/gtm/*` yazıyor; ancak yerleşik konvansiyon `/api/integrations/<provider>/*` ve GA ağacı zaten orada. **Yeni paradigma icat etme** kuralı gereği mevcut namespace korunur. Aşağıda mantıksal gruplama (GA/GTM) gerçek yollarla eşlenir.

### 6.1 GA4 — `/api/integrations/google-analytics/*`

| Endpoint | Method | Durum | Amaç | Scope |
|---|---|---|---|---|
| `start` | GET | ✅ var | OAuth başlat | `analytics.readonly` |
| `callback` | GET | ✅ var | token exchange + upsert | — |
| `status` | GET | ✅ var | bağlantı durumu | — |
| `properties` | GET | ✅ var | property listesi | readonly |
| `select-property` | POST | ✅ var | property seç | — |
| `reports` | GET | ✅ var | KPI + seri + tablolar (cache'li) | readonly |
| `disconnect` | POST | ✅ var | bağlantıyı kaldır | — |
| `admin/conversions` | GET/POST | 🆕 Faz 2 | conversion event listele/oluştur | `analytics.edit` |
| `admin/custom-events` | GET/POST | 🆕 Faz 2 | custom event tanımla | `analytics.edit` |
| `admin/data-streams` | GET | 🆕 Faz 2 | data stream + measurement_id | `analytics.edit`/readonly |

### 6.2 GTM — `/api/integrations/google-tag-manager/*` (tamamı 🆕)

| Endpoint | Method | Amaç | Scope |
|---|---|---|---|
| `start` | GET | OAuth başlat (`state=gtm_<hex>`, cookie `gtm_oauth_state`) | `tagmanager.readonly` |
| `callback` | GET | token exchange → `upsertGTMConnection` → `/entegrasyon?gtm=connected` (EN `/en/integration`) | — |
| `status` | GET | `getGTMConnectionStatus` | — |
| `accounts` | GET | `listAccounts` | readonly |
| `containers` | GET | `listContainers(accountId)` | readonly |
| `select-container` | POST | account+container+workspace seç → upsert | — |
| `tags` | GET | `listTags` (seçili workspace) | readonly |
| `create-tag` | POST | 🆕 Faz 2, flag-gated | `tagmanager.edit.containers` |
| `publish` | POST | 🆕 Faz 2, flag-gated | `tagmanager.publish` |
| `disconnect` | POST | `revokeGTMConnection` + cookie temizle | — |

**Temsili route iskeleti (mevcut GA pattern'iyle birebir):**
```ts
export async function GET() {
  const ctx = await resolveGTMContext()
  if (!ctx) return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  try {
    const data = await gtmService.listContainers(ctx.refreshToken, ctx.accountId!)
    return NextResponse.json({ data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'gtm_error' }, { status: 502 })
  }
}
```

---

## 7. Wizard / UI Step'leri

İki ayrı UI yüzeyi var:

### 7.1 Bağlantı kartları (entegrasyon sayfası) — her iki ürün için
[app/entegrasyon/page.tsx](../app/entegrasyon/page.tsx) "Raporlama Platformları" grid'inde:
- **GA4 kartı:** ✅ zaten var (connect → property seç → reports).
- **GTM kartı:** 🆕 GA bloğu klonlanır — `gtmStatus` state, `handleGTMConnect/Disconnect`, account→container→workspace seçim modalı. `GET /api/integrations/google-tag-manager/status` ile yüklenir, `window.location.href = '…/start'` ile bağlanır.
- **Kural:** amber/sarı yok; eşit yükseklikli kartlar (simetri kuralı); selection modalı GA property modalıyla aynı tasarım ailesinden.

### 7.2 Konfigürasyon wizard'ı (yalnızca yazma/oluşturma kapsama girerse — Faz 2)
[components/google/wizard](../components/google/wizard) pattern'i (`useState<WizardState>` + `StepProps {state, update, t}`) izlenir; reducer/store eklenmez.

- **GA4 property bağlama / oluşturma:** bağlama = `select-property` (var). Oluşturma = Admin API `properties.create` (yazma) → yeni step.
- **GTM container bağlama / oluşturma:** bağlama = account→container→workspace seçimi. Oluşturma = `accounts.containers.create` (yazma) → yeni step.
- **GA4 ölçüm planı (custom events, conversions):** event tanımla + conversion işaretle step'leri → Admin API (yazma); `measurement_plan JSONB`'a kaydet.
- Meta wizard yapısıyla paralel; tüm string'ler `t` üzerinden (hardcoded TR yok).

---

## 8. i18n Stratejisi

- **Kural:** Tüm yeni key'ler `locales/tr.json` VE `locales/en.json`'a **birebir aynı ağaç** ile eklenir (manuel parity, tooling yok).
- **Eklenecek namespace'ler:**

| Namespace | İçerik | Şablon |
|---|---|---|
| `dashboard.entegrasyon.gtm.*` | GTM kartı (15 key) | `dashboard.entegrasyon.googleAnalytics.*` birebir: `name, connected, notConnected, connectButton, container, selectContainer, selectContainerTitle, changeContainer, selectLabel, selecting, loading, noContainers, lastSync, disconnectConfirm, disconnectLabel` |
| `dashboard.gtm.wizard.*` | (Faz 2) GTM/GA config wizard | `dashboard.google.wizard.*` yapısı: `steps, nav, validation, toast, summary` |
| `dashboard.ga.measurementPlan.*` | (Faz 2) GA4 ölçüm planı | yeni |
| `legal.*` (privacy) | GA4/GTM privacy bölümleri | ✅ zaten eklendi (`section3GTM*`), single-source korunur |

- **Privacy policy single-source:** Metin locale key'lerinden gelir, iki dilde; [PrivacyPolicyContent.tsx](../components/legal/PrivacyPolicyContent.tsx) pattern'i devam eder (OAuth verification için kritik — Google privacy policy + data handling beyanı ister).

---

## 9. Rollout Sırası (bağımlılıklarla)

> **prod-risk-min uygulaması:** Migration **canonical DB = omddq**'ya uygulanır ve **Onur tarafından** çalıştırılır/doğrulanır (ben additive SQL + checklist veririm). Yazma scope'lu / maliyet getiren akışlar **default-OFF flag** arkasında başlar.

**Faz 0 — Karar & hazırlık (kod yok)**
1. Scope kararı: salt-okunur mu / yazma mı? (bkz. Açık Sorular)
2. Google Cloud Console: GTM API'yi etkinleştir, `tagmanager.readonly` scope'unu OAuth consent screen'e ekle, `GOOGLE_TAG_MANAGER_REDIRECT_URI` ekle.
3. Env var'lar (`.env.local` + Vercel): `GOOGLE_TAG_MANAGER_REDIRECT_URI` (+ eksik `GOOGLE_REDIRECT_URI`, `GOOGLE_ANALYTICS_REDIRECT_URI`, `GOOGLE_GSC_REDIRECT_URI` dokümante et).

**Faz 1 — GTM salt-okunur (düşük risk, additive)**
4. **Migration:** `google_tag_manager_connections` (additive `CREATE TABLE IF NOT EXISTS`) → Onur omddq'da uygular.  ⟶ *bağımlılık: hiçbiri*
5. **Helper:** `lib/google-tag-manager/connectionStore.ts` → `service.ts` (readonly) → `context.ts`.  ⟶ *bağımlılık: 4*
6. **Sabitler/tipler:** `ProviderKey` += `google_tag_manager`, `GOOGLE_TAG_MANAGER_SCOPES`, `GTM_API_BASE`.  ⟶ *bağımlılık: hiçbiri*
7. **API route'ları:** `start, callback, status, accounts, containers, select-container, tags, disconnect`.  ⟶ *bağımlılık: 5, 6*
8. **UI:** entegrasyon sayfasına GTM kartı + seçim modalı.  ⟶ *bağımlılık: 7*
9. **i18n:** `dashboard.entegrasyon.gtm.*` (tr + en).  ⟶ *bağımlılık: 8*
10. **Build test** (`next build` / typecheck) → **deploy**.  ⟶ *bağımlılık: 4-9*

**Faz 2 — Yazma/admin (opsiyonel, flag-gated, doğrulama ağır)**
11. Auth URL'lerine `include_granted_scopes=true` (additive).
12. Scope genişletme: `analytics.edit`, `tagmanager.edit.containers`, `tagmanager.publish` (consent screen + verification + olası güvenlik değerlendirmesi).
13. Yazma route'ları + config wizard → `GOOGLE_WRITE_SCOPES_ENABLED=false` (default-OFF) arkasında.
14. Incremental re-consent UX (mevcut müşteriler için "ek izin" akışı).
15. Onur Vercel'de flag'i açar, canlı maliyeti/davranışı gözden geçirir.

---

## 10. Test Stratejisi

### 10.1 Manuel test senaryoları
- **Yeni kullanıcı OAuth consent:** her scope için onay ekranı doğru scope'u gösteriyor mu.
- **Bağlan → seç → kullan → bağlantıyı kaldır:** GA4 ve GTM ayrı ayrı (account/container/workspace seçimi; tags listeleme).
- **Mevcut kullanıcı incremental re-consent:** salt-okunur token'a yazma scope ekleme (Faz 2).
- **Scope eksik (403):** yazma çağrısı readonly token'la → 403 → "yeniden bağlan" CTA'sı çıkıyor mu.
- **Token refresh:** süresi dolmuş access token → `refreshAccessToken` ile sessizce yenileniyor mu.
- **Çoklu kullanıcı izolasyonu:** kullanıcı A'nın token'ı kullanıcı B oturumunda görünmüyor (cookie fallback YOK — DB-only doğrula).
- **Data deletion:** disconnect → `status='revoked'` + `refresh_token=null`; ayrıca Google'ın istediği veri silme mekanizması belgelendi mi.

### 10.2 OAuth doğrulama (verification) için demo video akışları
Google verification için kaydedilecek akışlar:
1. **OAuth consent ekranı** — istenen scope'lar net görünür.
2. **Her scope'un uygulama içi kullanımı:**
   - `analytics.readonly` → entegrasyon sayfasında GA4 raporu çizdiriliyor.
   - `tagmanager.readonly` → GTM container/tag listesi gösteriliyor.
   - (Faz 2) `analytics.edit` → conversion/event konfigürasyonu; `tagmanager.edit/publish` → tag oluşturma/yayınlama.
3. **Privacy policy** sayfası (GA4/GTM bölümleri görünür) + **data deletion / disconnect** akışı.

> Verification, scope kullanımının gösterilmesini + yayında privacy policy'yi + veri silme mekanizmasını şart koşar. Restricted scope (yazma) seçilirse ek güvenlik değerlendirmesi gündeme gelir.

---

## Açık Sorular (Implementasyon Öncesi)

1. **🔴 EN KRİTİK — Scope derinliği:** GA4 ve GTM **salt-okunur** mu kalacak, yoksa **yazma/admin** (property/container *oluşturma*, conversion/event *konfigürasyonu*, tag oluştur/yayınla) da istenecek mi? Görev tanımı ("oluşturma", "ölçüm planı konfigürasyonu") yazmayı ima ediyor — ama bu, restricted scope + Google güvenlik değerlendirmesi demek (ağır maliyet/zaman). Karar tüm planı (tablo kolonları, route'lar, wizard, verification yolu) belirler. **Öneri:** Faz 1 salt-okunur ile başla (GTM'i GA gibi), yazmayı Faz 2'ye flag arkasında ertele.
2. **GA4'ün zaten var olduğu netleşti mi?** GA4 salt-okunur OAuth + raporlama çalışıyor. "GA4 entegrasyonu" ile kastedilen (a) mevcudu doğrulama/cilalama mı, (b) yazma yetenekleri eklemek mi? (1. soruyla bağlantılı.)
3. **Tek tablo vs ayrı tablo:** §3'te **ayrı tablo (Seçenek B)** öneriliyor. Onaylıyor musun, yoksa birleşik tablo (refactor riskiyle) mi istiyorsun?
4. **Verification zaman çizelgesi:** OAuth verification (ve restricted scope seçilirse güvenlik değerlendirmesi) haftalar sürebilir. Faz 1 (salt-okunur, hafif verification) önce yayınlanıp Faz 2 paralel doğrulamaya mı girsin?
5. **Client-side measurement tag'i kapsamda mı?** Bu plan OAuth API entegrasyonu içindir. YoAi'nin **kendi** sitesine GA4/GTM ölçüm snippet'i koymak ayrı, çok daha küçük bir iştir — kapsamda mı, yoksa tamamen müşteri hesaplarını yönetme mi hedefleniyor?
6. **Migration hedefi:** Yeni GTM tablosu canonical **omddq**'ya uygulanacak (doğru mu?), ve migration'ı sen mi çalıştıracaksın (prod-risk-min tercihin gereği)?
