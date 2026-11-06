import { ImageResponse } from 'next/og';

// iPhone home screen icon ("Add to Home Screen" in Safari).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#020617',
          color: '#f59e0b',
          fontSize: 92,
          fontWeight: 800,
          letterSpacing: -4,
        }}
      >
        Au
      </div>
    ),
    size,
  );
}
