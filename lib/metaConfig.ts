/**
 * Unified Meta configuration
 * Centralizes Graph API version and related constants
 */

export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v24.0";

export const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_OAUTH_BASE_URL = `https://www.facebook.com/${META_GRAPH_VERSION}`;

/** Single source for Meta OAuth scopes
 *  Only request scopes that have a real, demonstrable feature in the app.
 *  Each scope must have Advanced Access approval via Meta App Review.
 *
 *  Removed (no active feature / review risk):
 *  - pages_manage_metadata   → leadgen_tos check is non-critical; code handles missing scope gracefully
 *  - instagram_manage_messages → IG Direct ads use ads_management; no DM read/reply feature exists
 */
export const META_SCOPES = [
  "ads_read",
  "ads_management",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_ads",
  "pages_manage_posts",
  "leads_retrieval",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "whatsapp_business_management",
  "whatsapp_business_messaging",
].join(",");
