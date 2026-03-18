'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Download, Copy, Check, Plus, Trash2,
  ChevronDown, ChevronUp, RotateCcw,
  Bot, Globe, FileCode, Shield,
} from 'lucide-react'

/* ═══════ Types ═══════ */

interface RobotsRule {
  id: string
  userAgent: string
  directive: 'Allow' | 'Disallow'
  path: string
}

interface SitemapUrl {
  id: string
  loc: string
  lastmod: string
  changefreq: string
  priority: string
}

interface HtaccessConfig {
  redirects: { id: string; from: string; to: string }[]
  forceHttps: boolean
  wwwRedirect: 'none' | 'www-to-nonwww' | 'nonwww-to-www'
  xFrameOptions: boolean
  xContentType: boolean
  xXssProtection: boolean
  browserCache: boolean
  gzipCompression: boolean
  error404: string
  error403: string
  error500: string
}

/* ═══════ Helpers ═══════ */

let _idCounter = 0
function uid() { return `_${++_idCounter}_${Date.now()}` }

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* ═══════ Main Component ═══════ */

export default function SeoToolsTab() {
  const t = useTranslations('dashboard.seo.tools')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('description')}</p>
      </div>
      <div className="grid grid-cols-1 gap-6">
        <RobotsTxtGenerator t={t} />
        <SitemapGenerator t={t} />
        <HtaccessGenerator t={t} />
      </div>
    </div>
  )
}

/* ═══════ robots.txt ═══════ */

function RobotsTxtGenerator({ t }: { t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')
  const [rules, setRules] = useState<RobotsRule[]>([
    { id: uid(), userAgent: '*', directive: 'Disallow', path: '/admin/' },
    { id: uid(), userAgent: '*', directive: 'Disallow', path: '/private/' },
    { id: uid(), userAgent: '*', directive: 'Allow', path: '/' },
  ])
  const [sitemapUrl, setSitemapUrl] = useState('')
  const [crawlDelay, setCrawlDelay] = useState('')
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)

  const addRule = () => setRules([...rules, { id: uid(), userAgent: '*', directive: 'Disallow', path: '' }])
  const removeRule = (id: string) => setRules(rules.filter(r => r.id !== id))
  const updateRule = (id: string, field: keyof RobotsRule, value: string) =>
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r))

  const generate = useCallback(() => {
    const groups = new Map<string, RobotsRule[]>()
    for (const r of rules) {
      if (!r.path.trim()) continue
      const key = r.userAgent || '*'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }

    let txt = ''
    for (const [agent, agentRules] of groups) {
      txt += `User-agent: ${agent}\n`
      if (crawlDelay) txt += `Crawl-delay: ${crawlDelay}\n`
      for (const r of agentRules) {
        txt += `${r.directive}: ${r.path}\n`
      }
      txt += '\n'
    }

    const sitemap = sitemapUrl.trim() || (siteUrl.trim() ? `${siteUrl.replace(/\/$/, '')}/sitemap.xml` : '')
    if (sitemap) txt += `Sitemap: ${sitemap}\n`

    setOutput(txt.trim())
  }, [rules, sitemapUrl, siteUrl, crawlDelay])

  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ToolCard
      icon={<Bot className="w-5 h-5 text-blue-600" />}
      title={t('robotsTxt.title')}
      description={t('robotsTxt.description')}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      <div className="space-y-4">
        {/* Site URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('robotsTxt.siteUrl')}</label>
          <input
            type="url"
            value={siteUrl}
            onChange={e => setSiteUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Rules */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('robotsTxt.directive')}</label>
          <div className="space-y-2">
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={rule.userAgent}
                  onChange={e => updateRule(rule.id, 'userAgent', e.target.value)}
                  placeholder={t('robotsTxt.userAgent')}
                  className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <select
                  value={rule.directive}
                  onChange={e => updateRule(rule.id, 'directive', e.target.value as 'Allow' | 'Disallow')}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="Allow">{t('robotsTxt.allow')}</option>
                  <option value="Disallow">{t('robotsTxt.disallow')}</option>
                </select>
                <input
                  type="text"
                  value={rule.path}
                  onChange={e => updateRule(rule.id, 'path', e.target.value)}
                  placeholder={t('robotsTxt.path')}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <button onClick={() => removeRule(rule.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addRule} className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
            <Plus className="w-3.5 h-3.5" /> {t('addRule')}
          </button>
        </div>

        {/* Sitemap & Crawl Delay */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('robotsTxt.sitemapUrl')}</label>
            <input
              type="url"
              value={sitemapUrl}
              onChange={e => setSitemapUrl(e.target.value)}
              placeholder={siteUrl ? `${siteUrl.replace(/\/$/, '')}/sitemap.xml` : 'https://example.com/sitemap.xml'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('robotsTxt.crawlDelay')}</label>
            <input
              type="number"
              min="0"
              value={crawlDelay}
              onChange={e => setCrawlDelay(e.target.value)}
              placeholder="10"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Generate */}
        <div className="flex gap-2">
          <button
            onClick={generate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('generate')}
          </button>
        </div>

        {/* Output */}
        {output && (
          <OutputPreview
            content={output}
            filename="robots.txt"
            copied={copied}
            onCopy={handleCopy}
            onDownload={() => downloadFile(output, 'robots.txt')}
            t={t}
          />
        )}
      </div>
    </ToolCard>
  )
}

