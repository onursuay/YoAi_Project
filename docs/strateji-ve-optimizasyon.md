# Strateji & Optimizasyon — İşlev Analizi + Strateji İyileştirmeleri

> Son güncelleme: 2026-05-22
> Kapsam: (1) Strateji modülünün ne işe yaradığı + uygulanan 6 iyileştirmenin final hâli, (2) Optimizasyon modülünün ne işe yaradığı, (3) Strateji / Optimizasyon / YoAlgoritma üçlüsünün büyük resmi.

---

## 1. STRATEJİ MODÜLÜ

### 1.1 Amaç
Marka için **AI destekli, baştan sona pazarlama planı** üreten "stratejist" katmanı. Reklam panellerindeki tek tek kampanya yönetiminin **bir üst katmanı**: "hangi kampanyayı kuracağım?" değil, "bu bütçeyle, bu sektörde, bu hedefle **nasıl bir pazarlama mimarisi** kurmalıyım?" sorusunu cevaplar.

### 1.2 Çözdüğü problem
Marka sahibi reklam vermek istiyor ama bütçeyi funnel'a (TOFU/MOFU/BOFU) nasıl böleceğini, hangi persona'ları hedefleyeceğini, hangi kanala ne ağırlık vereceğini, hangi kreatif/deneyleri çalıştıracağını bilmiyor. Strateji bunları otomatik üretir ve uygulanabilir görevlere dönüştürür.

### 1.3 Nasıl çalışır
3 aşamalı pipeline + arka plan job kuyruğu (`sync_jobs`):

| Aşama | UI | Job | Çıktı |
|------|----|-----|-------|
| **Keşif (1)** | `components/strateji/WizardPhase1.tsx` | `analyze` | Veri kalitesi skoru; eksikse `NEEDS_ACTION` |
| **Strateji Planı (2)** | `components/strateji/BlueprintView.tsx` | `generate_plan` | Blueprint (KPI, funnel, persona, kreatif, deney, risk, görev) |
| **Uygulama (3)** | `components/strateji/TaskPanel.tsx` | `apply` | Görevler + taslak hedef kitleler + kampanya kurulum görevleri → `RUNNING` |
| **İzleme** | KPI Bar + JobPanel | `pull_metrics` → `optimize` | Gerçek Meta metrikleri + AI optimizasyon önerileri |

- **Motor:** `lib/strategy/ai-generator.ts` (blueprint) + `lib/strategy/job-runner.ts` (job orchestration) + `lib/strategy/blueprint-generator.ts` (deterministik template fallback).
- **Veri:** `strategy_instances`, `strategy_inputs`, `strategy_outputs`, `strategy_tasks`, `sync_jobs`, `metrics_snapshots` (Supabase, RLS `ad_account_id` + `user_id`).
- **Sahte veri yok:** Gerçek Meta aktivitesi yoksa `metrics_snapshots`'a snapshot yazılmaz; KPI bar boş durumda `—` gösterir.

### 1.4 Kredi / Abonelik
- `lib/billing/featureAccessMap.ts`: `strategy → subscription_required`, `strategy_overage → credit_required (10 kredi)`.
- Aylık limit: basic 3 / starter 5 / premium 10 / enterprise sınırsız. Aşımda atomik `deduct_strategy_credit` RPC ile kredi düşülür. Owner bypass `SUPER_ADMIN_EMAILS`.

### 1.5 Uygulanan 6 İyileştirme (2026-05-22) — final hâl

