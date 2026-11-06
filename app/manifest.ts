import type { MetadataRoute } from 'next';

// Lets the owner add the calculator to his phone's home screen and open it like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Precious Metals Pricing Calculator',
    short_name: 'Metals Calc',
    description: 'Melt value, buy offers and the weekly bullion price sheet.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
