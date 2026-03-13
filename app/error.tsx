'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ padding: 24 }}>
      <h2>Bir hata oluştu</h2>
      <p>Sayfa yüklenirken beklenmeyen bir problem oluştu. Tekrar deneyin.</p>
      <button
        onClick={() => reset()}
        style={{
          marginTop: 12,
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid #ccc',
          cursor: 'pointer',
        }}
      >
        Tekrar dene
      </button>
    </div>
  );
}
