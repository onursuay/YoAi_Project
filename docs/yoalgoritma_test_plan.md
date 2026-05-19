# YoAlgoritma AI Engine — Test Planı

**Sürüm:** Faz 2 (Claude Sonnet 4.6 + tool use + agentic loop)
**Hedef:** AI engine'i production'a açmadan önce **Preview** ortamında doğrulamak.
**Şu anki durum:** `USE_AI_ENGINE` Vercel Preview+Production'da `false`. Açana kadar prod davranışı değişmez.

---

## 1. Ön Koşullar (testten önce mutlaka)

| Item | Durum | Notlar |
|------|-------|--------|
| Vercel env: `ANTHROPIC_API_KEY` (Preview + Production) | ✅ kuruldu | `vercel env ls` ile görünür |
| Vercel env: `USE_AI_ENGINE=false` (Preview + Production) | ✅ kuruldu | Açana kadar bu kalır |
| Supabase tabloları (`ai_engine_runs`, `ai_alerts`, `ai_opportunities`, `ai_suggestions`) | Dashboard SQL Editor ile uygulandı | [supabase/migrations/20260519000000_create_ai_engine_tables.sql](../supabase/migrations/20260519000000_create_ai_engine_tables.sql) |
| `vercel.json` cron `/api/cron/yoalgoritma-scan` schedule `0 5 * * *` | ✅ doğrulandı | UTC 05:00 = Istanbul 08:00 |
| Build geçti (TS hatasız) | ✅ | commit `e97d0fe` |
| `CRON_SECRET` Production+Preview+Development | ✅ | Manual tetik için Authorization header lazım |

