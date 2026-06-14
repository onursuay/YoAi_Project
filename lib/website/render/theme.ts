import type { CSSProperties } from 'react'
import type { ThemeTokens } from '../types'

/** Üretilen site için varsayılan tema — jenerik Tailwind mavi/indigo DEĞİL. */
export const DEFAULT_SITE_THEME: Required<Pick<ThemeTokens, 'primaryColor'>> &
  Pick<ThemeTokens, 'secondaryColor' | 'fontHeading' | 'fontBody' | 'logoUrl'> = {
  primaryColor: '#0f172a', // ink (slate-900)
  secondaryColor: '#0f766e', // accent (teal-700) — markasız varsayılan, ayırt edici
  fontHeading: "'Playfair Display', Georgia, serif",
  fontBody: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  logoUrl: null,
}

/** Tema tokenlarını CSS değişkenlerine çevirir (renderer kökünde inline uygulanır). */
export function themeToCssVars(theme: ThemeTokens | null | undefined): CSSProperties {
  const t: Partial<ThemeTokens> = theme ?? {}
  const ink = t.primaryColor || DEFAULT_SITE_THEME.primaryColor
  const accent = t.secondaryColor || DEFAULT_SITE_THEME.secondaryColor || ink
  return {
    ['--site-ink' as string]: ink,
    ['--site-accent' as string]: accent,
    ['--site-font-heading' as string]: t.fontHeading || DEFAULT_SITE_THEME.fontHeading,
    ['--site-font-body' as string]: t.fontBody || DEFAULT_SITE_THEME.fontBody,
  }
}
