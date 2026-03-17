/**
 * Minimal dev fallback dataset for local development when Edge Config is not configured.
 * Only activated when NODE_ENV !== 'production' and Edge Config is missing.
 * Must NEVER run in production.
 */

import { normalizeText } from '@/lib/audience/normalize'
import type { AudienceDataset, AudienceBrowseNode, AudienceSearchItem } from '@/lib/audience/types'

const DEV_SAMPLE_NODES: AudienceBrowseNode[] = [
  { id: '1', n: 'Moda Tutkunları', c: 'AFFINITY', r: 'customers/-/userInterests/1' },
  { id: '2', n: 'Otomobil Tutkunları', c: 'AFFINITY', r: 'customers/-/userInterests/2' },
  { id: '3', n: 'Gayrimenkul', c: 'IN_MARKET', r: 'customers/-/userInterests/3' },
  { id: '4', n: 'Ev ve Bahçe', c: 'IN_MARKET', r: 'customers/-/userInterests/4' },
  { id: '5', n: 'Yakın Zamanda Ev Satın Aldı', c: 'LIFE_EVENT', r: 'customers/-/lifeEvents/5' },
]

function devSearchItems(): AudienceSearchItem[] {
  const nameEn = ['Fashion enthusiasts', 'Auto enthusiasts', 'Real estate', 'Home & garden', 'Recently purchased home']
  return DEV_SAMPLE_NODES.map((n, i) => {
    const aliases = [n.n, nameEn[i] ?? n.n]
    return {
      id: n.id,
      parentId: n.p,
      type: 'segment' as const,
      nameEn: nameEn[i] ?? n.n,
      nameTr: n.n,
      aliases,
      normalizedAliases: [...new Set(aliases.map(normalizeText).filter(Boolean))],
      path: [n.n],
      selectable: true,
      category: n.c,
      resourceName: n.r,
    }
  })
}

export function getDevFallbackDataset(): AudienceDataset {
  return {
    version: 'dev-fallback',
    updatedAt: new Date().toISOString(),
    locale: 'tr',
    browseTree: {
      affinity: DEV_SAMPLE_NODES.filter(n => n.c === 'AFFINITY'),
      inMarket: DEV_SAMPLE_NODES.filter(n => n.c === 'IN_MARKET'),
      detailedDemographics: [],
      lifeEvents: DEV_SAMPLE_NODES.filter(n => n.c === 'LIFE_EVENT'),
      userLists: [],
      customAudiences: [],
      combinedAudiences: [],
    },
    searchIndex: devSearchItems(),
    stats: {
      totalNodes: DEV_SAMPLE_NODES.length,
      totalSearchTerms: devSearchItems().reduce((s, i) => s + i.normalizedAliases.length, 0),
    },
  }
}
