/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Multi-AI Decision Desk (Faz 4)

   Shadow mode: rol çıktıları proposal generation context'ini
   zenginleştirir ve DB'ye audit edilir. Publish yapmaz;
   approval lifecycle değişmez.

   YOAI_MULTI_AI_ENABLED !== 'true' ise:
   - Hiçbir provider çağrısı yapılmaz.
   - Eski single-model generation akışı bozulmaz.
   ────────────────────────────────────────────────────────── */

import type {
  MultiAiDecisionInput,
  MultiAiDecisionDeskResult,
  MultiAiRunOptions,
  RoleDecisionOutput,
  StrategistDecision,
  CreativeDecision,
  RiskPolicyDecision,
  TechnicalValidatorDecision,
  JudgeDecision,
  JudgeFinalDecision,
  MultiAiCostGuardResult,
} from './multiAiTypes'
import type { CampaignSynthesisPackage } from './synthesisTypes'
import { callOpenAiJsonRole } from './aiProviders/openaiProvider'
import { callAnthropicJsonRole } from './aiProviders/anthropicProvider'
import { callGeminiJsonRole } from './aiProviders/geminiProvider'
import { hashObject, estimateCostUsd, asStringArray } from './aiProviders/providerGuards'
import { recordModelDecisionBatch } from './modelDecisionStore'

/* ──────────────────────────────────────────────────────────
   Feature flag
   ────────────────────────────────────────────────────────── */

export function isMultiAiEnabled(): boolean {
  return process.env.YOAI_MULTI_AI_ENABLED === 'true'
}

export function shouldUseDecisionDesk(): boolean {
  return isMultiAiEnabled()
}

/* ──────────────────────────────────────────────────────────
   Cost guard
   ────────────────────────────────────────────────────────── */

function checkCostGuard(
  completedOutputs: RoleDecisionOutput[],
  maxCostUsd: number,
): MultiAiCostGuardResult {
  let totalCost = 0
  for (const o of completedOutputs) {
    if (o.status === 'success' && o.model && o.tokenUsage) {
      const { inputTokens = 0, outputTokens = 0 } = o.tokenUsage
      totalCost += estimateCostUsd(inputTokens, outputTokens, o.model)
    }
  }
  if (totalCost >= maxCostUsd) {
    return {
      allowed: false,
      estimatedCostUsd: totalCost,
      reason: `Approx cost $${totalCost.toFixed(4)} reached limit $${maxCostUsd}`,
    }
  }
  return { allowed: true, estimatedCostUsd: totalCost }
}

/* ──────────────────────────────────────────────────────────
   Disabled result helper
   ────────────────────────────────────────────────────────── */

function buildDisabledResult(campaignId: string, platform: string, campaignType: string): MultiAiDecisionDeskResult {
  return {
    enabled: false,
    status: 'disabled',
    campaignId,
    platform,
    campaignType,
    synthesisHash: '',
    roles: { strategist: null, creative: null, riskPolicy: null, technicalValidator: null, judge: null },
    judgeDecision: null,
    overallConfidence: 0,
    overallRiskLevel: 'unknown',
    publishReady: false,
    requiresHumanReview: true,
    decisionContextForPrompt: '',
    costGuardTriggered: false,
    totalLatencyMs: 0,
  }
}

/* ──────────────────────────────────────────────────────────
   Rol prompt'ları
   ────────────────────────────────────────────────────────── */

