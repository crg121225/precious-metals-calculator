'use client';

import Link from 'next/link';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import AboutThisTool from './components/AboutThisTool';

type WeightUnit = 'grams' | 'dwt';

interface AssetCategory {
  value: string;
  label: string;
  metal: 'gold' | 'silver' | 'platinum';
  purity: number;
}

const assetOptions: AssetCategory[] = [
  { value: '24k-pure-gold', label: '24k Pure Gold', metal: 'gold', purity: 1.0 },
  { value: '22k-gold', label: '22k Gold', metal: 'gold', purity: 0.9167 },
  { value: '18k-gold', label: '18k Gold', metal: 'gold', purity: 0.75 },
  { value: '14k-gold', label: '14k Gold', metal: 'gold', purity: 0.5833 },
  { value: '10k-gold', label: '10k Gold', metal: 'gold', purity: 0.4167 },
  { value: 'sterling-silver', label: 'Sterling Silver (.925)', metal: 'silver', purity: 0.925 },
  { value: 'platinum-950', label: 'Platinum 950 (Jewelry)', metal: 'platinum', purity: 0.95 },
  { value: 'platinum-pure', label: 'Pure Platinum', metal: 'platinum', purity: 0.9995 },
];

type Metal = 'gold' | 'silver' | 'platinum';

const metalLabels: Record<Metal, string> = {
  gold: 'Gold Spot',
  silver: 'Silver Spot',
  platinum: 'Platinum Spot',
};

const metalColors: Record<Metal, string> = {
  gold: 'text-amber-400',
  silver: 'text-slate-300',
  platinum: 'text-teal-400',
};

// How often live prices refresh, and when a price is old enough to warn about.
const REFRESH_MS = 60_000;
const STALE_MS = 5 * 60_000;

type PriceMode = 'live' | 'manual';

interface LiveStatus {
  state: 'loading' | 'ok' | 'error';
  updatedAt?: number; // when the price service last updated (ms since epoch)
  fetchedAt?: number; // when this page last got a good response
  source?: string;
  error?: string;
}

