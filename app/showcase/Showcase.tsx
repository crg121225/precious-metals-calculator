'use client';

// Showcase cards: one picture of a piece in the case, with the answers people keep messaging about
// (item number, price or "price in store", and the in-store rules) printed right on the image.
//
// The owner stays in control: the photo never leaves his phone or computer, nothing is posted for him,
// and he decides what goes on every card. When a piece sells, he marks it SOLD and shares the updated card.

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import AboutThisTool from '../components/AboutThisTool';
import {
  canShareImageFiles,
  canvasToBlob,
  copyText,
  downloadBlob,
  shareImageFile,
  wrapLines,
} from '../lib/shareImage';

const STORAGE_KEY = 'rcj-showcase-v1';
const MAX_RECENT = 12;
const CARD_W = 1080;
const CARD_H = 1350; // 4:5, the tallest shape Facebook shows in the feed without cropping
const PHOTO_H = 880;
const PHOTO_MAX = 1080; // photos are shrunk to this size before saving on the device

interface CardData {
  itemNo: string;
  title: string;
  details: string;
  price: string;
  showPrice: boolean;
  sold: boolean;
}

interface SavedCard extends CardData {
  id: string;
  photo: string | null; // small JPEG kept only in this browser
  updatedAt: number;
}

interface ShowcaseSettings {
  shopName: string;
  shopLine: string;
  rulesLine: string;
  nextItemNo: number;
  showPriceDefault: boolean;
}

interface Stored {
  settings: ShowcaseSettings;
  recent: SavedCard[];
}

const defaultSettings: ShowcaseSettings = {
  shopName: 'Rockville Coin & Jewelry',
  shopLine: '110 S Market St, Rockville, IN · (765) 203-8680',
  rulesLine: 'Available in store only. First come, first served. No holds by message.',
  nextItemNo: 1001,
  showPriceDefault: true,
};

const loadStored = (): Stored => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stored>;
      return {
        settings: { ...defaultSettings, ...parsed.settings },
        recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      };
    }
  } catch {
    // fall through to defaults
  }
  return { settings: defaultSettings, recent: [] };
};

// Saves to this browser. If the device is short on space, drops the oldest cards until it fits.
const saveStored = (stored: Stored): boolean => {
  const recent = [...stored.recent];
  for (;;) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, recent }));
      return true;
    } catch {
      if (recent.length === 0) return false;
      recent.pop();
    }
  }
};

const blankCard = (settings: ShowcaseSettings): CardData => ({
  itemNo: String(settings.nextItemNo),
  title: '',
  details: '',
  price: '',
  showPrice: settings.showPriceDefault,
  sold: false,
});

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open that picture'));
    img.src = src;
  });

// Shrinks a picture so it is quick to work with and small enough to keep on the device.
const shrinkPhoto = async (file: File): Promise<string> => {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, PHOTO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
};

