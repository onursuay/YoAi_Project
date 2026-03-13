/**
 * Unified Meta configuration
 * Centralizes Graph API version and related constants
 */

export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v24.0";

export const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_OAUTH_BASE_URL = `https://www.facebook.com/${META_GRAPH_VERSION}`;

/** Single source for Meta OAuth scopes (CTWA, Lead Forms, Lead Retrieval, Website, Instagram) */
export const META_SCOPES = [
  "ads_read",
  "ads_management",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_ads",
  "leads_retrieval",
  "pages_manage_metadata",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_messages",
  "pages_manage_posts",
  "whatsapp_business_management",
  "whatsapp_business_messaging",
].join(",");
