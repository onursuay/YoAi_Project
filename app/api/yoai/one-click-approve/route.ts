import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import { getCapability } from '@/lib/yoai/meta/capabilityMatrix'
import { resolvePage } from '@/lib/yoai/meta/pageResolver'
import { runPreflight } from '@/lib/yoai/meta/preflight'
import { orchestrateMetaCreate } from '@/lib/yoai/meta/orchestrator'
import { recordActionOutcome } from '@/lib/yoai/learningStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/one-click-approve

   "Tek Tıkla Onayla" — YoAlgoritma'nın ürettiği proposal için:
   1) Capabilities çek (page/pixel/form)
   2) Otomatik seçim dene (tek page/pixel/form varsa)
   3) Gerekirse kullanıcıdan input iste (code: NEEDS_INPUT)
   4) Preflight → blocking eksik varsa NEEDS_INPUT
   5) AI görsel üret → Meta'ya yükle (imageHash)
   6) Orchestrator: campaign + adset + ad + creative (tümü PAUSED)
   7) Learning kaydı al

   Dış modüllere dokunmaz; mevcut /api/meta/* uçlarını çağırır.

   Body: {
     proposal: FullAdProposal,
     // Kullanıcı 2. turda bunları gönderir
     choices?: {
       pageId?: string
       pixelId?: string
       leadFormId?: string
       conversionEvent?: string
     }
   }

   Response:
     - { ok: true, created: { campaignId, adsetId, adId }, message }
     - { ok: false, code: 'NEEDS_INPUT', needs: { pages?, pixels?, leadForms?, conversionEvent?, websiteUrl? } }
     - { ok: false, code: 'UNSUPPORTED' | 'PREFLIGHT_BLOCKED' | 'CREATIVE_FAILED' | ..., message }
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_id')?.value
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli.' }, { status: 401 })
    }

    const body = await request.json()
    const proposal = body?.proposal as FullAdProposal | undefined
    const choices = (body?.choices || {}) as {
      pageId?: string
      pixelId?: string
      leadFormId?: string
      conversionEvent?: string
    }

    if (!proposal || proposal.platform !== 'Meta') {
      return NextResponse.json(
        { ok: false, error: 'Tek tık onay şu an sadece Meta için destekleniyor.' },
        { status: 400 },
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

    /* ── 1) Capability kontrolü ── */
    const capability = getCapability(objective, destination)
    if (!capability.supported) {
      return NextResponse.json(
        {
          ok: false,
          code: 'UNSUPPORTED',
          message: capability.unsupportedReason || 'Bu kombinasyon v1\'de desteklenmiyor.',
        },
        { status: 422 },
      )
    }

    /* ── 2) Capabilities snapshot ── */
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

    /* ── 3) Otomatik seçim → needs_input akışı ── */
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
      return NextResponse.json(
        {
          ok: false,
          code: 'UNSUPPORTED',
          message:
            'Meta hesabında bağlı Facebook sayfası bulunamadı. Önce bir sayfa bağlayın.',
        },
        { status: 422 },
      )
    }

    // Pixel
    let pixelId: string | null = choices.pixelId ?? null
    if (required.includes('pixel')) {
      if (!pixelId) {
        if (assets.pixels.length === 0) {
          return NextResponse.json(
            {
              ok: false,
              code: 'UNSUPPORTED',
              message: 'Dönüşüm kampanyası için pixel gerekli ama hesapta pixel yok.',
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
          return NextResponse.json(
            {
              ok: false,
              code: 'UNSUPPORTED',
              message:
                'Seçili sayfada Instant Form yok. Önce Meta\'da Lead Form oluşturun.',
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
      // Makul default: SALES → PURCHASE, LEADS → LEAD
      conversionEvent = objective === 'OUTCOME_SALES' ? 'PURCHASE' : 'LEAD'
    }

    // Website URL (proposal'dan)
    const websiteUrl = proposal.finalUrl || null
    if (required.includes('website_url') && !websiteUrl) {
      needs.websiteUrl = true
    }

    if (Object.keys(needs).length > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: 'NEEDS_INPUT',
          message: 'Otomatik seçim yapılamadı — kullanıcı girdisi gerekli.',
          needs,
          capability,
        },
        { status: 200 },
      )
    }

    /* ── 4) Preflight (creativeReady=true — çünkü biraz sonra üreteceğiz) ── */
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
      return NextResponse.json(
        {
          ok: false,
          code: 'PREFLIGHT_BLOCKED',
          message: preflight.message,
          preflight,
        },
        { status: 422 },
      )
    }

    /* ── 5) AI görsel üret → Meta'ya yükle ── */
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
      return NextResponse.json(
        {
          ok: false,
          code: 'CREATIVE_FAILED',
          stage: 'image_generate',
          message: e instanceof Error ? e.message : 'Görsel üretiminde hata.',
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
      return NextResponse.json(
        {
          ok: false,
          code: 'CREATIVE_FAILED',
          stage: 'meta_upload',
          message: e instanceof Error ? e.message : 'Meta upload hatası.',
          imageUrl,
        },
        { status: 422 },
      )
    }

    /* ── 6) Orchestrator ── */
    const result = await orchestrateMetaCreate({
      baseUrl,
      cookieHeader,
      objective,
      destination,
      optimizationGoal: proposal.optimizationGoal,
      campaignName: proposal.campaignName || `YoAi — ${proposal.headline || 'Auto'}`,
      adsetName: proposal.adsetName || `YoAi Reklam Seti`,
      adName: proposal.adName || proposal.campaignName || `YoAi Reklam`,
      dailyBudget: proposal.dailyBudget || 35,
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

    /* ── 7) Learning kaydı ── */
    try {
      await recordActionOutcome({
        user_id: userId,
        campaign_id: proposal.sourceCampaignId || proposal.id,
        campaign_name: proposal.campaignName,
        root_cause: null,
        action_type: 'recreate',
        suggestion_payload: { proposal, orchestratorResult: result },
        applied: result.status === 'ok',
      })
    } catch {
      // learning tablosu yoksa sessiz no-op
    }

    if (result.status === 'ok') {
      return NextResponse.json({
        ok: true,
        created: result.created,
        message: result.message,
        preflight: result.preflight,
      })
    }

    return NextResponse.json(
      {
        ok: false,
        code: result.status.toUpperCase(),
        message: result.message,
        created: result.created,
        _debug: result._debug,
      },
      { status: 422 },
    )
  } catch (error) {
    console.error('[YoAi OneClick] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}

