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
Bağlı **Meta / Google / TikTok reklam hesaplarını canlı tarayıp** her kampanyaya **performans skoru (0-100)** veren ve **somut düzeltme aksiyonlarını** (bütçe kıs, duraklat, kreatif yenile vb.) **tek tıkla canlıya uygulatan** **taktik optimizasyon** katmanı. Strateji "planı kur", Optimizasyon "çalışanı düzelt" katmanıdır. Üç platform da aynı derinlikte çalışır (4 kapılı skor + detay paneli + tarama + canlı apply/geri al).

### 2.2 Çözdüğü problem
Reklam veren, hesabında neyin iyi/kötü gittiğini ve **hemen ne yapması gerektiğini** bilmiyor. Optimizasyon, platform (Meta/Google/TikTok) metriklerini benchmark'larla karşılaştırıp 4 kapıda (Teslimat / Verim / Kalite / Doygunluk) skorlar ve tek tıkla uygulanabilir aksiyonlar verir.

### 2.3 Nasıl çalışır
- **Skor:** `app/api/meta/optimization/score/route.ts` → Meta insights çek → normalize → `lib/meta/optimization/ruleEngine.ts` + `scoring.ts` → kampanya başına 0-100 skor + 4 gate + problem etiketleri.
- **Tarama (Magic Scan):** İki mod —
  - **"Tara"** = deterministik rule engine (ücretsiz, anında).
  - **"AI ile Tara"** = `lib/meta/optimization/aiRecommender.ts` (LLM destekli öneri; kredi + günlük limit). API: `app/api/meta/optimization/magic-scan/route.ts`.
- **Aksiyon türleri:** `AUTO_APPLY_SAFE` (Onayla → anında uygula), `REVIEW_REQUIRED` (Onayla/Reddet), `TASK` (manuel görev).
- **Uygula/Geri al (GERÇEK):** `lib/meta/optimization/changeSetManager.ts` → `executeChangeSet` Meta API'ye **canlı** PATCH/POST (kampanya pause, bütçe değişimi, ad set duplicate). `rollbackChangeSet` ile geri alınabilir (duplicate hariç). Audit: `optimization_recommendation_results` (`resultTrackingStore`).
- **Kapsam:** **Meta + Google + TikTok** — üçü de skor + tarama + canlı apply, aynı 4 kapılı skor + `GoogleDetailPanel`. Meta: `app/api/meta/optimization/*` (kpiRegistry/scoring). Google: `app/api/google/optimization/*` (`fetchGoogleDeep`). TikTok: `app/api/tiktok/optimization/*` (`lib/tiktok/optimization/score.ts`, TikTok report API). Skor: Google/TikTok ortak `lib/google/optimization/gates.ts`.

### 2.4 Kredi / Abonelik
- `featureAccessMap.ts`: `optimization → subscription_required` (modül erişimi); `optimization_ai_scan_pro → credit_required` ("AI ile Tara Pro").
- Günlük AI scan limiti (plana göre); aşımda `AccessRequiredModal type="credit"`. Owner bypass.

### 2.5 Üç AI danışman katmanı — Strateji vs Optimizasyon vs YoAlgoritma

| | **Strateji** | **Optimizasyon** | **YoAlgoritma** |
|--|-------------|------------------|-----------------|
| **Soru** | Nasıl bir plan kurmalıyım? | Çalışanı nasıl düzeltirim? | Hesabım sistematik olarak ne durumda? |
| **Zamanlama** | Kullanıcı tetikler (yeni strateji) | Kullanıcı tetikler ("Tara"/"AI ile Tara") | **Otomatik** (Pazar gece cron), manuel buton yok |
| **Çıktı** | Blueprint (funnel, persona, KPI) → görevler | Kampanya skoru + tek-tık aksiyon | Hiyerarşik kartlar (hesap→kampanya→adset→reklam) |
| **AI** | **Claude** | **Claude** | **Claude Batch API** (async) |
| **Kalıcılık** | `strategy_*` tabloları | Transient + audit + `ai_scan_usage` | `account_alerts` / `*_improvements` (lifecycle) |
| **Apply** | Görev üretir (canlı basmaz) | **Canlıya basar** (pause/bütçe) + rollback | Reklam onayı → AdCreationWizard |
| **Kanal** | Meta + Google (plan) | **Meta + Google + TikTok** | Meta + Google |

