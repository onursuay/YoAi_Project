/**
 * Build normalized audience dataset from raw Google Ads API response.
 * Produces browse tree + search index with Turkish labels.
 * Uses static translations only (no OpenAI at build time).
 */

import { translateAudienceName, SEARCH_KEYWORDS_TR_TO_EN } from '@/lib/google-ads/audience-translations'
import type { AudienceSegment } from '@/lib/google-ads/audience-segments'
import type {
  AudienceBrowseNode,
  AudienceBrowseTree,
  AudienceDataset,
  AudienceSearchItem,
} from '@/lib/audience/types'
import { buildAliases, normalizeText } from '@/lib/audience/normalize'

type RawBrowseData = {
  affinity: AudienceSegment[]
  inMarket: AudienceSegment[]
  detailedDemographics: AudienceSegment[]
  lifeEvents: AudienceSegment[]
  userLists: AudienceSegment[]
  customAudiences: AudienceSegment[]
  combinedAudiences: AudienceSegment[]
}

/** Convert raw segment to compact browse node */
function toBrowseNode(s: AudienceSegment, locale: 'tr'): AudienceBrowseNode {
  const name = locale === 'tr' ? translateAudienceName(s.name, locale) : s.name
  return {
    id: s.id,
    n: name,
    c: s.category,
    r: s.resourceName,
    p: s.parentId,
  }
}

/** Get Turkish keywords that map to this segment (reverse of SEARCH_KEYWORDS) */
function getSynonymsForSegment(nameEn: string, nameTr: string): string[] {
  const lowerEn = nameEn.toLowerCase()
  const lowerTr = nameTr.toLowerCase()
  const terms: string[] = [nameEn, nameTr]
  for (const [trKw, enTerms] of Object.entries(SEARCH_KEYWORDS_TR_TO_EN)) {
    const enMatches = enTerms.some(e => lowerEn.includes(e))
    const trMatches = lowerTr.includes(trKw) || trKw.includes(lowerTr)
    if (enMatches || trMatches) terms.push(trKw)
  }
  return terms
}

/** Build search index item from segment */
function toSearchItem(
  s: AudienceSegment,
  nameTr: string,
  path: string[],
  selectable: boolean
): AudienceSearchItem {
  const synonyms = getSynonymsForSegment(s.name, nameTr)
  const aliases = buildAliases({
    nameEn: s.name,
    nameTr,
    path,
    knownSynonyms: synonyms,
  })
  const normalizedAliases = aliases.map(normalizeText).filter(Boolean)
  return {
    id: s.id,
    parentId: s.parentId,
    type: 'segment',
    nameEn: s.name,
    nameTr,
    aliases,
    normalizedAliases,
    path,
    selectable,
    category: s.category,
    resourceName: s.resourceName,
  }
}

/** Build full dataset from raw Google Ads response */
export function buildAudienceDataset(raw: RawBrowseData, locale: 'tr' = 'tr'): AudienceDataset {
  const tree: AudienceBrowseTree = {
    affinity: raw.affinity.map(s => toBrowseNode(s, locale)),
    inMarket: raw.inMarket.map(s => toBrowseNode(s, locale)),
    detailedDemographics: raw.detailedDemographics.map(s => toBrowseNode(s, locale)),
    lifeEvents: raw.lifeEvents.map(s => toBrowseNode(s, locale)),
    userLists: raw.userLists.map(s => toBrowseNode(s, locale)),
    customAudiences: raw.customAudiences.map(s => toBrowseNode(s, locale)),
    combinedAudiences: raw.combinedAudiences.map(s => toBrowseNode(s, locale)),
  }

  const searchIndex: AudienceSearchItem[] = []
  const allRaw: AudienceSegment[] = [
    ...raw.affinity,
    ...raw.inMarket,
    ...raw.detailedDemographics,
    ...raw.lifeEvents,
    ...raw.userLists,
    ...raw.customAudiences,
    ...raw.combinedAudiences,
  ]

  for (const seg of allRaw) {
    const nameTr = locale === 'tr' ? translateAudienceName(seg.name, locale) : seg.name
    searchIndex.push(toSearchItem(seg, nameTr, [nameTr], true))
  }

  const totalNodes =
    tree.affinity.length +
    tree.inMarket.length +
    tree.detailedDemographics.length +
    tree.lifeEvents.length +
    tree.userLists.length +
    tree.customAudiences.length +
    tree.combinedAudiences.length

  const totalSearchTerms = searchIndex.reduce((sum, i) => sum + i.normalizedAliases.length, 0)

  return {
    version: Date.now().toString(36),
    updatedAt: new Date().toISOString(),
    locale: 'tr',
    browseTree: tree,
    searchIndex,
    stats: { totalNodes, totalSearchTerms },
  }
}

/**
 * Per-customer segment'leri (user_list / custom_audience / combined_audience)
 * browse node + search item formatına çevirir.
 * Cache'e yazılmaz; her request'te çağıran kullanıcının verisinden canlı üretilir.
 */
export function buildPerCustomerAddenda(
  segments: { userLists: AudienceSegment[]; customAudiences: AudienceSegment[]; combinedAudiences: AudienceSegment[] },
  locale: 'tr' = 'tr'
): {
  userListsNodes: AudienceBrowseNode[]
  customAudiencesNodes: AudienceBrowseNode[]
  combinedAudiencesNodes: AudienceBrowseNode[]
  searchItems: AudienceSearchItem[]
} {
  const userListsNodes = segments.userLists.map(s => toBrowseNode(s, locale))
  const customAudiencesNodes = segments.customAudiences.map(s => toBrowseNode(s, locale))
  const combinedAudiencesNodes = segments.combinedAudiences.map(s => toBrowseNode(s, locale))

  const searchItems: AudienceSearchItem[] = []
  for (const seg of [...segments.userLists, ...segments.customAudiences, ...segments.combinedAudiences]) {
    const nameTr = locale === 'tr' ? translateAudienceName(seg.name, locale) : seg.name
    searchItems.push(toSearchItem(seg, nameTr, [nameTr], true))
  }

  return { userListsNodes, customAudiencesNodes, combinedAudiencesNodes, searchItems }
}
