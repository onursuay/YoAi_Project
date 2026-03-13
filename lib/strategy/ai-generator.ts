import type { InputPayload, Blueprint, Persona, CreativeTheme, Experiment, Risk, TaskSeed } from './types'
import { generateBlueprint as generateTemplateBased } from './blueprint-generator'

// ════════════════════════════════════════════════════════════
// AI-Powered Blueprint Generator (OpenAI GPT-4o-mini)
// Template-based fallback otomatik çalışır
// ════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `Sen bir dijital pazarlama stratejisti ve Meta/Google Ads uzmanısın.
Kullanıcının işletme verilerine göre kapsamlı bir reklam stratejisi planı üreteceksin.

## Meta Kampanya Hedefleri ve Çalışma Prensipleri

Kullanıcının seçtiği "İş Hedefi" Meta Ads'in kampanya hedeflerine (objectives) birebir karşılık gelir. Her hedefin Meta tarafında farklı bir optimizasyon algoritması ve çalışma prensibi vardır. Stratejiyi bu prensiplere göre şekillendir:

1. **Bilinirlik (OUTCOME_AWARENESS)**: Meta, reklamı mümkün olan en fazla kişiye gösterir. Gösterim (impression) ve tahmini hatırlanma artışı (estimated ad recall lift) optimize eder. Reach & frequency kampanyaları bu hedefe uygundur. KPI: CPM (1000 gösterim başına maliyet), Erişim, Ad Recall Lift. Dönüşüm/satış bekleme — bu tamamen farkındalık aşaması.

2. **Trafik (OUTCOME_TRAFFIC)**: Meta, link tıklaması veya açılış sayfası görüntülemesi yapma olasılığı yüksek kişilere gösterir. Optimizasyon link_click veya landing_page_view üzerinedir. KPI: CPC (tıklama başına maliyet), CTR, Açılış sayfası görüntüleme. Doğrudan satış değil, siteye trafik çekme hedeflidir.

3. **Etkileşim (OUTCOME_ENGAGEMENT)**: Meta, gönderiye beğeni/yorum/paylaşım yapma, mesaj gönderme veya video izleme olasılığı yüksek kişilere gösterir. Messenger/WhatsApp/Instagram DM kampanyaları da bu hedefe dahil. KPI: Post Engagement Rate, Mesaj sayısı, ThruPlay (video). Topluluk oluşturma ve ilişki kurma aşaması.

4. **Potansiyel Müşteriler (OUTCOME_LEADS)**: Meta, form doldurma, mesaj gönderme veya arama yapma olasılığı yüksek kişilere gösterir. Instant Form (Lead Ads), Messenger, WhatsApp veya web sitesindeki form kullanılabilir. KPI: CPL (lead başına maliyet), Lead hacmi, Lead kalitesi. CRM entegrasyonu kritik.

5. **Uygulama Tanıtımı (OUTCOME_APP_PROMOTION)**: Meta, uygulamayı yükleme veya uygulama içi belirli bir işlemi yapma olasılığı yüksek kişilere gösterir. App Install veya App Event optimizasyonu yapılır. KPI: CPI (yükleme başına maliyet), Uygulama içi olay maliyeti. SDK entegrasyonu gerekli.

6. **Satışlar (OUTCOME_SALES)**: Meta, satın alma/ödeme/sepete ekleme gibi dönüşüm işlemi yapma olasılığı yüksek kişilere gösterir. Pixel/Conversions API üzerinden olay takibi gerektirir. Advantage+ Shopping Campaign (ASC) bu hedefe en uygun format. KPI: ROAS, CPA, Dönüşüm hacmi, Sepet değeri.

ÖNEMLİ: Stratejiyi seçilen hedefe göre kurgula. Örneğin:
- "Bilinirlik" hedefinde ROAS/CPA hedefi koyma, CPM ve Erişim odaklı ol
- "Trafik" hedefinde dönüşüm oranı bekleme, CPC ve CTR odaklı ol
- "Etkileşim" hedefinde satış bekleme, engagement rate ve mesaj hacmi odaklı ol
- "Potansiyel Müşteriler" hedefinde CPL ve form doldurma oranı odaklı ol
- "Satışlar" hedefinde ROAS ve CPA odaklı ol