function buildStrategistPrompts(pkg: CampaignSynthesisPackage): { system: string; user: string } {
  const system = `Sen YoAi Multi-AI Decision Desk'te Strategist rolündesin.
Kampanyanın synthesis paketini analiz edecek ve kampanya stratejisi, reklam açısı ve bidding/targeting önerileri üreteceksin.

KRİTİK KURALLAR:
- Kampanya türünü ASLA değiştirme. Tür: ${pkg.campaignType} (${pkg.platform})
- Rakip içgörüsü yoksa uydurma yapma.
- Forbidden hareketlere göre öneri üretme.

JSON formatında yanıt ver:
{
  "confidence": 75,
  "riskLevel": "low|medium|high",
  "publishReady": false,
  "requiresHumanReview": true,
  "campaignStrategyNotes": "...",
  "recommendedAngle": "...",
  "biddingRecommendation": "...",
  "targetingRecommendation": "...",
  "campaignTypeFidelity": true,
  "recommendations": ["...", "..."],
  "objections": ["..."],
  "evidence": ["spend=X", "ctr=Y"]
}`

  const synth = pkg.synthesis
  const perf = pkg.performanceSnapshot
  const user = `KAMPANYA: ${pkg.campaignName} (${pkg.platform}/${pkg.campaignType})
PERFORMANS: spend=₺${perf.spend} | CTR=%${perf.ctr} | CPC=₺${perf.cpc} | conv=${perf.conversions}${perf.roas != null ? ` | ROAS=${perf.roas}x` : ''}
ANA PROBLEM: ${synth.mainProblem}
ANA FIRSAT: ${synth.mainOpportunity}
ÖNERILEN AÇI: ${synth.recommendedAngle}
BİDDING YÖNÜ: ${synth.biddingDirection}
HEDEFLEME YÖNÜ: ${synth.targetingDirection}
YASAK HAREKETLER: ${synth.forbiddenMoves.join(' | ')}
RAKİP: ${pkg.competitor.available ? `${pkg.competitor.adsCount} reklam, hook: ${pkg.competitor.topHooks.slice(0, 3).join(', ')}` : 'Rakip içgörüsü yok'}
DOCTRINE FIT: ${pkg.doctrine.available ? `${pkg.doctrine.fitScore}/100 (${pkg.doctrine.fitSeverity})` : 'Doctrine yok'}`

  return { system, user }
}

function buildCreativePrompts(pkg: CampaignSynthesisPackage): { system: string; user: string } {
  const system = `Sen YoAi Multi-AI Decision Desk'te Creative rolündesin.
Kampanyanın kreatif yönünü, headline fikirlerini ve CTA önerilerini üreteceksin.
Bu fazda görsel/video dosya yok; text-only analiz yap.
Görsel asset bilgisi yoksa "visual assets unavailable" not düş.

JSON formatında yanıt ver:
{
  "confidence": 65,
  "riskLevel": "low",
  "publishReady": false,
  "requiresHumanReview": true,
  "creativeDirection": "...",
  "headlineIdeas": ["...", "...", "..."],
  "ctaIdeas": ["...", "..."],
  "visualAssetsNote": "visual assets unavailable — text-only analysis",
  "recommendations": ["..."],
  "objections": [],
  "evidence": ["..."]
}`

  const synth = pkg.synthesis
  const user = `KAMPANYA: ${pkg.campaignName} (${pkg.platform}/${pkg.campaignType})
KREATİF YÖN: ${synth.creativeDirection}
ANA PROBLEM: ${synth.mainProblem}
RAKİP HOOK'LAR: ${pkg.competitor.available ? pkg.competitor.topHooks.slice(0, 5).join(', ') : 'yok'}
RAKİP CTA: ${pkg.competitor.available ? pkg.competitor.topCtas.slice(0, 3).join(', ') : 'yok'}
RAKIP VALUE PROP: ${pkg.competitor.available ? pkg.competitor.topValueProps.slice(0, 3).join(', ') : 'yok'}
DOCTRINE KREATİF PRENSİPLERİ: ${pkg.doctrine.creativePrinciples.slice(0, 3).join(' | ') || 'yok'}
GÖRSEL ASSET: Bu fazda görsel/video binary yok — text-only creative analiz.`

  return { system, user }
}

