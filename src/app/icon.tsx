import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/branding';

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 55%, #14B8A6 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 75% 30%, rgba(255,255,255,0.18), transparent 44%)',
          }}
        />
        <svg viewBox="0 0 64 64" width="26" height="26" style={{ position: 'relative' }}>
          <path
            d="M43 16.8 31.3 35.8a2.5 2.5 0 0 1-3.9.2l-5.1-6.5a2.2 2.2 0 1 0-3.4 2.8l7.1 8.9a6.6 6.6 0 0 0 10.8-.6l10-16.8a2.2 2.2 0 0 0-3.8-2.4Z"
            fill="rgba(8, 12, 28, 0.7)"
          />
          <path
            d="M39.9 11.7 54.1 10a1.5 1.5 0 0 1 1.6 2.2L48.8 26a1.5 1.5 0 0 1-2.8-.3l-1.7-6a1.5 1.5 0 0 0-1.1-1.1l-5.8-1.6a1.5 1.5 0 0 1-.3-2.9Z"
            fill="rgba(226,232,240,0.95)"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: BRAND.colors.frost,
            boxShadow: '0 0 6px rgba(226,232,240,0.8)',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
