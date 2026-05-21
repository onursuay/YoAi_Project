import { redirect } from 'next/navigation'

// Bu route eski bir mock (sahte Unsplash görselleri + sahte kredi) idi.
// Gerçek tasarım stüdyosu /tasarim'de yaşıyor (gerçek fal.ai üretimi + gerçek kredi).
// Sahte sayfa kaldırıldı; URL gerçek sayfaya yönlendirilir.
export default function TasarimGorselRedirect() {
  redirect('/tasarim')
}