function buildRiskPolicyPrompts(pkg: CampaignSynthesisPackage): { system: string; user: string } {
  const system = `Sen YoAi Multi-AI Decision Desk'te Risk Policy rolündesin.
Kampanyanın politika risklerini, abartılı vaatleri, publish risklerini ve insan incelemesi ihtiyacını değerlendireceksin.

KRİTİK KONTROLLER:
- Yanlış kampanya türü önerisi var mı?
- Abartılı ROAS/dönüşüm vaadi var mı?
- Budget guard riski var mı?
- Platform politikasına aykırı mesaj var mı?

JSON formatında yanıt ver (Türkçe içerik kabul edilir):
{
  "confidence": 80,
  "riskLevel": "low|medium|high|critical",
  "publishReady": false,
  "requiresHumanReview": true,
  "policyRisks": ["..."],
  "unresolvedRisks": ["..."],
  "humanReviewReasons": ["..."],
  "recommendations": ["..."],
  "objections": ["..."],
  "evidence": ["..."]
}`

  const synth = pkg.synthesis
  const perf = pkg.performanceSnapshot
  const user = `KAMPANYA: ${pkg.campaignName} (${pkg.platform}/${pkg.campaignType})
RİSKLER: ${pkg.risks.map(r => `[${r.severity}] ${r.message}`).join(' | ') || 'Yapısal risk yok'}
DOCTRINE FIT: ${pkg.doctrine.available ? `fit=${pkg.doctrine.fitScore}, severity=${pkg.doctrine.fitSeverity}` : 'doctrine yok'}
MISSING REQUIREMENTS: ${pkg.doctrine.missingRequirements.join(', ') || 'yok'}
POLICY NOTES: ${pkg.doctrine.policyNotes.join(', ') || 'yok'}
FORBIDDEN MOVES: ${synth.forbiddenMoves.join(' | ')}
BÜTÇE: ₺${perf.spend} harcandı, dönüşüm=${perf.conversions}${perf.roas != null ? `, ROAS=${perf.roas}x` : ''}
DIAGNOSIS: ${pkg.diagnosis.rootCauses.slice(0, 3).join(' | ') || 'root cause yok'}`

  return { system, user }
}

function buildTechnicalValidatorPrompts(pkg: CampaignSynthesisPackage): { system: string; user: string } {
  const system = `Sen YoAi Multi-AI Decision Desk'te Technical Validator rolündesin.
Kampanyanın teknik publish uygunluğunu değerlendireceksin.

KONTROL ET:
- Required fields mevcut mu? (campaignName, objective, budget, adsetName, targetingDescription, adName, primaryText, headline)
- Platform payload uygunluğu
- Final URL var mı? (Google kampanyaları için)
- CTA uygun mu?
- Budget guard'a takılır mı? (bütçe çok düşük mü)
- Budget guard: günlük bütçe > 0 ise geçer.

JSON formatında yanıt ver:
{
  "confidence": 85,
  "riskLevel": "low|medium|high",
  "publishReady": false,
  "requiresHumanReview": true,
  "missingFields": [],
  "platformCompatibilityNotes": "...",
  "budgetGuardPass": true,
  "publishReadiness": false,
  "recommendations": ["..."],
  "objections": ["..."],
  "evidence": ["..."]
}`

  const user = `KAMPANYA: ${pkg.campaignName} (${pkg.platform}/${pkg.campaignType})
MEVCUT: spend=₺${pkg.performanceSnapshot.spend} | budget kayıtlı mı: ${pkg.performanceSnapshot.spend > 0 ? 'evet (aktif)' : 'belirsiz'}
DOCTRINE REQUIRED ASSETS: ${pkg.doctrine.requiredAssets.join(', ') || 'belirtilmemiş'}
CAMPAIGN TYPE: ${pkg.campaignType} — Platform: ${pkg.platform}
CONSTRAINTS: ${pkg.constraints.map(c => c.message).slice(0, 3).join(' | ') || 'yok'}`

  return { system, user }
}

