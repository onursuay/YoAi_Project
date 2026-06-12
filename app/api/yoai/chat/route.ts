import { buildGenerationPrompt } from '@/lib/yoai/prompts'
import { type ContentCategory, COST_PER_CHAT } from '@/lib/yoai/types'
import { claudeStream, isClaudeReady } from '@/lib/anthropic/text'
import { chargeFeature } from '@/lib/billing/featureGuard'

// nodejs runtime: kredi/abonelik guard'ı server-only Supabase istemcisini kullanır.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // Sunucu-taraflı kimlik + abonelik + kredi guard — istemci atlanamaz.
    const access = await chargeFeature({
      featureKey: 'yoalgoritma_chat',
      creditCost: COST_PER_CHAT,
      requireSubscription: true,
    })
    if (!access.ok) return Response.json(access.body, { status: access.status })

    const { category, params } = (await req.json()) as {
      category: Exclude<ContentCategory, 'off_topic'>
      params: Record<string, string>
    }

    if (!category || !params) {
      if (access.ok) await access.refund() // erken çıkış → krediyi geri ver
      return Response.json({ error: 'Kategori ve parametreler gerekli' }, { status: 400 })
    }

    if (!isClaudeReady()) {
      if (access.ok) await access.refund()
      return Response.json({ error: 'AI servisi yapılandırılmamış' }, { status: 500 })
    }

    const systemPrompt = buildGenerationPrompt(category, params)

    // Claude akışı — istemci kontratı: data: {content} ... data: [DONE]
    const stream = claudeStream({
      system: systemPrompt,
      user: 'İçeriği oluştur.',
      maxTokens: 4000,
      temperature: 0.6,
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[YoAi Chat] Unexpected error:', err)
    return Response.json({ error: 'Beklenmeyen bir hata oluştu' }, { status: 500 })
  }
}
