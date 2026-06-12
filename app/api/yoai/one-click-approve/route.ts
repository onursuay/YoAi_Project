import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import { getCapability } from '@/lib/yoai/meta/capabilityMatrix'
import { resolvePage } from '@/lib/yoai/meta/pageResolver'
import { runPreflight } from '@/lib/yoai/meta/preflight'
import { orchestrateMetaCreate } from '@/lib/yoai/meta/orchestrator'
import { recordActionOutcome } from '@/lib/yoai/learningStore'
import {
  recordPublishAuditAttempt,
  updatePublishAuditStatus,
  hashPayload,
  sanitizeResponseExcerpt,
} from '@/lib/yoai/publishAuditStore'
import {
  markApprovalPublished,
  recordPublishAttemptOnApproval,
} from '@/lib/yoai/approvalStore'
import { validatePublishFeatureFlags, assertPausedOnly } from '@/lib/yoai/publishSafety'
import { validatePublishPayload } from '@/lib/yoai/publishPayloadValidator'
import { checkPolicyViolations } from '@/lib/yoai/policyGuard'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/one-click-approve

   "Tek Tıkla Onayla" — YoAlgoritma'nın ürettiği proposal için:
   1) Budget guard (Meta API'den ÖNCE)
   2) Capabilities çek (page/pixel/form)
   3) Otomatik seçim dene (tek page/pixel/form varsa)
   4) Gerekirse kullanıcıdan input iste (code: NEEDS_INPUT)
   5) Preflight → blocking eksik varsa NEEDS_INPUT
   6) AI görsel üret → Meta'ya yükle (imageHash)
   7) Orchestrator: campaign + adset + ad + creative (tümü PAUSED)
   8) Audit log: pending → success | blocked | failed | orphaned
   9) Learning kaydı al

   Dış modüllere dokunmaz; mevcut /api/meta/* uçlarını çağırır.
   ──────────────────────────────────────────────────────────── */

const DEFAULT_MAX_DAILY_BUDGET_TRY = 1000

interface BudgetGuardOk {
  ok: true
  budgetAmount: number
  currency: string
  maxDailyBudget: number
}
interface BudgetGuardBlock {
  ok: false
  code: 'BUDGET_GUARD_BLOCKED' | 'BUDGET_MISSING_OR_INVALID' | 'UNSUPPORTED_BUDGET_CURRENCY'
  message: string
  maxDailyBudget: number
  requestedBudget?: number | null
  currency?: string
}

function evaluateBudgetGuard(proposal: FullAdProposal): BudgetGuardOk | BudgetGuardBlock {
  const envCap = process.env.YOAI_MAX_DAILY_BUDGET_TRY
  const parsedCap = envCap ? Number(envCap) : NaN
  const maxDailyBudget =
    Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : DEFAULT_MAX_DAILY_BUDGET_TRY

  const rawBudget = (proposal as { dailyBudget?: unknown }).dailyBudget
  const budgetAmount = typeof rawBudget === 'number' ? rawBudget : Number(rawBudget)

  // Currency proposal şemasında resmi alan değil — defensive okuma. Default: TRY.
  const rawCurrency = (proposal as { dailyBudgetCurrency?: unknown }).dailyBudgetCurrency
  const currency = (typeof rawCurrency === 'string' && rawCurrency.trim()
    ? rawCurrency.trim()
    : 'TRY'
  ).toUpperCase()

  if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
    return {
      ok: false,
      code: 'BUDGET_MISSING_OR_INVALID',
      message: 'Günlük bütçe okunamadı veya geçersiz. Lütfen geçerli bir tutar belirleyin.',
      maxDailyBudget,
      requestedBudget: Number.isFinite(budgetAmount) ? budgetAmount : null,
      currency,
    }
  }

  if (currency !== 'TRY') {
    return {
      ok: false,
      code: 'UNSUPPORTED_BUDGET_CURRENCY',
      message: `Bütçe para birimi (${currency}) bu sürümde desteklenmiyor. Yalnızca TRY destekleniyor.`,
      maxDailyBudget,
      requestedBudget: budgetAmount,
      currency,
    }
  }

  if (budgetAmount > maxDailyBudget) {
    return {
      ok: false,
      code: 'BUDGET_GUARD_BLOCKED',
      message: `Günlük bütçe (₺${budgetAmount}) güvenli üst sınırı (₺${maxDailyBudget}) aşıyor. Yayın bloklandı.`,
      maxDailyBudget,
      requestedBudget: budgetAmount,
      currency,
    }
  }

  return { ok: true, budgetAmount, currency, maxDailyBudget }
}

