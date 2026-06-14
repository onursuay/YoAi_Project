import type { CSSProperties } from 'react'
import type { WebsitePage, ThemeTokens } from '../types'
import { themeToCssVars } from './theme'
import { renderSection } from './sections'

interface SiteRendererProps {
  page: WebsitePage
  theme: ThemeTokens | null | undefined
  /** Önizleme kapsayıcısında kullanım için ek stil (örn. ölçek). */
  style?: CSSProperties
}

/** Tek bir sayfa modelini tema uygulayarak render eder. Saf sunum (server+client). */
export default function SiteRenderer({ page, theme, style }: SiteRendererProps) {
  return (
    <div
      style={{ ...themeToCssVars(theme), fontFamily: 'var(--site-font-body)', ...style }}
      className="bg-white text-black antialiased"
    >
      {page.sections.map((block, i) => renderSection(block, i))}
    </div>
  )
}
