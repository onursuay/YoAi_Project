export interface Campaign {
  id: string
  resourceName: string
  name: string
  status: 'ENABLED' | 'PAUSED' | 'REMOVED'
  objective: string
  campaignBudgetResourceName: string
  dailyBudgetMicros: number
  biddingStrategy: string
  startDateTime?: string
  endDateTime?: string
  impressions: number
  clicks: number
  ctr: number
  averageCpc: number
  cost: number
  conversions: number
  roas: number
  optScore?: number
}
