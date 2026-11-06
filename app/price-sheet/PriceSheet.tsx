'use client';

// Weekly bullion price sheet: the owner's handwritten "Bullion prices and availability" form,
// filled in from his own premiums. He stays in control of every number:
//  - He enters (or fills in) the closing spot prices he wants to use.
//  - He sets the premium over melt for each product.
//  - He can type his own price on any line, which always wins over the calculation.
//  - He marks items sold out.
// Nothing is posted anywhere. He prints the sheet or downloads an image and posts it himself.

import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import AboutThisTool from '../components/AboutThisTool';
import {
  METAL_SYMBOL,
  PRODUCTS,
  ROUNDING_LABELS,
  SECTIONS,
  SHEET_CLOSE,
  SHEET_DATE,
  SHEET_METALS,
  formatMoney,
  meltValue,
  roundPrice,
  startingPremium,
  type Rounding,
  type SheetMetal,
  type SheetProduct,
  type SheetSection,
} from '../lib/bullion';

const STORAGE_KEY = 'rcj-price-sheet-v1';

interface SheetSettings {
  shopName: string;
  shopLine: string;
  title: string;
  note: string;
  sheetDate: string;
  closes: Record<SheetMetal, string>;
  premiums: Record<string, string>;
  myPrices: Record<string, string>;
  soldOut: Record<string, boolean>;
  rounding: Rounding;
}