| # | Sorun (önce) | Çözüm (sonra) | Dosyalar |
|---|--------------|---------------|----------|
| **1** | Motor OpenAI `gpt-4o-mini` kullanıyordu (proje standardı Claude'a aykırı) | Yeni `lib/strategy/claude.ts` (Anthropic SDK + `getAiEngineModel` + prompt-cache'li system bloğu). Blueprint üretimi ve optimize önerileri Claude'a taşındı. Template fallback korundu; gate `isAnthropicReady()` | `lib/strategy/claude.ts` (yeni), `ai-generator.ts`, `job-runner.ts` |
| **2** | "Plan aktifken haftalık otomatik analiz" vaadi vardı ama **cron yoktu** (metrik yalnız sayfa ziyaretinde lazy çekiliyordu) | Vercel cron `0 4 * * 1` (Pzt 04:00) → `/api/cron/strategy-metrics`: RUNNING instance'lar için bayat metrik varsa `pull_metrics` kuyruğa alıp işler (→ `optimize` zinciri). Auth `CRON_SECRET` | `app/api/cron/strategy-metrics/route.ts` (yeni), `vercel.json` |
| **3** | Apply yalnız Meta'yı ele alıyordu + ölü `campaignPlan` objesi | `createCampaignStructure` çok-kanallı (Meta + Google, `channel_mix` ağırlıklı funnel kurulum görevleri). Ölü obje temizlendi. **Canlı auto-push bilinçli olarak EKLENMEDİ** — gerçek para harcayan + entegrasyona dokunan aksiyon; kullanıcı görevleri AdCreationWizard ile yayına alır | `job-runner.ts` |
| **4** | `_yoai_business_context_prompt` hiç doldurulmuyordu → planlar **jenerik** | `runGeneratePlanJob` artık instance sahibinin brand intelligence'ını `getBusinessContextForUser` + `buildBusinessContextPromptBlock` ile motora besliyor → markaya özgü plan | `job-runner.ts` |
| **5** | "Kalan Bütçe = aylık bütçe − 7 günlük harcama" yanıltıcıydı; 14/30 gün aralığının **hiç verisi yoktu** (yalnız 7g snapshot) | `pull_metrics` 7/14/30 gün snapshot'larını çekiyor. Metrics route: `total_budget` aylık sabit + `remaining = aylık − 30g harcama` + performans seçili aralık. KPIBar etiketleri: "Aylık Bütçe" / "Kalan (Bu Ay)" / "Harcanan (7g)" | `job-runner.ts`, `app/api/strategy/metrics/route.ts`, `components/strateji/KPIBar.tsx` |
| **6** | Strateji ve YoAlgoritma kopuktu | `runOptimizeJob` aynı kullanıcının açık YoAlgoritma hesap uyarılarını (`listAccountAlertsForUser`) optimizasyon promptuna besliyor → öneriler Pixel/CAPI/dönüşüm açıklarını önceliklendiriyor | `job-runner.ts` |

> **Env notu:** Strateji AI artık `ANTHROPIC_API_KEY` (mevcut) kullanır; `OPENAI_*` env'leri Strateji için gereksiz. Cron `CRON_SECRET` (mevcut) gerektirir. Meta/Google entegrasyon koduna ve AdCreationWizard'a dokunulmadı. `tsc` ✓.

---

## 2. OPTİMİZASYON MODÜLÜ

### 2.1 Amaç
Bağlı **Meta reklam hesabını canlı tarayıp** her kampanyaya **performans skoru (0-100)** veren ve **somut düzeltme aksiyonları** (bütçe artır/azalt, duraklat, kitle yenile, ad set dengele) öneren **taktik optimizasyon** katmanı. Strateji "planı kur", Optimizasyon "çalışanı düzelt" katmanıdır.

### 2.2 Çözdüğü problem
Reklam veren, hesabında neyin iyi/kötü gittiğini ve **hemen ne yapması gerektiğini** bilmiyor. Optimizasyon, Meta Ads Manager metriklerini benchmark'larla karşılaştırıp 4 kapıda (Delivery / Efficiency / Quality / Saturation) skorlar ve tek tıkla uygulanabilir aksiyonlar verir.

### 2.3 Nasıl çalışır
- **Skor:** `app/api/meta/optimization/score/route.ts` → Meta insights çek → normalize → `lib/meta/optimization/ruleEngine.ts` + `scoring.ts` → kampanya başına 0-100 skor + 4 gate + problem etiketleri.
- **Tarama (Magic Scan):** İki mod —
  - **"Tara"** = deterministik rule engine (ücretsiz, anında).
  - **"AI ile Tara"** = `lib/meta/optimization/aiRecommender.ts` (LLM destekli öneri; kredi + günlük limit). API: `app/api/meta/optimization/magic-scan/route.ts`.
