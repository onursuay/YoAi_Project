'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import { Image, Video, Loader2, Sparkles, Download, Coins, Upload, RefreshCw } from 'lucide-react'

const COST_PER_GENERATION = 20

type Mode = 'gorsel' | 'video'
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3'

interface GeneratedItem {
  id: string
  url: string
  type: 'gorsel' | 'video'
  prompt: string
  ratio: AspectRatio
  createdAt: Date
}

const SAMPLE_GALLERY: GeneratedItem[] = [
  { id: '1', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop', type: 'gorsel', prompt: 'Spor ayakkabı', ratio: '1:1', createdAt: new Date() },
  { id: '2', url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=400&fit=crop', type: 'gorsel', prompt: 'Parfüm şişesi', ratio: '1:1', createdAt: new Date() },
  { id: '3', url: 'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=400&h=400&fit=crop', type: 'gorsel', prompt: 'Nike ayakkabı', ratio: '1:1', createdAt: new Date() },
  { id: '4', url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=400&fit=crop', type: 'gorsel', prompt: 'Kırmızı elbise', ratio: '1:1', createdAt: new Date() },
  { id: '5', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop', type: 'gorsel', prompt: 'Burger', ratio: '1:1', createdAt: new Date() },
  { id: '6', url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop', type: 'gorsel', prompt: 'Çanta', ratio: '1:1', createdAt: new Date() },
]

export default function TasarimGorselPage() {
  const t = useTranslations('dashboard.tasarim')
  const [mode, setMode] = useState<Mode>('gorsel')
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [ratio, setRatio] = useState<AspectRatio>('1:1')
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [credits, setCredits] = useState(100)
  const [gallery, setGallery] = useState<GeneratedItem[]>(SAMPLE_GALLERY)
  const [activeItem, setActiveItem] = useState<GeneratedItem | null>(SAMPLE_GALLERY[0])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    if (credits < COST_PER_GENERATION) return

    setIsGenerating(true)
    setCredits(prev => prev - COST_PER_GENERATION)

    // Mock generation - replace with real API call
    await new Promise(r => setTimeout(r, 2500))

    const newItem: GeneratedItem = {
      id: Date.now().toString(),
      url: `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000000000)}?w=800&h=800&fit=crop`,
      type: mode,
      prompt,
      ratio,
      createdAt: new Date(),
    }

    // Fallback to a known image for demo
    newItem.url = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=800&fit=crop'

    setGallery(prev => [newItem, ...prev])
    setActiveItem(newItem)
    setIsGenerating(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setReferenceImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <>
      <Topbar title={t('title')} description={t('description')} />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="flex h-full">
          {/* Left Panel */}
          <div className="w-[320px] shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
            {/* Mode Toggle */}
            <div className="cardPad border-b border-gray-100">
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('gorsel')}
                  className={`flex-1 flex items-center justify-center gap-2 chip-h rounded-lg text-ui font-medium transition-colors ${
                    mode === 'gorsel' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Image className="w-4 h-4" />
                  Görsel Üret
                </button>
                <button
                  onClick={() => setMode('video')}
                  className={`flex-1 flex items-center justify-center gap-2 chip-h rounded-lg text-ui font-medium transition-colors ${
                    mode === 'video' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  Video Üret
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 cardPad space-y-4">
              {/* Prompt */}
              <div>
                <label className="block text-ui font-medium text-gray-700 mb-1">
                  Prompt Yaz <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={mode === 'gorsel'
                    ? "Yeşil bir park, spor ayakkabı, 'Şimdi Satın Al' butonu, beyaz arkaplan..."
                    : "Ürünün farklı açılardan gösterildiği dinamik bir video..."
                  }
                  className="w-full px-3 input-h border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none min-h-[100px] py-3"
                  rows={5}
                />
              </div>

              {/* Reference Image - only for gorsel */}
              {mode === 'gorsel' && (
                <div>
                  <label className="block text-ui font-medium text-gray-700 mb-1">Görsel Ekle</label>
                  <label className="flex items-center gap-2 px-3 input-h border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <Upload className="w-4 h-4 text-gray-400" />
                    <span className="text-ui text-gray-500">
                      {referenceImage ? 'Görsel seçildi ✓' : 'Ürün Görseli'}
                    </span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                  </label>
                </div>
              )}

              {/* Aspect Ratio */}
              <div>
                <label className="block text-ui font-medium text-gray-700 mb-1">
                  {mode === 'gorsel' ? 'En / Boy Oranı' : 'En / Boy Oranı'}
                </label>
                <div className="flex gap-2">
                  {(['16:9', '9:16', '4:3', '1:1'] as AspectRatio[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setRatio(r)}
                      className={`flex-1 chip-h flex items-center justify-center text-ui rounded-lg border transition-colors ${
                        ratio === r
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title - only for gorsel */}
              {mode === 'gorsel' && (
                <>
                  <div>
                    <label className="block text-ui font-medium text-gray-700 mb-1">
                      Başlık <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Başlık"
                      className="w-full px-3 input-h border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <p className="text-caption text-gray-400 text-right mt-1">{title.length} / 300</p>
                  </div>
                  <div>
                    <label className="block text-ui font-medium text-gray-700 mb-1">Slogan</label>
                    <input
                      type="text"
                      placeholder="--"
                      className="w-full px-3 input-h border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Generate Button */}
            <div className="cardPad border-t border-gray-100 space-y-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim() || credits < COST_PER_GENERATION}
                className="w-full btn-h bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Oluşturuluyor...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {mode === 'gorsel' ? 'Görsel Oluştur' : 'Video Oluştur'}
                  </>
                )}
              </button>
              <p className="text-caption text-center text-gray-400">
                Üretilen her {mode === 'gorsel' ? 'görsel' : 'video'} için {COST_PER_GENERATION} kredi kullanılmaktadır.
              </p>
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar with tabs + credits */}
            <div className="bg-white border-b border-gray-200 cardPad flex items-center justify-between">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button className="px-4 chip-h text-ui font-medium text-gray-900 bg-white rounded-md shadow-sm">
                  Tasarım
                </button>
                <button className="px-4 chip-h text-ui font-medium text-gray-500 hover:text-gray-700">
                  Kütüphane
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 chip-h px-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="text-ui font-medium text-amber-700">{credits} Kredi</span>
                </div>
                <button className="btn-h-sm px-3 text-ui font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
                  Kredi Yükle
                </button>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Preview */}
              <div className="flex-1 p-6 flex flex-col items-center justify-center bg-gray-50">
                {activeItem ? (
                  <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
                    <div className="relative bg-white rounded-xl overflow-hidden shadow-lg w-full aspect-square max-h-[500px]">
                      {isGenerating ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                          <div className="text-center">
                            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
                            <p className="text-ui text-gray-600">Oluşturuluyor...</p>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={activeItem.url}
                          alt={activeItem.prompt}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <p className="text-ui font-medium text-gray-900">
                          {activeItem.prompt.slice(0, 40) || 'Adsız Tasarım'}
                        </p>
                        <p className="text-caption text-gray-400">{activeItem.ratio}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Henüz oluşturulmuş tasarım yok</p>
                    <p className="text-ui text-gray-400 mt-1">Sol paneli doldurup oluştur butonuna bas</p>
                  </div>
                )}
              </div>

              {/* Gallery sidebar */}
              <div className="w-[280px] shrink-0 border-l border-gray-200 bg-white overflow-y-auto cardPad">
                <p className="text-caption font-medium text-gray-500 mb-3 px-1">SON TASARIMLAR</p>
                <div className="grid grid-cols-2 gap-2">
                  {gallery.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setActiveItem(item)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                        activeItem?.id === item.id ? 'border-primary' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={item.url}
                        alt={item.prompt}
                        className="w-full h-full object-cover"
                      />
                      {item.type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Video className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