const priceLabel = (card: CardData) => {
  if (!card.showPrice) return 'Price in store';
  const n = parseFloat(card.price.replace(/[$,]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 'Price in store';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const postTextFor = (card: CardData, settings: ShowcaseSettings) => {
  const name = card.title.trim() || 'New in the showcase';
  if (card.sold) {
    return `SOLD: ${name} (Item #${card.itemNo}). Thank you! Stop in to see what's new in the showcase.`;
  }
  return [name, card.details.trim(), `Item #${card.itemNo} · ${priceLabel(card)}`, settings.rulesLine.trim()]
    .filter(Boolean)
    .join('\n');
};

function drawCard(
  canvas: HTMLCanvasElement,
  photo: HTMLImageElement | null,
  card: CardData,
  settings: ShowcaseSettings,
) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const font = 'Helvetica, Arial, sans-serif';
  const PAD = 56;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Photo, cropped to fill the top of the card
  if (photo) {
    const scale = Math.max(CARD_W / photo.naturalWidth, PHOTO_H / photo.naturalHeight);
    const w = photo.naturalWidth * scale;
    const h = photo.naturalHeight * scale;
    ctx.drawImage(photo, (CARD_W - w) / 2, (PHOTO_H - h) / 2, w, h);
  } else {
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, CARD_W, PHOTO_H);
    ctx.fillStyle = '#6b7280';
    ctx.font = `36px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('Add a photo of the piece', CARD_W / 2, PHOTO_H / 2);
    ctx.textAlign = 'left';
  }

  // Item number tag
  const tag = `Item #${card.itemNo}`;
  ctx.font = `bold 34px ${font}`;
  const tagW = ctx.measureText(tag).width + 40;
  ctx.fillStyle = 'rgba(17, 24, 39, 0.82)';
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(PAD - 20, 36, tagW, 60, 14);
    ctx.fill();
  } else {
    ctx.fillRect(PAD - 20, 36, tagW, 60); // older browsers without rounded rectangles
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(tag, PAD, 78);

  // SOLD stamp across the photo
  if (card.sold) {
    ctx.fillStyle = 'rgba(17, 24, 39, 0.35)';
    ctx.fillRect(0, 0, CARD_W, PHOTO_H);
    ctx.save();
    ctx.translate(CARD_W / 2, PHOTO_H / 2);
    ctx.rotate(-Math.PI / 9);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(-CARD_W, -95, CARD_W * 2, 190);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 150px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SOLD', 0, 8);
    ctx.restore();
  }

  // Text panel
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, PHOTO_H, CARD_W, CARD_H - PHOTO_H);
  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, PHOTO_H, CARD_W, 8);

  let y = PHOTO_H + 70;
  ctx.fillStyle = '#111827';
  ctx.font = `bold 46px ${font}`;
  for (const line of wrapLines(ctx, card.title.trim() || 'New in the showcase', CARD_W - PAD * 2, 2)) {
    ctx.fillText(line, PAD, y);
    y += 54;
  }
  if (card.details.trim()) {
    ctx.font = `30px ${font}`;
    ctx.fillStyle = '#374151';
    for (const line of wrapLines(ctx, card.details, CARD_W - PAD * 2, 1)) {
      ctx.fillText(line, PAD, y);
      y += 40;
    }
  }

  y += 30;
  if (card.sold) {
    ctx.font = `bold 52px ${font}`;
    ctx.fillStyle = '#b91c1c';
    ctx.fillText('SOLD · Thank you!', PAD, y);
  } else {
    const label = priceLabel(card);
    const isPrice = label.startsWith('$');
    ctx.font = isPrice ? `bold 64px ${font}` : `bold 48px ${font}`;
    ctx.fillStyle = '#92400e';
    ctx.fillText(label, PAD, y);
  }

  // Rules and shop line along the bottom
  ctx.font = `26px ${font}`;
  ctx.fillStyle = '#4b5563';
  const rules = card.sold ? 'Stop in to see what’s new in the showcase.' : settings.rulesLine;
  let by = CARD_H - 110;
  for (const line of wrapLines(ctx, rules, CARD_W - PAD * 2, 2).reverse()) {
    ctx.fillText(line, PAD, by);
    by -= 34;
  }
  ctx.font = `bold 28px ${font}`;
  ctx.fillStyle = '#111827';
  ctx.fillText(settings.shopName, PAD, CARD_H - 62);
  ctx.font = `24px ${font}`;
  ctx.fillStyle = '#4b5563';
  ctx.fillText(settings.shopLine, PAD, CARD_H - 28);
}

