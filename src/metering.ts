// Readings of the negative as the stage reads it: float frames (RGBA, rows
// top-down) captured at the stage's input. The pickers take an area's mean,
// minimum and maximum per channel, as darktable's colour pickers hand
// negadoctor; Auto takes percentiles of the whole frame.

import { inputOf, type FilmReading, type RGB, type Stock } from "./model";

export interface Frame {
  data: Float32Array;
  width: number;
  height: number;
}

export interface Uv {
  x: number;
  y: number;
}

/** A rectangle in the frame's 0–1 coordinates, corners in any order. */
export interface UvRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface AreaStats {
  mean: RGB;
  min: RGB;
  max: RGB;
}

/** A click reads a square this share of the long edge across each way of it (2 px at least). */
const SPOT_REACH = 0.01;
/** Auto reads the picture inside this share of the frame on every side, clear of a rebate or holder. */
const BORDER = 0.1;
/** Auto's film base: the brightest of the whole frame, a rebate in frame included. */
const BASE_QUANTILE = 0.999;
/** Auto's densest and thinnest picture areas, short of dust and specular glints. */
const DENSE_QUANTILE = 0.005;
const THIN_QUANTILE = 0.995;

/** The host's "no renderer" frame is 1×1. */
const blank = (f: Frame) => f.width < 2 && f.height < 2;

const pixel = (f: Frame, x: number, y: number, stock: Stock): RGB => {
  const i = 4 * (y * f.width + x);
  return inputOf(stock, [f.data[i], f.data[i + 1], f.data[i + 2]]);
};

const column = (f: Frame, u: number) => Math.min(f.width - 1, Math.max(0, Math.floor(u * f.width)));
const row = (f: Frame, v: number) => Math.min(f.height - 1, Math.max(0, Math.floor(v * f.height)));

/** The pixels a picker reads: a dragged rectangle, or a small square round a click. */
function bounds(f: Frame, at: UvRect | Uv): { x0: number; y0: number; x1: number; y1: number } {
  if ("x0" in at) {
    return {
      x0: column(f, Math.min(at.x0, at.x1)),
      y0: row(f, Math.min(at.y0, at.y1)),
      x1: column(f, Math.max(at.x0, at.x1)),
      y1: row(f, Math.max(at.y0, at.y1)),
    };
  }
  const reach = Math.max(2, Math.floor(SPOT_REACH * Math.max(f.width, f.height)));
  const x = column(f, at.x);
  const y = row(f, at.y);
  return {
    x0: Math.max(0, x - reach),
    y0: Math.max(0, y - reach),
    x1: Math.min(f.width - 1, x + reach),
    y1: Math.min(f.height - 1, y + reach),
  };
}

const offFrame = (at: UvRect | Uv) =>
  "x0" in at ? Math.max(at.x0, at.x1) < 0 || Math.min(at.x0, at.x1) > 1 || Math.max(at.y0, at.y1) < 0 || Math.min(at.y0, at.y1) > 1 : at.x < 0 || at.x > 1 || at.y < 0 || at.y > 1;

/** The area's mean, minimum and maximum per channel, read as `stock` reads
 *  the scan; null off the frame or on a blank one. */
export function areaStats(f: Frame, at: UvRect | Uv, stock: Stock): AreaStats | null {
  if (blank(f) || offFrame(at)) return null;
  const b = bounds(f, at);
  const sum = [0, 0, 0];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let n = 0;
  for (let y = b.y0; y <= b.y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      const p = pixel(f, x, y, stock);
      for (let c = 0; c < 3; c++) {
        sum[c] += p[c];
        min[c] = Math.min(min[c], p[c]);
        max[c] = Math.max(max[c], p[c]);
      }
      n++;
    }
  }
  return {
    mean: [sum[0] / n, sum[1] / n, sum[2] / n],
    min: [min[0], min[1], min[2]],
    max: [max[0], max[1], max[2]],
  };
}

function quantiles(values: Float32Array[], q: number): RGB {
  const at = (v: Float32Array) => v[Math.min(v.length - 1, Math.max(0, Math.round(q * (v.length - 1))))];
  return [at(values[0]), at(values[1]), at(values[2])];
}

function channels(f: Frame, stock: Stock, inset: number): Float32Array[] {
  const x0 = Math.floor(inset * f.width);
  const y0 = Math.floor(inset * f.height);
  const x1 = Math.max(x0 + 1, f.width - x0);
  const y1 = Math.max(y0 + 1, f.height - y0);
  const out = [0, 1, 2].map(() => new Float32Array((x1 - x0) * (y1 - y0)));
  let i = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++, i++) {
      const p = pixel(f, x, y, stock);
      out[0][i] = p[0];
      out[1][i] = p[1];
      out[2][i] = p[2];
    }
  }
  for (const c of out) c.sort();
  return out;
}

/** Auto's reading: the film base from the whole frame, the densest and
 *  thinnest film inside the border; null on a blank frame. */
export function frameStats(f: Frame, stock: Stock): Required<FilmReading> | null {
  if (blank(f)) return null;
  const inner = channels(f, stock, BORDER);
  return {
    base: quantiles(channels(f, stock, 0), BASE_QUANTILE),
    dense: quantiles(inner, DENSE_QUANTILE),
    thin: quantiles(inner, THIN_QUANTILE),
  };
}
