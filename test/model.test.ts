// The maths, against a transcription of darktable's negadoctor.c (commit_params,
// _process_pixel and the apply_auto_* pickers) kept apart from src/model.ts, in
// darktable's own units: Dmin, black and soft_clip as fractions, exposure as a
// factor.

import { describe, expect, it } from "vitest";
import {
  BW_FILM,
  COLOUR_FILM,
  RANGES,
  autoNegative,
  inputOf,
  invertPixel,
  pickBase,
  pickBlack,
  pickDmax,
  pickExposure,
  pickHighlights,
  pickOffset,
  pickShadows,
  type Negative,
  type RGB,
} from "../src/model";

const THRESHOLD = 2.3283064365386963e-10;

interface DtParams {
  bw: boolean;
  Dmin: RGB;
  wb_high: RGB;
  wb_low: RGB;
  D_max: number;
  offset: number;
  black: number;
  gamma: number;
  soft_clip: number;
  exposure: number;
}

const dtOf = (n: Negative): DtParams => ({
  bw: n.stock === "bw",
  Dmin: [n.base[0] / 100, n.base[1] / 100, n.base[2] / 100],
  wb_high: n.high,
  wb_low: n.low,
  D_max: n.dmax,
  offset: n.offset,
  black: n.black / 100,
  gamma: n.grade,
  soft_clip: n.gloss / 100,
  exposure: 2 ** n.exposure,
});

/** negadoctor's commit_params and _process_pixel, for one pixel. */
function dtPixel(p: DtParams, pix: RGB): RGB {
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const Dmin = p.bw ? p.Dmin[0] : p.Dmin[c];
    const wbHigh = p.wb_high[c] / p.D_max;
    const offset = p.wb_high[c] * p.offset * p.wb_low[c];
    const black = -p.exposure * (1 + p.black);
    const logDensity = -Math.log10(Dmin / Math.max(pix[c], THRESHOLD));
    const corrected = wbHigh * logDensity + offset;
    const printLinear = Math.max(-(p.exposure * 10 ** corrected + black), 0);
    const printGamma = printLinear ** p.gamma;
    const comp = 1 - p.soft_clip;
    out[c] = printGamma > p.soft_clip ? p.soft_clip + (1 - Math.exp(-(printGamma - p.soft_clip) / comp)) * comp : printGamma;
  }
  return [out[0], out[1], out[2]];
}

const colour: Negative = { ...COLOUR_FILM, stock: "colour" };
const tuned: Negative = {
  ...colour,
  base: [96, 52, 31],
  dmax: 1.9,
  offset: -0.12,
  low: [1.1, 0.95, 0.8],
  high: [0.9, 1.05, 1.3],
  black: 3.2,
  grade: 3.4,
  gloss: 62,
  exposure: 0.25,
};

const close = (a: RGB, b: RGB, tolerance = 1e-9) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(tolerance));

