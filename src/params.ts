// The values the panel edits, held in the photo's param bag under the stage's
// id, in the panel's units (model.ts). The film type is the stage's `stock`
// uniform: 0 off, 1 colour, 2 B&W, and 3, which only a capture ever holds,
// passing the negative through for the pickers and Auto to read.

import { DEFAULT_NEGATIVE, RANGES, clampTo, type Negative, type RGB, type Range, type Stock } from "./model";

export const EXT_ID = "film-negative";
export const STAGE_ID = `${EXT_ID}.invert`;

export type Key = keyof Negative;
export const KEYS: readonly Key[] = ["stock", "base", "dmax", "offset", "low", "high", "black", "grade", "gloss", "exposure"];
export const key = (k: Key): string => `${STAGE_ID}.${k}`;

export const STOCK_INDEX: Readonly<Record<Stock, number>> = { off: 0, colour: 1, bw: 2 };
const STOCKS: readonly Stock[] = ["off", "colour", "bw"];
const COLOUR_KEYS = ["base", "low", "high"] as const;
const NUMBER_KEYS = ["dmax", "offset", "black", "grade", "gloss", "exposure"] as const;
const MEASURE = 3;

/** Over a capture's bag: the stage passes the negative through, at work, so
 *  the photo renders from the plain source as the inversion reads it. */
export const MEASURE_BAG: Readonly<Record<string, number>> = { [key("stock")]: MEASURE };

/** The host's per-photo bag, untyped: any extension writes it. */
type Bag = Readonly<Record<string, unknown>>;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function readNumber(bag: Bag, k: (typeof NUMBER_KEYS)[number]): number {
  const v = bag[key(k)];
  return finite(v) ? clampTo(v, RANGES[k]) : DEFAULT_NEGATIVE[k];
}

function readColour(bag: Bag, k: (typeof COLOUR_KEYS)[number]): RGB {
  const v = bag[key(k)];
  if (!Array.isArray(v) || v.length !== 3 || !v.every(finite)) return DEFAULT_NEGATIVE[k];
  const r: Range = RANGES[k];
  return [clampTo(v[0], r), clampTo(v[1], r), clampTo(v[2], r)];
}

function readStock(bag: Bag): Stock {
  const v = bag[key("stock")];
  return STOCKS.find((s) => STOCK_INDEX[s] === v) ?? DEFAULT_NEGATIVE.stock;
}

/** A missing or malformed value reads as its default; one out of range is clamped. */
export function readNegative(bag: Bag): Negative {
  return {
    stock: readStock(bag),
    base: readColour(bag, "base"),
    dmax: readNumber(bag, "dmax"),
    offset: readNumber(bag, "offset"),
    low: readColour(bag, "low"),
    high: readColour(bag, "high"),
    black: readNumber(bag, "black"),
    grade: readNumber(bag, "grade"),
    gloss: readNumber(bag, "gloss"),
    exposure: readNumber(bag, "exposure"),
  };
}

export function negativePatch(values: Partial<Negative>): Record<string, number | number[]> {
  const out: Record<string, number | number[]> = {};
  if (values.stock !== undefined) out[key("stock")] = STOCK_INDEX[values.stock];
  for (const k of COLOUR_KEYS) {
    const v = values[k];
    if (v !== undefined) out[key(k)] = [...v];
  }
  for (const k of NUMBER_KEYS) {
    const v = values[k];
    if (v !== undefined) out[key(k)] = v;
  }
  return out;
}
