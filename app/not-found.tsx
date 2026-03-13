import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Sayfa bulunamadı (404)</h2>
      <p>Aradığınız sayfa taşınmış veya silinmiş olabilir.</p>
      <Link href="/" style={{ display: 'inline-block', marginTop: 12 }}>
        Ana sayfaya dön
      </Link>
    </div>
  );
}
