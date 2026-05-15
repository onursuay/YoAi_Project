/**
 * Başvuru Durumu — onaylanmamış kullanıcının görebileceği TEK sayfa.
 *
 * Sidebar, dashboard kabuğu ve diğer iç panel layout'ları YOK. Kullanıcı bu
 * ekranda yalnızca:
 *   - başvurusunun durumunu görür,
 *   - 30 dakikalık ön görüşme planlar veya
 *   - "şimdilik planlamak istemiyorum" der.
 * Owner onayı sonrası bu ekran kalkar ve normal `/dashboard`'a yönlenir.
 */
export default function BasvuruDurumuLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-screen bg-[#060609] text-white">{children}</div>
}
