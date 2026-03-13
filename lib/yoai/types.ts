export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export type ChatPhase = 'idle' | 'detecting' | 'options' | 'generating' | 'done' | 'error'

export type ContentCategory =
  | 'seo_article'
  | 'ad_copy'
  | 'social_media'
  | 'email_marketing'
  | 'product_description'
  | 'landing_page'
  | 'slogan'
  | 'off_topic'

export interface OptionsField {
  id: string
  label: string
  type: 'text' | 'select'
  options?: string[]
  default?: string
  required?: boolean
  placeholder?: string
}

export interface CategoryConfig {
  id: ContentCategory
  label: string
  fields: OptionsField[]
}

export const COST_PER_CHAT = 5 // placeholder — henüz netleşmedi
