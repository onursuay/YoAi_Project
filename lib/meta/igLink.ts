/**
 * Builds an Instagram DM deep link for INSTAGRAM_DIRECT ad creatives.
 * No network calls — pure string helper.
 *
 * Priority: username (ig.me/m/<username>) → instagramUserId fallback (ig.me/m/<id>)
 * Both forms are accepted by Meta as valid link_data.link values for IG Direct creatives.
 */
export function buildIgDmLink(input: {
  username?: string | null
  instagramUserId: string
}): string {
  if (input.username) {
    return `https://ig.me/m/${input.username}`
  }
  return `https://ig.me/m/${input.instagramUserId}`
}
