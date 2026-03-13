import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export const locales = ['tr', 'en'] as const
export type Locale = (typeof locales)[number]

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'

  return {
    locale,
    messages: (await import(`./locales/${locale}.json`)).default
  }
})