const todayLabel = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}-${String(d.getFullYear()).slice(2)}`;
};

const defaultPremiums = () =>
  Object.fromEntries(PRODUCTS.filter((p) => p.metal).map((p) => [p.id, startingPremium(p).toFixed(2)]));

// Products with no metal (Goldbacks) are priced by hand, so they start with his last price.
const defaultMyPrices = () =>
  Object.fromEntries(
    PRODUCTS.filter((p) => !p.metal && p.sheetPrice !== undefined).map((p) => [p.id, p.sheetPrice!.toFixed(2)]),
  );

const defaultSoldOut = () => Object.fromEntries(PRODUCTS.map((p) => [p.id, Boolean(p.startSoldOut)]));

const defaultSettings = (): SheetSettings => ({
  shopName: 'Rockville Coin & Jewelry',
  shopLine: '110 S Market St, Rockville, IN · (765) 203-8680',
  title: 'Weekend Bullion Prices and Availability',
  note: '',
  sheetDate: todayLabel(),
  closes: { gold: '', silver: '', platinum: '', palladium: '' },
  premiums: defaultPremiums(),
  myPrices: defaultMyPrices(),
  soldOut: defaultSoldOut(),
  rounding: 'cent',
});

// Reads saved settings from this browser. New products added later get their defaults.
const loadSettings = (): SheetSettings => {
  const defaults = defaultSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<SheetSettings>;
    return {
      ...defaults,
      ...saved,
      closes: { ...defaults.closes, ...saved.closes },
      premiums: { ...defaults.premiums, ...saved.premiums },
      myPrices: { ...defaults.myPrices, ...saved.myPrices },
      soldOut: { ...defaults.soldOut, ...saved.soldOut },
    };
  } catch {
    return defaults;
  }
};

const parseMoney = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const n = parseFloat(value.replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};

interface Row {
  product: SheetProduct;
  melt: number | null;
  premium: number;
  calculated: number | null;
  myPrice: number | null;
  final: number | null;
  soldOut: boolean;
}

const priceText = (row: Row) => {
  if (row.soldOut) return 'Sold out';
  if (row.final === null) return '—';
  return `$${formatMoney(row.final)}${row.product.unitLabel ? ` ${row.product.unitLabel}` : ''}`;
};

// Splits sections into two columns of roughly equal length, like his paper form.
const splitColumns = (groups: { section: SheetSection; rows: Row[] }[]) => {
  const total = groups.reduce((n, g) => n + g.rows.length + 1.5, 0);
  const left: typeof groups = [];
  const right: typeof groups = [];
  let count = 0;
  for (const g of groups) {
    if (count < total / 2) {
      left.push(g);
      count += g.rows.length + 1.5;
    } else {
      right.push(g);
    }
  }
  return [left, right];
};

// Draws the sheet onto a canvas so it can be saved as an image for Facebook.
function drawSheetImage(
  settings: SheetSettings,
  closes: Record<SheetMetal, number>,
  columns: { section: SheetSection; rows: Row[] }[][],
): HTMLCanvasElement {
  const W = 1080;
  const PAD = 56;
  const GAP = 48;
  const COL_W = (W - PAD * 2 - GAP) / 2;
  const SECTION_H = 52;
  const ROW_H = 36;
  const font = 'Helvetica, Arial, sans-serif';

  const columnHeight = (col: { rows: Row[] }[]) => col.reduce((h, g) => h + SECTION_H + g.rows.length * ROW_H + 12, 0);
  const headerH = 190;
  const noteLines = settings.note.trim() ? Math.ceil(settings.note.trim().length / 80) : 0;
  const footerH = 90 + noteLines * 30;
  const H = PAD + headerH + Math.max(...columns.map(columnHeight)) + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Header
  let y = PAD + 40;
  ctx.fillStyle = '#111827';
  ctx.font = `bold 44px ${font}`;
  ctx.fillText(settings.shopName, PAD, y);
  y += 46;
  ctx.font = `bold 30px ${font}`;
  ctx.fillStyle = '#92400e';
  ctx.fillText(settings.title, PAD, y);
  y += 40;
  ctx.font = `22px ${font}`;
  ctx.fillStyle = '#374151';
  const closeText = SHEET_METALS.filter((m) => closes[m] > 0)
    .map((m) => `${METAL_SYMBOL[m]} $${formatMoney(closes[m])}`)
    .join('    ');
  ctx.fillText(`${settings.sheetDate}    Close: ${closeText}`, PAD, y);
  y += 28;
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();

  const top = PAD + headerH;

  // Fits a product name into the space left of its price.
  const fit = (text: string, maxWidth: number) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
  };

  columns.forEach((col, ci) => {
    const x = PAD + ci * (COL_W + GAP);
    let cy = top;
    for (const g of col) {
      ctx.font = `bold 26px ${font}`;
      ctx.fillStyle = '#111827';
      ctx.fillText(g.section.toUpperCase(), x, cy + 32);
      cy += SECTION_H;
      for (const row of g.rows) {
        const price = priceText(row);
        ctx.font = row.soldOut ? `italic 21px ${font}` : `bold 21px ${font}`;
        const priceW = ctx.measureText(price).width;
        ctx.fillStyle = row.soldOut ? '#9ca3af' : '#111827';
        ctx.fillText(price, x + COL_W - priceW, cy + 24);
        ctx.font = `21px ${font}`;
        ctx.fillStyle = row.soldOut ? '#9ca3af' : '#1f2937';
        ctx.fillText(fit(row.product.name, COL_W - priceW - 16), x, cy + 24);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, cy + ROW_H - 4);
        ctx.lineTo(x + COL_W, cy + ROW_H - 4);
        ctx.stroke();
        cy += ROW_H;
      }
      cy += 12;
    }
  });

  // Footer
  let fy = H - footerH + 20;
  ctx.font = `20px ${font}`;
  ctx.fillStyle = '#374151';
  if (settings.note.trim()) {
    const words = settings.note.trim().split(/\s+/);
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > W - PAD * 2) {
        ctx.fillText(line, PAD, fy);
        fy += 30;
        line = w;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, PAD, fy);
      fy += 30;
    }
  }
  ctx.font = `bold 20px ${font}`;
  ctx.fillStyle = '#111827';
  ctx.fillText(settings.shopLine, PAD, fy + 10);
  ctx.font = `18px ${font}`;
  ctx.fillStyle = '#6b7280';
  ctx.fillText('Prices change with the market. Call to confirm availability.', PAD, fy + 40);

  return canvas;
}

export default function PriceSheet() {
  const [settings, setSettings] = useState<SheetSettings>(loadSettings);
  const [fetchState, setFetchState] = useState<{ busy: boolean; message: string }>({ busy: false, message: '' });
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);

  // Save every change in this browser only.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage can be unavailable (private browsing). The sheet still works for this visit.
    }
  }, [settings]);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const update = <K extends keyof SheetSettings>(key: K, value: SheetSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const setMapValue = (key: 'premiums' | 'myPrices' | 'closes', id: string, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: { ...prev[key], [id]: value } }));

  const closes = useMemo(
    () =>
      Object.fromEntries(
        SHEET_METALS.map((m) => {
          const n = parseMoney(settings.closes[m]);
          return [m, n !== null && n > 0 ? n : 0];
        }),
      ) as Record<SheetMetal, number>,
    [settings.closes],
  );

  const rows: Row[] = useMemo(
    () =>
      PRODUCTS.map((product) => {
        const hasSpot = product.metal ? closes[product.metal] > 0 : false;
        const melt = hasSpot ? meltValue(product, closes) : null;
        const premium = parseMoney(settings.premiums[product.id]) ?? 0;
        const calculated = melt !== null ? roundPrice(melt + premium, settings.rounding) : null;
        const typed = parseMoney(settings.myPrices[product.id]);
        const myPrice = typed !== null && typed > 0 ? typed : null;
        return {
          product,
          melt,
          premium,
          calculated,
          myPrice,
          final: myPrice ?? calculated,
          soldOut: Boolean(settings.soldOut[product.id]),
        };
      }),
    [closes, settings.premiums, settings.myPrices, settings.soldOut, settings.rounding],
  );

  const groups = useMemo(
    () =>
      SECTIONS.map((section) => ({ section, rows: rows.filter((r) => r.product.section === section) })).filter(
        (g) => g.rows.length > 0,
      ),
    [rows],
  );
  const columns = useMemo(() => splitColumns(groups), [groups]);

  const missingCloses = SHEET_METALS.filter((m) => closes[m] === 0);

  const fillFromMarket = async () => {
    setFetchState({ busy: true, message: '' });
    try {
      const res = await fetch('/api/spot', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.prices) throw new Error(data?.error || `HTTP ${res.status}`);
      setSettings((prev) => ({
        ...prev,
        sheetDate: todayLabel(),
        closes: Object.fromEntries(
          SHEET_METALS.map((m) => [
            m,
            typeof data.prices[m] === 'number' ? data.prices[m].toFixed(2) : prev.closes[m],
          ]),
        ) as Record<SheetMetal, string>,
      }));
      const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      setFetchState({ busy: false, message: `Filled with market prices from ${time}. Change any of them if you like.` });
    } catch (err) {
      setFetchState({
        busy: false,
        message: `Couldn't get market prices (${err instanceof Error ? err.message : 'unknown error'}). Type them in instead.`,
      });
    }
  };

  const loadSheetCloses = () => {
    update(
      'closes',
      Object.fromEntries(SHEET_METALS.map((m) => [m, SHEET_CLOSE[m].toFixed(2)])) as Record<SheetMetal, string>,
    );
    update('sheetDate', SHEET_DATE);
    setFetchState({
      busy: false,
      message: `Loaded the Friday close from the ${SHEET_DATE} sheet. Prices below should match that sheet.`,
    });
  };

  const resetPremiums = () => {
    if (window.confirm(`Reset every premium to the ones worked out from the ${SHEET_DATE} sheet?`)) {
      update('premiums', defaultPremiums());
    }
  };

  const clearMyPrices = () => {
    if (window.confirm('Clear every price you typed in yourself? Calculated prices will be used instead.')) {
      update('myPrices', {});
    }
  };

  const imageFileName = `bullion-prices-${settings.sheetDate || todayLabel()}.png`;

  const makeImageBlob = () =>
    new Promise<Blob | null>((resolve) => drawSheetImage(settings, closes, columns).toBlob(resolve, 'image/png'));

  // Phones: opens the phone's own share menu (Facebook, Messages, Save Image...). He picks where it goes.
  const [shareMessage, setShareMessage] = useState('');
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'test.png', { type: 'image/png' })] });

  const shareImage = async () => {
    setShareMessage('');
    const blob = await makeImageBlob();
    if (!blob) return;
    const file = new File([blob], imageFileName, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], text: postText });
    } catch (err) {
      // Closing the share menu without picking anything is normal, not an error.
      if (err instanceof Error && err.name !== 'AbortError') {
        setShareMessage("Couldn't open the share menu. Use Save image instead.");
      }
    }
  };

  const downloadImage = () => {
    makeImageBlob().then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = imageFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a moment to start the download before releasing the image.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };

  const postText = `${settings.title}:${settings.note.trim() ? `\n${settings.note.trim()}` : ''}`;

  const copyPostText = async () => {
    try {
      await navigator.clipboard.writeText(postText);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const input =
    'rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-amber-600 focus:outline-none';
  const button =
    'rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-50';
  const primary = `${button} border-amber-700 bg-amber-600 text-white hover:bg-amber-500`;
  const secondary = `${button} border-slate-300 bg-white text-slate-700 hover:border-slate-500`;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8 print:bg-white print:p-0">
      <header className="mx-auto mb-6 flex max-w-7xl flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <Link href="/" className="text-xs font-bold text-amber-700 hover:underline">
            ← Back to the pricing calculator
          </Link>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Weekly Bullion Price Sheet</h1>
          <p className="text-sm text-slate-600">
            Your premiums, your prices. Fill in the sheet, check it, then print it or save it as an image to post.
          </p>
        </div>
      </header>

      {/* Step 1: closing prices */}
      <section className="mx-auto mb-6 max-w-7xl rounded-xl border border-slate-300 bg-white p-5 print:hidden">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">1. Closing spot prices</h2>
        <p className="mt-1 text-xs text-slate-500">
          Type the close you want to use, the way you write it at the top of your sheet, or fill them in from the market
          and adjust.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="text-xs text-slate-600">
            Sheet date
            <input
              className={`${input} mt-1 block w-28`}
              value={settings.sheetDate}
              onChange={(e) => update('sheetDate', e.target.value)}
            />
          </label>
          {SHEET_METALS.map((m) => (
            <label key={m} className="text-xs text-slate-600">
              {METAL_SYMBOL[m]} close ($/oz)
              <input
                className={`${input} mt-1 block w-32 font-mono`}
                inputMode="decimal"
                placeholder="0.00"
                value={settings.closes[m]}
                onChange={(e) => setMapValue('closes', m, e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={primary} onClick={fillFromMarket} disabled={fetchState.busy}>
            {fetchState.busy ? 'Getting prices…' : 'Fill with current market'}
          </button>
          <button type="button" className={secondary} onClick={loadSheetCloses}>
            {`Use the ${SHEET_DATE} sheet’s close`}
          </button>
        </div>
        {fetchState.message && <p className="mt-2 text-xs text-slate-600">{fetchState.message}</p>}
        {missingCloses.length > 0 && (
          <p className="mt-2 text-xs text-amber-700">
            No close entered for: {missingCloses.map((m) => METAL_SYMBOL[m]).join(', ')}. Those lines stay blank unless
            you type your own price.
          </p>
        )}
      </section>

      {/* Step 2: premiums and prices */}
      <section className="mx-auto mb-6 max-w-7xl rounded-xl border border-slate-300 bg-white p-5 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">2. Premiums and prices</h2>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">
              {`Price = melt value + your premium. Starting premiums were worked out from your ${SHEET_DATE} sheet, so `}
              using that sheet&rsquo;s close gives back the same prices you wrote. Type a number in{' '}
              <strong>My price</strong> to use your own price on any line; it always wins over the calculation.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-600">
              Round calculated prices
              <select
                className={`${input} mt-1 block`}
                value={settings.rounding}
                onChange={(e) => update('rounding', e.target.value as Rounding)}
              >
                {(Object.keys(ROUNDING_LABELS) as Rounding[]).map((r) => (
                  <option key={r} value={r}>
                    {ROUNDING_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={secondary} onClick={resetPremiums}>
              Reset premiums
            </button>
            <button type="button" className={secondary} onClick={clearMyPrices}>
              Clear my prices
            </button>
          </div>
        </div>

        {/* Phone layout: one card per product, big tap targets, number keypad. */}
        <div className="mt-4 space-y-5 md:hidden">
          {groups.map((g) => (
            <div key={g.section}>
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-amber-800">{g.section}</p>
              <div className="space-y-2">
                {g.rows.map((row) => {
                  const p = row.product;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-lg border p-3 ${
                        row.soldOut ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold">{p.name}</p>
                          {p.metal && p.pureOz !== undefined && row.melt !== null && (
                            <p className="text-[11px] text-slate-400">
                              {p.pureOz.toFixed(4)} oz × ${formatMoney(closes[p.metal])} = ${formatMoney(row.melt)}
                            </p>
                          )}
                          {!p.metal && <p className="text-[11px] text-slate-400">Priced by hand</p>}
                        </div>
                        <p className={`shrink-0 text-right font-mono text-lg font-bold ${row.soldOut ? 'italic' : ''}`}>
                          {priceText(row)}
                        </p>
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                        {p.metal ? (
                          <label className="text-[11px] text-slate-500">
                            Premium +$
                            <input
                              className={`${input} mt-0.5 block w-full py-2 text-right font-mono text-base`}
                              inputMode="decimal"
                              value={settings.premiums[p.id] ?? ''}
                              onChange={(e) => setMapValue('premiums', p.id, e.target.value)}
                            />
                          </label>
                        ) : (
                          <span />
                        )}
                        <label className="text-[11px] text-slate-500">
                          My price
                          <input
                            className={`${input} mt-0.5 block w-full py-2 text-right font-mono text-base ${
                              row.myPrice !== null ? 'border-amber-500 bg-amber-50 font-bold' : ''
                            }`}
                            inputMode="decimal"
                            placeholder="optional"
                            value={settings.myPrices[p.id] ?? ''}
                            onChange={(e) => setMapValue('myPrices', p.id, e.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          aria-pressed={row.soldOut}
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              soldOut: { ...prev.soldOut, [p.id]: !prev.soldOut[p.id] },
                            }))
                          }
                          className={`rounded-md border px-3 py-2 text-xs font-bold ${
                            row.soldOut
                              ? 'border-slate-500 bg-slate-600 text-white'
                              : 'border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          {row.soldOut ? 'Sold out' : 'In stock'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Computer layout: one table row per product. */}
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3 text-right">Melt</th>
                <th className="py-2 pr-3 text-right">Premium (+$)</th>
                <th className="py-2 pr-3 text-right">Calculated</th>
                <th className="py-2 pr-3 text-right">My price</th>
                <th className="py-2 text-center">Sold out</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.section}>
                <tr>
                  <td colSpan={6} className="pt-4 pb-1 text-xs font-black uppercase tracking-wider text-amber-800">
                    {g.section}
                  </td>
                </tr>
                {g.rows.map((row) => {
                  const p = row.product;
                  return (
                    <tr key={p.id} className={`border-b border-slate-100 ${row.soldOut ? 'text-slate-400' : ''}`}>
                      <td className="py-1.5 pr-3">
                        <div>{p.name}</div>
                        {p.metal && p.pureOz !== undefined && (
                          <div className="text-[10px] text-slate-400">
                            {p.pureOz.toFixed(4)} oz {p.metal}
                            {row.melt !== null && ` × $${formatMoney(closes[p.metal])} = $${formatMoney(row.melt)}`}
                          </div>
                        )}
                        {!p.metal && <div className="text-[10px] text-slate-400">Priced by hand</div>}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono">
                        {row.melt !== null ? `$${formatMoney(row.melt)}` : '—'}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        {p.metal ? (
                          <input
                            aria-label={`Premium for ${p.name}`}
                            className={`${input} w-24 text-right font-mono`}
                            inputMode="decimal"
                            value={settings.premiums[p.id] ?? ''}
                            onChange={(e) => setMapValue('premiums', p.id, e.target.value)}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono">
                        {row.calculated !== null ? `$${formatMoney(row.calculated)}` : '—'}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        <input
                          aria-label={`My price for ${p.name}`}
                          className={`${input} w-28 text-right font-mono ${
                            row.myPrice !== null ? 'border-amber-500 bg-amber-50 font-bold' : ''
                          }`}
                          inputMode="decimal"
                          placeholder="optional"
                          value={settings.myPrices[p.id] ?? ''}
                          onChange={(e) => setMapValue('myPrices', p.id, e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${p.name} sold out`}
                          className="h-4 w-4 accent-amber-600"
                          checked={row.soldOut}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              soldOut: { ...prev.soldOut, [p.id]: e.target.checked },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      {/* Step 3: sheet details and sharing */}
      <section className="mx-auto mb-6 max-w-7xl rounded-xl border border-slate-300 bg-white p-5 print:hidden">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">3. Print or post</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-slate-600">
            Shop name
            <input
              className={`${input} mt-1 block w-full`}
              value={settings.shopName}
              onChange={(e) => update('shopName', e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Address and phone line
            <input
              className={`${input} mt-1 block w-full`}
              value={settings.shopLine}
              onChange={(e) => update('shopLine', e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Sheet title
            <input
              className={`${input} mt-1 block w-full`}
              value={settings.title}
              onChange={(e) => update('title', e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Note for this week (optional)
            <textarea
              className={`${input} mt-1 block w-full`}
              rows={2}
              placeholder="e.g. Due to high demand some items are sold out."
              value={settings.note}
              onChange={(e) => update('note', e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {canShareFiles && (
            <button type="button" className={`${primary} py-2.5`} onClick={shareImage}>
              Share image…
            </button>
          )}
          <button type="button" className={canShareFiles ? secondary : primary} onClick={downloadImage}>
            Save image for Facebook
          </button>
          <button type="button" className={secondary} onClick={copyPostText}>
            {copied ? 'Copied!' : 'Copy post text'}
          </button>
          <button type="button" className={secondary} onClick={() => window.print()}>
            Print sheet
          </button>
        </div>
        {shareMessage && <p className="mt-2 text-xs text-red-600">{shareMessage}</p>}
        <p className="mt-2 text-xs text-slate-500">
          Nothing is posted for you.{' '}
          {canShareFiles
            ? 'Share image opens your phone’s share menu, where you can pick Facebook or Save Image. You choose where it goes.'
            : 'Save the image, then add it to a Facebook post yourself with the copied text.'}
        </p>
      </section>

      {/* Preview: this is exactly what prints */}
      <h2 className="mx-auto mb-2 max-w-7xl text-xs font-bold uppercase tracking-wider text-slate-500 print:hidden">
        Preview
      </h2>
      <article className="mx-auto max-w-4xl rounded-lg bg-white p-4 shadow-xl sm:p-8 print:max-w-none print:rounded-none print:p-6 print:shadow-none">
        <header className="border-b-2 border-slate-300 pb-3">
          <p className="text-3xl font-black">{settings.shopName}</p>
          <p className="text-xl font-bold text-amber-800">{settings.title}</p>
          <p className="mt-1 font-mono text-sm text-slate-700">
            {settings.sheetDate}
            {SHEET_METALS.some((m) => closes[m] > 0) && (
              <>
                {'  ·  Close: '}
                {SHEET_METALS.filter((m) => closes[m] > 0)
                  .map((m) => `${METAL_SYMBOL[m]} $${formatMoney(closes[m])}`)
                  .join('  ')}
              </>
            )}
          </p>
        </header>
        <div className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2 print:grid-cols-2">
          {columns.map((col, i) => (
            <div key={i}>
              {col.map((g) => (
                <div key={g.section} className="mb-4 break-inside-avoid">
                  <p className="mb-1 text-sm font-black uppercase tracking-wider">{g.section}</p>
                  {g.rows.map((row) => (
                    <div
                      key={row.product.id}
                      className={`flex justify-between gap-3 border-b border-slate-200 py-0.5 text-[13px] ${
                        row.soldOut ? 'text-slate-400' : ''
                      }`}
                    >
                      <span>{row.product.name}</span>
                      <span className={`whitespace-nowrap font-mono ${row.soldOut ? 'italic' : 'font-bold'}`}>
                        {priceText(row)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
        {settings.note.trim() && <p className="mt-2 text-sm text-slate-700">{settings.note}</p>}
        <footer className="mt-4 border-t border-slate-300 pt-2 text-sm">
          <p className="font-bold">{settings.shopLine}</p>
          <p className="text-xs text-slate-500">Prices change with the market. Call to confirm availability.</p>
        </footer>
      </article>

      <AboutThisTool light />
    </main>
  );
}
