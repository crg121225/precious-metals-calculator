import type { Metadata } from 'next';
import ShowcaseLoader from './ShowcaseLoader';

export const metadata: Metadata = {
  title: 'Showcase Cards',
  description: 'Make a picture card for a showcase piece with the item number, price and in-store rules on it.',
};

export default function ShowcasePage() {
  return <ShowcaseLoader />;
}
