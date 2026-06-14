import type { SectionBlock } from '../types'

/**
 * Üretilen sitenin responsive bölüm bileşenleri. Saf sunum (server+client uyumlu, hook yok).
 * Renkler site temasından gelen CSS değişkenleriyle (--site-ink / --site-accent) uygulanır;
 * bu sayede her site kendi markasına göre temalanır, uygulamanın primary'sinden bağımsız.
 */

type Dict = Record<string, unknown>
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const arr = (v: unknown): Dict[] => (Array.isArray(v) ? (v as Dict[]) : [])

/**
 * GÜVENLİK: href/src değerleri AI üretiminden veya kullanıcı girdisinden gelebilir ve
 * PUBLIC sayfada render edilir → `javascript:`/`data:text` gibi şemalar stored-XSS riski taşır.
 * Yalnız güvenli şemalara izin verilir; aksi halde fallback'e düşülür.
 */
const safeHref = (u: unknown, fallback = '#'): string => {
  const s = typeof u === 'string' ? u.trim() : ''
  if (!s) return fallback
  if (s.startsWith('#') || s.startsWith('/')) return s
  try {
    const url = new URL(s)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.toString() : fallback
  } catch {
    return fallback
  }
}
const safeImg = (u: unknown): string => {
  const s = typeof u === 'string' ? u.trim() : ''
  if (!s) return ''
  if (s.startsWith('/')) return s
  if (s.startsWith('data:image/')) return s
  try {
    const url = new URL(s)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

interface NavLink { label: string; href: string }
const navLinks = (v: unknown): NavLink[] =>
  arr(v).map((x) => ({ label: str(x.label), href: safeHref(x.href) })).filter((x) => x.label)

export function HeaderSection({ content }: { content: Dict }) {
  const brand = str(content.brand, 'Marka')
  const logoUrl = safeImg(content.logoUrl)
  const nav = navLinks(content.nav)
  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-white/80 border-b border-black/5">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brand} className="h-8 w-auto object-contain" />
          ) : (
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold"
              style={{ backgroundColor: 'var(--site-ink)' }}
            >
              {brand.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-base font-semibold tracking-tight" style={{ color: 'var(--site-ink)' }}>
            {brand}
          </span>
        </a>
        <nav className="hidden sm:flex items-center gap-7">
          {nav.map((l, i) => (
            <a key={i} href={l.href} className="text-sm text-black/60 hover:text-black transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}

export function HeroSection({ content }: { content: Dict }) {
  const title = str(content.title, 'Başlık')
  const subtitle = str(content.subtitle)
  const ctaLabel = str(content.ctaLabel)
  const ctaHref = safeHref(content.ctaHref, '#contact')
  const imageUrl = safeImg(content.imageUrl)
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          background:
            'radial-gradient(60rem 40rem at 80% -10%, var(--site-accent), transparent 60%), radial-gradient(50rem 40rem at -10% 20%, var(--site-ink), transparent 55%)',
        }}
      />
      {/* Grain/doku — derinlik için ince SVG noise (anti-jenerik) */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.035] pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05]"
            style={{ color: 'var(--site-ink)', fontFamily: 'var(--site-font-heading)', letterSpacing: '-0.03em' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 text-lg text-black/60 max-w-xl" style={{ lineHeight: 1.7 }}>
              {subtitle}
            </p>
          )}
          {ctaLabel && (
            <a
              href={ctaHref}
              className="mt-9 inline-flex items-center rounded-full px-7 py-3.5 text-white text-sm font-medium shadow-lg transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: 'var(--site-ink)', boxShadow: '0 10px 30px -10px var(--site-ink)' }}
            >
              {ctaLabel}
            </a>
          )}
        </div>
        {imageUrl && (
          <div className="relative">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden ring-1 ring-black/5 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function AboutSection({ content }: { content: Dict }) {
  const heading = str(content.heading, 'Hakkımızda')
  const body = str(content.body)
  const imageUrl = safeImg(content.imageUrl)
  return (
    <section id="about" className="py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-center">
        {imageUrl && (
          <div className="aspect-[4/3] rounded-3xl overflow-hidden ring-1 ring-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={heading} className="w-full h-full object-cover" />
          </div>
        )}
        <div>
          <h2
            className="text-3xl sm:text-4xl font-semibold"
            style={{ color: 'var(--site-ink)', fontFamily: 'var(--site-font-heading)', letterSpacing: '-0.02em' }}
          >
            {heading}
          </h2>
          {body && <p className="mt-5 text-black/65" style={{ lineHeight: 1.8 }}>{body}</p>}
        </div>
      </div>
    </section>
  )
}

export function ServicesSection({ content }: { content: Dict }) {
  const heading = str(content.heading, 'Hizmetlerimiz')
  const items = arr(content.items)
  return (
    <section id="services" className="py-20 sm:py-24 bg-black/[0.02]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <h2
          className="text-3xl sm:text-4xl font-semibold text-center"
          style={{ color: 'var(--site-ink)', fontFamily: 'var(--site-font-heading)', letterSpacing: '-0.02em' }}
        >
          {heading}
        </h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white p-7 ring-1 ring-black/5 transition-transform hover:-translate-y-1"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <div className="h-10 w-10 rounded-xl mb-5" style={{ backgroundColor: 'var(--site-accent)', opacity: 0.12 }} />
              <h3 className="text-lg font-semibold" style={{ color: 'var(--site-ink)' }}>{str(it.title)}</h3>
              {str(it.description) && (
                <p className="mt-2.5 text-sm text-black/60" style={{ lineHeight: 1.7 }}>{str(it.description)}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FeaturesSection({ content }: { content: Dict }) {
  const heading = str(content.heading, 'Neden Biz')
  const items = arr(content.items)
  return (
    <section className="py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <h2
          className="text-3xl sm:text-4xl font-semibold"
          style={{ color: 'var(--site-ink)', fontFamily: 'var(--site-font-heading)', letterSpacing: '-0.02em' }}
        >
          {heading}
        </h2>
        <div className="mt-10 grid sm:grid-cols-2 gap-x-12 gap-y-8">
          {items.map((it, i) => (
            <div key={i} className="flex gap-4">
              <div
                className="mt-1 h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: 'var(--site-accent)' }}
              >
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--site-ink)' }}>{str(it.title)}</h3>
                {str(it.description) && (
                  <p className="mt-1.5 text-sm text-black/60" style={{ lineHeight: 1.7 }}>{str(it.description)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ContactSection({ content }: { content: Dict }) {
  const heading = str(content.heading, 'İletişim')
  const body = str(content.body)
  const locations = (Array.isArray(content.locations) ? content.locations : []).map((x) => str(x)).filter(Boolean)
  const links = navLinks(content.links)
  return (
    <section id="contact" className="py-20 sm:py-24" style={{ backgroundColor: 'var(--site-ink)' }}>
      <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center text-white">
        <h2 className="text-3xl sm:text-4xl font-semibold" style={{ fontFamily: 'var(--site-font-heading)', letterSpacing: '-0.02em' }}>
          {heading}
        </h2>
        {body && <p className="mt-5 text-white/70" style={{ lineHeight: 1.8 }}>{body}</p>}
        {locations.length > 0 && (
          <p className="mt-6 text-white/60 text-sm">{locations.join(' · ')}</p>
        )}
        {links.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {links.map((l, i) => (
              <a
                key={i}
                href={l.href}
                className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function FooterSection({ content }: { content: Dict }) {
  const brand = str(content.brand, 'Marka')
  const note = str(content.note)
  return (
    <footer className="py-10 border-t border-black/5">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-black/45">
        <span style={{ color: 'var(--site-ink)' }} className="font-semibold">{brand}</span>
        <span>{note || `© ${brand}`}</span>
      </div>
    </footer>
  )
}

/** Bölüm tipi → bileşen eşlemesi. Bilinmeyen tip sessizce atlanır. */
export function renderSection(block: SectionBlock, key: number) {
  const content = (block.content ?? {}) as Dict
  switch (block.type) {
    case 'header': return <HeaderSection key={key} content={content} />
    case 'hero': return <HeroSection key={key} content={content} />
    case 'about': return <AboutSection key={key} content={content} />
    case 'services': return <ServicesSection key={key} content={content} />
    case 'features': return <FeaturesSection key={key} content={content} />
    case 'contact': return <ContactSection key={key} content={content} />
    case 'footer': return <FooterSection key={key} content={content} />
    default: return null
  }
}
