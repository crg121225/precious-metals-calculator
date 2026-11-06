import { ImageResponse } from 'next/og';

// App icon (used for the home screen on Android and in the app manifest).
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
          fontSize: 260,
          fontWeight: 800,
          letterSpacing: -10,
        }}
      >
        Au
      </div>
    ),
    size,
  );
}
