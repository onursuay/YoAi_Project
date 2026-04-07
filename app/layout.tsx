import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { cookies } from 'next/headers'
import { CreditProvider } from '@/components/providers/CreditProvider'
import { SubscriptionProvider } from '@/components/providers/SubscriptionProvider'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'optional',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'YoAI Dashboard',
  description: 'Reklam ve pazarlama yönetim platformu',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'
  const messages = await getMessages({ locale })

  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${inter.className} text-body`}>
        <script dangerouslySetInnerHTML={{ __html: `try{var s=localStorage.getItem('sidebar_collapsed');var w=s==='true'?'72px':'260px';document.documentElement.style.setProperty('--sidebar-width',w)}catch(e){}` }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SubscriptionProvider>
            <CreditProvider>
              {children}
            </CreditProvider>
          </SubscriptionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
