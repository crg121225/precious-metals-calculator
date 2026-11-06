// Products on the shop's weekly "Bullion prices and availability" sheet.
//
// The list and order follow the shop's own handwritten sheet dated 10-31-26.
// Starting premiums are worked out from that sheet: his posted price minus the melt value
// at his posted Friday close. They are only a starting point. The owner sets every premium,
// can type his own price for any line, and can mark anything sold out.

export type SheetMetal = 'gold' | 'silver' | 'platinum' | 'palladium';

export const SHEET_METALS: SheetMetal[] = ['gold', 'silver', 'platinum', 'palladium'];

export const METAL_SYMBOL: Record<SheetMetal, string> = {
  gold: 'Au',
  silver: 'Ag',
  platinum: 'Plat',
  palladium: 'Pall',
};

export type SheetSection = 'Gold' | 'Gold Bars & World Gold' | 'Silver' | 'Platinum' | 'Palladium' | 'Other';

export const SECTIONS: SheetSection[] = ['Gold', 'Gold Bars & World Gold', 'Silver', 'Platinum', 'Palladium', 'Other'];

export interface SheetProduct {
  id: string;
  name: string;
  section: SheetSection;
  /** Metal the price follows. Omitted for items he prices by hand only (e.g. Goldbacks). */
  metal?: SheetMetal;
  /** Troy ounces of pure metal in one item (for 90% coin: per $1 face value). */
  pureOz?: number;
  /** Shown after the price, e.g. "x face" or "/ sleeve". */
  unitLabel?: string;
  /** His price on the 10-31-26 sheet. Undefined where he wrote N/A. */
  sheetPrice?: number;
  /** He wrote N/A on the 10-31-26 sheet. */
  startSoldOut?: boolean;
}

// Friday close he wrote at the top of the 10-31-26 sheet.
export const SHEET_DATE = '10-31-26';
export const SHEET_CLOSE: Record<SheetMetal, number> = {
  gold: 3876.4,
  silver: 49.25,
  platinum: 1439.0,
  palladium: 1001.0,
};

const G = 1 / 31.1035; // one gram in troy ounces