**İlişki:** Çakışmazlar, tamamlayıcıdırlar. Strateji = stratejik plan, Optimizasyon = anlık taktik düzeltme, YoAlgoritma = haftalık sistematik denetim. (#6 iyileştirmesiyle Strateji optimize'ı artık YoAlgoritma uyarılarını da dikkate alır.)

### 2.6 Optimizasyon — iyileştirmeler
1. ✅ **AI motoru Claude'a taşındı** (2026-05-22) — `aiRecommender.ts` artık OpenAI gpt-4o-mini yerine `getAnthropicClient` + `getAiEngineModel` kullanır (prompt-cache'li system bloğu). Deterministik rule-engine fallback korundu; gate `isAnthropicReady()`.
2. ✅ **Günlük AI scan limiti sunucuya alındı** (2026-05-22) — yeni `ai_scan_usage` tablosu + atomik `consume_ai_scan` RPC. `magic-scan` route'u `useAI` istendiğinde sunucuda kotayı tüketir; kota dolunca `COST_PER_AI_SCAN` (5) kredi düşer, yetersizse 402 ile bloklanır. Client localStorage sayacı yalnız ön-UX; **otorite artık sunucuda**. (Migration: `npm run db:migrate:aiscan` — deploy öncesi omddq'ya uygulanmalı.)
3. ✅ **Çok-kanallı: Meta + Google + TikTok** (2026-05-22) — Optimizasyon artık 3 platformu da kapsıyor (Meta/Google/TikTok kaynak seçici). Google **ve** TikTok için skor + tarama + öneri + **tek-tık canlı apply/rollback** (kampanya duraklat / bütçe kıs, REVIEW_REQUIRED açık onay). TikTok: `/api/tiktok/optimization/{score,magic-scan,apply}` + `lib/tiktok/optimization/score.ts` (mevcut TikTok read/mutate altyapısı). Kartlar/sonuçlar platformdan bağımsız yeniden kullanıldı (`GoogleScanResults` `applyEndpoint` prop'lu). TikTok'ta ROAS gelir verisi olmadığı için null (uydurulmaz). **Açık:** TikTok ad-grup sayısı yok (bazı yapısal kurallar atlanır); Meta/Google/TikTok-only kullanıcı için sayfa girişi hâlâ Meta bağlantısına bağlı.
4. ✅ **Meta score route para birimi** (2026-05-22) — sabit `'TRY'` yerine `account.currency`.
5. ✅ **ScoreBadge renk kuralı** (2026-05-22) — amber/turuncu → gri/kırmızı (onaylı palet).
6. ✅ **Ad set sayfalama** (2026-05-22) — 5 → 15 sayfa (büyük hesaplar).
7. ✅ **Google + TikTok Meta seviyesine çıkarıldı** (2026-05-22) — `lib/google/optimization/gates.ts` ile 4 kapılı skor (Teslimat %40 / Verim %30 / Kalite %15 / Doygunluk %15, Meta ağırlıkları) Google+TikTok'a da hesaplanır (skor metodolojisi 3 platformda aynı); `GoogleDetailPanel` = skor kırılımı + tüm metrikler + kanal/teklif/bütçe + sorunlar + ad grupları. **Üç platform artık aynı derinlik.** Veri olmayan kapılar "veri yok" notuyla işaretlenir (sahte üretilmez); kalite kapısı sıralama yoksa CTR vekiliyle çalışır.
8. ⏳ **Açık (Faz sonrası):** Meta/Google/TikTok'tan yalnız birine sahip kullanıcı için sayfa girişi (şu an Meta bağlantı kapısına bağlı); TikTok ad-grup sayısı çekilmediğinden bazı yapısal kurallar atlanır.
