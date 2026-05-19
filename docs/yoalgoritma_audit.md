# YoAlgoritma — Mevcut Sistem Audit Raporu

**Tarih:** 2026-05-19
**Faz:** 1 (Audit — kod değişikliği yok)
**Sonraki adım:** Faz 2 (Claude API + tool use + agentic loop ile rebuild) — bu rapor onaylanmadan başlamaz.

URL: `yoai.yodijital.com/yoai`
Ana giriş: [app/yoai/page.tsx](app/yoai/page.tsx) (603 satır)

---

## 1. Sayfa & UI Component Haritası

[app/yoai/page.tsx](app/yoai/page.tsx) bir client component'tir (`'use client'`, [app/yoai/page.tsx:1](app/yoai/page.tsx#L1)).

**Yaşam döngüsü:**
- Mount'ta `/api/yoai/command-center` çağrılır → `ccData` state'i doldurulur ([app/yoai/page.tsx:159](app/yoai/page.tsx#L159))
- Eğer cache yoksa, `/api/yoai/daily-run` POST otomatik tetiklenir ([app/yoai/page.tsx:141](app/yoai/page.tsx#L141))
- `localStorage` ile sayfa açılışında "scanning…" spinner görünmesin diye `yoai_cc_cache_v1` anahtarında veri tutulur ([app/yoai/page.tsx:88-100](app/yoai/page.tsx#L88-L100))

**Page'in render ettiği bileşenler:**
| Component | Rol |
|-----------|-----|
| `YoAlgoritmaHeader` | Üst başlık + action ticker |
| `CommandCenterHeader` | 6 metrik kartı + başlık bloğu |
| `AiAdSuggestions` | Öneri kartı grid'i + onay akışı |
| `AdCreationWizard` | Reklam oluşturma modal'ı |
| `ActionConfirmDialog` | Aksiyon onay modal'ı |
| `AccessRequiredModal` | Abonelik / kredi guard |

### 6 Metrik Kartı

`CommandCenterHeader.tsx:32-50`'de tanımlı. Hepsi `health` objesinden besleniyor (deep analysis sonucu):

| Kart | Veri kaynağı | Hesaplama |
|------|--------------|-----------|
| Bağlı Platformlar | `health.connectedAccounts.platforms` | Meta + Google connection sayısı |
| Aktif Kampanya | `health.activeCampaigns` | Filtered active campaign count |
| Kritik Uyarılar | `health.criticalAlerts` | `campaigns.filter(c => c.riskLevel === 'critical').length` |
| İyileştirme Fırsatları | `health.opportunities` | `actions.filter(a => a.priority === 'high').length` |
| Bekleyen Onaylar | `approvalsPendingCount` (öncelik) / `health.pendingApprovals` (fallback) | `/api/yoai/approvals?count=1` ([app/yoai/page.tsx:56](app/yoai/page.tsx#L56)) |
| Önerilen Aksiyonlar | `health.draftActions` | `ccData.actions.length` |

### Suggestion Card Grid

[components/yoai/AiAdSuggestions.tsx](components/yoai/AiAdSuggestions.tsx) içinde, `FullAdProposal[]` üzerinden render ediliyor. Her kart:

- Platform logosu + objective
- Metrik özeti
- **Confidence yüzdesi** — [components/yoai/AdPreviewCard.tsx:214](components/yoai/AdPreviewCard.tsx#L214): `%{proposal.confidence} güven`
- **AI GEREKÇESİ** alanı — [components/yoai/AdPreviewCard.tsx:369-372](components/yoai/AdPreviewCard.tsx#L369-L372): `proposal.reasoning` field'ı.

> **Durum:** "AI GEREKÇESİ" alanı kod düzeyinde mevcut, ama `reasoning` field'ı her zaman dolu gelmiyor — proposal üretimi sırasında LLM yanıtında reasoning yoksa boş kalıyor.

---

## 2. API Route Tablosu

`app/api/yoai/**/route.ts` altındaki tüm endpoint'ler:

| Endpoint | Method | Amaç | Çıktı |
|----------|--------|------|-------|
| `/api/yoai/command-center` | GET | Persiste analizi getir | `{ ok, data: DeepAnalysisResult, run_date }` |
| `/api/yoai/daily-run` | GET/POST | Cron veya manuel günlük analiz | Deep analysis + DB persist |
| `/api/yoai/chat` | POST | Kullanıcı niyeti için LLM streaming | SSE content stream |
| `/api/yoai/detect-intent` | POST | Mesaj intent classify | `{ intent: ContentCategory }` |
| `/api/yoai/approvals` | GET | Bekleyen onay sayısı | `{ ok, pendingCount }` |
| `/api/yoai/approvals/[id]` | PATCH | Onay state güncelle | `{ ok, updated }` |
| `/api/yoai/actions/record` | POST | Aksiyon outcome log | `yoai_action_outcomes` insert |
| `/api/yoai/execute-action` | POST | Onaylı aksiyonu Meta/Google'da çalıştır | Platform API çağrısı |
| `/api/yoai/optimization/recommendations` | POST/GET | Tarama snapshot persist | 14 günlük öncesi/sonrası metrik |
| `/api/yoai/diagnose` | POST | Meta kampanya teşhisi | `{ diagnoses: DiagnosisResult[] }` |
| `/api/yoai/articles` | POST | Generate edilmiş SEO yazısı kaydet | `yoai_articles` |
| `/api/yoai/one-click-approve` | POST | Tüm bekleyenleri toplu onayla | Batch update |
| `/api/yoai/business-profile` | GET/POST | İşletme bağlamı CRUD | `user_business_profiles` |

**Frontend ↔ Backend wiring:**
- `/api/yoai/command-center` → page mount'ta ([app/yoai/page.tsx:159](app/yoai/page.tsx#L159))
- Kullanıcı input → `/api/yoai/detect-intent` ([app/yoai/page.tsx:207](app/yoai/page.tsx#L207)) → `/api/yoai/chat` ([app/yoai/page.tsx:249](app/yoai/page.tsx#L249))
- Onay sayısı → `/api/yoai/approvals?count=1` ([app/yoai/page.tsx:56](app/yoai/page.tsx#L56))

---

## 3. Kural Motoru Derin İncelemesi

### A. Meta Rule Engine — [lib/yoai/meta/optimization/ruleEngine.ts](lib/yoai/meta/optimization/ruleEngine.ts)

**Kural tanımı** (lib/yoai/meta/optimization/ruleEngine.ts:74-78):

```typescript
interface Rule {
  id: ProblemTagId
  severity: 'critical' | 'warning' | 'info'
  evaluate: (ctx: RuleContext) => MetricEvidence[] | null
}
```

Rule'lar array olarak tanımlı; her birinin `evaluate` fonksiyonu varsa evidence döner, yoksa null. Severity literal string olarak rule'a hardcoded.

**Confidence hesaplaması — [lib/yoai/meta/optimization/scoring.ts](lib/yoai/meta/optimization/scoring.ts):**

```typescript
// scoring.ts:12-15
const WEIGHT_NORTH_STAR = 0.40
const WEIGHT_EFFICIENCY = 0.30
const WEIGHT_QUALITY = 0.15
const WEIGHT_SATURATION = 0.15
```

Sabit ağırlıklı bileşim:
- `evaluateDeliveryGate()` ([scoring.ts:63](lib/yoai/meta/optimization/scoring.ts#L63)) — spend > 0, impression eşiği
- `evaluateEfficiencyGate()` ([scoring.ts:85](lib/yoai/meta/optimization/scoring.ts#L85)) — CPA/ROAS/CTR benchmark
- `rankingToScore()` ([scoring.ts:37](lib/yoai/meta/optimization/scoring.ts#L37)) — Meta ranking'leri 0-100'e çevirir:

```typescript
ABOVE_AVERAGE → 90
AVERAGE       → 60
BELOW_AVERAGE → 20
```

**Kategorizasyon (Meta):**
- **Kritik Uyarılar** → `severity: 'critical'` (NO_DELIVERY, LOW_ROAS, LOW_CONVERSIONS)
- **İyileştirme Fırsatları** → `severity: 'warning'` (LOW_CTR, HIGH_CPC, IMPRESSION_SHARE_BUDGET_LOST)
- **Önerilen Aksiyonlar** → `fitScore` üzerinden ([lib/yoai/adCreator.ts:266-352](lib/yoai/adCreator.ts#L266-L352))

### B. Google Rule Engine — [lib/yoai/googleRuleEngine.ts](lib/yoai/googleRuleEngine.ts) (208 satır)

Severity mapping ([googleRuleEngine.ts:193-197](lib/yoai/googleRuleEngine.ts#L193-L197)):

```typescript
const severity = ['NO_DELIVERY', 'LOW_ROAS', 'LOW_CONVERSIONS'].includes(rule.id)
  ? 'critical'
  : ['LOW_CTR', 'HIGH_CPC', 'IMPRESSION_SHARE_BUDGET_LOST', ...].includes(rule.id)
    ? 'warning'
    : 'info'
```

### C. LLM çağrısı?

**Rule engine LLM kullanmaz. %100 deterministic.** LLM yalnızca:
- `/api/yoai/chat` (kullanıcı konuşması)
- [lib/yoai/aiAnalysisSummarizer.ts](lib/yoai/aiAnalysisSummarizer.ts) (top 15 kampanya özeti — [lib/yoai/deepAnalysis.ts:144](lib/yoai/deepAnalysis.ts#L144))
- [lib/yoai/aiProviders/anthropicProvider.ts](lib/yoai/aiProviders/anthropicProvider.ts) — multi-AI decision desk'in "risk_policy" rolü (opsiyonel; key yoksa skip)

---

## 4. Veri Kaynakları & Kullanılan Metrikler

### Meta (Graph API — live)

[lib/yoai/metaDeepFetcher.ts:118](lib/yoai/metaDeepFetcher.ts#L118) `insights.fields`:

```
spend, impressions, clicks, ctr, cpc, reach, frequency, cpm,
actions, action_values, cost_per_action_type, purchase_roas,
quality_ranking, engagement_rate_ranking, conversion_rate_ranking
```

Action breakdown: `purchase`, `lead`, `offsite_conversion.fb_pixel_purchase`, `offsite_conversion.fb_pixel_lead`.

### Google Ads (live)

[lib/yoai/googleDeepFetcher.ts](lib/yoai/googleDeepFetcher.ts): spend, impressions, clicks, CTR, CPC, conversions, ROAS, optimization_score, bidding strategy, impression share (budget/rank lost), daily budget.

### Önemli: Cache yok, snapshot yok

Her `/api/yoai/daily-run` çağrısı **canlı API'leri yeniden vurur.** Supabase'de `meta_insights` / `google_insights` gibi snapshot tablosu **yok** — sadece `optimization/recommendations` rotası 14 günlük öncesi/sonrası kıyas için snapshot saklar.

### Kullanılmayan ama mevcut metrikler

- Video completion rate (Meta video)
- App install metrics
- Lead quality (Meta lead form)
- Audience overlap (Meta)
- Google auction insights (coğrafi, rakip kelimeler)
- Cohort breakdown (yaş, lokasyon, cihaz)

> Bu metrikler tool use ile rebuild'de Claude'a sunulduğunda sinyal kalitesi ciddi artar.

---

## 5. Supabase Tabloları

| Tablo | Amaç | Rebuild'de durum |
|-------|------|------------------|
| `yoai_pending_approvals` | Proposal onay state machine | Aynen kullanılabilir |
| `yoai_competitor_ads` | Rakip reklam scrape | Aynen kullanılabilir |
| `yoai_competitor_insights` | Analiz edilmiş rakip | Aynen kullanılabilir |
| `yoai_platform_doctrine` | Kampanya tipi doktrin | Aynen kullanılabilir |
| `user_business_profiles` | İşletme bağlamı | Genişletilebilir (yeni kolon ihtiyacı yok) |
| `user_business_competitors` | Kullanıcı tanımlı rakip listesi | Aynen kullanılabilir |
| `yoai_action_outcomes` | Aksiyon feedback (öğrenme döngüsü) | Aynen kullanılabilir, learning loop temeli |
| `yoai_articles` | SEO yazıları (chat'ten) | Legacy, isteğe bağlı konsolidasyon |
| `meta_connections` | Meta hesap credentials | Aynen kullanılabilir |
| `google_ads_connections` | Google hesap credentials | Aynen kullanılabilir |

### Yeni tablo önerisi (Faz 2)

- `ai_suggestions` — Claude'un ürettiği öneriler (mevcut `yoai_pending_approvals`'a alternatif değil, üst katman)
- `ai_alerts` — kritik uyarılar (severity, reason, target_id, confidence)
- `ai_opportunities` — iyileştirme fırsatları
- `yoai_daily_run_cache` — günlük snapshot (localStorage yerine DB-backed)

---

## 6. Mevcut AI / Inngest / Cron Altyapısı

### Anthropic SDK

- **`@anthropic-ai/sdk` paketi `package.json`'da YOK** (verified)
- Kullanım: [lib/yoai/aiProviders/anthropicProvider.ts](lib/yoai/aiProviders/anthropicProvider.ts) raw `fetch` ile `https://api.anthropic.com/v1/messages`'a çağrı atıyor ([anthropicProvider.ts:92](lib/yoai/aiProviders/anthropicProvider.ts#L92))
- Model: `process.env.ANTHROPIC_MODEL_RISK_POLICY || 'claude-sonnet-4-20250514'` ([anthropicProvider.ts:21](lib/yoai/aiProviders/anthropicProvider.ts#L21))
- Key yoksa `status: 'skipped'` ([anthropicProvider.ts:80](lib/yoai/aiProviders/anthropicProvider.ts#L80)) — fallback yok

> Faz 2'de `@anthropic-ai/sdk` paketi eklenip resmî SDK kullanılmalı (tool use, prompt caching, streaming için).

### Inngest

**Yok.** Grep sonuç döndürmedi. Rebuild'de eklenecek (`inngest/client.ts`, `app/api/inngest/route.ts`).

### Vercel Cron — `vercel.json`

```json
crons:
  /api/yoai/daily-run                  → "0 5 * * *"   (08:00 Istanbul)
  /api/cron/official-ads-refresh       → "0 6 1 * *"   (aylık)
  /api/cron/audiences-sync             → "0 * * * *"   (saatlik)
```

- Auth: `CRON_SECRET` ([daily-run/route.ts:34-44](app/api/yoai/daily-run/route.ts#L34-L44))
- `maxDuration: 300` (5 dakika) — daily-run için yeterli ama tool use loop için Inngest'e taşımak gerek

---

## 7. Dürüst Değerlendirme

### ✅ Şu an iyi yapılan şeyler — KORUNMALI

1. **UI mimarisi temiz.** `components/yoai/` klasörü disipline (CommandCenterHeader, AiAdSuggestions, AdCreationWizard ayrık). Rebuild'de UI'ı bozma kuralı doğru.
2. **Çift platform paralel fetch + graceful degradation** — bir platform fail olursa diğer çalışmaya devam ediyor. Sağlam.
3. **Credential resolution** — cookies → DB fallback (cron context için). İyi pattern.
4. **Rule engine deterministik ve denetlenebilir** — evidence trail her rule için tutuluyor. Bu **silinmemeli**, Claude'a tool olarak verilmeli (raw signal).
5. **Approval workflow DB-backed state machine** — `yoai_pending_approvals` doğru tasarlanmış. Yeni AI öneriler aynı tabloya yazılabilir.
6. **Vercel cron + CRON_SECRET auth** doğru. Sadece Inngest event tetiklemeye geçecek.
7. **Currency-aware threshold'lar** ([scoring.ts](lib/yoai/meta/optimization/scoring.ts)) — TRY/USD/EUR destekli. Korunmalı.

### ✗ Neden çıktılar generic — KÖK NEDENLER

#### Kök neden 1: Confidence skorları sahte / kopuk

[lib/yoai/adCreator.ts:474](lib/yoai/adCreator.ts#L474) — proposal'da `confidence` field'ı **literal sayı olarak yazılıyor** (ör. `confidence: 80`). Rule engine'in hesapladığı `fitScore` ([adCreator.ts:266-352](lib/yoai/adCreator.ts#L266-L352)) **proposal confidence'ına bağlanmıyor**.

> Sonuç: Kampanyada 5 problem olsa bile her proposal %75-85 güven gösteriyor. Kullanıcı confidence'a güvenini kaybediyor.

#### Kök neden 2: Metrik whitelist çok dar

Rule engine sadece ~10-12 KPI bakıyor. Yüksek sinyalli metrikler kullanılmıyor:
- Creative fatigue (frequency'den daha sofistike — same-ad-impression decay)
- Landing page mismatch (CTA ↔ destination type — [platformKnowledge.ts](lib/yoai/platformKnowledge.ts)'de var ama severity weighting'e girmiyor)
- Audience saturation (reach/impression oranı threshold'a bağlanmamış)
- Cohort breakdown (yaş/lokasyon/cihaz performans dağılımı fetch edilmiyor)

#### Kök neden 3: Per-account context yok

Rule'lar global benchmark kullanıyor (CTR > 2% iyi Search için). **Hesap geçmişi yok**:
- Dünün CTR'ı → bugünün CTR'ı trend yok
- Geçmiş onaylardan öğrenme yok (`user_action_outcomes` tablosu var ama feedback loop'a girmiyor)
- Stateless analiz → personalization yok

#### Kök neden 4: Proposal template generic

[lib/yoai/adCreator.ts:501-502](lib/yoai/adCreator.ts#L501-L502) — proposal prompt'unda **hesabın en iyi performans gösteren creative/audience/offer örnekleri yok**. LLM jenerik şablon üretiyor.

Reasoning field'ı LLM çıktısı; rule evidence'tan beslenmiyor. Yani "neden bu proposal'ı öneriyorum" cevabı veri-driven değil, retroaktif rasyonalizasyon.

#### Kök neden 5: Multi-AI decision desk aslında tek AI

`multiAiDecisionDesk.ts` adındaki yapı yalnızca Anthropic provider'ı koşuyor. Google/Gemini/OpenAI provider stub'ları codebase'de görünse de decision flow'da kullanılmıyor. İsim aspirasyonel.

#### Kök neden 6: Teşhis → aksiyon kopuk

`/api/yoai/diagnose` "landing page problem" tespit ediyor ama proposal generator bu teşhisi okumuyor. Kullanıcı "audience mismatch detected" görüyor ama proposal hâlâ generic reklam öneriyor — teşhise scoped strategy (örn. "audience'ı genişlet" yerine yeni reklam yazmak) önerilmiyor.

### Özet kanıt tablosu

| Sorun | Dosya:Satır |
|-------|-------------|
| Hardcoded confidence | [lib/yoai/adCreator.ts:474](lib/yoai/adCreator.ts#L474) |
| fitScore proposal'a bağlanmıyor | [lib/yoai/adCreator.ts:352](lib/yoai/adCreator.ts#L352) |
| Generic template prompt | [lib/yoai/adCreator.ts:501-502](lib/yoai/adCreator.ts#L501-L502) |
| Dar metrik seti | [lib/yoai/metaDeepFetcher.ts:118](lib/yoai/metaDeepFetcher.ts#L118) |
| Hesap geçmişi sorgusu yok | [lib/yoai/deepAnalysis.ts:82-176](lib/yoai/deepAnalysis.ts#L82-L176) |
| LLM opsiyonel, fallback yok | [lib/yoai/aiProviders/anthropicProvider.ts:80](lib/yoai/aiProviders/anthropicProvider.ts#L80) |

---

## 8. Locale (tr / en)

**Konum:** `locales/tr.json`, `locales/en.json`

**Namespace:** `dashboard.yoai`
- `dashboard.yoai.header.*` — başlık, açıklama, butonlar
- `dashboard.yoai.cards.*` — 6 metrik kart etiketi (platforms, activeCampaigns, criticalAlerts, opportunities, pendingApprovals, draftActions)
- `dashboard.yoai.actions.*` — aksiyon etiketleri
- `dashboard.yoai.errors.*` — hata mesajları

Page'de `useTranslations('dashboard.yoai')` ([app/yoai/page.tsx:34](app/yoai/page.tsx#L34)). Bazı fallback string'ler hardcoded ([app/yoai/page.tsx:64](app/yoai/page.tsx#L64), [app/yoai/page.tsx:93](app/yoai/page.tsx#L93)).

> Faz 2'de yeni eklenecek tüm AI-driven metinler (alert title, opportunity description, reasoning text) **dil-agnostic JSON şemada** Claude'dan dönmeli — kullanıcının seçtiği locale'e göre Claude'a target dili prompt'tan verip cevabı doğrudan kullanılmalı. tr.json/en.json sadece statik UI label'ları için kalsın.

---

## Faz 2 İçin Net Sonuçlar

### Korunacaklar (silinmez, taşınmaz)
- Tüm UI bileşenleri (CommandCenterHeader, AiAdSuggestions, AdCreationWizard, AdPreviewCard, ActionConfirmDialog)
- Rule engine (`meta/optimization/ruleEngine.ts`, `googleRuleEngine.ts`) — Claude'a **tool** olarak verilir, evidence kaynağı kalır
- Tüm Supabase tabloları
- `yoai_pending_approvals` workflow
- Vercel cron + `CRON_SECRET` auth pattern'i
- Currency-aware benchmark logic

### Yeni eklenecekler
- `@anthropic-ai/sdk` paketi (resmî SDK, prompt caching destekli)
- Inngest (`inngest/client.ts`, `app/api/inngest/route.ts`) — agentic loop için
- `lib/yoai/ai/tools/*` — get_account_overview, get_campaign_metrics, get_adset_breakdown, get_creative_performance, compare_vs_benchmark, detect_anomaly
- `lib/yoai/ai/agent.ts` — Claude Sonnet 4.6 agentic loop runner
- `ai_suggestions`, `ai_alerts`, `ai_opportunities` tabloları
- `USE_AI_ENGINE` feature flag (env var) — rollback için

### Geri taşınacak (deprecate, silme)
- `lib/legacy/rule-engine/` klasörü — eski rule-only flow'u feature flag false ile koşmaya devam edebilsin (rollback güvenliği)

### Yeni veri akışı

```
Vercel Cron (08:00 TR)
  → /api/cron/yoalgoritma-scan (yeni endpoint)
    → Inngest event per Meta/Google account
      → Claude Sonnet 4.6 agentic loop (tool use)
        ↳ get_account_overview()        — toplu görünüm
        ↳ get_campaign_metrics()        — kampanya bazlı
        ↳ get_adset_breakdown()         — adset bazlı drill-down
        ↳ get_creative_performance()    — creative düzeyi
        ↳ compare_vs_benchmark()        — sektör karşılaştırma
        ↳ detect_anomaly()              — kritik uyarı tespiti
        ↳ rule_engine_evidence()        — mevcut rule engine output
      → Final JSON:
          critical_alerts[]    { severity, title, reason, suggested_action, confidence }
          opportunities[]      { category, title, expected_impact, action, confidence }
          recommended_actions[]{ priority, action_type, target_id, reasoning, confidence }
    → DB write: ai_suggestions, ai_alerts, ai_opportunities
  → Frontend mevcut UI'ı koruyarak yeni datayı render eder
```

### Confidence kaynağı

Claude'un kendi belirsizlik tahmini — model output'un parçası. Hesaba katılacak sinyaller:
- Evidence kuvveti (kaç rule trigger oldu, kaç metrik benchmark altı)
- Sample size (yeterli impression / spend var mı)
- Geçmiş benzer aksiyonların outcome'u (`yoai_action_outcomes`'tan)

---

## Onay isteği

Bu rapor onaylandığında Faz 2'ye geçiyorum:

1. `@anthropic-ai/sdk` + Inngest kurulumu
2. Tool definitions yazımı
3. Agentic loop runner
4. Yeni DB tabloları + migration
5. Cron endpoint
6. Feature flag (`USE_AI_ENGINE`)
7. Frontend wire-up (UI bozmadan)
8. Locale ekleri
9. `npm run build` + `npm run dev` test
10. Deploy

**Onayını bekliyorum.**
