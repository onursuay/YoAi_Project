/**
 * Shared API response types for audience routes.
 * Used by browse, search, refresh, and error responses.
 */

export interface AudienceDatasetNotReadyResponse {
  data_not_ready: true
  code: 'dataset_not_ready'
  affinity: []
  inMarket: []
  detailedDemographics: []
  lifeEvents: []
  userLists: []
  customAudiences: []
  combinedAudiences: []
  state: 'data_not_ready'
}

export interface AudienceBrowseOkResponse {
  affinity: Array<{ id: string; name: string; category: string; resourceName: string; parentId?: string }>
  inMarket: Array<{ id: string; name: string; category: string; resourceName: string; parentId?: string }>
  detailedDemographics: Array<{ id: string; name: string; category: string; resourceName: string; parentId?: string }>
  lifeEvents: Array<{ id: string; name: string; category: string; resourceName: string; parentId?: string }>
  userLists: Array<{ id: string; name: string; category: string; resourceName: string; parentId?: string }>
  customAudiences: Array<{ id: string; name: string; category: string; resourceName: string; parentId?: string }>
  combinedAudiences: Array<{ id: string; name: string; category: string; resourceName: string; parentId?: string }>
}

export interface AudienceSearchOkResponse {
  results: Array<{ id: string; name: string; category: string; resourceName: string; parentId?: string }>
  state: 'ok'
}

export interface AudienceSearchNotReadyResponse {
  results: []
  state: 'data_not_ready'
  data_not_ready: true
  code: 'dataset_not_ready'
}

export interface AudienceRefreshOkResponse {
  ok: true
  version: string
  updatedAt: string
  stats: { totalNodes: number; totalSearchTerms: number }
  payloadSizeBytes: number
  elapsedMs: number
  storage: 'edge-config'
}

export interface AudienceRefreshErrorResponse {
  ok: false
  code: 'admin_secret_missing' | 'unauthorized' | string
  error?: string
  elapsedMs?: number
}
