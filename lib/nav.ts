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
  Building2
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
        href: '#',
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
    badge: 'AI',
  },
  {
    id: 'optimizasyon',
    label: 'Optimizasyon',
    href: '/optimizasyon',
    icon: TrendingUp,
    badge: 'AI',
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
    badge: 'AI',
  },
  {
    id: 'tasarim',
    label: 'Tasarım',
    href: '/tasarim',
    icon: Image,
    badge: 'AI',
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
  {
    id: 'kurumsal',
    label: 'Kurumsal',
    icon: Building2,
    children: [
      {
        id: 'gizlilik-politikasi',
        label: 'Gizlilik Politikası',
        href: '/gizlilik-politikasi',
        icon: FileText,
      },
      {
        id: 'cerez-politikasi',
        label: 'Çerez Politikası',
        href: '/cerez-politikasi',
        icon: FileText,
      },
      {
        id: 'kullanim-kosullari',
        label: 'Kullanım Koşulları',
        href: '/kullanim-kosullari',
        icon: FileText,
      },
      {
        id: 'veri-silme',
        label: 'Veri Silme',
        href: '/veri-silme',
        icon: FileText,
      },
    ],
  },
]

