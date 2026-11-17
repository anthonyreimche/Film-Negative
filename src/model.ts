// The inversion, a port of darktable's negadoctor (src/iop/negadoctor.c,
// GPL-3.0-or-later): the scan's transmission becomes the film's density
// against its base, the density is corrected per channel, and the corrected
// density is printed on virtual paper with a black, a grade, a gloss and an
// exposure. invertPixel is the CPU twin of the stage's GLSL (stage.ts); the
// pick* functions are negadoctor's apply_auto_* pickers. Values are held in
// the panel's units: the film base, paper black and paper gloss in %, print
// exposure in EV.

export type RGB = readonly [number, number, number];

/** "off" leaves the photo exactly as without the extension. */
export type Stock = "off" | "colour" | "bw";

export interface Negative {
  stock: Stock;
  /** The film base's transmission per channel, %. darktable's Dmin. */
  base: RGB;
  /** The film's density range. */
  dmax: number;
  /** Scan exposure bias, in density. */
  offset: number;
  /** Shadows colour cast: darktable's wb_low. */
  low: RGB;
  /** Highlights white balance: darktable's wb_high. */
  high: RGB;
  /** Paper black, %. */
  black: number;
  /** Paper grade: the print's gamma. */
  grade: number;
  /** Paper gloss: where specular highlights start to roll off, %. */
  gloss: number;
  /** Print exposure, EV. */
  exposure: number;
}

export interface Range {
  min: number;
  max: number;
  step: number;
}

export const RANGES = {
  base: { min: 0.001, max: 150, step: 0.01 },
  dmax: { min: 0.1, max: 6, step: 0.001 },
  offset: { min: -1, max: 1, step: 0.001 },
  low: { min: 0.25, max: 2, step: 0.001 },
  high: { min: 0.25, max: 2, step: 0.001 },
  black: { min: -50, max: 50, step: 0.01 },
  grade: { min: 1, max: 8, step: 0.01 },
  gloss: { min: 0.01, max: 100, step: 0.01 },
  exposure: { min: -1, max: 1, step: 0.001 },
} as const satisfies Record<Exclude<keyof Negative, "stock">, Range>;

type Values = Omit<Negative, "stock">;

/** darktable's "color film" preset. */
export const COLOUR_FILM: Values = {
  base: [113, 49, 27],
  dmax: 1.6,
  offset: -0.05,
  low: [1, 1, 1],
  high: [1, 1, 1],
  black: 7.55,
  grade: 4,
  gloss: 75,
  exposure: Math.log2(0.9245),
};

/** darktable's "black and white film" preset. */
export const BW_FILM: Values = {
  base: [100, 100, 100],
  dmax: 2.2,
  offset: -0.05,
  low: [1, 1, 1],
  high: [1, 1, 1],
  black: 7.55,
  grade: 5,
  gloss: 75,
  exposure: 0,
};

export const DEFAULT_NEGATIVE: Negative = { stock: "off", ...COLOUR_FILM };

/** The starting values of a film type. */
export const startOf = (stock: Stock): Values => (stock === "bw" ? BW_FILM : COLOUR_FILM);

/** negadoctor's floor on the transmission, −32 EV. */
const THRESHOLD = 2.3283064365386963e-10;
const LUMA: RGB = [0.2126, 0.7152, 0.0722];

export const clampTo = (v: number, r: Range): number => Math.min(r.max, Math.max(r.min, v));
/** A picker's result in its range, or what it was where the area gives no
 *  answer (an area at the film base divides zero by zero). */
const settle = (v: number, was: number, r: Range): number => (Number.isFinite(v) ? clampTo(v, r) : was);
const settle3 = (v: readonly number[], was: RGB, r: Range): RGB => [settle(v[0], was[0], r), settle(v[1], was[1], r), settle(v[2], was[2], r)];
const each = (f: (c: number) => number): RGB => [f(0), f(1), f(2)];

/** What the stage reads as transmission: the scan, or for B&W film its
 *  luminance on every channel, so the positive is neutral. */
export function inputOf(stock: Stock, rgb: RGB): RGB {
  if (stock !== "bw") return rgb;
  const y = LUMA[0] * rgb[0] + LUMA[1] * rgb[1] + LUMA[2] * rgb[2];
  return [y, y, y];
}

/** The film base as a fraction, the red channel's on every channel for B&W. */
const baseOf = (n: Negative): RGB => each((c) => (n.stock === "bw" ? n.base[0] : n.base[c]) / 100);

/** −log10(Dmin / in): the density above the base, ≤ 0 on the film. */
const densityOf = (base: number, t: number): number => -Math.log10(base / Math.max(t, THRESHOLD));

/** negadoctor's _process_pixel, from the scan's linear RGB. */
export function invertPixel(n: Negative, scan: RGB): RGB {
  const input = inputOf(n.stock, scan);
  const base = baseOf(n);
  const exposure = 2 ** n.exposure;
  const black = n.black / 100;
  const gloss = n.gloss / 100;
  const roll = Math.max(1 - gloss, 1e-6);
  return each((c) => {
    const corrected = (n.high[c] / n.dmax) * densityOf(base[c], input[c]) + n.high[c] * n.offset * n.low[c];
    const print = Math.max(exposure * (1 + black - 10 ** corrected), 0) ** n.grade;
    return print > gloss ? gloss + (1 - Math.exp(-(print - gloss) / roll)) * roll : print;
  });
}