Çıktını SADECE aşağıdaki JSON formatında ver, başka hiçbir şey yazma:

{
  "kpi_targets": {
    "cpa_range": [min_tl, max_tl],
    "roas_range": [min, max],
    "ctr_range": [min_pct, max_pct],
    "cvr_range": [min_pct, max_pct]
  },
  "funnel_split": { "tofu": 0-100, "mofu": 0-100, "bofu": 0-100 },
  "channel_mix": { "meta": 0-100, "google": 0-100 },
  "personas": [
    { "name": "Persona adı", "pain": "Acı noktası", "promise": "Vaat", "proof": "Kanıt/güven unsuru" }
  ],
  "creative_themes": [
    { "theme": "Tema adı", "hook": "Dikkat çekici açılış", "offer": "Teklif", "format": "video|image|ugc" }
  ],
  "experiment_backlog": [
    { "hypothesis": "Hipotez", "metric": "Ölçüm metriki", "test": "Test açıklaması", "priority": "high|med|low" }
  ],
  "risks": [
    { "risk": "Risk açıklaması", "mitigation": "Çözüm önerisi" }
  ],
  "tasks_seed": [
    { "title": "Görev başlığı", "category": "setup|creative|audience|campaign|measurement", "priority": "high|med|low" }
  ]
}

Kurallar:
- Tüm metinler Türkçe olmalı
- KPI hedefleri sektöre, bütçeye ve seçilen kampanya hedefine gerçekçi olmalı (Türkiye piyasası)
- En az 3 persona, 3 kreatif tema, 3 deney, 3 risk, 8 görev üret
- funnel_split toplamı 100 olmalı
- channel_mix toplamı 100 olmalı (sadece aktif kanallar için)
- Görevler somut ve uygulanabilir olmalı
- Sektöre özel stratejik derinlik göster — genel/jenerik öneriler verme
- Bütçeye uygun öneriler ver (düşük bütçeye agresif taktikler önerme)
- Seçilen kampanya hedefine uygun KPI ve strateji belirle. Bilinirlik hedefinde ROAS/CPA bekleme, Trafik hedefinde dönüşüm oranı bekleme vb.
- ÖNEMLİ: Ürün/hizmet adını olduğu gibi reklam metnine kopyalama! Hizmetin ne olduğunu anla ve SON KULLANICIYA hitap eden, doğal dilde hook ve teklifler yaz.
- Örnek YANLIŞ: "Feribot bilet satışı ile tanışın" — bu bir iş tanımı, reklam değil.
- Örnek DOĞRU: "Kıbrıs'a en uygun feribot bileti burada" — son kullanıcıya hitap ediyor.
- Hook'lar müşterinin ilgisini çekmeli, ürün/hizmet tanımını tekrarlamamalı.`

function buildUserPrompt(input: InputPayload): string {
  const parts = [
    `Sektör: ${input.industry}${input.industry_custom ? ` (${input.industry_custom})` : ''}`,
    `Ürün/Hizmet: ${input.product || 'Belirtilmedi'}`,
    `Hedef: ${goalLabel(input.goal_type)}`,
    `Aylık Bütçe: ${input.monthly_budget_try.toLocaleString('tr-TR')} TL`,
    `Süre: ${input.time_horizon_days} gün`,
    `Kanallar: ${[input.channels.meta && 'Meta', input.channels.google && 'Google', input.channels.tiktok && 'TikTok'].filter(Boolean).join(', ')}`,
    `Coğrafya: ${input.geographies?.join(', ') || 'Türkiye'}`,
    `Dil: ${input.language || 'Türkçe'}`,
  ]

  if (input.avg_basket) parts.push(`Ortalama Sepet: ${input.avg_basket} TL`)
  if (input.margin_pct) parts.push(`Kâr Marjı: %${input.margin_pct}`)
  if (input.ltv) parts.push(`Müşteri Yaşam Boyu Değeri (LTV): ${input.ltv} TL`)

  parts.push(`Pixel Durumu: ${integrationLabel(input.integrations?.pixel)}`)
  parts.push(`Analytics Durumu: ${integrationLabel(input.integrations?.analytics)}`)
  parts.push(`CRM Durumu: ${integrationLabel(input.integrations?.crm)}`)

  return parts.join('\n')
}

