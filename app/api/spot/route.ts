// Server-side route that fetches live spot prices for gold, silver, platinum and palladium.
// This is the only outside service the app talks to, and it sends nothing about the shop or its customers.
// The browser calls /api/spot; this route calls the price service, so any future
// API key stays on the server and the browser never hits the provider directly.
//
// Data source: gold-api.com (free, no API key). Prices are USD per troy ounce.

import { NextResponse } from 'next/server';

const SOURCE_NAME = 'gold-api.com';
const SOURCE_URL = 'https://api.gold-api.com/price';

const SYMBOLS = {
  gold: 'XAU',
  silver: 'XAG',
  platinum: 'XPT',
  palladium: 'XPD',
} as const;

type Metal = keyof typeof SYMBOLS;

// Cache each provider response for 30 seconds so many open browser tabs
// don't hammer the price service.
const CACHE_SECONDS = 30;

async function fetchPrice(symbol: string): Promise<{ price: number; updatedAt: string | null }> {
  const res = await fetch(`${SOURCE_URL}/${symbol}`, {
    next: { revalidate: CACHE_SECONDS },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`${symbol}: price service returned HTTP ${res.status}`);
  }
  const data: unknown = await res.json();
  const price = (data as { price?: unknown })?.price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    throw new Error(`${symbol}: price service returned an invalid price`);
  }
  const updatedAt = (data as { updatedAt?: unknown })?.updatedAt;
  return { price, updatedAt: typeof updatedAt === 'string' ? updatedAt : null };
}

export async function GET() {
  try {
    // Gold, silver and platinum are required. Palladium is a bonus: if it fails, the rest still load.
    const metals = Object.keys(SYMBOLS) as Metal[];
    const settled = await Promise.allSettled(metals.map((m) => fetchPrice(SYMBOLS[m])));

    const prices: Partial<Record<Metal, number>> = {};
    const results: { price: number; updatedAt: string | null }[] = [];
    metals.forEach((m, i) => {
      const r = settled[i];
      if (r.status === 'fulfilled') {
        prices[m] = r.value.price;
        results.push(r.value);
      } else if (m !== 'palladium') {
        throw r.reason;
      }
    });

    // Report the oldest provider timestamp so the screen never looks fresher than it is.
    const providerTimes = results
      .map((r) => (r.updatedAt ? Date.parse(r.updatedAt) : NaN))
      .filter((t) => Number.isFinite(t));
    const updatedAt = providerTimes.length
      ? new Date(Math.min(...providerTimes)).toISOString()
      : new Date().toISOString();

    return NextResponse.json(
      { prices, updatedAt, source: SOURCE_NAME },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Live prices unavailable (${message})` },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