/** log10(Dmin / v) per channel: the density of `v` below the base. */
const depth = (n: Negative, v: RGB): RGB => {
  const base = baseOf(n);
  return each((c) => Math.log10(base[c] / Math.max(v[c], THRESHOLD)));
};

/** Film base: the area's mean. */
export const pickBase = (n: Negative, mean: RGB): Pick<Negative, "base"> => ({
  base: settle3(mean.map((v) => v * 100), n.base, RANGES.base),
});

/** D max: the largest density in the area's minimum. */
export const pickDmax = (n: Negative, min: RGB): Pick<Negative, "dmax"> => ({
  dmax: settle(Math.max(...depth(n, min)), n.dmax, RANGES.dmax),
});

/** Scan bias: the smallest density in the area's maximum, over D max. */
export const pickOffset = (n: Negative, max: RGB): Pick<Negative, "offset"> => ({
  offset: settle(Math.min(...depth(n, max)) / n.dmax, n.offset, RANGES.offset),
});

/** Shadows colour cast, from the mean of an area that should print black. */
export function pickShadows(n: Negative, mean: RGB): Pick<Negative, "low"> {
  const r = depth(n, mean).map((d) => d / n.dmax);
  const v = Math.min(...r);
  return { low: settle3(r.map((x) => v / x), n.low, RANGES.low) };
}

/** Highlights white balance, from the mean of an area that should print white. */
export function pickHighlights(n: Negative, mean: RGB): Pick<Negative, "high"> {
  const d = depth(n, mean);
  const r = each((c) => Math.abs(-1 / (n.offset * n.low[c] - d[c] / n.dmax)));
  const v = Math.min(...r);
  return { high: settle3(r.map((x) => x / v), n.high, RANGES.high) };
}

/** Paper black, from the area's maximum: its thinnest film prints just black. */
export function pickBlack(n: Negative, max: RGB): Pick<Negative, "black"> {
  const d = depth(n, max);
  const r = each((c) => 0.1 - (1 - 10 ** ((-d[c] * n.high[c]) / n.dmax + n.low[c] * n.offset * n.high[c])));
  return { black: settle(Math.max(...r) * 100, n.black, RANGES.black) };
}

/** Print exposure, from the area's minimum: its densest film prints at 0.96.
 *  As in negadoctor, the offset here isn't scaled by the highlights balance. */
export function pickExposure(n: Negative, min: RGB): Pick<Negative, "exposure"> {
  const d = depth(n, min);
  const black = n.black / 100;
  const r = each((c) => 0.96 / (1 - 10 ** ((-d[c] * n.high[c]) / n.dmax + n.low[c] * n.offset) + black));
  return { exposure: settle(Math.log2(Math.max(Math.min(...r), 2 ** RANGES.exposure.min)), n.exposure, RANGES.exposure) };
}

export interface FilmReading {
  /** The film base, when it is to be measured (Auto measures it unless set). */
  base?: RGB;
  /** The densest film per channel: the print's whites. */
  dense: RGB;
  /** The thinnest film per channel: the print's blacks. */
  thin: RGB;
}

/** Both colour balances at once, so the densest and the thinnest film each
 *  print neutral: every channel's corrected density then runs the same line
 *  between them. The highlights balance evens the channels' density ranges
 *  (the dye layers' contrasts), the shadows cast their starts; the channel
 *  that starts lowest keeps a cast of 1. Null where the reading can't say:
 *  a channel with no range, or no scan bias to scale the cast by. */
export function fitBalance(n: Negative, reading: Pick<FilmReading, "dense" | "thin">): Pick<Negative, "low" | "high"> | null {
  const thin = depth(n, reading.thin).map((d) => d / n.dmax);
  const dense = depth(n, reading.dense).map((d) => d / n.dmax);
  const range = thin.map((t, c) => dense[c] - t);
  if (range.some((r) => !(r > 0)) || !(n.offset > 0)) return null;
  const widest = Math.max(...range);
  const high = range.map((r) => widest / r);
  const start = high.map((h, c) => h * thin[c]);
  const m = start.indexOf(Math.min(...start));
  const target = high[m] * n.offset - start[m];
  const low = high.map((h, c) => (target + start[c]) / (h * n.offset));
  return { high: settle3(high, n.high, RANGES.high), low: settle3(low, n.low, RANGES.low) };
}

/** Auto, on a reading of the whole photo: negadoctor's pickers in its own
 *  order, with both colour balances fitted together (fitBalance) where the
 *  reading allows and negadoctor's two pickers where it doesn't. A film base
 *  is measured only when the reading brings one. Off turns into Colour. */
export function autoNegative(start: Negative, reading: FilmReading): Negative {
  let n: Negative = { ...start, stock: start.stock === "off" ? "colour" : start.stock };
  if (reading.base) n = { ...n, ...pickBase(n, reading.base) };
  n = { ...n, ...pickDmax(n, reading.dense) };
  n = { ...n, ...pickOffset(n, reading.thin) };
  const fitted = fitBalance(n, reading);
  if (fitted) n = { ...n, ...fitted };
  else {
    n = { ...n, ...pickShadows(n, reading.thin) };
    n = { ...n, ...pickHighlights(n, reading.dense) };
  }
  n = { ...n, ...pickBlack(n, reading.thin) };
  return { ...n, ...pickExposure(n, reading.dense) };
}

/** Whether the film base is still its film type's starting value. */
export const baseAtStart = (n: Negative): boolean => {
  const start = startOf(n.stock).base;
  return n.base.every((v, c) => v === start[c]);
};