function buildJudgePrompts(
  pkg: CampaignSynthesisPackage,
  roleOutputs: RoleDecisionOutput[],
): { system: string; user: string } {
  const system = `Sen YoAi Multi-AI Decision Desk'te Judge/Hakem rolündesin.
Tüm rol çıktılarını (Strategist, Creative, Risk Policy, Technical Validator) okuyacak ve final karar vereceksin.

KARAR KURALLARI:
- publish_ready sadece: risk low/medium VE technical_validator pass VE campaign_type_fidelity=true ise true olabilir.
- Risk high/critical ise publish_ready=false.
- Campaign type değiştirilmişse publish_ready=false.
- Unresolved risks varsa requires_human_review=true.
- Rakip içgörüsü yoksa bu riski not et ama uydurma yapma.

FINAL KARAR TİPLERİ:
- "publish_ready": tüm kontroller geçti, risk düşük
- "needs_edit": küçük düzeltme gereken öneriler var
- "reject": yanlış objective, kritik politika ihlali
- "hold": insan incelemesi gerektiriyor ama reddedilmiyor
- "needs_human_review": belirsiz, insan karar vermeli

JSON formatında yanıt ver:
{
  "confidence": 80,
  "riskLevel": "low|medium|high|critical",
  "publishReady": false,
  "requiresHumanReview": true,
  "finalDecision": "needs_edit",
  "campaignTypeFidelity": true,
  "finalRecommendation": "...",
  "finalCreativeBrief": "...",
  "finalPayloadNotes": "...",
  "unresolvedRisks": ["..."],
  "requiredHumanChecks": ["..."],
  "reason": "...",
  "recommendations": ["..."],
  "objections": ["..."],
  "evidence": ["..."]
}`

  const roleSummaries = roleOutputs.map(o => {
    const status = o.status
    if (status !== 'success') {
      return `[${o.role.toUpperCase()}] status=${status}${o.errorMessage ? ` err=${o.errorMessage.slice(0, 80)}` : ''}`
    }
    return `[${o.role.toUpperCase()}] conf=${o.confidence} risk=${o.riskLevel} publishReady=${o.publishReady} humanReview=${o.requiresHumanReview}
  Öneriler: ${o.recommendations.slice(0, 2).join('; ') || 'yok'}
  İtirazlar: ${o.objections.slice(0, 2).join('; ') || 'yok'}`
  }).join('\n\n')

  const user = `KAMPANYA: ${pkg.campaignName} (${pkg.platform}/${pkg.campaignType})
ANA PROBLEM: ${pkg.synthesis.mainProblem}
SYNTHESIS HASH: ${hashObject(pkg.synthesis)}

ROL ÇIKTILARI:
${roleSummaries}

FORBIDDEN MOVES: ${pkg.synthesis.forbiddenMoves.slice(0, 3).join(' | ')}
DOCTRINE FIT: ${pkg.doctrine.available ? `${pkg.doctrine.fitScore}/100 (${pkg.doctrine.fitSeverity})` : 'yok'}
RAKİP: ${pkg.competitor.available ? `${pkg.competitor.adsCount} reklam` : 'yok'}

GÖREV: Tüm rol çıktılarını değerlendirip final karar ver.`

  return { system, user }
}

/* ──────────────────────────────────────────────────────────
   Deterministic fallback judge
   Rol çıktıları yetersizse veya judge API çağrısı başarısızsa.
   ────────────────────────────────────────────────────────── */

