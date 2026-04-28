/**
 * Google Drive Picker helper — kullanıcı Drive'ından görsel seçer, File döndürür.
 * İş akışı: GIS token → Picker → Drive API files.get?alt=media → Blob → File
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWin = Window & { gapi?: any; google?: any }

interface PickerConfig {
  configured: boolean
  apiKey?: string
  clientId?: string
  appId?: string
}

let cachedConfig: PickerConfig | null = null
let scriptPromises: { gapi?: Promise<void>; gis?: Promise<void> } = {}

async function loadScript(src: string, check: () => boolean): Promise<void> {
  if (check()) return
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (check()) return resolve()
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`failed to load ${src}`)), { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`failed to load ${src}`))
    document.head.appendChild(s)
  })
}

async function getConfig(): Promise<PickerConfig> {
  if (cachedConfig) return cachedConfig
  const res = await fetch('/api/integrations/google-ads/assets/picker-config')
  const json = (await res.json()) as PickerConfig
  cachedConfig = json
  return json
}

async function loadGapiPicker(): Promise<void> {
  const w = window as AnyWin
  if (!scriptPromises.gapi) {
    scriptPromises.gapi = loadScript('https://apis.google.com/js/api.js', () => !!w.gapi)
  }
  await scriptPromises.gapi
  if (!w.gapi?.picker) {
    await new Promise<void>((resolve, reject) => {
      w.gapi.load('picker', { callback: () => resolve(), onerror: () => reject(new Error('gapi picker load failed')) })
    })
  }
}

async function loadGis(): Promise<void> {
  const w = window as AnyWin
  if (!scriptPromises.gis) {
    scriptPromises.gis = loadScript('https://accounts.google.com/gsi/client', () => !!w.google?.accounts?.oauth2)
  }
  await scriptPromises.gis
}

async function requestAccessToken(clientId: string): Promise<string> {
  const w = window as AnyWin
  return new Promise((resolve, reject) => {
    const tokenClient = w.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback: (resp: any) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error))
          return
        }
        resolve(resp.access_token as string)
      },
    })
    try {
      tokenClient.requestAccessToken({ prompt: '' })
    } catch (e) {
      reject(e instanceof Error ? e : new Error('token request failed'))
    }
  })
}

interface PickedFile {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
}

async function openPicker(
  apiKey: string,
  appId: string,
  accessToken: string,
  locale: 'tr' | 'en',
): Promise<PickedFile | null> {
  const w = window as AnyWin
  return new Promise((resolve, reject) => {
    try {
      const view = new w.google.picker.DocsView(w.google.picker.ViewId.DOCS_IMAGES)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
      const picker = new w.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setLocale(locale === 'tr' ? 'tr' : 'en')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .setCallback((data: any) => {
          if (data.action === w.google.picker.Action.PICKED) {
            const doc = data.docs?.[0]
            if (!doc) return resolve(null)
            resolve({
              id: doc.id,
              name: doc.name ?? 'drive_asset',
              mimeType: doc.mimeType ?? '',
              sizeBytes: Number(doc.sizeBytes ?? 0),
            })
          } else if (data.action === w.google.picker.Action.CANCEL) {
            resolve(null)
          }
        })
        .build()
      picker.setVisible(true)
    } catch (e) {
      reject(e instanceof Error ? e : new Error('picker failed'))
    }
  })
}

async function downloadDriveFile(fileId: string, accessToken: string): Promise<Blob> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`drive download failed ${res.status}`)
  return await res.blob()
}

/**
 * Google Drive Picker'ı açar, seçilen görseli File nesnesi olarak döndürür.
 * Kullanıcı cancel ederse null döner.
 */
export async function pickImageFromGoogleDrive(
  locale: 'tr' | 'en' = 'tr',
): Promise<File | null> {
  const cfg = await getConfig()
  if (!cfg.configured || !cfg.apiKey || !cfg.clientId || !cfg.appId) {
    throw new Error(locale === 'tr' ? 'Google Drive yapılandırılmamış' : 'Google Drive is not configured')
  }
  await Promise.all([loadGapiPicker(), loadGis()])
  const accessToken = await requestAccessToken(cfg.clientId)
  const picked = await openPicker(cfg.apiKey, cfg.appId, accessToken, locale)
  if (!picked) return null
  if (!picked.mimeType.startsWith('image/')) {
    throw new Error(locale === 'tr' ? 'Yalnızca resim dosyaları seçilebilir' : 'Only image files can be selected')
  }
  const blob = await downloadDriveFile(picked.id, accessToken)
  return new File([blob], picked.name, { type: blob.type || picked.mimeType })
}

export async function isGoogleDriveConfigured(): Promise<boolean> {
  const cfg = await getConfig()
  return cfg.configured === true
}
