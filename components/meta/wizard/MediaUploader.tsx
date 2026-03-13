'use client'

import { useCallback, useState } from 'react'
import { getLocaleFromCookie, getWizardTranslations } from '@/lib/i18n/wizardTranslations'
import MediaLibraryModal from './MediaLibraryModal'

async function compressImage(file: File, maxSizeMB = 3): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      const maxDim = 1920
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      let quality = 0.85
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return }
          if (blob.size / 1024 / 1024 > maxSizeMB && quality > 0.3) {
            quality -= 0.1
            tryCompress()
          } else {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          }
        }, 'image/jpeg', quality)
      }
      tryCompress()
    }
    img.onerror = () => resolve(file)
    img.src = url
  })
}

export interface MediaUploadResult {
  hash?: string
  videoId?: string
}

interface MediaUploaderProps {
  accept?: string
  maxSizeMB?: number
  preview?: string
  onFileSelect: (file: File | null, preview: string, extra?: MediaUploadResult) => void
  label?: string
  type: 'image' | 'video'
}

export default function MediaUploader({
  accept = 'image/*',
  maxSizeMB = 30,
  preview = '',
  onFileSelect,
  label,
  type,
}: MediaUploaderProps) {
  const t = getWizardTranslations(getLocaleFromCookie())
  const resolvedLabel = label ?? (type === 'video' ? t.uploadVideo : t.uploadImage)

  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showLibrary, setShowLibrary] = useState(false)

  if (type === 'video') {
    accept = 'video/mp4,video/quicktime'
    // Vercel 4.5MB body limit - video max 4MB
    maxSizeMB = 4 * 1024
  }
  const maxBytes = maxSizeMB * 1024 * 1024

  const uploadMedia = useCallback(
    async (file: File) => {
      setError('')
      setUploading(true)
      setUploadProgress(0)

      const isVideo = file.type.startsWith('video/')
      const compressedFile = isVideo ? file : await compressImage(file)

      try {
        if (isVideo) {
          // Video: dogrudan Meta Graph API'ye yukle (Vercel 4.5MB limitini bypass et)
          const tokenRes = await fetch('/api/meta/upload-token')
          if (!tokenRes.ok) {
            setError('Meta bağlantısı kurulamadı')
            onFileSelect(null, '')
            return
          }
          const { accessToken, accountId } = await tokenRes.json()

          const metaFormData = new FormData()
          metaFormData.append('source', compressedFile, file.name)
          metaFormData.append('title', file.name)
          metaFormData.append('access_token', accessToken)

          const metaRes = await fetch(
            `https://graph.facebook.com/v21.0/${accountId}/advideos`,
            { method: 'POST', body: metaFormData }
          )
          const metaData = await metaRes.json()
          setUploadProgress(100)

          if (metaData.id) {
            const previewUrl = URL.createObjectURL(file)
            onFileSelect(file, previewUrl, { videoId: metaData.id })
          } else {
            const msg = metaData.error?.error_user_msg || metaData.error?.message || t.uploadFailed
            setError(msg)
            onFileSelect(null, '')
          }
        } else {
          // Gorsel: mevcut proxy route'u kullan
          const formData = new FormData()
          formData.append('file', compressedFile)
          formData.append('type', 'image')

          const res = await fetch('/api/meta/upload-media', { method: 'POST', body: formData })
          if (res.status === 413) {
            setError('Görsel çok büyük. Maksimum 30MB olmalıdır.')
            onFileSelect(null, '')
            return
          }
          const data = await res.json()
          setUploadProgress(100)

          if (data.ok) {
            const previewUrl = URL.createObjectURL(file)
            onFileSelect(file, previewUrl, { hash: data.hash })
          } else {
            setError(data.message || t.uploadFailed)
            onFileSelect(null, '')
          }
        }
      } catch {
        setError(t.connectionError)
        onFileSelect(null, '')
      } finally {
        setUploading(false)
      }
    },
    [onFileSelect, t.uploadFailed, t.connectionError]
  )

  const handleFile = useCallback(
    (file: File | null) => {
      setError('')
      if (!file) {
        onFileSelect(null, '')
        return
      }
      if (file.size > maxBytes) {
        setError(`Maksimum boyut: ${type === 'video' ? '4GB' : `${maxSizeMB}MB`}`)
        return
      }
      uploadMedia(file)
    },
    [maxBytes, type, maxSizeMB, uploadMedia]
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    handleFile(file ?? null)
  }

  const handleLibrarySelect = (item: { hash?: string; videoId?: string; url: string }) => {
    // For library items, use the URL as preview and pass hash/videoId
    onFileSelect(null, item.url, { hash: item.hash, videoId: item.videoId })
    setShowLibrary(false)
  }

  return (
    <div>
      <MediaLibraryModal
        isOpen={showLibrary}
        onClose={() => setShowLibrary(false)}
        type={type}
        onSelect={handleLibrarySelect}
      />
      <label className="block text-sm font-semibold text-gray-700 mb-1">{resolvedLabel}</label>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary'
        } ${uploading ? 'opacity-70 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          accept={accept}
          onChange={onInputChange}
          className="hidden"
          id="media-upload"
          disabled={uploading}
        />
        {uploading && (
          <div className="space-y-2">
            <p className="text-sm text-primary">{t.uploading}</p>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden max-w-xs mx-auto">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
        {!uploading && preview ? (
          <div className="relative group">
            {type === 'image' ? (
              <img src={preview} alt={t.previewAlt} className="max-h-48 mx-auto rounded object-contain" />
            ) : (
              <video src={preview} controls className="max-h-48 mx-auto rounded" />
            )}
            <div className="flex items-center justify-center gap-2 mt-3">
              <label
                htmlFor="media-upload"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t.editMedia || (getLocaleFromCookie() === 'tr' ? 'Düzenle' : 'Edit')}
              </label>
              <button
                type="button"
                onClick={() => handleFile(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50 transition-colors"
                title={t.removeMedia}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                {t.deleteMedia || (getLocaleFromCookie() === 'tr' ? 'Sil' : 'Delete')}
              </button>
            </div>
          </div>
        ) : null}
        {!uploading && !preview ? (
          <div className="space-y-4">
            <label htmlFor="media-upload" className="cursor-pointer block">
              <p className="text-sm text-gray-600">
                {t.dragAndDrop} <span className="text-primary font-medium">{t.selectFile}</span>
              </p>
              <p className="text-caption text-gray-500 mt-1">
                {type === 'video'
                  ? t.maxSizeVideo
                  : `${t.maxSizeImagePrefix} ${maxSizeMB}${t.maxSizeImageSuffix}`}
              </p>
            </label>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-500">{t.or}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowLibrary(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {type === 'image' ? t.selectFromImageLibrary : t.selectFromVideoLibrary}
            </button>
          </div>
        ) : null}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