- **Aksiyon türleri:** `AUTO_APPLY_SAFE` (Onayla → anında uygula), `REVIEW_REQUIRED` (Onayla/Reddet), `TASK` (manuel görev).
- **Uygula/Geri al (GERÇEK):** `lib/meta/optimization/changeSetManager.ts` → `executeChangeSet` Meta API'ye **canlı** PATCH/POST (kampanya pause, bütçe değişimi, ad set duplicate). `rollbackChangeSet` ile geri alınabilir (duplicate hariç). Audit: `optimization_recommendation_results` (`resultTrackingStore`).
- **Kapsam:** Yalnız **Meta** (Google optimization route'u yok).

### 2.4 Kredi / Abonelik
- `featureAccessMap.ts`: `optimization → subscription_required` (modül erişimi); `optimization_ai_scan_pro → credit_required` ("AI ile Tara Pro").
- Günlük AI scan limiti (plana göre); aşımda `AccessRequiredModal type="credit"`. Owner bypass.

### 2.5 Üç AI danışman katmanı — Strateji vs Optimizasyon vs YoAlgoritma

| | **Strateji** | **Optimizasyon** | **YoAlgoritma** |
|--|-------------|------------------|-----------------|
| **Soru** | Nasıl bir plan kurmalıyım? | Çalışanı nasıl düzeltirim? | Hesabım sistematik olarak ne durumda? |
| **Zamanlama** | Kullanıcı tetikler (yeni strateji) | Kullanıcı tetikler ("Tara"/"AI ile Tara") | **Otomatik** (Pazar gece cron), manuel buton yok |
| **Çıktı** | Blueprint (funnel, persona, KPI) → görevler | Kampanya skoru + tek-tık aksiyon | Hiyerarşik kartlar (hesap→kampanya→adset→reklam) |
| **AI** | **Claude** (yeni) | OpenAI gpt-4o-mini | **Claude Batch API** (async) |
| **Kalıcılık** | `strategy_*` tabloları | Transient + audit | `account_alerts` / `*_improvements` (lifecycle) |
| **Apply** | Görev üretir (canlı basmaz) | **Canlıya basar** (pause/bütçe) + rollback | Reklam onayı → AdCreationWizard |
| **Kanal** | Meta + Google (plan) | Yalnız Meta | Meta + Google |

**İlişki:** Çakışmazlar, tamamlayıcıdırlar. Strateji = stratejik plan, Optimizasyon = anlık taktik düzeltme, YoAlgoritma = haftalık sistematik denetim. (#6 iyileştirmesiyle Strateji optimize'ı artık YoAlgoritma uyarılarını da dikkate alır.)

### 2.6 Optimizasyon — iyileştirmeler
1. ✅ **AI motoru Claude'a taşındı** (2026-05-22) — `aiRecommender.ts` artık OpenAI gpt-4o-mini yerine `getAnthropicClient` + `getAiEngineModel` kullanır (prompt-cache'li system bloğu). Deterministik rule-engine fallback korundu; gate `isAnthropicReady()`.
2. ✅ **Günlük AI scan limiti sunucuya alındı** (2026-05-22) — yeni `ai_scan_usage` tablosu + atomik `consume_ai_scan` RPC. `magic-scan` route'u `useAI` istendiğinde sunucuda kotayı tüketir; kota dolunca `COST_PER_AI_SCAN` (5) kredi düşer, yetersizse 402 ile bloklanır. Client localStorage sayacı yalnız ön-UX; **otorite artık sunucuda**. (Migration: `npm run db:migrate:aiscan` — deploy öncesi omddq'ya uygulanmalı.)
3. ⏳ **Yalnız Meta** (henüz açık) — Google Ads için optimizasyon skoru/aksiyonu yok; çok-kanallı markalar Google tarafını göremiyor. Sıradaki aday.
