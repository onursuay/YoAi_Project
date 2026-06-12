import {
  LayoutDashboard,
  Target,
  TrendingUp,
  Sparkles,
  Users,
  Image,
  FileText,
  Search,
  Puzzle,
  Building2,
  ShieldCheck,
  Briefcase,
  WandSparkles,
  Contact,
  Mail,
} from 'lucide-react'
import { ROUTES } from '@/lib/routes'

export interface NavItem {
  id: string
  label: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  iconPath?: string
  badge?: string
  disabled?: boolean
  children?: NavItem[]
}

export const navItems: NavItem[] = [
  {
    id: 'reklam',
    label: 'Reklam',
    icon: LayoutDashboard,
    children: [
      {
        id: 'meta',
        label: 'Meta',
        href: ROUTES.META_ADS,
        icon: LayoutDashboard,
        iconPath: '/platform-icons/meta.svg',
      },
      {
        id: 'google',
        label: 'Google',
        href: ROUTES.GOOGLE_ADS,
        icon: LayoutDashboard,
        iconPath: '/platform-icons/google-ads.svg',
      },
      {
        id: 'tiktok',
        label: 'TikTok',
        href: ROUTES.TIKTOK_ADS,
        icon: LayoutDashboard,
        iconPath: '/platform-icons/tiktok.svg',
        disabled: true,
      },
    ],
  },
  {
    id: 'strateji',
    label: 'Strateji',
    href: '/strateji',
    icon: Target,
  },
  {
    id: 'optimizasyon',
    label: 'Optimizasyon',
    href: '/optimizasyon',
    icon: TrendingUp,
  },
  {
    id: 'yoai',
    label: 'YoAi',
    href: '/yoalgoritma',
    icon: Sparkles,
  },
  {
    id: 'hedef-kitle',
    label: 'Hedef Kitle',
    href: '/hedef-kitle',
    icon: Users,
  },
  {
    id: 'tasarim',
    label: 'Tasarım',
    href: '/tasarim',
    icon: Image,
  },
  {
    id: 'raporlar',
    label: 'Raporlar',
    href: '/raporlar',
    icon: FileText,
  },
  {
    id: 'seo',
    label: 'SEO Plus',
    href: '/seo-plus',
    icon: Search,
  },
  {
    id: 'crm',
    label: 'CRM',
    href: ROUTES.CRM,
    icon: Contact,
  },
  {
    id: 'email-marketing',
    label: 'Email Marketing',
    href: ROUTES.EMAIL_MARKETING,
    icon: Mail,
  },
  {
    id: 'entegrasyon',
    label: 'Entegrasyon',
    href: '/entegrasyon',
    icon: Puzzle,
  },
]

/**
 * Gözetim Merkezi menü öğesi — yalnızca yetkili oturum için sidebar'a
 * eklenir. `navItems` içine konmaz; client tarafında dinamik enjekte edilir.
 * UI etiketi her zaman "Gözetim Merkezi" — locale dosyalarına ihtiyaç yoktur.
 */
export const gozetimMerkeziNavItem: NavItem = {
  id: 'gozetim-merkezi',
  label: 'Gözetim Merkezi',
  href: '/gozetim-merkezi',
  icon: ShieldCheck,
}

/**
 * Dönüşüm Sihirbazı (route: donusum-sihirbazi) — rollout sırasında gizli. `navItems` içine konmaz;
 * yalnız owner veya `MARKETING_SETUP_ENABLED` açıkken client tarafında dinamik
 * enjekte edilir (Gözetim Merkezi ile aynı desen). UI etiketi sidebar.marketingkurulumu.
 */
export const marketingSetupNavItem: NavItem = {
  id: 'donusum-sihirbazi',
  label: 'Dönüşüm Sihirbazı',
  href: ROUTES.MARKETING_SETUP,
  icon: WandSparkles,
}

