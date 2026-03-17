/**
 * Shared types for Google Ads Audience dataset (Edge Config-backed).
 * Browse tab: tree structure. Search tab: flat index with aliases.
 */

export type AudienceSegmentCategory =
  | 'AFFINITY'
  | 'IN_MARKET'
  | 'DETAILED_DEMOGRAPHIC'
  | 'LIFE_EVENT'
  | 'USER_LIST'
  | 'CUSTOM_AUDIENCE'
  | 'COMBINED_AUDIENCE'

/** Node for browse tree — compact for Edge Config size limits */
export interface AudienceBrowseNode {
  id: string
  n: string
  c: AudienceSegmentCategory
  r: string
  p?: string
}

/** Full browse tree — matches current UI structure */
export interface AudienceBrowseTree {
  affinity: AudienceBrowseNode[]
  inMarket: AudienceBrowseNode[]
  detailedDemographics: AudienceBrowseNode[]
  lifeEvents: AudienceBrowseNode[]
  userLists: AudienceBrowseNode[]
  customAudiences: AudienceBrowseNode[]
  combinedAudiences: AudienceBrowseNode[]
}

/** Search index item — normalized for local matching */
export interface AudienceSearchItem {
  id: string
  parentId?: string
  type: 'category' | 'segment'
  nameEn: string
  nameTr: string
  aliases: string[]
  normalizedAliases: string[]
  path: string[]
  selectable: boolean
  category: AudienceSegmentCategory
  resourceName: string
}

/** Full dataset stored in Edge Config (single key) */
export interface AudienceDataset {
  version: string
  updatedAt: string
  locale: 'tr'
  browseTree: AudienceBrowseTree
  searchIndex: AudienceSearchItem[]
  stats: {
    totalNodes: number
    totalSearchTerms: number
  }
}

/** Metadata only — for refresh responses */
export interface AudienceDatasetMeta {
  version: string
  updatedAt: string
  totalNodes: number
  totalSearchTerms: number
}

/** API response for browse */
export interface AudienceBrowseResponse {
  affinity: AudienceItem[]
  inMarket: AudienceItem[]
  detailedDemographics: AudienceItem[]
  lifeEvents: AudienceItem[]
  userLists: AudienceItem[]
  customAudiences: AudienceItem[]
  combinedAudiences: AudienceItem[]
}

/** API response for search */
export interface AudienceSearchResponse {
  results: AudienceItem[]
  state?: 'ok' | 'data_not_ready'
}

/** Expand compact browse node to full UI item */
export function expandNode(node: AudienceBrowseNode): AudienceItem {
  return {
    id: node.id,
    name: node.n,
    category: node.c,
    resourceName: node.r,
    parentId: node.p,
  }
}

/** UI-facing item (matches current modal contract) */
export interface AudienceItem {
  id: string
  name: string
  category: AudienceSegmentCategory
  resourceName: string
  parentId?: string
  subType?: string
  sizeRange?: string
  description?: string
}
