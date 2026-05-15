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
    href: '/yoai',
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
    label: 'SEO',
    href: '/seo',
    icon: Search,
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