function buildPayloadExcerpt(proposal: FullAdProposal): unknown {
  return sanitizeResponseExcerpt({
    proposalId: proposal.id,
    sourceCampaignId: proposal.sourceCampaignId,
    platform: proposal.platform,
    proposalType: (proposal as { proposalType?: unknown }).proposalType,
    campaignName: proposal.campaignName,
    campaignObjective: proposal.campaignObjective,
    optimizationGoal: proposal.optimizationGoal,
    destinationType: proposal.destinationType,
    headline: proposal.headline,
    callToAction: proposal.callToAction,
    finalUrl: proposal.finalUrl,
    dailyBudget: (proposal as { dailyBudget?: unknown }).dailyBudget,
  })
}

export async function POST(request: Request) {
  let auditId: string | null = null
  let auditWarning: string | null = null
  let approvalId: string | null = null
  let userIdForCatch: string | null = null

  // Helper: terminal-olmayan publish blokları için yoai_pending_approvals.metadata.last_publish_attempt yazımı.
  // Status değiştirmez; proposal pending/hold/editing kalmaya devam edebilir.
  const notifyApprovalAttempt = async (code: string, message: string) => {
    if (approvalId && userIdForCatch) {
      try {
        await recordPublishAttemptOnApproval(userIdForCatch, approvalId, {
          code,
          message,
          auditId,
        })
      } catch (e) {
        console.warn('[OneClick] notifyApprovalAttempt failed (non-fatal):', e)
      }
    }
  }

  try {
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli.' }, { status: 401 })
    }
    userIdForCatch = userId

    const body = await request.json()
    const proposal = body?.proposal as FullAdProposal | undefined
    const choices = (body?.choices || {}) as {
      pageId?: string
      pixelId?: string
      leadFormId?: string
      conversionEvent?: string
    }
    if (typeof body?.approvalId === 'string' && body.approvalId.length > 0) {
      approvalId = body.approvalId
    }

    if (!proposal || proposal.platform !== 'Meta') {
      return NextResponse.json(
        { ok: false, error: 'Tek tık onay şu an sadece Meta için destekleniyor.' },
        { status: 400 },
      )
    }

    /* ── 0) Feature flags + PAUSED guard ── */
    try {
      assertPausedOnly()
    } catch (safetyErr) {
      const errMsg = safetyErr instanceof Error ? safetyErr.message : String(safetyErr)
      console.error('[OneClick] ACTIVE_PUBLISH safety violation:', errMsg)
      return NextResponse.json(
        { ok: false, code: 'ACTIVE_PUBLISH_SAFETY_VIOLATION', message: errMsg },
        { status: 500 },
      )
    }

    const flagCheck = validatePublishFeatureFlags()
    if (!flagCheck.ok) {
      return NextResponse.json(
        { ok: false, code: flagCheck.code, message: flagCheck.message },
        { status: 422 },
      )
    }

    /* ── 0B) Payload validation (proposal alanları) ── */
    const payloadCheck = validatePublishPayload(proposal)
    if (!payloadCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: 'PAYLOAD_INVALID',
          message: payloadCheck.message,
          missingFields: payloadCheck.missingFields,
        },
        { status: 422 },
      )
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const requestUrl = new URL(request.url)
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      `${requestUrl.protocol}//${requestUrl.host}`

    const objective = (proposal.campaignObjective || 'OUTCOME_TRAFFIC') as string
    const destination = (proposal.destinationType || 'WEBSITE') as string

    /* ── 1) Budget guard (Meta API'den ÖNCE) ── */
    const budgetCheck = evaluateBudgetGuard(proposal)

    /* ── 2) Audit attempt: pending insert ── */
    const payloadExcerpt = buildPayloadExcerpt(proposal)
    const payloadHash = hashPayload({
      proposalId: proposal.id,
      campaignName: proposal.campaignName,
      objective,
      destination,
      dailyBudget: (proposal as { dailyBudget?: unknown }).dailyBudget,
    })

    const auditAttempt = await recordPublishAuditAttempt({
      user_id: userId,
      proposal_id: proposal.id || proposal.sourceCampaignId || null,
      platform: 'meta',
      source_campaign_id: proposal.sourceCampaignId || null,
      status: 'pending',
      action_type: 'one_click_approve',
      payload_hash: payloadHash || null,
      payload_excerpt: payloadExcerpt,
      budget_amount: budgetCheck.ok
        ? budgetCheck.budgetAmount
        : budgetCheck.requestedBudget ?? null,
      currency: budgetCheck.ok ? budgetCheck.currency : budgetCheck.currency || 'TRY',
    })
    auditId = auditAttempt?.id ?? null
    if (!auditId) {
      auditWarning = 'AUDIT_LOG_WRITE_FAILED'
      console.error('[OneClick][AUDIT_LOSS] publish attempt audit row insert edilemedi.')
    }

    if (!budgetCheck.ok) {
      if (auditId) {
        await updatePublishAuditStatus(auditId, 'blocked', {
          error_message: `${budgetCheck.code}: ${budgetCheck.message}`,
          response_excerpt: sanitizeResponseExcerpt({
            code: budgetCheck.code,
            maxDailyBudget: budgetCheck.maxDailyBudget,
            requestedBudget: budgetCheck.requestedBudget,
            currency: budgetCheck.currency,
          }),
        })
      }
      await notifyApprovalAttempt(budgetCheck.code, budgetCheck.message)
      return NextResponse.json(
        {
          ok: false,
          code: budgetCheck.code,
          message: budgetCheck.message,
          maxDailyBudget: budgetCheck.maxDailyBudget,
          requestedBudget: budgetCheck.requestedBudget ?? null,
          auditId,
          ...(auditWarning ? { auditWarning } : {}),
        },
        { status: 422 },
      )
    }

    /* ── 3) Capability kontrolü ── */
    const capability = getCapability(objective, destination)
    if (!capability.supported) {
      if (auditId) {
        await updatePublishAuditStatus(auditId, 'blocked', {
          error_message: `UNSUPPORTED: ${capability.unsupportedReason || ''}`,
          response_excerpt: sanitizeResponseExcerpt({
            code: 'UNSUPPORTED',
            objective,
            destination,
          }),
        })
      }
      await notifyApprovalAttempt(
        'UNSUPPORTED',
        capability.unsupportedReason || 'Bu kombinasyon desteklenmiyor.',
      )
      return NextResponse.json(
        {
          ok: false,
          code: 'UNSUPPORTED',
          message: capability.unsupportedReason || 'Bu kombinasyon v1\'de desteklenmiyor.',
          auditId,
          ...(auditWarning ? { auditWarning } : {}),
        },
        { status: 422 },
      )
    }

    /* ── 4) Capabilities snapshot ── */
    let assets: {
      pages: Array<{ id: string; name: string }>
      pixels: Array<{ id: string; name: string }>
      leadForms: Array<{ id: string; name: string; page_id: string }>
    } = { pages: [], pixels: [], leadForms: [] }
    try {
      const capRes = await fetch(`${baseUrl}/api/meta/capabilities`, {
        method: 'GET',
        headers: { Cookie: cookieHeader },
      })
      const capData = await capRes.json().catch(() => ({}))
      const a = capData?.assets || {}
      assets = {
        pages: Array.isArray(a.pages)
          ? a.pages.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
          : [],
        pixels: Array.isArray(a.pixels) ? a.pixels : [],
        leadForms: Array.isArray(a.leadForms) ? a.leadForms : [],
      }
    } catch (e) {
      console.warn('[OneClick] capabilities fetch failed:', e)
    }

    /* ── 5) Otomatik seçim → needs_input akışı ── */
    const required = capability.requiredAssets

    // Page
    const pageSel = resolvePage({
      availablePages: assets.pages,
      explicitPageId: choices.pageId,
    })
    let pageId = pageSel.pageId
    const needs: Record<string, unknown> = {}
    if (pageSel.source === 'ambiguous') {
      needs.pages = pageSel.options
    } else if (pageSel.source === 'missing') {
      if (auditId) {
        await updatePublishAuditStatus(auditId, 'blocked', {
          error_message: 'UNSUPPORTED: bağlı Facebook sayfası yok',
        })
      }
      await notifyApprovalAttempt('UNSUPPORTED', 'bağlı Facebook sayfası yok')
      return NextResponse.json(
        {
          ok: false,
          code: 'UNSUPPORTED',
          message:
            'Meta hesabında bağlı Facebook sayfası bulunamadı. Önce bir sayfa bağlayın.',
          auditId,
          ...(auditWarning ? { auditWarning } : {}),
        },
        { status: 422 },
      )
    }

    // Pixel
    let pixelId: string | null = choices.pixelId ?? null
    if (required.includes('pixel')) {
      if (!pixelId) {
        if (assets.pixels.length === 0) {
          if (auditId) {
            await updatePublishAuditStatus(auditId, 'blocked', {
              error_message: 'UNSUPPORTED: hesapta pixel yok',
            })
          }
          await notifyApprovalAttempt('UNSUPPORTED', 'hesapta pixel yok')
          return NextResponse.json(
            {
              ok: false,
              code: 'UNSUPPORTED',
              message: 'Dönüşüm kampanyası için pixel gerekli ama hesapta pixel yok.',
              auditId,
              ...(auditWarning ? { auditWarning } : {}),
            },
            { status: 422 },
          )
        }
        if (assets.pixels.length === 1) {
          pixelId = assets.pixels[0].id
        } else {
          needs.pixels = assets.pixels
        }
      }
    }

    // Lead form
    let leadFormId: string | null = choices.leadFormId ?? null
    if (required.includes('lead_form')) {
      const forPage = pageId
        ? assets.leadForms.filter((f) => f.page_id === pageId)
        : assets.leadForms
      if (!leadFormId) {
        if (forPage.length === 0) {
          if (auditId) {
            await updatePublishAuditStatus(auditId, 'blocked', {
              error_message: 'UNSUPPORTED: lead form yok',
            })
          }
          await notifyApprovalAttempt('UNSUPPORTED', 'lead form yok')
          return NextResponse.json(
            {
              ok: false,
              code: 'UNSUPPORTED',
              message:
                'Seçili sayfada Instant Form yok. Önce Meta\'da Lead Form oluşturun.',
              auditId,
              ...(auditWarning ? { auditWarning } : {}),
            },
            { status: 422 },
          )
        }
        if (forPage.length === 1) {
          leadFormId = forPage[0].id
        } else {
          needs.leadForms = forPage
        }
      }
    }

    // Conversion event (default'lar)
    let conversionEvent: string | null = choices.conversionEvent ?? null
    if (required.includes('conversion_event') && !conversionEvent) {
      conversionEvent = objective === 'OUTCOME_SALES' ? 'PURCHASE' : 'LEAD'
    }

    // Website URL (proposal'dan)
    const websiteUrl = proposal.finalUrl || null
    if (required.includes('website_url') && !websiteUrl) {
      needs.websiteUrl = true
    }

    if (Object.keys(needs).length > 0) {
      if (auditId) {
        await updatePublishAuditStatus(auditId, 'blocked', {
          error_message: 'NEEDS_INPUT: kullanıcı seçimi gerekli',
          response_excerpt: sanitizeResponseExcerpt({ needs }),
        })
      }
      return NextResponse.json(
        {
          ok: false,
          code: 'NEEDS_INPUT',
          message: 'Otomatik seçim yapılamadı — kullanıcı girdisi gerekli.',
          needs,
          capability,
          auditId,
          ...(auditWarning ? { auditWarning } : {}),
        },
        { status: 200 },
      )
    }

    /* ── 6) Preflight (creativeReady=true — biraz sonra üretilecek) ── */
    const preflight = runPreflight({
      objective,
      destination,
      assets,
      explicitPageId: pageId || undefined,
      pixelId,
      conversionEvent,
      websiteUrl,
      leadFormId,
      creativeReady: true,
    })

    if (preflight.status !== 'ok') {
      if (auditId) {
        await updatePublishAuditStatus(auditId, 'blocked', {
          error_message: `PREFLIGHT_BLOCKED: ${preflight.message}`,
          response_excerpt: sanitizeResponseExcerpt({ preflight }),
        })
      }
      await notifyApprovalAttempt('PREFLIGHT_BLOCKED', preflight.message)
      return NextResponse.json(
        {
          ok: false,
          code: 'PREFLIGHT_BLOCKED',
          message: preflight.message,
          preflight,
          auditId,
          ...(auditWarning ? { auditWarning } : {}),
        },
        { status: 422 },
      )
    }

    /* ── 7) AI görsel üret → Meta'ya yükle ── */
    const imagePrompt = `${proposal.headline || ''} ${proposal.description || ''}`.trim() || proposal.campaignName

    let imageUrl: string | null = null
    try {
      const enhRes = await fetch(`${baseUrl}/api/tasarim/enhance-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          prompt: `Dijital reklam görseli: ${imagePrompt}. Profesyonel, modern, temiz arka plan. NO TEXT on image, no words, no letters, no typography, purely visual content only.`,
          locale: 'tr',
        }),
      })
      let enhanced = imagePrompt
      if (enhRes.ok) {
        const d = await enhRes.json().catch(() => ({}))
        if (d.enhanced) enhanced = d.enhanced
      }
      const genRes = await fetch(`${baseUrl}/api/tasarim/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({ prompt: enhanced, aspect_ratio: '1:1' }),
      })
      if (!genRes.ok) throw new Error('Görsel üretilemedi.')
      const genData = await genRes.json().catch(() => ({}))
      imageUrl = genData.url || null
      if (!imageUrl) throw new Error('Görsel URL alınamadı.')
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Görsel üretiminde hata.'
      if (auditId) {
        await updatePublishAuditStatus(auditId, 'failed', {
          error_message: `CREATIVE_FAILED.image_generate: ${errMsg}`,
        })
      }
      await notifyApprovalAttempt('CREATIVE_FAILED.image_generate', errMsg)
      return NextResponse.json(
        {
          ok: false,
          code: 'CREATIVE_FAILED',
          stage: 'image_generate',
          message: errMsg,
          auditId,
          ...(auditWarning ? { auditWarning } : {}),
        },
        { status: 422 },
      )
    }

    let imageHash: string | null = null
    try {
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error('Görsel indirilemedi.')
      const blob = await imgRes.blob()
      const fd = new FormData()
      fd.append(
        'file',
        new File([blob], `yoai-oneclick-${Date.now()}.png`, {
          type: blob.type || 'image/png',
        }),
      )
      fd.append('type', 'image')
      const up = await fetch(`${baseUrl}/api/meta/upload-media`, {
        method: 'POST',
        headers: { Cookie: cookieHeader },
        body: fd,
      })
      const upData = await up.json().catch(() => ({}))
      if (!up.ok || !upData.ok || !upData.hash) {
        throw new Error(upData.message || upData.error || 'Meta upload başarısız.')
      }
      imageHash = upData.hash
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Meta upload hatası.'
      if (auditId) {
        await updatePublishAuditStatus(auditId, 'failed', {
          error_message: `CREATIVE_FAILED.meta_upload: ${errMsg}`,
        })
      }
      await notifyApprovalAttempt('CREATIVE_FAILED.meta_upload', errMsg)
      return NextResponse.json(
        {
          ok: false,
          code: 'CREATIVE_FAILED',
          stage: 'meta_upload',
          message: errMsg,
          imageUrl,
          auditId,
          ...(auditWarning ? { auditWarning } : {}),
        },
        { status: 422 },
      )
    }

    /* ── 7B) Policy guard (içerik politikası kontrolü) ── */
    const policyCheck = checkPolicyViolations(proposal)
    if (!policyCheck.ok) {
      if (auditId) {
        await updatePublishAuditStatus(auditId, 'blocked', {
          error_message: `POLICY_VIOLATION: ${policyCheck.message}`,
          response_excerpt: sanitizeResponseExcerpt({
            violations: policyCheck.violations,
            riskLevel: policyCheck.riskLevel,
          }),
        })
      }
      await notifyApprovalAttempt('POLICY_VIOLATION', policyCheck.message || 'İçerik politikası ihlali')
      return NextResponse.json(
        {
          ok: false,
          code: 'POLICY_VIOLATION',
          message: policyCheck.message,
          violations: policyCheck.violations,
          riskLevel: policyCheck.riskLevel,
          auditId,
          ...(auditWarning ? { auditWarning } : {}),
        },
        { status: 422 },
      )
    }

    /* ── 8) Orchestrator ── */
    const result = await orchestrateMetaCreate({
      baseUrl,
      cookieHeader,
      objective,
      destination,
      optimizationGoal: proposal.optimizationGoal,
      campaignName: proposal.campaignName || `YoAi — ${proposal.headline || 'Auto'}`,
      adsetName: proposal.adsetName || `YoAi Reklam Seti`,
      adName: proposal.adName || proposal.campaignName || `YoAi Reklam`,
      dailyBudget: budgetCheck.budgetAmount,
      explicitPageId: pageId || undefined,
      pixelId,
      conversionEvent,
      websiteUrl,
      leadFormId,
      creative: {
        format: 'single_image',
        primaryText: proposal.primaryText || proposal.headline || '',
        headline: proposal.headline,
        description: proposal.description,
        callToAction: proposal.callToAction,
        websiteUrl: websiteUrl || undefined,
        imageHash: imageHash!,
      },
    })

    /* ── 9) Audit update + response ── */
    if (result.status === 'ok') {
      if (auditId) {
        await updatePublishAuditStatus(auditId, 'success', {
          response_excerpt: sanitizeResponseExcerpt({
            created: result.created,
            resolvedParams: result.resolvedParams,
          }),
        })
      }
      // Approval queue: kayıt published olarak işaretlenir.
      if (approvalId) {
        try {
          await markApprovalPublished(userId, approvalId, auditId, {
            published_via: 'one_click_approve',
            created: result.created,
          })
        } catch (e) {
          console.warn('[OneClick] markApprovalPublished failed (non-fatal):', e)
        }
      }
      // Mevcut learning kaydı (action_outcomes) — değişmedi
      try {
        await recordActionOutcome({
          user_id: userId,
          campaign_id: proposal.sourceCampaignId || proposal.id,
          campaign_name: proposal.campaignName,
          root_cause: null,
          action_type: 'recreate',
          suggestion_payload: { proposal, orchestratorResult: result },
          applied: true,
        })
      } catch {
        // learning tablosu yoksa learningStore zaten AUDIT_LOSS log atar
      }

      return NextResponse.json({
        ok: true,
        created: result.created,
        message: result.message,
        preflight: result.preflight,
        auditId,
        ...(auditWarning ? { auditWarning } : {}),
      })
    }

    // Partial / full failure → orphan tracking
    const orphanResources: Array<{
      platform: string
      type: 'campaign' | 'adset' | 'ad'
      id: string
      parent_id?: string
    }> = []
    if (result.created.campaignId) {
      orphanResources.push({
        platform: 'meta',
        type: 'campaign',
        id: result.created.campaignId,
      })
    }
    if (result.created.adsetId) {
      orphanResources.push({
        platform: 'meta',
        type: 'adset',
        id: result.created.adsetId,
        parent_id: result.created.campaignId || undefined,
      })
    }
    if (result.created.adId) {
      orphanResources.push({
        platform: 'meta',
        type: 'ad',
        id: result.created.adId,
        parent_id: result.created.adsetId || undefined,
      })
    }

    // status mapping:
    //   preflight_blocked → blocked
    //   campaign_failed   → failed (orphan yok)
    //   adset_failed      → orphaned (campaign kaldı)
    //   ad_failed         → orphaned (campaign + adset kaldı)
    let auditStatus: 'blocked' | 'failed' | 'orphaned'
    if (result.status === 'preflight_blocked') {
      auditStatus = 'blocked'
    } else if (orphanResources.length > 0 && result.status !== 'campaign_failed') {
      auditStatus = 'orphaned'
    } else {
      auditStatus = 'failed'
    }

    if (auditId) {
      await updatePublishAuditStatus(auditId, auditStatus, {
        error_message: `${result.status.toUpperCase()}: ${result.message}`,
        response_excerpt: sanitizeResponseExcerpt({
          status: result.status,
          created: result.created,
          resolvedParams: result.resolvedParams,
          _debug: result._debug,
        }),
        orphan_resources: orphanResources,
      })
    }

    // Approval queue: status değiştirilmez (proposal yaşıyor — yeniden denenebilir).
    // Sadece metadata.last_publish_attempt güncellenir.
    await notifyApprovalAttempt(result.status.toUpperCase(), result.message)

    // Mevcut learning kaydı (action_outcomes) — applied=false
    try {
      await recordActionOutcome({
        user_id: userId,
        campaign_id: proposal.sourceCampaignId || proposal.id,
        campaign_name: proposal.campaignName,
        root_cause: null,
        action_type: 'recreate',
        suggestion_payload: { proposal, orchestratorResult: result },
        applied: false,
      })
    } catch {
      // no-op (AUDIT_LOSS log learningStore içinde yazılır)
    }

    return NextResponse.json(
      {
        ok: false,
        code: result.status.toUpperCase(),
        message: result.message,
        created: result.created,
        orphanResources,
        _debug: result._debug,
        auditId,
        ...(auditWarning ? { auditWarning } : {}),
      },
      { status: 422 },
    )
  } catch (error) {
    console.error('[YoAi OneClick] Error:', error)
    const errMsg = error instanceof Error ? error.message : 'Bilinmeyen hata'
    if (auditId) {
      await updatePublishAuditStatus(auditId, 'failed', {
        error_message: `ROUTE_EXCEPTION: ${errMsg}`,
      })
    }
    await notifyApprovalAttempt('ROUTE_EXCEPTION', errMsg)
    return NextResponse.json(
      {
        ok: false,
        error: errMsg,
        auditId,
        ...(auditWarning ? { auditWarning } : {}),
      },
      { status: 500 },
    )
  }
}