function goalLabel(goal: string): string {
  const map: Record<string, string> = {
    awareness: 'Bilinirlik (Marka bilinirliği ve erişim — OUTCOME_AWARENESS)',
    traffic: 'Trafik (Web sitesi/uygulama trafiği — OUTCOME_TRAFFIC)',
    engagement: 'Etkileşim (Beğeni, yorum, mesaj — OUTCOME_ENGAGEMENT)',
    leads: 'Potansiyel Müşteriler (Form, mesaj ile lead toplama — OUTCOME_LEADS)',
    app: 'Uygulama Tanıtımı (Yükleme ve uygulama içi etkinlik — OUTCOME_APP_PROMOTION)',
    sales: 'Satışlar (E-ticaret satışı ve dönüşüm — OUTCOME_SALES)',
  }
  return map[goal] || goal
}

function integrationLabel(status?: string): string {
  if (status === 'green') return 'Kurulu ve çalışıyor'
  if (status === 'yellow') return 'Kısmen kurulu'
  return 'Kurulu değil'
}

// Ana fonksiyon — AI ile üret, başarısız olursa template fallback
export async function generateBlueprintWithAI(input: InputPayload): Promise<{ blueprint: Blueprint; aiGenerated: boolean }> {
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  if (!apiKey) {
    console.log('[Strategy AI] OpenAI API key yok, template fallback kullanılıyor')
    return { blueprint: generateTemplateBased(input), aiGenerated: false }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(input) },
        ],
        temperature: 0.4,
        max_tokens: 4000,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Parse JSON (markdown code block varsa temizle)
    const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const raw = JSON.parse(jsonStr)

    // Validate & normalize
    const blueprint = validateBlueprint(raw, input)

    console.log('[Strategy AI] Blueprint başarıyla üretildi')
    return { blueprint, aiGenerated: true }

  } catch (err) {
    console.error('[Strategy AI] Hata, template fallback kullanılıyor:', err)
    return { blueprint: generateTemplateBased(input), aiGenerated: false }
  }
}