export default function Showcase() {
  const [stored, setStored] = useState<Stored>(loadStored);
  const { settings, recent } = stored;
  const [card, setCard] = useState<CardData>(() => blankCard(stored.settings));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canShare = canShareImageFiles();

  // Save to this browser whenever the list or settings change.
  const [storageFull, setStorageFull] = useState(false);
  useEffect(() => {
    if (!saveStored(stored)) queueMicrotask(() => setStorageFull(true));
  }, [stored]);

  // Load the chosen photo into an image the card can draw.
  useEffect(() => {
    let cancelled = false;
    if (!photoSrc) {
      queueMicrotask(() => !cancelled && setPhotoImg(null));
      return () => {
        cancelled = true;
      };
    }
    loadImage(photoSrc)
      .then((img) => !cancelled && setPhotoImg(img))
      .catch(() => !cancelled && setMessage('Could not open that picture. Try a different one.'));
    return () => {
      cancelled = true;
    };
  }, [photoSrc]);

  // Redraw the live preview whenever anything on the card changes.
  useEffect(() => {
    if (previewRef.current) drawCard(previewRef.current, photoImg, card, settings);
  }, [photoImg, card, settings]);

  const updateCard = <K extends keyof CardData>(key: K, value: CardData[K]) =>
    setCard((prev) => ({ ...prev, [key]: value }));

  const updateSettings = <K extends keyof ShowcaseSettings>(key: K, value: ShowcaseSettings[K]) =>
    setStored((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage('');
    try {
      setPhotoSrc(await shrinkPhoto(file));
    } catch {
      setMessage('Could not open that picture. Try a different one.');
    }
  };

  // Adds the card to the recent list (or updates it), so it can be marked sold later.
  const keepCard = () => {
    const id = editingId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const saved: SavedCard = { ...card, id, photo: photoSrc, updatedAt: Date.now() };
    setStored((prev) => {
      const isNew = !prev.recent.some((r) => r.id === id);
      const typedNo = parseInt(card.itemNo, 10);
      const nextItemNo =
        isNew && Number.isFinite(typedNo) && typedNo >= prev.settings.nextItemNo ? typedNo + 1 : prev.settings.nextItemNo;
      return {
        settings: { ...prev.settings, nextItemNo },
        recent: [saved, ...prev.recent.filter((r) => r.id !== id)].slice(0, MAX_RECENT),
      };
    });
    setEditingId(id);
  };

  const makeBlob = async () => {
    const canvas = document.createElement('canvas');
    drawCard(canvas, photoImg, card, settings);
    return canvasToBlob(canvas, 'image/jpeg', 0.9);
  };

  const fileName = `showcase-item-${card.itemNo}${card.sold ? '-sold' : ''}.jpg`;

  const onShare = async () => {
    setBusy(true);
    setMessage('');
    keepCard();
    const blob = await makeBlob();
    if (blob) setMessage(await shareImageFile(blob, fileName, postTextFor(card, settings)));
    setBusy(false);
  };

  const onSave = async () => {
    setBusy(true);
    setMessage('');
    keepCard();
    const blob = await makeBlob();
    if (blob) downloadBlob(blob, fileName);
    setBusy(false);
  };

  const onCopy = async () => {
    const ok = await copyText(postTextFor(card, settings));
    setMessage(ok ? 'Post text copied.' : 'Could not copy here. Select the text below and copy it yourself.');
  };

  const newCard = () => {
    setCard(blankCard(settings));
    setEditingId(null);
    setPhotoSrc(null);
    setMessage('');
  };

  const openCard = (saved: SavedCard, markSold = false) => {
    const { itemNo, title, details, price, showPrice, sold } = saved;
    setCard({ itemNo, title, details, price, showPrice, sold: markSold ? true : sold });
    setEditingId(saved.id);
    setPhotoSrc(saved.photo);
    setMessage(markSold ? 'Marked SOLD. Share the updated card when you’re ready.' : '');
    if (markSold) {
      setStored((prev) => ({
        ...prev,
        recent: prev.recent.map((r) => (r.id === saved.id ? { ...r, sold: true, updatedAt: Date.now() } : r)),
      }));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeCard = (id: string) => {
    if (!window.confirm('Remove this card from your list? (It does not touch anything already posted.)')) return;
    setStored((prev) => ({ ...prev, recent: prev.recent.filter((r) => r.id !== id) }));
    if (editingId === id) setEditingId(null);
  };

  const input =
    'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-amber-600 focus:outline-none';
  const button =
    'rounded-full border px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-50';
  const primary = `${button} border-amber-700 bg-amber-600 text-white hover:bg-amber-500`;
  const secondary = `${button} border-slate-300 bg-white text-slate-700 hover:border-slate-500`;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      <header className="mx-auto mb-6 max-w-6xl">
        <Link href="/" className="text-xs font-bold text-amber-700 hover:underline">
          ← Back to the pricing calculator
        </Link>
        <h1 className="mt-1 text-2xl font-black tracking-tight">Showcase Cards</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          One picture with the answers already on it: item number, price (or &ldquo;price in store&rdquo;) and your
          in-store rules. Fewer &ldquo;how much?&rdquo; and &ldquo;is it still available?&rdquo; messages.
        </p>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
        {/* Editor */}
        <section className="space-y-4 rounded-xl border border-slate-300 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              {editingId ? `Editing item #${card.itemNo}` : 'New card'}
            </h2>
            {editingId && (
              <button type="button" className={secondary} onClick={newCard}>
                + New card
              </button>
            )}
          </div>

          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
            <button type="button" className={`${primary} w-full`} onClick={() => fileRef.current?.click()}>
              {photoSrc ? 'Change photo' : 'Take or choose a photo'}
            </button>
            <p className="mt-1 text-[11px] text-slate-500">The photo stays on this device. It is never uploaded.</p>
          </div>

          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <label className="text-xs text-slate-600">
              Item #
              <input
                className={input}
                inputMode="numeric"
                value={card.itemNo}
                onChange={(e) => updateCard('itemNo', e.target.value)}
              />
            </label>
            <label className="text-xs text-slate-600">
              What is it?
              <input
                className={input}
                placeholder="e.g. Sterling & turquoise cuff"
                value={card.title}
                onChange={(e) => updateCard('title', e.target.value)}
              />
            </label>
          </div>

          <label className="block text-xs text-slate-600">
            Details (optional)
            <input
              className={input}
              placeholder="e.g. Signed, size 8, 32 grams"
              value={card.details}
              onChange={(e) => updateCard('details', e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 items-end gap-3">
            <label className="text-xs text-slate-600">
              Price
              <input
                className={`${input} font-mono ${card.showPrice ? '' : 'opacity-40'}`}
                inputMode="decimal"
                placeholder="0.00"
                disabled={!card.showPrice}
                value={card.price}
                onChange={(e) => updateCard('price', e.target.value)}
              />
            </label>
            <div className="flex rounded-md border border-slate-300 p-1 text-xs font-bold">
              <button
                type="button"
                aria-pressed={card.showPrice}
                onClick={() => updateCard('showPrice', true)}
                className={`flex-1 rounded px-2 py-2 ${card.showPrice ? 'bg-amber-600 text-white' : 'text-slate-600'}`}
              >
                Show price
              </button>
              <button
                type="button"
                aria-pressed={!card.showPrice}
                onClick={() => updateCard('showPrice', false)}
                className={`flex-1 rounded px-2 py-2 ${!card.showPrice ? 'bg-amber-600 text-white' : 'text-slate-600'}`}
              >
                Price in store
              </button>
            </div>
          </div>

          <button
            type="button"
            aria-pressed={card.sold}
            onClick={() => updateCard('sold', !card.sold)}
            className={`w-full rounded-md border px-3 py-2.5 text-sm font-bold ${
              card.sold ? 'border-red-700 bg-red-700 text-white' : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            {card.sold ? 'SOLD (tap to mark available)' : 'Available (tap to mark SOLD)'}
          </button>

          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            {canShare && (
              <button type="button" className={primary} onClick={onShare} disabled={busy}>
                Share image…
              </button>
            )}
            <button type="button" className={canShare ? secondary : primary} onClick={onSave} disabled={busy}>
              Save image
            </button>
            <button type="button" className={secondary} onClick={onCopy}>
              Copy post text
            </button>
          </div>
          {message && <p className="text-xs text-slate-600">{message}</p>}
          {storageFull && (
            <p className="text-xs text-red-600">
              This device is out of room for saved cards. Remove a few old ones from the list below.
            </p>
          )}
          <p className="text-[11px] text-slate-500">
            Nothing is posted for you. {canShare ? 'Share opens your phone’s menu; you pick where it goes. ' : ''}
            Sharing or saving also keeps the card in your list below, so you can mark it SOLD later.
          </p>

          <details className="rounded-md border border-slate-200 p-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-bold">Post text and card settings</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 font-sans text-slate-700">
              {postTextFor(card, settings)}
            </pre>
            <label className="mt-3 block">
              Rules line on every card
              <input
                className={input}
                value={settings.rulesLine}
                onChange={(e) => updateSettings('rulesLine', e.target.value)}
              />
            </label>
            <label className="mt-2 block">
              Shop name
              <input
                className={input}
                value={settings.shopName}
                onChange={(e) => updateSettings('shopName', e.target.value)}
              />
            </label>
            <label className="mt-2 block">
              Address and phone line
              <input
                className={input}
                value={settings.shopLine}
                onChange={(e) => updateSettings('shopLine', e.target.value)}
              />
            </label>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-600"
                checked={settings.showPriceDefault}
                onChange={(e) => updateSettings('showPriceDefault', e.target.checked)}
              />
              Show prices on new cards by default
            </label>
          </details>
        </section>

        {/* Live preview */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Preview</h2>
          <canvas
            ref={previewRef}
            width={CARD_W}
            height={CARD_H}
            className="w-full rounded-lg bg-white shadow-xl"
            aria-label="Showcase card preview"
          />
        </section>
      </div>

      {/* Recent cards */}
      <section className="mx-auto mt-8 max-w-6xl rounded-xl border border-slate-300 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Your recent cards</h2>
        <p className="mt-1 text-xs text-slate-500">
          Saved only on this device (the last {MAX_RECENT}). When something sells, tap <strong>Mark sold</strong>,
          then share the updated card.
        </p>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No cards yet.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((r) => (
              <li key={r.id} className="flex gap-3 rounded-lg border border-slate-200 p-2">
                {r.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local photo kept in this browser
                  <img src={r.photo} alt="" className="h-20 w-20 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded bg-slate-200" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    #{r.itemNo} {r.title || 'Untitled'}
                  </p>
                  <p className={`text-xs ${r.sold ? 'font-bold text-red-700' : 'text-slate-500'}`}>
                    {r.sold ? 'SOLD' : priceLabel(r)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                      onClick={() => openCard(r)}
                    >
                      Open
                    </button>
                    {!r.sold && (
                      <button
                        type="button"
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                        onClick={() => openCard(r, true)}
                      >
                        Mark sold
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-slate-400 hover:text-red-600"
                      onClick={() => removeCard(r.id)}
                      aria-label={`Remove item ${r.itemNo} from list`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AboutThisTool light />
    </main>
  );
}