**Henüz yapılmayan / opsiyonel:**
- `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` — eklemezsen cron **inline** modunda çalışır (Vercel 300s'e sığacak şekilde kullanıcı başı sıralı). Ölçek arttığında eklenmeli.
- `ANTHROPIC_MODEL_AI_ENGINE` override — default `claude-sonnet-4-6`.

---

## 2. Preview Deployment'ta Test Prosedürü

### Branch & deploy

1. Mevcut `main` branch zaten Faz 2 commit'i içeriyor (e97d0fe). Vercel her push'ta Preview deployment üretiyor.
2. **Preview üzerinde flag'i AÇ:**
   ```
   vercel env add USE_AI_ENGINE preview
   # değer olarak: true
   # sadece preview environment seç (Production'a EKLEME)
   ```
   - Production'daki `USE_AI_ENGINE=false` env'i bozulmaz.
   - Yeni preview deployment'ı tetikle (boş commit `git commit --allow-empty -m "trigger preview test"` ve `git push`).
3. Yeni preview URL'i `vercel ls --limit 3` ile bul (`Environment: Preview`).

### Manuel scan tetikleme (Inngest yoksa)

**Yöntem A — Tek kullanıcı (cookie'li, UI üzerinden):**
- Preview URL'e gir → login ol → `/yoai` sayfasına git → `triggerBackgroundBootstrap` otomatik POST atar `/api/yoai/daily-run`'a.
- Flag açıksa daily-run AI engine'e delege eder ([app/api/yoai/daily-run/route.ts:228-243](../app/api/yoai/daily-run/route.ts#L228-L243)).
- 30-90sn içinde sonuç gelmeli (15 iter * ~5-10sn).

**Yöntem B — Tüm kullanıcılar (cron simülasyonu, CRON_SECRET'lı):**
```
curl -i "https://<preview-url>/api/cron/yoalgoritma-scan" \
  -H "Authorization: Bearer <CRON_SECRET değeri>"
```
- CRON_SECRET'i `.env.local`'dan oku (yerel sync sonrası gelmiş olmalı).
- Yanıt: `{ ok: true, mode: "inline", users: N, completed: X, failed: Y }`.
- Inngest aktifse `mode: "inngest"` döner; her kullanıcı için event fırlatılır.

**Yöntem C — Tek kullanıcı (manuel POST, kendi user_id'sine):**
```
curl -i -X POST "https://<preview-url>/api/cron/yoalgoritma-scan" \
  -H "Cookie: user_id=<senin user uuid>"
```
- Cookie'siz çağrı 401 verir. Login sonrası tarayıcıdan cookie'yi çek.

### Beklenen log akışı (Vercel Function Logs)

`[AI Scan] ...` ve `[AI Engine][Persist] ...` log satırlarını izle:
```
[AI Scan][Meta] User <id> AI run failed: ...   ← hata
[AI Engine][Persist] ai_engine_runs upsert error: ...   ← persist hatası
```

---

## 3. Doğrulama Soruları (Supabase SQL Editor)

### a) `ai_engine_runs` — token kullanımı normal mi?

```sql
SELECT
  id, user_id, platform, status, model, iterations, tool_calls_count,
  input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
  duration_ms, created_at
FROM ai_engine_runs
ORDER BY created_at DESC
LIMIT 10;
```

**Normal aralıklar (Sonnet 4.6, ~10-15 kampanyalı bir hesap için):**
| Metrik | Beklenen | Açıklama |
|---|---|---|
| `iterations` | 4-12 | 15'e takılı kalmamalı |
| `tool_calls_count` | 6-20 | Çok düşükse Claude tool kullanmıyor demektir |
| `input_tokens` | **20K-80K** | İlk turn'de tüm tools+system prompt + tool result'lar |
| `output_tokens` | 2K-8K | Final JSON + reasoning text + thinking |
| `cache_read_tokens` | 2. taramadan itibaren input'un ~%70-90'ı | Cache hit |
| `duration_ms` | 30K-90K (30-90sn) | 5dk'dan az olmalı |
| `status` | `completed` | `failed` varsa `error_message` kolonunu oku |

> 50-100K input token soruna 5-10 kampanyalı küçük hesap için **yüksek** ama Claude'un toplam loop'unda kümülatif. Normal. Tool sayısı arttıkça artar.

### b) `ai_suggestions` — confidence varyansı gerçek mi?

```sql
SELECT
  confidence, COUNT(*) as count,
  AVG(confidence) OVER () as overall_avg,
  STDDEV_POP(confidence) OVER () as overall_stddev
FROM ai_suggestions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY confidence
ORDER BY confidence DESC;
```

**Sağlıklı dağılım sinyalleri:**
- `confidence` değerleri **30 ile 95 arasında dağılmalı** — hepsi 80 değil.
- `STDDEV_POP >= 10` olmalı — yani çeşitlilik var.
- En az 1 öneri `confidence >= 85` (yüksek güven), en az 1 öneri `confidence <= 60` (düşük güven) olmalı.

**Kötü sinyal:** Tüm confidence aynı (`STDDEV = 0`) veya 75-85 arasında dar bir bantta → model gerçekten kendi belirsizliğini ölçmüyor, mesleki refleksle sayı veriyor.

### c) `ai_alerts` — kritik uyarı üretiliyor mu?

```sql
SELECT
  severity, COUNT(*) as count,
  AVG(confidence) as avg_confidence
FROM ai_alerts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY severity
ORDER BY severity;
```

**Beklenti:**
- Tüm hesaplar için `severity = 'critical'` count = 0 OLMAMALIDIR (modelin gerçekten kritik bulunca uyarı çıkardığından emin olmak için).
- Eğer toplam hesap sayısı ≥3 ve `count('critical') = 0` → ya sistem sorunsuz (mümkün) ya da model kritik tespit etmiyor (kötü). Bir kampanyayı kasten bozarak (örn. budget düşür, 1 günlük negatif ROAS) tetikleyici test yapılabilir.

**Reasoning kalite kontrolü:**
```sql
SELECT id, title, LEFT(reason, 200) as reason_preview, confidence,
       target_entity_type, target_entity_name
FROM ai_alerts
ORDER BY confidence DESC
LIMIT 5;
```
- `reason` field'ı **hesaba özgü sayı/metrik içermeli** (örn. "ROAS 4.2 → 0.8", "CTR %0.4"). Jenerik cümleler ("Kampanya iyi performans göstermiyor") yetersiz.

### d) `ai_suggestions.reasoning` — AI GEREKÇE dolu ve gerçek mi?

```sql
SELECT
  id, title, priority, action_type, confidence,
  LENGTH(reasoning) as reasoning_length,
  LEFT(reasoning, 250) as reasoning_preview
FROM ai_suggestions
ORDER BY created_at DESC
LIMIT 10;
```
- `reasoning_length > 80` olmalı (kısa tek cümle yeterli değil).
- Preview metin hesap-özgü sayı içermeli.

### e) Token bütçesi toplamı (maliyet kontrolü)

```sql
SELECT
  DATE(created_at) as day,
  COUNT(*) as runs,
  SUM(input_tokens + output_tokens) as total_tokens,
  SUM(cache_read_tokens) as cache_savings_tokens,
  ROUND(SUM(input_tokens) * 3.0 / 1000000 + SUM(output_tokens) * 15.0 / 1000000, 4) as est_usd
FROM ai_engine_runs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```
- Sonnet 4.6 fiyatı: input $3/1M, output $15/1M.
- 10 kullanıcılı bir gün için ~$0.50-$2 beklenir. Daha yüksekse loop'lar uzun çalışıyor demektir.

---

## 4. Red Flags — Sistemi Kapat 🚨

Aşağıdaki durumlar görülürse **`USE_AI_ENGINE=false`** geri alıp Production'a apply et — eski rule engine flow'u devreye girer.

| Durum | Threshold | Aksiyon |
|---|---|---|
| **Tek tarama süresi** | `duration_ms > 300000` (5dk) | Vercel max_duration'a takılıyor — `MAX_ITERATIONS=15` veya `MAX_TOKENS_PER_TURN=16000` çok yüksek olabilir. Inngest aktif olmalı veya kullanıcı sayısı sınırlandırılmalı. |
| **Token kullanımı** | Tek run `input_tokens + output_tokens > 200000` | Loop yanıt vermeden çok tool çağırıyor olabilir veya snapshot çok büyük. `MAX_ITERATIONS`'ı 10'a düşür. |
| **Confidence varyansı yok** | `STDDEV_POP(confidence) < 5` (en az 20 öneri varken) | Model rastgele/sabit sayı üretiyor — sistem prompt'ta confidence kalibrasyonu zayıf. **Kritik durum**, sistemi kapat. |
| **Hata oranı** | `failed/(completed+failed) > 0.20` (24sa pencerede) | 5'te 1'den fazla fail. `error_message`'ları topla, root cause analiz et. Çoğu sebep: Anthropic rate limit, network timeout, Supabase RLS hatası, ya da JSON parse fail. |
| **Reasoning generic** | 5 örnekten 3+'ü hesap-özgü sayı içermiyor | Generic template üretiyor — Faz 1'in kök neden #4'ü tekrar gelmiş. Sistem prompt'ı sıkılaştır, tool kullanımını zorunlu kıl. |
| **Aynı kampanya için tutarsız öneri** | İki ardışık run'da aynı kampanya hakkında zıt öneriler | Stateless analiz tutarsız. Geçmiş outcome'ları (`yoai_action_outcomes`) tool'a vermek lazım. |

### Hızlı kapatma komutu

```
vercel env rm USE_AI_ENGINE production
vercel env add USE_AI_ENGINE production
# değer: false
# yeni deploy tetikle:
git commit --allow-empty -m "rollback: USE_AI_ENGINE=false" && git push
```

Hata varsa `ai_engine_runs.status='failed'` satırlarını korur — root cause analizine kanıt olarak kullanılır.

---

## 5. Production'a Açma Kontrol Listesi

Preview'da yukarıdaki 5 doğrulama geçtiğinde:

- [ ] `ai_engine_runs.status='completed'` ≥ 5 farklı kullanıcıda
- [ ] `STDDEV(confidence) >= 10` ai_suggestions üzerinde
- [ ] Tek run `duration_ms < 90000` ortalaması
- [ ] `ai_alerts` ve `ai_opportunities` her ikisinde de en az 1 satır var
- [ ] Reasoning field'ları manuel okumada hesap-özgü
- [ ] Tahmini gün başı maliyet < $5 (ölçeklendirmeden)
- [ ] Inngest setup (opsiyonel ama 50+ kullanıcı için zorunlu)
- [ ] Frontend smoke test: `/yoai` sayfası açıldığında "AI Analiz" rozeti gözüküyor

**Sonra:**
```
vercel env rm USE_AI_ENGINE production
vercel env add USE_AI_ENGINE production
# değer: true
git commit --allow-empty -m "enable USE_AI_ENGINE in production" && git push
```

## 6. Rollback Davranışı (geri dönüş güvenliği)

`USE_AI_ENGINE=false` set edildiğinde:
- `/api/cron/yoalgoritma-scan` → erken `skipped: true` response (no Claude call).
- `/api/yoai/daily-run` cron + manual POST → eski rule engine + adCreator flow'u tam çalışır.
- `yoai_daily_runs.command_center_data` eski şekilde yazılır (`aiGenerated: false`).
- Frontend rozeti "Kural Motoru" gösterir.
- `ai_engine_runs` ve diğer 3 tabloya yeni satır eklenmez (eskiler korunur).

**Veri kaybı yok**, sadece yeni AI çıktıları üretilmez.