describe("invertPixel", () => {
  const scans: RGB[] = [
    [0.9, 0.4, 0.22],
    [0.5, 0.2, 0.1],
    [0.12, 0.05, 0.03],
    [0.02, 0.01, 0.004],
    [1.13, 0.49, 0.27],
    [1.3, 0.6, 0.4],
  ];

  it.each([
    ["colour film", colour],
    ["tuned colour film", tuned],
  ])("matches negadoctor for %s", (_name, n) => {
    for (const scan of scans) close(invertPixel(n, scan), dtPixel(dtOf(n), scan));
  });

  it("turns the film base dark and the densest film light", () => {
    const base: RGB = [1.13, 0.49, 0.27];
    expect(Math.max(...invertPixel(colour, base))).toBeLessThan(0.01);
    const dense: RGB = [1.13 / 40, 0.49 / 40, 0.27 / 40];
    expect(Math.min(...invertPixel(colour, dense))).toBeGreaterThan(0.6);
  });

  it("guards zero and negative input as darktable's threshold does", () => {
    const out = invertPixel(colour, [0, -0.2, 0]);
    out.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    close(out, dtPixel(dtOf(colour), [THRESHOLD, THRESHOLD, THRESHOLD]));
  });

  it("stays finite with the gloss at 100 %", () => {
    const n = { ...colour, gloss: 100 };
    for (const scan of scans) invertPixel(n, scan).forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  it("is continuous where the gloss starts to roll off", () => {
    const n = { ...colour, gloss: 50 };
    // A transmission whose print value sits just either side of the gloss.
    const at = (t: number) => invertPixel(n, [t, t, t])[0];
    let lo = 1e-4;
    let hi = 1.13;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid) > 0.5) lo = mid;
      else hi = mid;
    }
    expect(Math.abs(at(lo) - at(hi))).toBeLessThan(1e-6);
  });

  it("makes a B&W negative neutral from its luminance, on the red film base", () => {
    const bw: Negative = { ...BW_FILM, stock: "bw", base: [80, 20, 5] };
    const out = invertPixel(bw, [0.3, 0.1, 0.05]);
    expect(out[1]).toBeCloseTo(out[0], 12);
    expect(out[2]).toBeCloseTo(out[0], 12);
    const y = 0.2126 * 0.3 + 0.7152 * 0.1 + 0.0722 * 0.05;
    close(out, dtPixel({ ...dtOf(bw), bw: true }, [y, y, y]));
  });

  it("tones B&W with the highlights white balance, as darktable keeps it", () => {
    const toned: Negative = { ...BW_FILM, stock: "bw", high: [1, 1, 1.3] };
    const out = invertPixel(toned, [0.2, 0.2, 0.2]);
    expect(out[2]).not.toBeCloseTo(out[0], 3);
  });
});

describe("inputOf", () => {
  it("is the scan for colour film and its luminance for B&W", () => {
    expect(inputOf("colour", [0.3, 0.2, 0.1])).toEqual([0.3, 0.2, 0.1]);
    const y = 0.2126 * 0.3 + 0.7152 * 0.2 + 0.0722 * 0.1;
    inputOf("bw", [0.3, 0.2, 0.1]).forEach((v) => expect(v).toBeCloseTo(y, 12));
  });
});

describe("pickers, as negadoctor's apply_auto_*", () => {
  const p = dtOf(tuned);
  const log10 = Math.log10;
  const t = (v: number) => Math.max(v, THRESHOLD);

  it("Film base takes the mean, in %", () => {
    expect(pickBase(tuned, [0.9, 0.41, 0.2])).toEqual({ base: [90, 41, 20] });
  });

  it("D max takes the largest density of the area's minimum", () => {
    const min: RGB = [0.05, 0.03, 0.02];
    const want = Math.max(...[0, 1, 2].map((c) => log10(p.Dmin[c] / t(min[c]))));
    expect(pickDmax(tuned, min).dmax).toBeCloseTo(want, 12);
  });

  it("Scan bias takes the smallest density of the area's maximum over D max", () => {
    const max: RGB = [0.8, 0.45, 0.25];
    const want = Math.min(...[0, 1, 2].map((c) => log10(p.Dmin[c] / t(max[c])) / p.D_max));
    expect(pickOffset(tuned, max).offset).toBeCloseTo(want, 12);
  });

  it("Shadows colour divides the smallest density by each channel's", () => {
    const mean: RGB = [0.7, 0.3, 0.12];
    const r = [0, 1, 2].map((c) => log10(p.Dmin[c] / t(mean[c])) / p.D_max);
    const v = Math.min(...r);
    const got = pickShadows(tuned, mean).low;
    got?.forEach((g, c) => expect(g).toBeCloseTo(v / r[c], 12));
  });

  it("Highlights white balance divides each channel by the smallest", () => {
    const mean: RGB = [0.08, 0.04, 0.025];
    const r = [0, 1, 2].map((c) => Math.abs(-1 / (p.offset * p.wb_low[c] - log10(p.Dmin[c] / t(mean[c])) / p.D_max)));
    const v = Math.min(...r);
    const got = pickHighlights(tuned, mean).high;
    got?.forEach((g, c) => expect(g).toBeCloseTo(r[c] / v, 12));
  });

  it("Paper black takes the largest of darktable's remap, in %", () => {
    const max: RGB = [0.8, 0.4, 0.22];
    const want = Math.max(
      ...[0, 1, 2].map((c) => {
        let v = -log10(p.Dmin[c] / t(max[c]));
        v *= p.wb_high[c] / p.D_max;
        v += p.wb_low[c] * p.offset * p.wb_high[c];
        return 0.1 - (1 - 10 ** v);
      }),
    );
    expect(pickBlack(tuned, max).black).toBeCloseTo(want * 100, 10);
  });

  it("Print exposure takes the smallest of darktable's remap, in EV", () => {
    const min: RGB = [0.05, 0.025, 0.015];
    const want = Math.min(
      ...[0, 1, 2].map((c) => {
        let v = -log10(p.Dmin[c] / t(min[c]));
        v *= p.wb_high[c] / p.D_max;
        v += p.wb_low[c] * p.offset;
        return 0.96 / (1 - 10 ** v + p.black);
      }),
    );
    expect(pickExposure(tuned, min).exposure).toBeCloseTo(Math.log2(Math.min(Math.max(want, 0.5), 2)), 10);
  });

  it("keeps every result inside its slider's range", () => {
    expect(pickDmax(tuned, [1e-12, 1e-12, 1e-12]).dmax).toBe(RANGES.dmax.max);
    expect(pickBase(tuned, [5, 5, 5]).base).toEqual([RANGES.base.max, RANGES.base.max, RANGES.base.max]);
  });
});