function buildDeterministicJudge(
  pkg: CampaignSynthesisPackage,
  roleOutputs: RoleDecisionOutput[],
): JudgeDecision {
  const successOutputs = roleOutputs.filter(o => o.status === 'success')
  const avgConf = successOutputs.length > 0
    ? Math.round(successOutputs.reduce((s, o) => s + o.confidence, 0) / successOutputs.length)
    : 40

  const hasHighRisk = roleOutputs.some(o => o.riskLevel === 'high' || o.riskLevel === 'critical')
  const hasCriticalRisk = roleOutputs.some(o => o.riskLevel === 'critical')
  const allObjFailed = roleOutputs.some(o =>
    o.role === 'technical_validator' && o.status === 'failed'
  )

  let finalDecision: JudgeFinalDecision = 'needs_human_review'
  let riskLevel = 'medium'

  if (hasCriticalRisk || allObjFailed) {
    finalDecision = 'hold'
    riskLevel = 'critical'
  } else if (hasHighRisk) {
    finalDecision = 'needs_edit'
    riskLevel = 'high'
  } else if (successOutputs.length >= 2 && avgConf >= 60) {
    finalDecision = 'needs_edit'
    riskLevel = 'medium'
  }

  const unresolvedRisks = pkg.risks
    .filter(r => r.severity === 'high' || r.severity === 'critical')
    .map(r => r.message)

  return {
    role: 'judge',
    provider: 'openai',
    model: 'deterministic-fallback',
    status: 'success',
    confidence: avgConf,
    riskLevel,
    publishReady: false,
    requiresHumanReview: true,
    recommendations: ['İnsan incelemesi önerilir (deterministik fallback judge).'],
    objections: unresolvedRisks,
    evidence: [`successful_roles=${successOutputs.length}`, `avg_confidence=${avgConf}`],
    outputJson: { finalDecision, riskLevel, deterministic: true },
    latencyMs: 0,
    tokenUsage: {},
    finalDecision,
    campaignTypeFidelity: true,
    finalRecommendation: 'Rol çıktıları yetersiz; insan incelemesi ile devam et.',
    finalCreativeBrief: pkg.synthesis.creativeDirection,
    finalPayloadNotes: 'Deterministik fallback — AI judge çalışmadı.',
    unresolvedRisks,
    requiredHumanChecks: ['Tüm rol çıktılarını manuel kontrol et.'],
    reason: 'Deterministic fallback judge (AI judge API başarısız veya yetersiz rol çıktısı).',
  }
}

/* ──────────────────────────────────────────────────────────
   Result builder
   ────────────────────────────────────────────────────────── */

function buildDeskResult(params: {
  pkg: CampaignSynthesisPackage
  synthesisHash: string
  strategist: StrategistDecision | null
  creative: CreativeDecision | null
  riskPolicy: RiskPolicyDecision | null
  technicalValidator: TechnicalValidatorDecision | null
  judge: JudgeDecision | null
  costGuardTriggered: boolean
  startMs: number
}): MultiAiDecisionDeskResult {
  const { pkg, synthesisHash, strategist, creative, riskPolicy, technicalValidator, judge, costGuardTriggered, startMs } = params

  const allRoles = [strategist, creative, riskPolicy, technicalValidator, judge].filter(Boolean) as RoleDecisionOutput[]
  const successRoles = allRoles.filter(r => r.status === 'success')

  const overallConfidence = judge?.confidence
    ?? (successRoles.length > 0
      ? Math.round(successRoles.reduce((s, r) => s + r.confidence, 0) / successRoles.length)
      : 0)

  const riskLevels = allRoles.map(r => r.riskLevel).filter(Boolean) as string[]
  const overallRiskLevel = riskLevels.includes('critical')
    ? 'critical'
    : riskLevels.includes('high')
    ? 'high'
    : riskLevels.includes('medium')
    ? 'medium'
    : 'low'

  const publishReady = judge?.publishReady ?? false
  const requiresHumanReview = judge?.requiresHumanReview ?? true
  const judgeDecision = judge?.finalDecision ?? null

  let status: MultiAiDecisionDeskResult['status'] = 'completed'
  if (allRoles.length === 0) status = 'all_skipped'
  else if (successRoles.length === 0) status = 'all_skipped'
  else if (successRoles.length < allRoles.length) status = 'partial'

  return {
    enabled: true,
    status,
    campaignId: pkg.campaignId,
    platform: pkg.platform,
    campaignType: pkg.campaignType,
    synthesisHash,
    roles: { strategist, creative, riskPolicy, technicalValidator, judge },
    judgeDecision,
    overallConfidence,
    overallRiskLevel,
    publishReady,
    requiresHumanReview,
    decisionContextForPrompt: buildDecisionDeskContextForPrompt({
      enabled: true, status, campaignId: pkg.campaignId, platform: pkg.platform,
      campaignType: pkg.campaignType, synthesisHash, roles: { strategist, creative, riskPolicy, technicalValidator, judge },
      judgeDecision, overallConfidence, overallRiskLevel, publishReady, requiresHumanReview,
      decisionContextForPrompt: '', costGuardTriggered, totalLatencyMs: Date.now() - startMs,
    }),
    costGuardTriggered,
    totalLatencyMs: Date.now() - startMs,
  }
}

