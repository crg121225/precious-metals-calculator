'use client';

// Showcase cards keep their photos and settings in this browser, so the page only runs in the browser.
import dynamic from 'next/dynamic';

const Showcase = dynamic(() => import('./Showcase'), {
  ssr: false,
  loading: () => <p className="p-8 text-sm text-slate-500">Loading showcase cards…</p>,
});

export default function ShowcaseLoader() {
  return <Showcase />;
}
