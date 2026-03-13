'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: 24 }}>
          <h2>Kritik hata</h2>
          <p>Uygulama genelinde bir hata oluştu. Sayfayı yenileyin.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #ccc',
              cursor: 'pointer',
            }}
          >
            Yenile
          </button>
        </div>
      </body>
    </html>
  );
}