export const PRODUCTS: SheetProduct[] = [
  // Gold coins
  { id: 'age-1', name: 'American Gold Eagle 1 oz', section: 'Gold', metal: 'gold', pureOz: 1, startSoldOut: true },
  { id: 'age-1-2', name: '1/2 oz Gold Eagle', section: 'Gold', metal: 'gold', pureOz: 0.5, startSoldOut: true },
  { id: 'age-1-4', name: '1/4 oz Gold Eagle', section: 'Gold', metal: 'gold', pureOz: 0.25, sheetPrice: 1070 },
  { id: 'age-1-10', name: '1/10 oz Gold Eagle', section: 'Gold', metal: 'gold', pureOz: 0.1, sheetPrice: 440 },
  { id: 'gold-buffalo', name: 'Gold Buffalo 1 oz', section: 'Gold', metal: 'gold', pureOz: 1, sheetPrice: 4145 },
  { id: 'gold-maple', name: 'Gold Maple 1 oz', section: 'Gold', metal: 'gold', pureOz: 1, sheetPrice: 3980 },
  { id: 'gold-maple-1-10', name: '1/10 oz Gold Maple', section: 'Gold', metal: 'gold', pureOz: 0.1, sheetPrice: 446 },
  { id: 'gold-kanga', name: 'Gold Kangaroo 1 oz', section: 'Gold', metal: 'gold', pureOz: 1, sheetPrice: 3960 },
  { id: 'gold-krand', name: 'Krugerrand 1 oz', section: 'Gold', metal: 'gold', pureOz: 1, sheetPrice: 3940 },

  // Gold bars and world gold coins (pure-gold weight as written on his sheet)
  { id: 'gold-bar-1oz', name: 'Gold Bar 1 oz (RCM)', section: 'Gold Bars & World Gold', metal: 'gold', pureOz: 1, sheetPrice: 3980 },
  { id: 'gold-bar-1g', name: '1 g Gold Bar', section: 'Gold Bars & World Gold', metal: 'gold', pureOz: 1 * G, sheetPrice: 140 },
  { id: 'gold-bar-2g', name: '2 g Gold Bar', section: 'Gold Bars & World Gold', metal: 'gold', pureOz: 2 * G, sheetPrice: 287 },
  { id: 'gold-bar-2-5g', name: '2.5 g Gold Bar', section: 'Gold Bars & World Gold', metal: 'gold', pureOz: 2.5 * G, startSoldOut: true },
  { id: 'gold-bar-5g', name: '5 g Gold Bar', section: 'Gold Bars & World Gold', metal: 'gold', pureOz: 5 * G, sheetPrice: 678 },
  { id: 'sovereign', name: 'Gold Sovereign (.2355 AGW)', section: 'Gold Bars & World Gold', metal: 'gold', pureOz: 0.2355, sheetPrice: 925 },
  { id: '20-franc', name: '20 Franc Gold (.1867 AGW)', section: 'Gold Bars & World Gold', metal: 'gold', pureOz: 0.1867, sheetPrice: 735 },
  // His sheet shows ".603" next to this line; .0603 oz matches his $237 price, so that is used here.
  { id: 'peso-gold', name: 'Peso Gold (.0603 AGW)', section: 'Gold Bars & World Gold', metal: 'gold', pureOz: 0.0603, sheetPrice: 237 },
  { id: 'goldback', name: 'Goldback', section: 'Gold Bars & World Gold', unitLabel: '/ sleeve', sheetPrice: 7.85 },

  // Silver
  { id: '90-coin', name: '90% Coin (per $1 face)', section: 'Silver', metal: 'silver', pureOz: 0.715, unitLabel: 'x face', sheetPrice: 35.5 },
  { id: 'ase-current', name: 'American Silver Eagle (current year)', section: 'Silver', metal: 'silver', pureOz: 1, sheetPrice: 59 },
  { id: 'ase-backdate', name: 'Silver Eagle (backdate)', section: 'Silver', metal: 'silver', pureOz: 1, sheetPrice: 56.5 },
  { id: 'silver-kanga', name: 'Silver Kangaroo 1 oz', section: 'Silver', metal: 'silver', pureOz: 1, sheetPrice: 54.25 },
  { id: 'silver-maple', name: 'Silver Maple 1 oz', section: 'Silver', metal: 'silver', pureOz: 1, sheetPrice: 55.25 },
  { id: 'britannia', name: 'Silver Britannia 1 oz', section: 'Silver', metal: 'silver', pureOz: 1, sheetPrice: 54 },
  { id: 'harmonics', name: 'Philharmonic 1 oz', section: 'Silver', metal: 'silver', pureOz: 1, sheetPrice: 54 },
  { id: 'silver-generic', name: '1 oz Generic Round', section: 'Silver', metal: 'silver', pureOz: 1, sheetPrice: 53.75 },
  { id: 'silver-bar-1oz', name: '1 oz Silver Bar', section: 'Silver', metal: 'silver', pureOz: 1, sheetPrice: 53.75 },
  { id: 'canadian-2oz', name: '2 oz Canadian', section: 'Silver', metal: 'silver', pureOz: 2, sheetPrice: 110 },
  { id: 'silver-bar-10oz', name: '10 oz Silver Bar', section: 'Silver', metal: 'silver', pureOz: 10, sheetPrice: 530 },
  { id: 'silver-kilo', name: 'Kilo Silver Bar', section: 'Silver', metal: 'silver', pureOz: 1000 * G, sheetPrice: 1699 },
  { id: 'silver-100oz', name: '100 oz Silver Bar', section: 'Silver', metal: 'silver', pureOz: 100, sheetPrice: 5200 },
  { id: 'peace', name: 'Peace Dollar', section: 'Silver', metal: 'silver', pureOz: 0.7734, sheetPrice: 41.5 },
  { id: 'morgan', name: 'Morgan Dollar', section: 'Silver', metal: 'silver', pureOz: 0.7734, sheetPrice: 42 },
  { id: 'atb-5oz', name: '5 oz ATB', section: 'Silver', metal: 'silver', pureOz: 5, startSoldOut: true },
  { id: 'silver-bar-5oz', name: '5 oz Silver Bar', section: 'Silver', metal: 'silver', pureOz: 5, startSoldOut: true },
  { id: 'silver-100g', name: '100 g Silver Bar', section: 'Silver', metal: 'silver', pureOz: 100 * G, startSoldOut: true },

  // Platinum
  { id: 'plat-bar-1oz', name: '1 oz Platinum Bar', section: 'Platinum', metal: 'platinum', pureOz: 1, sheetPrice: 1635 },
  { id: 'plat-maple', name: '1 oz Platinum Maple', section: 'Platinum', metal: 'platinum', pureOz: 1, sheetPrice: 1655 },
  { id: 'plat-eagle', name: '1 oz Platinum Eagle', section: 'Platinum', metal: 'platinum', pureOz: 1, sheetPrice: 1745 },
  { id: 'plat-brit-1-10', name: '1/10 oz Platinum Britannia', section: 'Platinum', metal: 'platinum', pureOz: 0.1, sheetPrice: 167 },

  // Palladium
  { id: 'pall-bar-1oz', name: '1 oz Palladium Bar', section: 'Palladium', metal: 'palladium', pureOz: 1, sheetPrice: 1165 },
  { id: 'pall-bar-1-2oz', name: '1/2 oz Palladium Bar', section: 'Palladium', metal: 'palladium', pureOz: 0.5, sheetPrice: 583 },
];

export const meltValue = (p: SheetProduct, spot: Record<SheetMetal, number>): number | null =>
  p.metal && p.pureOz !== undefined ? p.pureOz * spot[p.metal] : null;

/**
 * Starting premium (dollars over melt) for each product, worked out from his 10-31-26 sheet.
 * Products he marked N/A start at $0 for him to fill in.
 */
export const startingPremium = (p: SheetProduct): number => {
  const melt = meltValue(p, SHEET_CLOSE);
  if (melt === null || p.sheetPrice === undefined) return 0;
  return Math.round((p.sheetPrice - melt) * 100) / 100;
};

export type Rounding = 'cent' | 'quarter' | 'dollar' | 'five';

export const ROUNDING_LABELS: Record<Rounding, string> = {
  cent: 'To the cent',
  quarter: 'Nearest 25¢',
  dollar: 'Nearest $1',
  five: 'Nearest $5',
};

export const roundPrice = (value: number, rounding: Rounding): number => {
  const step = { cent: 0.01, quarter: 0.25, dollar: 1, five: 5 }[rounding];
  return Math.round(value / step) * step;
};

export const formatMoney = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
