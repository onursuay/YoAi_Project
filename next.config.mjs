import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig = {
  productionBrowserSourceMaps: process.env.NEXT_PUBLIC_DEBUG_SOURCEMAPS === '1',
  experimental: {
    turbo: {},
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

export default withNextIntl(nextConfig)