/* ──────────────────────────────────────────────────────────
   Context for prompt (adCreator'a geçilecek blok)
   ────────────────────────────────────────────────────────── */

export function buildDecisionDeskContextForPrompt(
  result: Omit<MultiAiDecisionDeskResult, 'decisionContextForPrompt'> & { decisionContextForPrompt?: string },
): string {
  if (!result.enabled || result.status === 'disabled') return ''
  if (result.status === 'all_skipped') return ''

  const lines: string[] = []
  lines.push(`MULTI-AI DECISION DESK (${result.campaignId}):`)
  lines.push(`- Karar: ${result.judgeDecision ?? 'belirsiz'} | Güven: ${result.overallConfidence}/100 | Risk: ${result.overallRiskLevel}`)
  lines.push(`- Publish ready: ${result.publishReady} | İnsan incelemesi: ${result.requiresHumanReview}`)

  const judge = result.roles.judge
  if (judge && judge.status === 'success') {
    if (judge.finalRecommendation) {
      lines.push(`- Judge önerisi: ${judge.finalRecommendation.slice(0, 200)}`)
    }
    if (judge.unresolvedRisks && judge.unresolvedRisks.length > 0) {
      lines.push(`- Çözülmemiş riskler: ${judge.unresolvedRisks.slice(0, 2).join('; ')}`)
    }
  }

  const strategist = result.roles.strategist
  if (strategist && strategist.status === 'success') {
    if (strategist.recommendedAngle) {
      lines.push(`- Strategist açısı: ${strategist.recommendedAngle.slice(0, 150)}`)
    }
  }

  const creative = result.roles.creative
  if (creative && creative.status === 'success') {
    if (creative.creativeDirection) {
      lines.push(`- Creative yön: ${creative.creativeDirection.slice(0, 150)}`)
    }
    if (creative.headlineIdeas && creative.headlineIdeas.length > 0) {
      lines.push(`- Headline fikirleri: ${creative.headlineIdeas.slice(0, 3).join(' | ')}`)
    }
  }

  return lines.join('\n').slice(0, 1200)
}

/* ──────────────────────────────────────────────────────────
   Input builder
   ────────────────────────────────────────────────────────── */

export function buildMultiAiDecisionInput(
  synthesisPackage: CampaignSynthesisPackage,
  userId: string,
  proposalId?: string | null,
): MultiAiDecisionInput {
  return { userId, synthesisPackage, proposalId: proposalId ?? null }
}

/* ──────────────────────────────────────────────────────────
   Role runners
   ────────────────────────────────────────────────────────── */

export async function runStrategistRole(
  input: MultiAiDecisionInput,
  options: MultiAiRunOptions = {},
): Promise<StrategistDecision> {
  const { system, user } = buildStrategistPrompts(input.synthesisPackage)
  const raw = await callOpenAiJsonRole({
    role: 'strategist',
    systemPrompt: system,
    userPrompt: user,
    timeoutMs: options.timeoutMs,
  })

  return {
    ...raw,
    role: 'strategist',
    provider: 'openai',
    campaignStrategyNotes: String(raw.outputJson.campaignStrategyNotes ?? ''),
    recommendedAngle: String(raw.outputJson.recommendedAngle ?? ''),
    biddingRecommendation: String(raw.outputJson.biddingRecommendation ?? ''),
    targetingRecommendation: String(raw.outputJson.targetingRecommendation ?? ''),
    campaignTypeFidelity: Boolean(raw.outputJson.campaignTypeFidelity ?? true),
  }
}

export async function runCreativeRole(
  input: MultiAiDecisionInput,
  options: MultiAiRunOptions = {},
): Promise<CreativeDecision> {
  const { system, user } = buildCreativePrompts(input.synthesisPackage)
  const raw = await callGeminiJsonRole({
    role: 'creative',
    systemPrompt: system,
    userPrompt: user,
    timeoutMs: options.timeoutMs,
  })

  return {
    ...raw,
    role: 'creative',
    provider: 'gemini',
    creativeDirection: String(raw.outputJson.creativeDirection ?? ''),
    headlineIdeas: asStringArray(raw.outputJson.headlineIdeas),
    ctaIdeas: asStringArray(raw.outputJson.ctaIdeas),
    visualAssetsNote: String(raw.outputJson.visualAssetsNote ?? 'visual assets unavailable — text-only analysis'),
  }
}

