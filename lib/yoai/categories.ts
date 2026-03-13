import type { CategoryConfig, ContentCategory } from './types'

export const CATEGORIES: Record<Exclude<ContentCategory, 'off_topic'>, CategoryConfig> = {
  seo_article: {
    id: 'seo_article',
    label: 'SEO Makale Oluştur',
    fields: [
      {
        id: 'keyword',
        label: 'Anahtar Kelime',
        type: 'text',
        required: true,
        placeholder: 'Örn: dijital pazarlama',
      },
      {
        id: 'wordCount',
        label: 'Kelime Sayısı',
        type: 'select',
        options: ['300', '400', '500', '600'],
        default: '500',
      },
      {
        id: 'tone',
        label: 'Ton',
        type: 'select',
        options: ['Resmi', 'Samimi', 'Teknik', 'Eğitici'],
        default: 'Samimi',
      },
    ],
  },

  ad_copy: {
    id: 'ad_copy',
    label: 'Reklam Metni Oluştur',
    fields: [
      {
        id: 'product',
        label: 'Ürün/Hizmet',
        type: 'text',
        required: true,
        placeholder: 'Örn: Online yoga kursu',
      },
      {
        id: 'platform',
        label: 'Platform',
        type: 'select',
        options: ['Meta', 'Google Ads', 'TikTok'],
        default: 'Meta',
      },
      {
        id: 'audience',
        label: 'Hedef Kitle',
        type: 'select',
        options: ['Gençler (18-25)', 'Yetişkinler (25-45)', 'İş Dünyası', 'Genel'],
        default: 'Genel',
      },
      {
        id: 'tone',
        label: 'Ton',
        type: 'select',
        options: ['Profesyonel', 'Samimi', 'Agresif', 'Eğlenceli'],
        default: 'Profesyonel',
      },
    ],
  },

  social_media: {
    id: 'social_media',
    label: 'Sosyal Medya İçeriği Oluştur',
    fields: [
      {
        id: 'topic',
        label: 'Konu',
        type: 'text',
        required: true,
        placeholder: 'Örn: Yeni ürün lansmanı',
      },
      {
        id: 'platform',
        label: 'Platform',
        type: 'select',
        options: ['Instagram', 'Facebook', 'LinkedIn', 'Twitter/X'],
        default: 'Instagram',
      },
      {
        id: 'tone',
        label: 'Ton',
        type: 'select',
        options: ['Samimi', 'Profesyonel', 'Eğlenceli', 'İlham Verici'],
        default: 'Samimi',
      },
    ],
  },

  email_marketing: {
    id: 'email_marketing',
    label: 'E-posta İçeriği Oluştur',
    fields: [
      {
        id: 'product',
        label: 'Ürün/Hizmet',
        type: 'text',
        required: true,
        placeholder: 'Örn: %30 indirim kampanyası',
      },
      {
        id: 'purpose',
        label: 'Amaç',
        type: 'select',
        options: ['Promosyon', 'Bilgilendirme', 'Hoş Geldin', 'Geri Kazanım'],
        default: 'Promosyon',
      },
      {
        id: 'tone',
        label: 'Ton',
        type: 'select',
        options: ['Resmi', 'Samimi'],
        default: 'Samimi',
      },
    ],
  },

  product_description: {
    id: 'product_description',
    label: 'Ürün Açıklaması Oluştur',
    fields: [
      {
        id: 'product',
        label: 'Ürün Adı ve Özellikleri',
        type: 'text',
        required: true,
        placeholder: 'Örn: Kablosuz bluetooth kulaklık, 40 saat pil ömrü',
      },
      {
        id: 'platform',
        label: 'Platform',
        type: 'select',
        options: ['E-ticaret', 'Sosyal Medya', 'Genel'],
        default: 'E-ticaret',
      },
      {
        id: 'length',
        label: 'Uzunluk',
        type: 'select',
        options: ['Kısa', 'Orta', 'Detaylı'],
        default: 'Orta',
      },
    ],
  },

  landing_page: {
    id: 'landing_page',
    label: 'Landing Page Metni Oluştur',
    fields: [
      {
        id: 'product',
        label: 'Hizmet/Ürün',
        type: 'text',
        required: true,
        placeholder: 'Örn: SaaS proje yönetim aracı',
      },
      {
        id: 'action',
        label: 'Hedef Aksiyon',
        type: 'select',
        options: ['Satın Al', 'Kayıt Ol', 'İletişime Geç', 'İndir'],
        default: 'Satın Al',
      },
      {
        id: 'tone',
        label: 'Ton',
        type: 'select',
        options: ['Profesyonel', 'Samimi', 'Acil'],
        default: 'Profesyonel',
      },
    ],
  },

  slogan: {
    id: 'slogan',
    label: 'Slogan / Marka Mesajı Oluştur',
    fields: [
      {
        id: 'brand',
        label: 'Marka Adı',
        type: 'text',
        required: true,
        placeholder: 'Örn: TechFlow',
      },
      {
        id: 'sector',
        label: 'Sektör',
        type: 'text',
        required: true,
        placeholder: 'Örn: Teknoloji / E-ticaret',
      },
      {
        id: 'tone',
        label: 'Ton',
        type: 'select',
        options: ['Modern', 'Klasik', 'Eğlenceli', 'Profesyonel'],
        default: 'Modern',
      },
    ],
  },
}
