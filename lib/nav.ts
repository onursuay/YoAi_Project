import {
  LayoutDashboard,
  Target,
  TrendingUp,
  Sparkles,
  Users,
  Image,
  FileText,
  Package,
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
    href: '/dashboard/raporlar',
    icon: FileText,
  },
  {
    id: 'katalog',
    label: 'Katalog',
    href: '/dashboard/katalog',
    icon: Package,
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
    href: '/dashboard/entegrasyon',
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
        href: '/privacy-policy',
        icon: FileText,
      },
      {
        id: 'veri-silme',
        label: 'Veri Silme',
        href: '/data-deletion',
        icon: FileText,
      },
      {
        id: 'kullanim-sartlari',
        label: 'Kullanım Şartları',
        href: '/terms',
        icon: FileText,
      },
    ],
  },
]