describe("autoNegative", () => {
  // A neutral grey scale shot on colour film: each dye layer has its own
  // contrast and the orange mask its own colour, so the scan is far from
  // neutral. A scene `stops` below white (−6 to 0) leaves transmission
  // base · 2^(−γ_c (stops + 6)): the darkest step is the bare base, and the
  // photo's thinnest picture area sits a stop above it, as fog leaves film.
  const BASE: RGB = [0.95, 0.42, 0.21];
  const GAMMA: RGB = [0.6, 0.65, 0.72];
  const scan = (stops: number): RGB => [
    BASE[0] * 2 ** (-(stops + 6) * GAMMA[0]),
    BASE[1] * 2 ** (-(stops + 6) * GAMMA[1]),
    BASE[2] * 2 ** (-(stops + 6) * GAMMA[2]),
  ];
  const STOPS = Array.from({ length: 21 }, (_, i) => -5 + i * 0.25);
  const thin = scan(-5);
  const dense = scan(0);

  it("takes the film base it is given and fits the rest", () => {
    const n = autoNegative({ ...COLOUR_FILM, stock: "off" }, { base: BASE, dense, thin });
    expect(n.stock).toBe("colour");
    n.base.forEach((b, c) => expect(b).toBeCloseTo(BASE[c] * 100, 9));
  });

  it("prints the grey scale neutral, black to near white", () => {
    const n = autoNegative({ ...COLOUR_FILM, stock: "colour" }, { base: BASE, dense, thin });
    for (const s of STOPS) {
      const out = invertPixel(n, scan(s));
      expect(Math.max(...out) - Math.min(...out), `spread at ${s} EV`).toBeLessThan(1e-6);
    }
    expect(Math.max(...invertPixel(n, thin))).toBeLessThan(0.01);
    // Print exposure puts the densest at 0.96 on the paper; the gloss rolls it off.
    expect(Math.min(...invertPixel(n, dense))).toBeGreaterThan(0.75);
  });

  it("falls back on negadoctor's own pickers where a channel has no range", () => {
    const flat: RGB = [0.5, 0.2, 0.1];
    const n = autoNegative({ ...COLOUR_FILM, stock: "colour" }, { base: BASE, dense: [0.1, 0.2, 0.05], thin: flat });
    Object.values(n).flat().forEach((v) => typeof v === "number" && expect(Number.isFinite(v)).toBe(true));
  });

  it("keeps a film base that is already set when none is given", () => {
    const set: Negative = { ...COLOUR_FILM, stock: "colour", base: [95, 42, 21] };
    expect(autoNegative(set, { dense, thin }).base).toEqual([95, 42, 21]);
  });
});