export async function runRiskPolicyRole(
  input: MultiAiDecisionInput,
  options: MultiAiRunOptions = {},
): Promise<RiskPolicyDecision> {
  const { system, user } = buildRiskPolicyPrompts(input.synthesisPackage)
  const raw = await callAnthropicJsonRole({
    role: 'risk_policy',
    systemPrompt: system,
    userPrompt: user,
    timeoutMs: options.timeoutMs,
  })

  return {
    ...raw,
    role: 'risk_policy',
    provider: 'anthropic',
    policyRisks: asStringArray(raw.outputJson.policyRisks),
    unresolvedRisks: asStringArray(raw.outputJson.unresolvedRisks),
    humanReviewReasons: asStringArray(raw.outputJson.humanReviewReasons),
  }
}

export async function runTechnicalValidatorRole(
  input: MultiAiDecisionInput,
  options: MultiAiRunOptions = {},
): Promise<TechnicalValidatorDecision> {
  const { system, user } = buildTechnicalValidatorPrompts(input.synthesisPackage)
  const raw = await callOpenAiJsonRole({
    role: 'technical_validator',
    systemPrompt: system,
    userPrompt: user,
    timeoutMs: options.timeoutMs,
  })

  return {
    ...raw,
    role: 'technical_validator',
    provider: 'openai',
    missingFields: asStringArray(raw.outputJson.missingFields),
    platformCompatibilityNotes: String(raw.outputJson.platformCompatibilityNotes ?? ''),
    budgetGuardPass: Boolean(raw.outputJson.budgetGuardPass ?? true),
    publishReadiness: Boolean(raw.outputJson.publishReadiness ?? false),
  }
}

export async function runJudgeRole(
  input: MultiAiDecisionInput,
  roleOutputs: RoleDecisionOutput[],
  options: MultiAiRunOptions = {},
): Promise<JudgeDecision> {
  const successCount = roleOutputs.filter(o => o.status === 'success').length

  // Yeterli başarılı rol yoksa deterministik fallback
  if (successCount === 0) {
    return buildDeterministicJudge(input.synthesisPackage, roleOutputs)
  }

  const { system, user } = buildJudgePrompts(input.synthesisPackage, roleOutputs)
  const raw = await callOpenAiJsonRole({
    role: 'judge',
    systemPrompt: system,
    userPrompt: user,
    timeoutMs: options.timeoutMs,
  })

  if (raw.status !== 'success') {
    return buildDeterministicJudge(input.synthesisPackage, roleOutputs)
  }

  const validDecisions = new Set(['publish_ready', 'needs_edit', 'reject', 'hold', 'needs_human_review'])
  const rawDecision = String(raw.outputJson.finalDecision ?? 'needs_human_review')
  const finalDecision: JudgeFinalDecision = validDecisions.has(rawDecision)
    ? rawDecision as JudgeFinalDecision
    : 'needs_human_review'

  return {
    ...raw,
    role: 'judge',
    provider: 'openai',
    finalDecision,
    campaignTypeFidelity: Boolean(raw.outputJson.campaignTypeFidelity ?? true),
    finalRecommendation: String(raw.outputJson.finalRecommendation ?? ''),
    finalCreativeBrief: String(raw.outputJson.finalCreativeBrief ?? ''),
    finalPayloadNotes: String(raw.outputJson.finalPayloadNotes ?? ''),
    unresolvedRisks: asStringArray(raw.outputJson.unresolvedRisks),
    requiredHumanChecks: asStringArray(raw.outputJson.requiredHumanChecks),
    reason: String(raw.outputJson.reason ?? ''),
  }
}

