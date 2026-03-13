/**
 * Meta capabilities — inventory-derived gating for wizard options.
 * Single source for "has pixels", "has lead forms", etc.
 */

export interface MetaCapabilityPage {
  page_id: string
  name: string
  picture?: string
  lead_terms_accepted: boolean | null
  has_messaging: boolean
  has_whatsapp: boolean
}

export interface MetaCapabilityPixel {
  pixel_id: string
  name: string
}

export interface MetaCapabilityLeadForm {
  form_id: string
  name: string
  status: string
}

export interface MetaCapabilityCatalog {
  catalog_id: string
  name: string
}

export interface MetaCapabilityProductSet {
  product_set_id: string
  name: string
}

export interface MetaCapabilities {
  /** Pages (with lead_terms_accepted, has_messaging, has_whatsapp) */
  pages: MetaCapabilityPage[]
  /** IG business accounts linked to pages */
  igAccounts: { ig_id: string; username: string; profile_picture_url?: string; connected_page_id?: string }[]
  /** Pixels for conversion/website flows */
  pixels: MetaCapabilityPixel[]
  /** Events per pixel id */
  pixelEventsByPixelId: Record<string, string[]>
  /** Lead forms per page id (ACTIVE only) */
  leadFormsByPageId: Record<string, MetaCapabilityLeadForm[]>
  /** Apps for app install / app promotion */
  apps: { app_id: string; name?: string }[]
  /** Catalogs for sales DPA */
  catalogs: MetaCapabilityCatalog[]
  /** Product sets per catalog id */
  productSetsByCatalogId: Record<string, MetaCapabilityProductSet[]>
  /** WhatsApp available per page id (derived from page.has_whatsapp) */
  whatsappAvailabilityByPageId: Record<string, boolean>
  /** Messenger available per page id */
  messagingAvailabilityByPageId: Record<string, boolean>

  // Gating booleans (derived)
  hasPages: boolean
  hasPixels: boolean
  hasLeadForms: boolean
  hasApps: boolean
  hasCatalogs: boolean
  hasIgAccounts: boolean
}

export const emptyCapabilities: MetaCapabilities = {
  pages: [],
  igAccounts: [],
  pixels: [],
  pixelEventsByPixelId: {},
  leadFormsByPageId: {},
  apps: [],
  catalogs: [],
  productSetsByCatalogId: {},
  whatsappAvailabilityByPageId: {},
  messagingAvailabilityByPageId: {},
  hasPages: false,
  hasPixels: false,
  hasLeadForms: false,
  hasApps: false,
  hasCatalogs: false,
  hasIgAccounts: false,
}
