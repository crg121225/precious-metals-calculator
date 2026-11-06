'use client';

// One menu across the top of every page, so the three tools feel like one app.
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Calculator' },
  { href: '/price-sheet', label: 'Price Sheet' },
  { href: '/showcase', label: 'Showcase' },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md print:hidden"
    >
      <div className="mx-auto flex max-w-7xl gap-1 px-3 py-2 md:px-6">
        {ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 rounded-full px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.15em] sm:flex-none ${
                active
                  ? 'bg-amber-600/90 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
