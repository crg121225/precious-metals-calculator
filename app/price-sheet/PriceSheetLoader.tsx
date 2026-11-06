'use client';

// The price sheet reads the owner's saved settings from this browser, so it only runs in the browser.
import dynamic from 'next/dynamic';

const PriceSheet = dynamic(() => import('./PriceSheet'), {
  ssr: false,
  loading: () => <p className="p-8 text-sm text-slate-500">Loading price sheet…</p>,
});

export default function PriceSheetLoader() {
  return <PriceSheet />;
}