/* ═══════ sitemap.xml ═══════ */

function SitemapGenerator({ t }: { t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false)
  const [urls, setUrls] = useState<SitemapUrl[]>([
    { id: uid(), loc: '', lastmod: new Date().toISOString().split('T')[0], changefreq: 'weekly', priority: '1.0' },
  ])
  const [defaultChangefreq, setDefaultChangefreq] = useState('weekly')
  const [defaultPriority, setDefaultPriority] = useState('0.8')
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)

  const addUrl = () => setUrls([...urls, { id: uid(), loc: '', lastmod: new Date().toISOString().split('T')[0], changefreq: defaultChangefreq, priority: defaultPriority }])
  const removeUrl = (id: string) => setUrls(urls.filter(u => u.id !== id))
  const updateUrl = (id: string, field: keyof SitemapUrl, value: string) =>
    setUrls(urls.map(u => u.id === id ? { ...u, [field]: value } : u))

  const changefreqOptions = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']

  const generate = useCallback(() => {
    const validUrls = urls.filter(u => u.loc.trim())
    if (!validUrls.length) return

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    for (const u of validUrls) {
      xml += '  <url>\n'
      xml += `    <loc>${escapeXml(u.loc.trim())}</loc>\n`
      if (u.lastmod) xml += `    <lastmod>${u.lastmod}</lastmod>\n`
      xml += `    <changefreq>${u.changefreq}</changefreq>\n`
      xml += `    <priority>${u.priority}</priority>\n`
      xml += '  </url>\n'
    }

    xml += '</urlset>'
    setOutput(xml)
  }, [urls])

  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ToolCard
      icon={<Globe className="w-5 h-5 text-green-600" />}
      title={t('sitemap.title')}
      description={t('sitemap.description')}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      <div className="space-y-4">
        {/* Default settings */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('sitemap.changefreq')} ({t('sitemap.defaultSettings')})</label>
            <select
              value={defaultChangefreq}
              onChange={e => setDefaultChangefreq(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {changefreqOptions.map(o => (
                <option key={o} value={o}>{t(`sitemap.${o}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('sitemap.priority')} ({t('sitemap.defaultSettings')})</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={defaultPriority}
              onChange={e => setDefaultPriority(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* URL List */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('sitemap.urls')}</label>
          <div className="space-y-2">
            {urls.map(u => (
              <div key={u.id} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <input
                  type="url"
                  value={u.loc}
                  onChange={e => updateUrl(u.id, 'loc', e.target.value)}
                  placeholder={t('sitemap.urlPlaceholder')}
                  className="flex-1 min-w-[200px] px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <input
                  type="date"
                  value={u.lastmod}
                  onChange={e => updateUrl(u.id, 'lastmod', e.target.value)}
                  className="w-36 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <select
                  value={u.changefreq}
                  onChange={e => updateUrl(u.id, 'changefreq', e.target.value)}
                  className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                >
                  {changefreqOptions.map(o => (
                    <option key={o} value={o}>{t(`sitemap.${o}`)}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={u.priority}
                  onChange={e => updateUrl(u.id, 'priority', e.target.value)}
                  className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <button onClick={() => removeUrl(u.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addUrl} className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
            <Plus className="w-3.5 h-3.5" /> {t('addUrl')}
          </button>
        </div>

        {/* Generate */}
        <div className="flex gap-2">
          <button
            onClick={generate}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            {t('generate')}
          </button>
        </div>

        {/* Output */}
        {output && (
          <OutputPreview
            content={output}
            filename="sitemap.xml"
            copied={copied}
            onCopy={handleCopy}
            onDownload={() => downloadFile(output, 'sitemap.xml')}
            t={t}
          />
        )}
      </div>
    </ToolCard>
  )
}

/* ═══════ .htaccess ═══════ */

function HtaccessGenerator({ t }: { t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false)
  const [config, setConfig] = useState<HtaccessConfig>({
    redirects: [{ id: uid(), from: '', to: '' }],
    forceHttps: true,
    wwwRedirect: 'www-to-nonwww',
    xFrameOptions: true,
    xContentType: true,
    xXssProtection: true,
    browserCache: true,
    gzipCompression: true,
    error404: '',
    error403: '',
    error500: '',
  })
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)

  const updateConfig = <K extends keyof HtaccessConfig>(key: K, value: HtaccessConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: value }))

  const addRedirect = () =>
    updateConfig('redirects', [...config.redirects, { id: uid(), from: '', to: '' }])
  const removeRedirect = (id: string) =>
    updateConfig('redirects', config.redirects.filter(r => r.id !== id))
  const updateRedirect = (id: string, field: 'from' | 'to', value: string) =>
    updateConfig('redirects', config.redirects.map(r => r.id === id ? { ...r, [field]: value } : r))

  const generate = useCallback(() => {
    const lines: string[] = []

    // HTTPS redirect
    if (config.forceHttps) {
      lines.push('# Force HTTPS')
      lines.push('RewriteEngine On')
      lines.push('RewriteCond %{HTTPS} off')
      lines.push('RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]')
      lines.push('')
    }

    // www redirect
    if (config.wwwRedirect === 'www-to-nonwww') {
      lines.push('# Redirect www to non-www')
      lines.push('RewriteEngine On')
      lines.push('RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]')
      lines.push('RewriteRule ^(.*)$ https://%1/$1 [L,R=301]')
      lines.push('')
    } else if (config.wwwRedirect === 'nonwww-to-www') {
      lines.push('# Redirect non-www to www')
      lines.push('RewriteEngine On')
      lines.push('RewriteCond %{HTTP_HOST} !^www\\. [NC]')
      lines.push('RewriteRule ^(.*)$ https://www.%{HTTP_HOST}/$1 [L,R=301]')
      lines.push('')
    }

    // Security headers
    if (config.xFrameOptions || config.xContentType || config.xXssProtection) {
      lines.push('# Security Headers')
      lines.push('<IfModule mod_headers.c>')
      if (config.xFrameOptions) lines.push('  Header set X-Frame-Options "SAMEORIGIN"')
      if (config.xContentType) lines.push('  Header set X-Content-Type-Options "nosniff"')
      if (config.xXssProtection) lines.push('  Header set X-XSS-Protection "1; mode=block"')
      lines.push('</IfModule>')
      lines.push('')
    }

    // Browser cache
    if (config.browserCache) {
      lines.push('# Browser Cache')
      lines.push('<IfModule mod_expires.c>')
      lines.push('  ExpiresActive On')
      lines.push('  ExpiresByType image/jpeg "access plus 1 year"')
      lines.push('  ExpiresByType image/png "access plus 1 year"')
      lines.push('  ExpiresByType image/gif "access plus 1 year"')
      lines.push('  ExpiresByType image/svg+xml "access plus 1 year"')
      lines.push('  ExpiresByType image/webp "access plus 1 year"')
      lines.push('  ExpiresByType text/css "access plus 1 month"')
      lines.push('  ExpiresByType application/javascript "access plus 1 month"')
      lines.push('  ExpiresByType application/x-javascript "access plus 1 month"')
      lines.push('  ExpiresByType text/html "access plus 1 hour"')
      lines.push('  ExpiresByType application/pdf "access plus 1 month"')
      lines.push('  ExpiresByType font/woff2 "access plus 1 year"')
      lines.push('  ExpiresByType font/woff "access plus 1 year"')
      lines.push('</IfModule>')
      lines.push('')
    }

    // Gzip compression
    if (config.gzipCompression) {
      lines.push('# Gzip Compression')
      lines.push('<IfModule mod_deflate.c>')
      lines.push('  AddOutputFilterByType DEFLATE text/html')
      lines.push('  AddOutputFilterByType DEFLATE text/css')
      lines.push('  AddOutputFilterByType DEFLATE application/javascript')
      lines.push('  AddOutputFilterByType DEFLATE application/x-javascript')
      lines.push('  AddOutputFilterByType DEFLATE text/xml')
      lines.push('  AddOutputFilterByType DEFLATE application/xml')
      lines.push('  AddOutputFilterByType DEFLATE application/json')
      lines.push('  AddOutputFilterByType DEFLATE image/svg+xml')
      lines.push('  AddOutputFilterByType DEFLATE font/woff2')
      lines.push('</IfModule>')
      lines.push('')
    }

    // 301 Redirects
    const validRedirects = config.redirects.filter(r => r.from.trim() && r.to.trim())
    if (validRedirects.length) {
      lines.push('# 301 Redirects')
      for (const r of validRedirects) {
        lines.push(`Redirect 301 ${r.from.trim()} ${r.to.trim()}`)
      }
      lines.push('')
    }

    // Custom error pages
    const errorPages: [string, string][] = [
      ['404', config.error404],
      ['403', config.error403],
      ['500', config.error500],
    ]
    const validErrors = errorPages.filter(([, path]) => path.trim())
    if (validErrors.length) {
      lines.push('# Custom Error Pages')
      for (const [code, path] of validErrors) {
        lines.push(`ErrorDocument ${code} ${path.trim()}`)
      }
      lines.push('')
    }

    setOutput(lines.join('\n').trim())
  }, [config])

  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ToolCard
      icon={<FileCode className="w-5 h-5 text-orange-600" />}
      title={t('htaccess.title')}
      description={t('htaccess.description')}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      <div className="space-y-5">
        {/* 301 Redirects */}
        <Section title={t('htaccess.redirects')}>
          <div className="space-y-2">
            {config.redirects.map(r => (
              <div key={r.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={r.from}
                  onChange={e => updateRedirect(r.id, 'from', e.target.value)}
                  placeholder={t('htaccess.oldUrl')}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <span className="text-gray-400 text-sm">→</span>
                <input
                  type="text"
                  value={r.to}
                  onChange={e => updateRedirect(r.id, 'to', e.target.value)}
                  placeholder={t('htaccess.newUrl')}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
                <button onClick={() => removeRedirect(r.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addRedirect} className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
            <Plus className="w-3.5 h-3.5" /> {t('addRule')}
          </button>
        </Section>

        {/* HTTPS + www */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Toggle
              label={t('htaccess.forceHttps')}
              description={t('htaccess.forceHttpsDesc')}
              checked={config.forceHttps}
              onChange={v => updateConfig('forceHttps', v)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('htaccess.wwwRedirect')}</label>
            <div className="space-y-1">
              {(['www-to-nonwww', 'nonwww-to-www', 'none'] as const).map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="radio"
                    name="wwwRedirect"
                    checked={config.wwwRedirect === opt}
                    onChange={() => updateConfig('wwwRedirect', opt)}
                    className="text-blue-600"
                  />
                  {opt === 'www-to-nonwww' ? t('htaccess.wwwToNonWww') :
                   opt === 'nonwww-to-www' ? t('htaccess.nonWwwToWww') :
                   t('htaccess.noWwwRedirect')}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Security Headers */}
        <Section title={t('htaccess.securityHeaders')} icon={<Shield className="w-4 h-4" />}>
          <div className="space-y-2">
            <Toggle
              label={t('htaccess.xFrameOptions')}
              checked={config.xFrameOptions}
              onChange={v => updateConfig('xFrameOptions', v)}
            />
            <Toggle
              label={t('htaccess.xContentType')}
              checked={config.xContentType}
              onChange={v => updateConfig('xContentType', v)}
            />
            <Toggle
              label={t('htaccess.xXssProtection')}
              checked={config.xXssProtection}
              onChange={v => updateConfig('xXssProtection', v)}
            />
          </div>
        </Section>

        {/* Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Toggle
            label={t('htaccess.browserCache')}
            description={t('htaccess.browserCacheDesc')}
            checked={config.browserCache}
            onChange={v => updateConfig('browserCache', v)}
          />
          <Toggle
            label={t('htaccess.gzipCompression')}
            description={t('htaccess.gzipDesc')}
            checked={config.gzipCompression}
            onChange={v => updateConfig('gzipCompression', v)}
          />
        </div>

        {/* Custom error pages */}
        <Section title={t('htaccess.errorPages')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('htaccess.error404')}</label>
              <input
                type="text"
                value={config.error404}
                onChange={e => updateConfig('error404', e.target.value)}
                placeholder="/404.html"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('htaccess.error403')}</label>
              <input
                type="text"
                value={config.error403}
                onChange={e => updateConfig('error403', e.target.value)}
                placeholder="/403.html"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('htaccess.error500')}</label>
              <input
                type="text"
                value={config.error500}
                onChange={e => updateConfig('error500', e.target.value)}
                placeholder="/500.html"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        </Section>

        {/* Generate */}
        <div className="flex gap-2">
          <button
            onClick={generate}
            className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
          >
            {t('generate')}
          </button>
          <button
            onClick={() => {
              setConfig({
                redirects: [{ id: uid(), from: '', to: '' }],
                forceHttps: true,
                wwwRedirect: 'www-to-nonwww',
                xFrameOptions: true,
                xContentType: true,
                xXssProtection: true,
                browserCache: true,
                gzipCompression: true,
                error404: '',
                error403: '',
                error500: '',
              })
              setOutput('')
            }}
            className="px-4 py-2 text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {t('reset')}
          </button>
        </div>

        {/* Output */}
        {output && (
          <OutputPreview
            content={output}
            filename=".htaccess"
            copied={copied}
            onCopy={handleCopy}
            onDownload={() => downloadFile(output, '.htaccess')}
            t={t}
          />
        )}
      </div>
    </ToolCard>
  )
}

/* ═══════ Shared UI components ═══════ */

function ToolCard({ icon, title, description, expanded, onToggle, children }: {
  icon: React.ReactNode
  title: string
  description: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          {children}
        </div>
      )}
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <label className="text-sm font-medium text-gray-700">{title}</label>
      </div>
      {children}
    </div>
  )
}

function Toggle({ label, description, checked, onChange }: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="pt-0.5">
        <div
          onClick={() => onChange(!checked)}
          className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
      </div>
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </label>
  )
}

function OutputPreview({ content, filename, copied, onCopy, onDownload, t }: {
  content: string
  filename: string
  copied: boolean
  onCopy: () => void
  onDownload: () => void
  t: (key: string) => string
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-600">{t('preview')}: {filename}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onCopy}
            className="p-1.5 text-gray-500 hover:text-gray-700 rounded"
            title={t('copy')}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            <Download className="w-3 h-3" /> {t('download')}
          </button>
        </div>
      </div>
      <pre className="p-3 text-xs font-mono text-gray-800 bg-gray-50 overflow-x-auto max-h-80 whitespace-pre-wrap">
        {content}
      </pre>
    </div>
  )
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