// Turns a typed value into a usable number. Blank, invalid or negative input counts as 0.
const toPositiveNumber = (value: string): number => {
  const num = parseFloat(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const GRAMS_PER_TROY_OZ = 31.1035;
const DWT_PER_TROY_OZ = 20;
const SILVER_OZ_PER_DOLLAR_FACE_90 = 0.715; // circulated 90% silver dimes, quarters, halves
const SILVER_OZ_PER_MORGAN_PEACE = 0.7734;
const SILVER_OZ_PER_EAGLE = 1.0;

const findAsset = (value: string) =>
  assetOptions.find((o) => o.value === value) ?? assetOptions.find((o) => o.value === '14k-gold')!;

// Pure-metal ounces in a piece of jewelry or scrap.
const jewelryPureOz = (categoryValue: string, weight: number, unit: WeightUnit) => {
  const asset = findAsset(categoryValue);
  const weightInOz = unit === 'grams' ? weight / GRAMS_PER_TROY_OZ : weight / DWT_PER_TROY_OZ;
  return { asset, pureOz: weightInOz * asset.purity };
};

// Pure silver ounces in a lot of US silver coins.
const coinSilverOz = (faceValue90: number, morgans: number, eagles: number) =>
  faceValue90 * SILVER_OZ_PER_DOLLAR_FACE_90 + morgans * SILVER_OZ_PER_MORGAN_PEACE + eagles * SILVER_OZ_PER_EAGLE;

// One line on a customer's buy ticket. Each line stores what was entered and the margin used,
// and its dollar values are worked out from the ticket's spot prices when shown.
type TicketItem =
  | {
      id: number;
      kind: 'jewelry';
      category: string;
      weight: number;
      unit: WeightUnit;
      margin: number;
    }
  | {
      id: number;
      kind: 'coins';
      faceValue90: number;
      morgans: number;
      eagles: number;
      margin: number;
    };

const describeTicketItem = (item: TicketItem): string => {
  if (item.kind === 'jewelry') {
    return `${findAsset(item.category).label}, ${item.weight} ${item.unit === 'grams' ? 'g' : 'dwt'}`;
  }
  const parts: string[] = [];
  if (item.faceValue90 > 0) parts.push(`${money(item.faceValue90)} face 90% silver`);
  if (item.morgans > 0) parts.push(`${item.morgans} Morgan/Peace`);
  if (item.eagles > 0) parts.push(`${item.eagles} Silver Eagle${item.eagles === 1 ? '' : 's'}`);
  return parts.join(', ');
};

const valueTicketItem = (item: TicketItem, spot: Record<Metal, number>) => {
  const melt =
    item.kind === 'jewelry'
      ? (() => {
          const { asset, pureOz } = jewelryPureOz(item.category, item.weight, item.unit);
          return pureOz * spot[asset.metal];
        })()
      : coinSilverOz(item.faceValue90, item.morgans, item.eagles) * spot.silver;
  return { melt, offer: melt * (1 - item.margin / 100) };
};

export default function Home() {
  // Spot prices in USD per troy ounce: filled automatically in live mode, typed in manual mode.
  // Stored as text so the fields can be cleared and retyped; converted to numbers below.
  // Fields start blank on purpose so nobody quotes a customer from old or made-up prices.
  const [spotInputs, setSpotInputs] = useState<Record<Metal, string>>({
    gold: '',
    silver: '',
    platinum: '',
  });
  const spotPrices = useMemo(
    () => ({
      gold: toPositiveNumber(spotInputs.gold),
      silver: toPositiveNumber(spotInputs.silver),
      platinum: toPositiveNumber(spotInputs.platinum),
    }),
    [spotInputs],
  );
  const missingSpot = (Object.keys(spotPrices) as Metal[]).filter((m) => spotPrices[m] === 0);

  // Live mode pulls prices from /api/spot every minute. Manual mode lets the user type them.
  const [priceMode, setPriceMode] = useState<PriceMode>('live');
  const [liveStatus, setLiveStatus] = useState<LiveStatus>({ state: 'loading' });
  const [now, setNow] = useState<number>(() => Date.now());
  const priceModeRef = useRef<PriceMode>(priceMode);
  useEffect(() => {
    priceModeRef.current = priceMode;
  }, [priceMode]);

  const loadLivePrices = useCallback(async () => {
    try {
      const res = await fetch('/api/spot', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.prices) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      // If the user switched to manual while this request was in flight, keep their numbers.
      if (priceModeRef.current !== 'live') return;
      setSpotInputs({
        gold: Number(data.prices.gold).toFixed(2),
        silver: Number(data.prices.silver).toFixed(2),
        platinum: Number(data.prices.platinum).toFixed(2),
      });
      const fetchedAt = Date.now();
      setLiveStatus({
        state: 'ok',
        updatedAt: Date.parse(data.updatedAt) || fetchedAt,
        fetchedAt,
        source: data.source,
      });
    } catch (err) {
      // Keep the last good prices on screen and flag the problem.
      setLiveStatus((prev) => ({
        ...prev,
        state: 'error',
        error: err instanceof Error ? err.message : 'Could not reach the price service',
      }));
    }
  }, []);

  useEffect(() => {
    if (priceMode !== 'live') return;
    loadLivePrices();
    const refreshTimer = window.setInterval(loadLivePrices, REFRESH_MS);
    // Refresh right away when the user comes back to this tab.
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadLivePrices();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [priceMode, loadLivePrices]);

  // Ticks every 15 seconds so the "updated X ago" and stale warning stay current.
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(clock);
  }, []);

  const isStale =
    priceMode === 'live' && liveStatus.updatedAt !== undefined && now - liveStatus.updatedAt > STALE_MS;

  const formatTime = (ms?: number) =>
    ms ? new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '';

  let statusText: string;
  let statusColor = 'text-slate-500';
  if (priceMode === 'manual') {
    statusText =
      missingSpot.length > 0
        ? `Manual prices. Enter today's spot for: ${missingSpot.join(', ')}.`
        : 'Manual prices. Update them before each quote.';
  } else if (liveStatus.state === 'loading') {
    statusText = 'Loading live prices...';
  } else if (liveStatus.state === 'error') {
    statusColor = 'text-red-400';
    statusText = liveStatus.fetchedAt
      ? `Live feed problem. Showing prices from ${formatTime(liveStatus.fetchedAt)}. Retrying every minute.`
      : 'Live prices unavailable. Switch to manual and enter today’s spot prices.';
  } else if (isStale) {
    statusColor = 'text-amber-400';
    statusText = `Warning: market price last changed at ${formatTime(liveStatus.updatedAt)}. Markets may be closed, or the feed may be delayed.`;
  } else {
    statusColor = 'text-emerald-400';
    statusText = `● Live from ${liveStatus.source ?? 'price feed'}. Market price as of ${formatTime(liveStatus.updatedAt)}. Refreshes every minute.`;
  }

  const [category, setCategory] = useState<string>('14k-gold');
  const [weight, setWeight] = useState<string>('10');
  const [unit, setUnit] = useState<WeightUnit>('grams');
  const [buyMargin, setBuyMargin] = useState<number>(30);
  // Coins usually buy closer to melt than scrap jewelry, so they get their own margin.
  const [coinBuyMargin, setCoinBuyMargin] = useState<number>(10);
  const [retailMultiplier, setRetailMultiplier] = useState<number>(2.5);

  const [faceValue90, setFaceValue90] = useState<string>('');
  const [morganDollars, setMorganDollars] = useState<string>('');
  const [silverEagles, setSilverEagles] = useState<string>('');

  // Quote lock: freezes spot prices so the offer doesn't move while a customer is at the counter.
  // Live prices keep updating in the header; all calculations use the locked prices until unlocked.
  const [lockedQuote, setLockedQuote] = useState<{ prices: Record<Metal, number>; at: number } | null>(null);
  const quoteSpot: Record<Metal, number> = lockedQuote?.prices ?? spotPrices;
  const canLock = missingSpot.length === 0;

  const lockQuote = () => {
    if (!canLock) return;
    setLockedQuote({ prices: { ...spotPrices }, at: Date.now() });
  };
  const unlockQuote = () => setLockedQuote(null);

  // Customer ticket: several items bought from one customer, totaled together.
  const [ticket, setTicket] = useState<TicketItem[]>([]);
  const nextItemId = useRef(1);

  const jewelryMetrics = useMemo(() => {
    const { asset: selected, pureOz: pureMetalOz } = jewelryPureOz(category, toPositiveNumber(weight), unit);

    const meltValue = pureMetalOz * quoteSpot[selected.metal];
    const storeOffer = meltValue * (1 - buyMargin / 100);
    const retailPrice = meltValue * retailMultiplier;

    return { meltValue, storeOffer, retailPrice, pureMetalOz, selected };
  }, [quoteSpot, category, weight, unit, buyMargin, retailMultiplier]);

  const coinMetrics = useMemo(() => {
    const fv90Num = toPositiveNumber(faceValue90);
    const morganNum = Math.floor(toPositiveNumber(morganDollars));
    const eagleNum = Math.floor(toPositiveNumber(silverEagles));

    const totalSilverOz = coinSilverOz(fv90Num, morganNum, eagleNum);
    const coinMeltValue = totalSilverOz * quoteSpot.silver;
    const coinStoreOffer = coinMeltValue * (1 - coinBuyMargin / 100);

    return { totalSilverOz, coinMeltValue, coinStoreOffer, fv90Num, morganNum, eagleNum };
  }, [faceValue90, morganDollars, silverEagles, coinBuyMargin, quoteSpot.silver]);

  const ticketLines = ticket.map((item) => ({ item, ...valueTicketItem(item, quoteSpot) }));
  const ticketMelt = ticketLines.reduce((sum, l) => sum + l.melt, 0);
  const ticketOffer = ticketLines.reduce((sum, l) => sum + l.offer, 0);

  // Adding the first item locks prices automatically, so every line on a ticket uses the same prices.
  const ensureLocked = () => {
    if (!lockedQuote && canLock) lockQuote();
  };

  const addJewelryToTicket = () => {
    const w = toPositiveNumber(weight);
    if (w === 0 || jewelryMetrics.meltValue === 0) return;
    ensureLocked();
    setTicket((prev) => [
      ...prev,
      { id: nextItemId.current++, kind: 'jewelry', category, weight: w, unit, margin: buyMargin },
    ]);
    setWeight('');
  };

  const addCoinsToTicket = () => {
    if (coinMetrics.totalSilverOz === 0 || coinMetrics.coinMeltValue === 0) return;
    ensureLocked();
    setTicket((prev) => [
      ...prev,
      {
        id: nextItemId.current++,
        kind: 'coins',
        faceValue90: coinMetrics.fv90Num,
        morgans: coinMetrics.morganNum,
        eagles: coinMetrics.eagleNum,
        margin: coinBuyMargin,
      },
    ]);
    setFaceValue90('');
    setMorganDollars('');
    setSilverEagles('');
  };

  const removeTicketItem = (id: number) => setTicket((prev) => prev.filter((i) => i.id !== id));

  // Starting a new customer clears the ticket and releases the price lock.
  const newCustomer = () => {
    setTicket([]);
    setLockedQuote(null);
  };

  return (
    <main className="min-h-screen bg-slate-950 p-6 pb-40 text-slate-100 lg:pb-6 selection:bg-amber-500 selection:text-slate-950">
      <header className="mx-auto mb-8 flex max-w-7xl flex-col items-start justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.35em] text-amber-500">
            Portfolio Project
          </span>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
            Precious Metals Pricing Calculator{' '}
            <span className="font-light text-slate-500">| Valuation Engine</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">Built by Chelsea Gallagher</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/price-sheet"
              className="inline-block rounded-full border border-amber-600/50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-amber-400 hover:bg-amber-500/10"
            >
              Weekly bullion price sheet →
            </Link>
            <Link
              href="/showcase"
              className="inline-block rounded-full border border-amber-600/50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-amber-400 hover:bg-amber-500/10"
            >
              Showcase cards →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-3 shadow-2xl">
          <div className="flex flex-wrap gap-4">
            {(Object.keys(metalLabels) as Metal[]).map((metal, i) => (
              <div key={metal} className={i > 0 ? 'border-l border-slate-800 pl-4' : ''}>
                <label
                  htmlFor={`spot-${metal}`}
                  className="block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                >
                  {metalLabels[metal]} ($/oz)
                </label>
                <div className="flex items-center">
                  <span className={`text-lg font-mono font-bold ${metalColors[metal]}`}>$</span>
                  <input
                    id={`spot-${metal}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={spotInputs[metal]}
                    readOnly={priceMode === 'live'}
                    onChange={(e) => setSpotInputs((prev) => ({ ...prev, [metal]: e.target.value }))}
                    placeholder={priceMode === 'live' ? '...' : '0.00'}
                    className={`w-28 bg-transparent text-lg font-mono font-bold focus:outline-none ${metalColors[metal]} ${
                      priceMode === 'live' ? 'cursor-default' : 'rounded border border-slate-700 px-1'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className={`mt-2 max-w-md text-[10px] ${statusColor}`} role="status" aria-live="polite">
            {statusText}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {priceMode === 'live' ? (
              <>
                <button
                  type="button"
                  onClick={loadLivePrices}
                  className="rounded-full border border-amber-600/40 bg-amber-600/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-950 hover:bg-amber-500"
                >
                  Refresh now
                </button>
                <button
                  type="button"
                  onClick={() => setPriceMode('manual')}
                  className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300 hover:text-white"
                >
                  Enter prices manually
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setPriceMode('live')}
                className="rounded-full border border-amber-600/40 bg-amber-600/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-950 hover:bg-amber-500"
              >
                Use live prices
              </button>
            )}
          </div>
        </div>
      </header>

      <section
        className={`mx-auto mb-8 flex max-w-7xl flex-col gap-3 rounded-xl border px-5 py-3 md:flex-row md:items-center md:justify-between ${
          lockedQuote ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-800 bg-slate-900/60'
        }`}
        aria-label="Quote price lock"
      >
        <div className="text-xs">
          {lockedQuote ? (
            <>
              <p className="font-bold text-amber-400">
                🔒 Quote locked at {formatTime(lockedQuote.at)}. Offers below use these prices:
              </p>
              <p className="mt-0.5 font-mono text-slate-300">
                Gold {money(lockedQuote.prices.gold)} · Silver {money(lockedQuote.prices.silver)} · Platinum{' '}
                {money(lockedQuote.prices.platinum)}
              </p>
            </>
          ) : (
            <p className="text-slate-400">
              Offers follow the spot prices above and can change each minute. Lock them before you tell a customer a
              number.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {lockedQuote ? (
            <button
              type="button"
              onClick={unlockQuote}
              className="rounded-full border border-slate-600 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-200 hover:text-white"
            >
              Unlock prices
            </button>
          ) : (
            <button
              type="button"
              onClick={lockQuote}
              disabled={!canLock}
              className="rounded-full border border-amber-600/40 bg-amber-600/90 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-950 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Lock quote prices
            </button>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500">
                Estate Jewelry &amp; Scrap Input
              </h2>
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                Live Calculations
              </span>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Asset Purity Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                >
                  {assetOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Material Weight</label>
                <div className="flex overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-transparent px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  />
                  <div className="flex items-center border-l border-slate-800 bg-slate-900 px-1 py-1">
                    <button
                      type="button"
                      onClick={() => setUnit('grams')}
                      className={`rounded px-2 py-1 text-[10px] font-bold ${
                        unit === 'grams' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Grams
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnit('dwt')}
                      className={`rounded px-2 py-1 text-[10px] font-bold ${
                        unit === 'dwt' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      DWT
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-400">Store Buying Margin (Discount from Melt)</span>
                  <span className="font-mono font-bold text-amber-400">{buyMargin}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={buyMargin}
                  onChange={(e) => setBuyMargin(parseInt(e.target.value, 10))}
                  className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-950 accent-amber-500"
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-400">Retail Markup Multiplier (Display Case Price)</span>
                  <span className="font-mono font-bold text-amber-400">{retailMultiplier}x</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="4.0"
                  step="0.1"
                  value={retailMultiplier}
                  onChange={(e) => setRetailMultiplier(parseFloat(e.target.value))}
                  className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-950 accent-amber-500"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                US Silver Coin Counter (Numismatic Bulk)
              </h2>
              <span className="rounded-full border border-slate-700/50 bg-slate-700/30 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                Bullion Spec
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  90% Junk Silver Total Face Value (Pre-1965 Dimes/Quarters/Halves)
                </label>
                <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950">
                  <span className="pl-3 text-sm font-bold text-slate-500">$</span>
                  <input
                    type="number"
                    value={faceValue90}
                    onChange={(e) => setFaceValue90(e.target.value)}
                    inputMode="decimal"
                    min="0"
                    step="0.05"
                    placeholder="e.g. 100.00 face value bag"
                    className="w-full bg-transparent px-1 py-2 pr-3 text-sm text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Morgan &amp; Peace Dollars (Count)</label>
                  <input
                    type="number"
                    value={morganDollars}
                    onChange={(e) => setMorganDollars(e.target.value)}
                    inputMode="numeric"
                    min="0"
                    step="1"
                    placeholder="Total individual coins"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">American Silver Eagles (1oz Pure)</label>
                  <input
                    type="number"
                    value={silverEagles}
                    onChange={(e) => setSilverEagles(e.target.value)}
                    inputMode="numeric"
                    min="0"
                    step="1"
                    placeholder="Total individual coins"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <label htmlFor="coin-margin" className="text-slate-400">
                    Coin Buying Margin (Discount from Melt)
                  </label>
                  <span className="font-mono font-bold text-amber-400">{coinBuyMargin}%</span>
                </div>
                <input
                  id="coin-margin"
                  type="range"
                  min="0"
                  max="40"
                  value={coinBuyMargin}
                  onChange={(e) => setCoinBuyMargin(parseInt(e.target.value, 10))}
                  className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-950 accent-amber-500"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div
            id="jewelry-ledger"
            className="flex h-fit scroll-mt-6 flex-col justify-between space-y-4 rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl"
          >
            <h2 className="text-xs font-bold uppercase tracking-[0.35em] text-slate-500">Jewelry Scrap Ledger</h2>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Intrinsic Melt Value</p>
                <p className="mt-0.5 text-4xl font-mono font-black tracking-tight text-white">
                  ${jewelryMetrics.meltValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Contains {jewelryMetrics.pureMetalOz.toFixed(4)} oz pure {jewelryMetrics.selected.metal} content.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                  Recommended Over-The-Counter Offer
                </p>
                <p className="mt-0.5 text-2xl font-mono font-bold text-amber-400">
                  ${jewelryMetrics.storeOffer.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Melt base adjusted down by the configured {buyMargin}% business margin.
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Suggested Display Retail Tag</p>
                <p className="mt-0.5 text-lg font-mono font-bold text-slate-300">
                  ${jewelryMetrics.retailPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <button
                type="button"
                onClick={addJewelryToTicket}
                disabled={jewelryMetrics.meltValue === 0}
                className="w-full rounded-lg border border-amber-600/40 bg-amber-600/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-950 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Add to customer ticket
              </button>
            </div>
          </div>

          <div
            id="coin-ledger"
            className="flex h-fit scroll-mt-6 flex-col justify-between space-y-4 rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl"
          >
            <h2 className="text-xs font-bold uppercase tracking-[0.35em] text-slate-500">Numismatic Coin Ledger</h2>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Net Silver Bulk Weight</p>
                <p className="mt-0.5 text-3xl font-mono font-black tracking-tight text-slate-200">
                  {coinMetrics.totalSilverOz.toFixed(3)} <span className="text-sm font-normal text-slate-500">Troy Oz</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-900 bg-slate-950 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Coin Melt Value</p>
                  <p className="mt-0.5 text-md font-mono font-bold text-white">
                    ${coinMetrics.coinMeltValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Coin Buy Price</p>
                  <p className="mt-0.5 text-md font-mono font-bold text-amber-400">
                    ${coinMetrics.coinStoreOffer.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={addCoinsToTicket}
                disabled={coinMetrics.coinMeltValue === 0}
                className="w-full rounded-lg border border-amber-600/40 bg-amber-600/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-950 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Add coins to customer ticket
              </button>
            </div>
          </div>

          <section
            id="customer-ticket"
            className="scroll-mt-6 space-y-4 rounded-2xl border border-amber-500/30 bg-slate-900 p-6 shadow-2xl"
            aria-label="Customer ticket"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.35em] text-amber-500">Customer Ticket</h2>
              <span className="text-[10px] text-slate-500">
                {ticket.length} item{ticket.length === 1 ? '' : 's'}
              </span>
            </div>

            {ticket.length === 0 ? (
              <p className="text-xs text-slate-500">
                Use the &ldquo;Add to customer ticket&rdquo; buttons to total everything one customer is selling.
                Adding the first item locks the spot prices for this ticket.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-800">
                  {ticketLines.map(({ item, melt, offer }) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200">{describeTicketItem(item)}</p>
                        <p className="text-[10px] text-slate-500">
                          Melt {money(melt)} · {item.margin}% margin
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-sm font-bold text-amber-400">{money(offer)}</span>
                        <button
                          type="button"
                          onClick={() => removeTicketItem(item.id)}
                          aria-label={`Remove ${describeTicketItem(item)}`}
                          className="rounded px-1.5 text-slate-500 hover:bg-slate-800 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Total melt value</span>
                    <span className="font-mono">{money(ticketMelt)}</span>
                  </div>
                  <div className="mt-1 flex items-end justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                      Total offer to customer
                    </span>
                    <span className="text-2xl font-mono font-black text-amber-400">{money(ticketOffer)}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {lockedQuote
                      ? `Using prices locked at ${formatTime(lockedQuote.at)}.`
                      : 'Prices are not locked, so this total follows the live market.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={newCustomer}
                  className="w-full rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-300 hover:text-white"
                >
                  Done · start new customer
                </button>
              </>
            )}
          </section>
        </div>
      </div>

      <AboutThisTool />

      {/* Pinned totals for phones and tablets, where the ledgers sit far below the inputs.
          Hidden on wide screens because the ledgers are already beside the inputs there. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur-md lg:hidden">
        {lockedQuote && (
          <p className="mx-auto mb-1 max-w-7xl text-[10px] font-bold text-amber-400">
            🔒 Prices locked at {formatTime(lockedQuote.at)}
          </p>
        )}
        <div className={`mx-auto grid max-w-7xl gap-2 ${ticket.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <a href="#jewelry-ledger" className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Jewelry Offer</p>
            <p className="text-lg font-mono font-bold text-amber-400">
              ${jewelryMetrics.storeOffer.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-500">
              Melt ${jewelryMetrics.meltValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </a>
          <a href="#coin-ledger" className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Coin Offer</p>
            <p className="text-lg font-mono font-bold text-amber-400">
              ${coinMetrics.coinStoreOffer.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-500">{coinMetrics.totalSilverOz.toFixed(3)} oz silver</p>
          </a>
          {ticket.length > 0 && (
            <a href="#customer-ticket" className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Ticket Total</p>
              <p className="text-lg font-mono font-bold text-amber-300">{money(ticketOffer)}</p>
              <p className="text-[10px] text-slate-400">
                {ticket.length} item{ticket.length === 1 ? '' : 's'}
              </p>
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