/* ──────────────────────────────────────────────────────────
   Main orchestrator
   ────────────────────────────────────────────────────────── */

export async function runMultiAiDecisionDesk(
  input: MultiAiDecisionInput,
  options: MultiAiRunOptions = {},
): Promise<MultiAiDecisionDeskResult> {
  const startMs = Date.now()
  const pkg = input.synthesisPackage

  if (!isMultiAiEnabled()) {
    return buildDisabledResult(pkg.campaignId, pkg.platform, pkg.campaignType)
  }

  const synthesisHash = hashObject(pkg.synthesis)
  const timeoutMs = options.timeoutMs
    ?? Number(process.env.YOAI_MULTI_AI_TIMEOUT_MS || 45_000)
  const maxCostUsd = options.maxCostUsd
    ?? (process.env.YOAI_MULTI_AI_MAX_COST_PER_RUN_TRY
      ? Number(process.env.YOAI_MULTI_AI_MAX_COST_PER_RUN_TRY)
      : null)

  let costGuardTriggered = false
  const completedRoles: RoleDecisionOutput[] = []

  try {
    // 1. Rol çağrıları — bağımsız, paralel
    const [strategistRaw, creativeRaw, riskPolicyRaw, technicalValidatorRaw] =
      await Promise.allSettled([
        runStrategistRole(input, { timeoutMs }),
        runCreativeRole(input, { timeoutMs }),
        runRiskPolicyRole(input, { timeoutMs }),
        runTechnicalValidatorRole(input, { timeoutMs }),
      ])

    const strategist = strategistRaw.status === 'fulfilled' ? strategistRaw.value : null
    const creative = creativeRaw.status === 'fulfilled' ? creativeRaw.value : null
    const riskPolicy = riskPolicyRaw.status === 'fulfilled' ? riskPolicyRaw.value : null
    const technicalValidator = technicalValidatorRaw.status === 'fulfilled' ? technicalValidatorRaw.value : null

    for (const r of [strategist, creative, riskPolicy, technicalValidator]) {
      if (r) completedRoles.push(r)
    }

    // 2. Cost guard kontrolü
    if (maxCostUsd !== null && maxCostUsd > 0) {
      const guard = checkCostGuard(completedRoles, maxCostUsd)
      if (!guard.allowed) {
        console.warn(
          `[MultiAiDesk] Cost guard triggered: ${guard.reason} — judge skipped`,
        )
        costGuardTriggered = true
      }
    }

    // 3. Judge — cost guard tetiklenmediyse çalışır
    let judge: JudgeDecision | null = null
    if (!costGuardTriggered) {
      judge = await runJudgeRole(input, completedRoles, { timeoutMs })
      if (judge) completedRoles.push(judge)
    } else {
      judge = buildDeterministicJudge(pkg, completedRoles)
      judge.status = 'skipped_cost_guard'
      completedRoles.push(judge)
    }

    // 4. DB audit (fire-and-forget; route çökmez)
    recordModelDecisionBatch(input.userId, {
      enabled: true, status: 'completed', campaignId: pkg.campaignId,
      platform: pkg.platform, campaignType: pkg.campaignType, synthesisHash,
      roles: { strategist, creative, riskPolicy, technicalValidator, judge },
      judgeDecision: judge?.finalDecision ?? null,
      overallConfidence: 0, overallRiskLevel: 'unknown', publishReady: false,
      requiresHumanReview: true, decisionContextForPrompt: '', costGuardTriggered,
      totalLatencyMs: Date.now() - startMs,
    }, completedRoles).catch(e => {
      console.warn('[MultiAiDesk] DB audit failed (non-fatal):', e instanceof Error ? e.message : String(e))
    })

    return buildDeskResult({
      pkg, synthesisHash,
      strategist, creative, riskPolicy, technicalValidator, judge,
      costGuardTriggered, startMs,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[MultiAiDesk] Orchestrator error (non-fatal):', msg)
    return {
      ...buildDisabledResult(pkg.campaignId, pkg.platform, pkg.campaignType),
      enabled: true,
      status: 'error',
      error: msg,
    }
  }
}
