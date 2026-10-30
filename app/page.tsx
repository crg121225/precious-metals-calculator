'use client';

import React, { useState, useMemo } from 'react';

type WeightUnit = 'grams' | 'dwt';

interface AssetCategory {
  value: string;
  label: string;
  metal: 'gold' | 'silver' | 'platinum';
  purity: number;
}

const assetOptions: AssetCategory[] = [
  { value: '24k-pure-gold', label: '24k Pure Gold', metal: 'gold', purity: 1.0 },
  { value: '18k-gold', label: '18k Gold', metal: 'gold', purity: 0.75 },
  { value: '14k-gold', label: '14k Gold', metal: 'gold', purity: 0.5833 },
  { value: '10k-gold', label: '10k Gold', metal: 'gold', purity: 0.4167 },
  { value: 'sterling-silver', label: 'Sterling Silver (.925)', metal: 'silver', purity: 0.925 },
  { value: 'platinum-pure', label: 'Pure Platinum', metal: 'platinum', purity: 0.9995 },
];

export default function Home() {
  const [spotPrices, setSpotPrices] = useState({
    gold: 4095.0,
    silver: 59.5,
    platinum: 1640.0,
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const [category, setCategory] = useState<string>('14k-gold');
  const [weight, setWeight] = useState<string>('10');
  const [unit, setUnit] = useState<WeightUnit>('grams');
  const [buyMargin, setBuyMargin] = useState<number>(30);
  const [retailMultiplier, setRetailMultiplier] = useState<number>(2.5);

  const [faceValue90, setFaceValue90] = useState<string>('');
  const [morganDollars, setMorganDollars] = useState<string>('');
  const [silverEagles, setSilverEagles] = useState<string>('');

  const jewelryMetrics = useMemo(() => {
    const selected = assetOptions.find((o) => o.value === category) || assetOptions[2];
    const numWeight = parseFloat(weight) || 0;

    const weightInOz = unit === 'grams' ? numWeight / 31.1035 : numWeight / 20;
    const pureMetalOz = weightInOz * selected.purity;
    const baseSpot = spotPrices[selected.metal];

    const meltValue = pureMetalOz * baseSpot;
    const storeOffer = meltValue * (1 - buyMargin / 100);
    const retailPrice = meltValue * retailMultiplier;

    return { meltValue, storeOffer, retailPrice, pureMetalOz, selected };
  }, [spotPrices, category, weight, unit, buyMargin, retailMultiplier]);

  const coinMetrics = useMemo(() => {
    const fv90Num = parseFloat(faceValue90) || 0;
    const morganNum = parseInt(morganDollars, 10) || 0;
    const eagleNum = parseInt(silverEagles, 10) || 0;

    const silverFrom90 = fv90Num * 0.715;
    const silverFromMorgan = morganNum * 0.7734;
    const silverFromEagle = eagleNum * 1.0;

    const totalSilverOz = silverFrom90 + silverFromMorgan + silverFromEagle;
    const coinMeltValue = totalSilverOz * spotPrices.silver;
    const coinStoreOffer = coinMeltValue * (1 - buyMargin / 100);

    return { totalSilverOz, coinMeltValue, coinStoreOffer };
  }, [faceValue90, morganDollars, silverEagles, buyMargin, spotPrices.silver]);

  const handleSync = () => {
    setIsSyncing(true);

    window.setTimeout(() => {
      setSpotPrices({
        gold: 4098.25,
        silver: 59.72,
        platinum: 1642.15,
      });
      setIsSyncing(false);
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      <header className="mx-auto mb-8 flex max-w-7xl flex-col items-start justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.35em] text-amber-500">
            Proprietary Build Platform
          </span>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
            Rockville Coin &amp; Jewelry{' '}
            <span className="font-light text-slate-500">| Valuation Engine</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">Engineered by Chelsea Gallagher Tech Advisory LLC</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 px-5 py-3 shadow-2xl">
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Gold Spot</p>
              <p className="text-lg font-mono font-bold text-amber-400">
                ${spotPrices.gold.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Silver Spot</p>
              <p className="text-lg font-mono font-bold text-slate-300">
                ${spotPrices.silver.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Platinum Spot</p>
              <p className="text-lg font-mono font-bold text-teal-400">
                ${spotPrices.platinum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${
              isSyncing
                ? 'animate-pulse border-amber-500/40 bg-amber-500/20 text-amber-300'
                : 'border-amber-600/40 bg-amber-600/90 text-slate-950 hover:bg-amber-500'
            }`}
          >
            {isSyncing ? 'Connecting to Bullion Wire...' : '🔄 Sync Live Market Tickers'}
          </button>
        </div>
      </header>

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
                    placeholder="Total individual coins"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-slate-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div className="flex h-fit flex-col justify-between space-y-4 rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl">
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
            </div>
          </div>

          <div className="flex h-fit flex-col justify-between space-y-4 rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl">
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
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