// AI çıktısını validate et ve eksikleri tamamla
function validateBlueprint(raw: Record<string, unknown>, input: InputPayload): Blueprint {
  const fallback = generateTemplateBased(input)
  const used: string[] = []  // hangi bölümlerde AI kullanıldı

  // KPI targets — cpa_range ve en az bir range dolu olsun yeter
  const kpi = raw.kpi_targets as Blueprint['kpi_targets'] | undefined
  let kpi_targets = fallback.kpi_targets
  if (kpi && Array.isArray(kpi.cpa_range) && kpi.cpa_range.length === 2) {
    kpi_targets = {
      cpa_range: kpi.cpa_range,
      roas_range: Array.isArray(kpi.roas_range) && kpi.roas_range.length === 2 ? kpi.roas_range : [0, 0],
      ctr_range: Array.isArray(kpi.ctr_range) && kpi.ctr_range.length === 2 ? kpi.ctr_range : [0, 0],
      cvr_range: Array.isArray(kpi.cvr_range) && kpi.cvr_range.length === 2 ? kpi.cvr_range : [0, 0],
    }
    used.push('kpi_targets')
  }

  // Funnel split — toplamı 50-150 arası kabul et ve normalize et
  const fs = raw.funnel_split as Blueprint['funnel_split'] | undefined
  let funnel_split = fallback.funnel_split
  if (fs && typeof fs.tofu === 'number' && typeof fs.mofu === 'number' && typeof fs.bofu === 'number') {
    const total = fs.tofu + fs.mofu + fs.bofu
    if (total >= 50 && total <= 150) {
      const factor = 100 / total
      funnel_split = {
        tofu: Math.round(fs.tofu * factor),
        mofu: Math.round(fs.mofu * factor),
        bofu: Math.round(fs.bofu * factor),
      }
      // Son değer yuvarlamadan kalanı alsın
      funnel_split.bofu = 100 - funnel_split.tofu - funnel_split.mofu
      used.push('funnel_split')
    }
  }

  // Channel mix — herhangi pozitif değer kabul et
  const cm = raw.channel_mix as Blueprint['channel_mix'] | undefined
  let channel_mix = fallback.channel_mix
  if (cm && typeof cm.meta === 'number' && typeof cm.google === 'number') {
    const total = cm.meta + cm.google
    if (total > 0) {
      const factor = 100 / total
      channel_mix = {
        meta: Math.round(cm.meta * factor),
        google: Math.round(cm.google * factor),
      }
      used.push('channel_mix')
    }
  }

  // Personas — en az 1 geçerli persona yeterli
  const rawPersonas = raw.personas as Persona[] | undefined
  let personas = fallback.personas
  if (Array.isArray(rawPersonas) && rawPersonas.length >= 1) {
    const valid = rawPersonas.filter(p => p.name && p.pain).map(p => ({
      name: p.name,
      pain: p.pain,
      promise: p.promise || '',
      proof: p.proof || '',
    })).slice(0, 6)
    if (valid.length >= 1) { personas = valid; used.push('personas') }
  }

  // Creative themes — en az 1 geçerli tema yeterli
  const rawThemes = raw.creative_themes as CreativeTheme[] | undefined
  let creative_themes = fallback.creative_themes
  if (Array.isArray(rawThemes) && rawThemes.length >= 1) {
    const valid = rawThemes.filter(t => t.theme && t.hook).map(t => ({
      theme: t.theme,
      hook: t.hook,
      offer: t.offer || '',
      format: (['video', 'image', 'ugc'].includes(t.format) ? t.format : 'image') as CreativeTheme['format'],
    })).slice(0, 8)
    if (valid.length >= 1) { creative_themes = valid; used.push('creative_themes') }
  }

  // Experiments — en az 1 geçerli deney yeterli
  const rawExps = raw.experiment_backlog as Experiment[] | undefined
  let experiment_backlog = fallback.experiment_backlog
  if (Array.isArray(rawExps) && rawExps.length >= 1) {
    const valid = rawExps.filter(e => e.hypothesis).map(e => ({
      hypothesis: e.hypothesis,
      metric: e.metric || 'CPA',
      test: e.test || e.hypothesis,
      priority: (['high', 'med', 'low'].includes(e.priority) ? e.priority : 'med') as Experiment['priority'],
    })).slice(0, 10)
    if (valid.length >= 1) { experiment_backlog = valid; used.push('experiment_backlog') }
  }

  // Risks — en az 1 geçerli risk yeterli
  const rawRisks = raw.risks as Risk[] | undefined
  let risks = fallback.risks
  if (Array.isArray(rawRisks) && rawRisks.length >= 1) {
    const valid = rawRisks.filter(r => r.risk).map(r => ({
      risk: r.risk,
      mitigation: r.mitigation || 'İzlenmeli',
    })).slice(0, 8)
    if (valid.length >= 1) { risks = valid; used.push('risks') }
  }

  // Tasks — en az 1 geçerli görev yeterli, bilinmeyen kategoriyi 'campaign' yap
  const rawTasks = raw.tasks_seed as TaskSeed[] | undefined
  const validCategories = ['setup', 'creative', 'audience', 'campaign', 'measurement']
  let tasks_seed = fallback.tasks_seed
  if (Array.isArray(rawTasks) && rawTasks.length >= 1) {
    const valid = rawTasks.filter(t => t.title).map(t => ({
      title: t.title,
      category: (validCategories.includes(t.category) ? t.category : 'campaign') as TaskSeed['category'],
      priority: (['high', 'med', 'low'].includes(t.priority) ? t.priority : 'med') as TaskSeed['priority'],
    })).slice(0, 15)
    if (valid.length >= 1) { tasks_seed = valid; used.push('tasks_seed') }
  }

  const allSections = ['kpi_targets', 'funnel_split', 'channel_mix', 'personas', 'creative_themes', 'experiment_backlog', 'risks', 'tasks_seed']
  const templateSections = allSections.filter(s => !used.includes(s))
  console.log(`[Strategy AI] Validate: AI kullanılan bölümler: [${used.join(', ')}]`)
  if (templateSections.length > 0) {
    console.log(`[Strategy AI] Validate: Template fallback bölümler: [${templateSections.join(', ')}]`)
  }

  return { kpi_targets, funnel_split, channel_mix, personas, creative_themes, experiment_backlog, risks, tasks_seed }
}
