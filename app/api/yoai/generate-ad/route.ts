import { NextResponse } from 'next/server'
import { generateFullAutoProposals } from '@/lib/yoai/adCreator'
import { runFullCompetitorAnalysis, compareWithCompetitors } from '@/lib/yoai/competitorAnalyzer'
import type { CompetitorAd } from '@/lib/yoai/competitorAnalyzer'
import { listCompetitorAds } from '@/lib/yoai/competitorAdStore'
import { runStructuralAnalysis } from '@/lib/yoai/platformKnowledge'
import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'
import { getBestAvailableRun, upsertDailyRun, getTurkeyDate } from '@/lib/yoai/dailyRunStore'
import type { Platform } from '@/lib/yoai/analysisTypes'
import { diagnoseCampaigns } from '@/lib/yoai/meta/diagnosis'
import { decideForDiagnoses } from '@/lib/yoai/meta/decision'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import { bulkInsertPendingApprovalsIfMissing, listApprovals } from '@/lib/yoai/approvalStore'
import { buildCompetitorContextForPrompt } from '@/lib/yoai/competitorInsightStore'
import { sanitizeProposalForDisplay } from '@/lib/yoai/competitorDisplay'
import { filterVisibleYoaiProposals } from '@/lib/yoai/proposalVisibilityFilter'
import { normalizeCampaignType } from '@/lib/yoai/campaignTypeIntelligence'
import { buildSynthesisPackagesForCampaigns } from '@/lib/yoai/synthesisEngine'
import type { CampaignSynthesisPackage } from '@/lib/yoai/synthesisTypes'
import { runMultiAiDecisionDesk, shouldUseDecisionDesk } from '@/lib/yoai/multiAiDecisionDesk'
import type { MultiAiDecisionDeskResult } from '@/lib/yoai/multiAiTypes'
import { buildProposalEngineContext } from '@/lib/yoai/proposalEngineOrchestrator'
import type { EngineContextDiagnostics } from '@/lib/yoai/proposalEngineOrchestrator'
import type { CompetitorQueryPlan } from '@/lib/yoai/competitorQueryExpander'
import type { CampaignIntentProfile } from '@/lib/yoai/campaignIntentEngine'
import { getBusinessContextForUser, buildBusinessContextPromptBlock } from '@/lib/yoai/businessContextStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/generate-ad
   Accepts { platform } or { platforms: ["Meta","Google"] }.
   Reads persisted → falls back to live generation.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { platform, platforms, forceGenerate } = body as {
      platform?: Platform
      platforms?: Platform[]
      forceGenerate?: boolean
    }

    // Support both single platform and multi-platform
    const targetPlatforms: Platform[] = platforms || (platform ? [platform] : [])
    if (targetPlatforms.length === 0) {
      return NextResponse.json({ ok: false, error: 'Platform gerekli' }, { status: 400 })
    }

    // Resolve userId once
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value

    // ── Helpers ──
    const cookieHeader = request.headers.get('cookie') || ''
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const fetchBothPlatforms = () => Promise.all([
      fetchMetaDeep(userId || undefined).catch(e => { console.error('[GenerateAd] Meta fetch failed:', e); return { campaigns: [] as any[], errors: ['Meta fetch hatası'], connected: false } }),
      fetchGoogleDeep(userId || undefined).catch(e => { console.error('[GenerateAd] Google fetch failed:', e); return { campaigns: [] as any[], errors: ['Google fetch hatası'], connected: false } }),
    ])

    // Business context — kullanıcı işletmesi (zorunlu bağlam, locked değilse kullan)
    const businessContext = userId ? await getBusinessContextForUser(userId) : null
    const businessContextPromptBlock = businessContext ? buildBusinessContextPromptBlock(businessContext) : null
    const businessKeywords = businessContext?.keywords || []

    // Orchestrator diagnostics accumulator — platform başına toplanır, response'a eklenir
    const engineDiagnosticsMap: Record<string, EngineContextDiagnostics> = {}

    const generateForPlatforms = async (platforms: Platform[], allCampaigns: any[]) => {
      const [competitorAnalysis, structuralAnalysis] = await Promise.all([
        runFullCompetitorAnalysis(allCampaigns, cookieHeader, baseUrl).catch(() => ({
          userProfile: { keywords: [], themes: [], ctaTypes: [], formats: [], platforms: [], topPerformingAds: [], weakAds: [], avgCtr: 0, avgCpc: 0, totalSpend: 0, objectives: [], destinations: [], optimizationGoals: [], biddingStrategies: [], channelTypes: [] },
          competitorAds: [], comparison: { competitorThemes: [], competitorCTAs: [], competitorFormats: [], gaps: [], competitorSummary: '' }, errors: [],
        })),
        Promise.resolve(runStructuralAnalysis(allCampaigns)),
      ])

      // Run SEQUENTIALLY to avoid API rate limits (parallel calls caused one to fail)
      const results: (Awaited<ReturnType<typeof generateFullAutoProposals>> | null)[] = []
      for (const p of platforms) {
        try {
          console.log(`[GenerateAd] Generating for ${p}...`)

          // Faz 2 (additive): platform için baskın campaign type'a uygun
          // kalıcı rakip içgörüsünü prompt'a ek context olarak geçir.
          // Hata olursa sessizce null kalır; mevcut akış değişmez.
          let persistedCompetitorContext: string | null = null
          if (userId) {
            try {
              const platformLower = p === 'Meta' ? 'meta' : 'google'
              const firstActive = allCampaigns.find(
                (c: any) => c.platform === p && (c.status === 'ACTIVE' || c.status === 'ENABLED'),
              )
              const campaignType = firstActive
                ? normalizeCampaignType(firstActive).campaignType
                : null
              persistedCompetitorContext = await buildCompetitorContextForPrompt(
                userId,
                campaignType,
                null,
                { platform: platformLower },
              )
            } catch (e) {
              console.warn('[GenerateAd] persistedCompetitorContext fetch failed (non-fatal):', e)
            }
          }

          // Faz 3: Synthesis Engine — kampanya + doctrine + competitor + diagnosis
          // bilgilerini deterministik tek pakete birleştir. Hata olursa
          // sessizce undefined kalır; adCreator eski path ile devam eder.
          let synthesisPackagesByCampaignId: Record<string, CampaignSynthesisPackage> | undefined
          try {
            const platformCampaigns = allCampaigns.filter(
              (c: any) => c.platform === p && (c.status === 'ACTIVE' || c.status === 'ENABLED'),
            )
            if (platformCampaigns.length > 0) {
              const synth = await buildSynthesisPackagesForCampaigns(platformCampaigns, {
                userId: userId || null,
              })
              synthesisPackagesByCampaignId = synth.packageMap
              console.log(
                `[GenerateAd] ${p} synthesis: ${synth.count} packages, warnings=${synth.warnings.length}`,
              )
            }
          } catch (e) {
            console.warn('[GenerateAd] synthesis build failed (non-fatal):', e)
          }

          // Faz 4: Multi-AI Decision Desk — enabled ise synthesis paketleri üzerinden çalışır.
          // Disabled ise veya hata olursa eski generation path bozulmaz.
          let decisionDeskResultsByCampaignId: Record<string, MultiAiDecisionDeskResult> | undefined
          if (userId && synthesisPackagesByCampaignId && shouldUseDecisionDesk()) {
            decisionDeskResultsByCampaignId = {}
            for (const [campaignId, pkg] of Object.entries(synthesisPackagesByCampaignId)) {
              try {
                const deskResult = await runMultiAiDecisionDesk(
                  { userId, synthesisPackage: pkg, proposalId: null },
                  { timeoutMs: Number(process.env.YOAI_MULTI_AI_TIMEOUT_MS || 45_000) },
                )
                decisionDeskResultsByCampaignId[campaignId] = deskResult
                console.log(
                  `[GenerateAd] MultiAI ${p}/${campaignId}: status=${deskResult.status} judge=${deskResult.judgeDecision ?? 'none'}`,
                )
              } catch (e) {
                console.warn(`[GenerateAd] MultiAI desk failed for ${campaignId} (non-fatal):`, e)
              }
            }
          }

          // Proposal Engine Orchestrator: intent profiles + platform-specific competitor
          // query plans — tek çağrıyla her ikisini de üretir ve diagnostics döner.
          // Hata olursa hem intentProfilesByCampaignId hem
          // competitorQueryPlansByCampaignId boş kalır; adCreator fallback path ile devam eder.
          let intentProfilesByCampaignId: Record<string, CampaignIntentProfile> | undefined
          let competitorQueryPlansByCampaignId: Record<string, CompetitorQueryPlan> | undefined
          try {
            const platformCampaignsForOrchestrator = allCampaigns.filter(
              (c: any) => c.platform === p,
            )
            if (platformCampaignsForOrchestrator.length > 0) {
              const engineCtx = await buildProposalEngineContext({
                userId: userId || null,
                platform: p,
                platformCampaigns: platformCampaignsForOrchestrator,
                businessKeywords,
              })
              intentProfilesByCampaignId = engineCtx.intentProfilesByCampaignId
              competitorQueryPlansByCampaignId = engineCtx.competitorQueryPlansByCampaignId
              engineDiagnosticsMap[p] = engineCtx.diagnostics
            }
          } catch (e) {
            console.warn('[GenerateAd] orchestrator failed (non-fatal):', e)
          }

          // competitorAnalysis.competitorAds sadece Meta Ad Library'den gelir.
          // Meta için Meta reklamları; Google için DB'den platform='google' filtresiyle ayrıca çek.
          let platformCompetitorAds: CompetitorAd[] = []
          let platformComparison = competitorAnalysis.comparison

          if (p === 'Meta') {
            platformCompetitorAds = competitorAnalysis.competitorAds
          } else if (p === 'Google' && userId) {
            try {
              const googleRows = await listCompetitorAds(userId, {
                platform: 'google',
                active_only: false,
                limit: 50,
              })
              if (googleRows.length > 0) {
                platformCompetitorAds = googleRows.map((row) => ({
                  id: row.id,
                  pageName: row.advertiser_page_name || '',
                  pageId: row.source_page_id || '',
                  body: row.ad_body || '',
                  title: row.ad_title || '',
                  description: row.ad_description || '',
                  startDate: row.ad_delivery_start_time || '',
                  platforms: row.publisher_platforms || [],
                  isActive: row.is_active,
                }))
                platformComparison = compareWithCompetitors(competitorAnalysis.userProfile, platformCompetitorAds)
                console.log(`[GenerateAd] Google: ${platformCompetitorAds.length} competitor ads from DB`)
              } else {
                console.log('[GenerateAd] Google: no competitor ads in DB — competitor context empty')
              }
            } catch (e) {
              console.warn('[GenerateAd] Google competitor ads DB fetch failed (non-fatal):', e)
            }
          }

          const result = await generateFullAutoProposals(
            p,
            competitorAnalysis.userProfile,
            platformComparison,
            platformCompetitorAds,
            allCampaigns,
            structuralAnalysis.issues,
            persistedCompetitorContext,
            synthesisPackagesByCampaignId,
            decisionDeskResultsByCampaignId,
            intentProfilesByCampaignId,
            competitorQueryPlansByCampaignId,
            businessContextPromptBlock,
          )
          console.log(`[GenerateAd] ${p}: ${result.proposals.length} proposals, aiGenerated: ${result.aiGenerated}`)
          results.push(result)
        } catch (e) {
          console.error(`[GenerateAd] ${p} failed:`, e)
          results.push(null)
        }
      }

      const proposals: any[] = []
      const fitAnalyses: any[] = []
      const debugInfo: any[] = []

      // Aggregate engine diagnostics across all platforms
      const engineDiagnostics = {
        intentProfilesUsed: 0,
        lowConfidenceIntentCount: 0,
        competitorQueryPlansUsed: 0,
        queryPlanConfidenceLow: 0,
        policyRejectedCount: 0,
        policyReviewRequiredCount: 0,
        fallbackUsed: false,
        byPlatform: engineDiagnosticsMap,
      }

      for (const r of results) {
        if (!r) continue
        proposals.push(...r.proposals)
        fitAnalyses.push(...r.fitAnalyses)
        if ((r as any)._debug) {
          const d = (r as any)._debug
          debugInfo.push(d)
          engineDiagnostics.policyRejectedCount += d.policyRejectedCount ?? 0
          engineDiagnostics.policyReviewRequiredCount += d.policyReviewRequiredCount ?? 0
        }
      }

      for (const diag of Object.values(engineDiagnosticsMap)) {
        engineDiagnostics.intentProfilesUsed += diag.intentProfilesBuilt
        engineDiagnostics.lowConfidenceIntentCount += diag.lowConfidenceIntentCount
        engineDiagnostics.competitorQueryPlansUsed += diag.competitorQueryPlansBuilt
        engineDiagnostics.queryPlanConfidenceLow += diag.queryPlanConfidenceLow
        if (diag.fallbackUsed) engineDiagnostics.fallbackUsed = true
      }

      return { proposals, fitAnalyses, debugInfo, engineDiagnostics }
    }

    // 1. Persisted veri varsa her zaman dön (kısmi bile olsa).
    //    Sayfa yenilendiğinde yeniden tarama tetiklenmemesi için kritik.
    //    Kullanıcı tam yeniden üretim isterse forceGenerate=true gönderir.
    if (!forceGenerate && userId) {
      const run = await getBestAvailableRun(userId)
      let shouldGenerateLive = false

      if (run?.ad_proposals_data?.proposals) {
        const rawPersisted = run.ad_proposals_data.proposals as any[]
        let persistedProposals = rawPersisted.map(sanitizeProposalForDisplay)
        if (persistedProposals.length > 0) {
          const persistedFitAnalyses = (run.ad_proposals_data.fitAnalyses || []) as any[]

          // Approval queue mapping: eksik proposal_id'leri pending olarak ekle.
          // Mevcut (rejected/hold/published vb.) kayıtlar dokunulmaz.
          try {
            await bulkInsertPendingApprovalsIfMissing(
              userId,
              persistedProposals as FullAdProposal[],
              null,
            )
          } catch (e) {
            console.warn('[GenerateAd] approvals upsert (persisted) failed (non-fatal):', e)
          }

          // Merkezi filtre: expired + policyRejected + generic content
          // filterVisibleYoaiProposals ile UI ve API aynı kuralı uygular.
          const beforeFilter = persistedProposals.length
          try {
            const expiredApprovals = await listApprovals(userId, { status: 'expired', limit: 500 })
            const expiredIds = expiredApprovals.length > 0
              ? new Set(expiredApprovals.map((a: { proposal_id: string }) => a.proposal_id))
              : undefined
            persistedProposals = filterVisibleYoaiProposals(persistedProposals as any, { expiredIds }) as any[]
            const removed = beforeFilter - persistedProposals.length
            if (removed > 0) console.log(`[GenerateAd] Visibility filter: removed ${removed} stale/generic/rejected proposals`)
          } catch (e) {
            console.warn('[GenerateAd] visibility filter non-fatal:', e)
          }

          if (persistedProposals.length > 0) {
            const metaCount = persistedProposals.filter((p: any) => p.platform === 'Meta').length
            const googleCount = persistedProposals.filter((p: any) => p.platform === 'Google').length
            console.log(`[GenerateAd] Returning persisted (Meta: ${metaCount}, Google: ${googleCount})`)

            return NextResponse.json({
              ok: true,
              data: {
                proposals: persistedProposals,
                fitAnalyses: persistedFitAnalyses,
                summary: {
                  ...(run.ad_proposals_data.summary || {}),
                  metaCount,
                  googleCount,
                  proposalsGenerated: persistedProposals.length,
                },
                diagnoses: run.ad_proposals_data.diagnoses || [],
                decisions: run.ad_proposals_data.decisions || [],
              },
              persisted: true,
              run_date: run.run_date,
            })
          }

          // Tüm kayıtlı öneriler stale cleanup sonrası filtrelendi → canlı üretim başlat.
          if (beforeFilter > 0) {
            shouldGenerateLive = true
            console.log('[GenerateAd] All persisted proposals filtered after stale cleanup; triggering live generation...')
          }
        }
      }

      // Edge case: run var ama proposals boş (null / [] ) VE run önceki günden kalma
      // → live generation tetikle (stale run hiç öneri üretememişse yenile)
      if (!shouldGenerateLive && run && run.run_date < getTurkeyDate()) {
        const stored = run.ad_proposals_data?.proposals
        const hasNoProposals = !stored || (Array.isArray(stored) && (stored as unknown[]).length === 0)
        if (hasNoProposals) {
          shouldGenerateLive = true
          console.log(`[GenerateAd] Stale run (${run.run_date}) has no proposals; triggering live generation...`)
        }
      }

      if (!shouldGenerateLive) {
        // Persisted yok — boş veri dön. Live üretimi sadece forceGenerate ile çalıştır.
        console.log('[GenerateAd] No persisted data; returning empty (forceGenerate=false).')
        return NextResponse.json({
          ok: true,
          data: { proposals: [], fitAnalyses: [], summary: { totalCampaignsAnalyzed: 0, criticalIssues: 0, opportunities: 0, proposalsGenerated: 0, metaCount: 0, googleCount: 0 }, diagnoses: [], decisions: [] },
          persisted: false,
          empty: true,
        })
      }
      // shouldGenerateLive: stale cleanup sonrası tüm öneri filtrelendi; canlı üretim başlatılıyor.
    }

    // 2. Full live generation — ONLY when forceGenerate=true
    const [metaResult, googleResult] = await fetchBothPlatforms()
    console.log(`[GenerateAd] Live: Meta: ${metaResult.campaigns.length} campaigns, Google: ${googleResult.campaigns.length} campaigns`)
    const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]

    if (allCampaigns.length === 0) {
      return NextResponse.json({ ok: false, error: 'Analiz edilecek kampanya bulunamadı' }, { status: 404 })
    }

    // Use connected flag — generateFullAutoProposals handles 0 campaigns gracefully
    const effectivePlatforms: Platform[] = []
    if (metaResult.connected) effectivePlatforms.push('Meta')
    if (googleResult.connected) effectivePlatforms.push('Google')
    console.log(`[GenerateAd] Effective platforms: ${effectivePlatforms.join(', ')} (Meta: ${metaResult.campaigns.length} campaigns, Google: ${googleResult.campaigns.length} campaigns)`)

    const { proposals: allProposals, fitAnalyses: allFitAnalyses, debugInfo: platformDebug, engineDiagnostics } = await generateForPlatforms(effectivePlatforms, allCampaigns)

    const metaCount = allProposals.filter((p: any) => p.platform === 'Meta').length
    const googleCount = allProposals.filter((p: any) => p.platform === 'Google').length
    // totalCampaignsAnalyzed = only ACTIVE campaigns that were actually analyzed (from fitAnalyses)
    const totalSummary = {
      totalCampaignsAnalyzed: allFitAnalyses.length,
      criticalIssues: allFitAnalyses.filter((fa: any) => fa.fitScore < 40).length,
      opportunities: allFitAnalyses.filter((fa: any) => fa.weaknesses?.length > 0).length,
      proposalsGenerated: allProposals.length,
      metaCount,
      googleCount,
    }

    // ── Diagnosis + Decision (sadece Meta için, mevcut akışı bozmaz) ──
    let diagnoses: any[] = []
    let decisions: any[] = []
    try {
      diagnoses = diagnoseCampaigns(allCampaigns)
      decisions = decideForDiagnoses(diagnoses)
      console.log(`[GenerateAd] Diagnosed ${diagnoses.length} Meta campaigns`)
    } catch (e) {
      console.warn('[GenerateAd] Diagnosis failed (non-fatal):', e)
    }

    console.log(`[GenerateAd] Total: ${allProposals.length} proposals (Meta: ${metaCount}, Google: ${googleCount})`)

    // Persist live-generated results so they survive page refresh
    if (userId && allProposals.length > 0) {
      try {
        await upsertDailyRun({
          user_id: userId,
          run_date: getTurkeyDate(),
          status: 'completed',
          command_center_data: null,
          ad_proposals_data: { proposals: allProposals, fitAnalyses: allFitAnalyses, summary: totalSummary, diagnoses, decisions },
        })
        console.log(`[GenerateAd] Persisted ${allProposals.length} proposals to daily run store`)
      } catch (e) {
        console.error('[GenerateAd] Persist error:', e)
      }

      // Approval queue mapping: yeni proposal'lar için pending kayıt oluştur.
      try {
        const approvalRes = await bulkInsertPendingApprovalsIfMissing(
          userId,
          allProposals as FullAdProposal[],
          null,
        )
        console.log(
          `[GenerateAd] Approvals upsert: inserted=${approvalRes.inserted} skipped=${approvalRes.skipped}`,
        )
      } catch (e) {
        console.warn('[GenerateAd] approvals upsert (live) failed (non-fatal):', e)
      }
    }

    return NextResponse.json({
      ok: true,
      data: { proposals: allProposals, fitAnalyses: allFitAnalyses, summary: totalSummary, diagnoses, decisions },
      persisted: false,
      engineDiagnostics,
      _debug: {
        metaCampaigns: metaResult.campaigns.length,
        metaConnected: metaResult.connected,
        googleCampaigns: googleResult.campaigns.length,
        googleConnected: googleResult.connected,
        effectivePlatforms,
        platformResults: platformDebug,
      },
    })
  } catch (error) {
    console.error('[Generate Ad] Error:', error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' }, { status: 500 })
  }
}
