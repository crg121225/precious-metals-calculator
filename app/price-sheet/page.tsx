import type { Metadata } from 'next';
import PriceSheetLoader from './PriceSheetLoader';

export const metadata: Metadata = {
  title: 'Weekly Bullion Price Sheet',
  description: 'Fill in, print or save the weekly bullion price sheet from your own premiums.',
};

export default function PriceSheetPage() {
  return <PriceSheetLoader />;
}
