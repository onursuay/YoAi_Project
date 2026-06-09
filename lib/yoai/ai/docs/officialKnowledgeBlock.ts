/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Onaylı Resmi Bilgi Bloğu (Alt-Proje B, analiz enjeksiyonu)

   official_ads_knowledge_items'taki ONAYLI bilgiyi analiz prompt'larına
   (systemPrompt / perCampaignPrompt) ephemeral-cache'li system bloğu olarak
   enjekte eder. Onaylı item yoksa / tablo yoksa null → blok eklenmez (empty-safe).

   adCreator + proposalPolicyGuard zaten bu store'u kullanıyordu; bu modül
   aynı onaylı bilgiyi ANALİZ tarafına da ulaştırarak yüzeyleri birleştirir.
   ────────────────────────────────────────────────────────── */

import type { OfficialAdsKnowledgeItem } from '../../officialAdsKnowledgeStore'

export type SystemBlock = { type: 'text'; text: string; cache_control: { type: 'ephemeral' } }

const MAX_ITEMS = 60
const MAX_BLOCK_CHARS = 12_000

/** Onaylı item listesini kompakt, AI-okunur metne çevirir (saf fonksiyon). */
export function renderOfficialKnowledge(items: OfficialAdsKnowledgeItem[]): string {
  if (!items.length) return ''
  const lines = items.slice(0, MAX_ITEMS).map((i) => {
    let line = `- [${i.category}] ${i.title}`
    if (i.summary) line += `: ${i.summary}`
    return line
  })
  const body = lines.join('\n').slice(0, MAX_BLOCK_CHARS)
  return [
    '# GÜNCEL ONAYLI RESMİ BİLGİ',
    'Aşağıdaki maddeler resmi Meta/Google dokümanlarından çıkarılıp onaylanmıştır.',
    'Çelişki olursa bu güncel onaylı bilgiyi diğer kaynaklara TERCİH ET.',
    '',
    body,
  ].join('\n')
}

export interface KnowledgeBlockDeps {
  load?: (platform: 'google' | 'meta') => Promise<OfficialAdsKnowledgeItem[]>
}

/**
 * Platforma ait onaylı bilgi bloğunu üretir; yoksa null.
 * Default loader lazy dynamic import ile store'u yükler (test DI'de yüklenmez).
 */
export async function officialKnowledgeBlock(
  platform: 'Meta' | 'Google',
  deps: KnowledgeBlockDeps = {},
): Promise<SystemBlock | null> {
  const load =
    deps.load ??
    (async (p: 'google' | 'meta') => {
      const mod = await import('../../officialAdsKnowledgeStore')
      return mod.getApprovedKnowledgeByPlatform(p)
    })
  try {
    const p = platform === 'Meta' ? 'meta' : 'google'
    const items = await load(p)
    const text = renderOfficialKnowledge(items)
    if (!text) return null
    return { type: 'text', text, cache_control: { type: 'ephemeral' } }
  } catch {
    return null
  }
}
