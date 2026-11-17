// The stage on the real renderer. Run via `npm run test:gpu` (run.cjs copies
// this file into a SafeLight checkout and runs it under its headless Chromium
// + SwiftShader rig). What the CPU suite cannot check:
//  • installing Film Negative changes no photo while it is off: every frame is
//    bit-identical with and without it;
//  • the stage compiles with the host's namespacing and renders model.ts
//    invertPixel, for colour and B&W film;
//  • while it is on, a RAW scan reaches it without the baseline tone
//    (plainSource), and stock 3 hands the pickers that scan unchanged at the
//    "decode" capture point.
//
// Frames are read at "decode", right after the decode stages, so nothing
// after the inversion moves its output before the read. References start
// from the stage's own input as captured, so the RGBA16F upload doesn't count.

import { describe, expect, it } from "vitest";
import { BW_FILM, COLOUR_FILM, invertPixel, type Negative, type RGB } from "@fn/model";
import { MEASURE_BAG, negativePatch } from "@fn/params";
import { invertStage } from "@fn/stage";
import { CURRENT_PROCESS_VERSION } from "@/catalog/types";
import { baselineTone } from "@/rendering/baseline-tone";
import { LINEAR_PROBE_PIPELINE, builtinStages, floatImage, identityParams, withRenderer } from "@/rendering/webgl/webgl.test-support";

const W = 64;
const H = 48;

/** A scanned negative: the orange base at the left, denser to the right,
 *  each row a different dye balance. */
const SCAN = floatImage(W, H, (x, y) => {
  const t = 0.9 * 2 ** (-7 * (x / (W - 1)));
  const u = y / (H - 1);
  return [t * (1 - 0.1 * u), t * (0.45 + 0.1 * u), t * (0.22 + 0.05 * Math.sin(6 * u))];
});

type Bag = Record<string, unknown>;

/** The linear probe, keeping the RAW baseline as the built-in transform does. */
const PROBE = { ...LINEAR_PROBE_PIPELINE, skipBaseCurve: false, sig: "fn.linear-probe+baseline" };

function frames(bags: Record<string, Bag>, withStage = true): Record<string, Float32Array> {
  const out: Record<string, Float32Array> = {};
  const stages = withStage ? [...builtinStages(), invertStage()] : builtinStages();
  withRenderer({ stages, pipeline: PROBE }, (renderer) => {
    renderer.setImage(SCAN);
    renderer.setParams(identityParams({ processVersion: CURRENT_PROCESS_VERSION }));
    for (const [name, bag] of Object.entries(bags)) {
      renderer.setContributedParams(bag);
      const frame = renderer.readFloatFrame("decode");
      if (!frame) throw new Error("readFloatFrame returned null");
      out[name] = frame.data;
    }
  });
  return out;
}

const pixelOf = (data: Float32Array, i: number): RGB => [data[4 * i], data[4 * i + 1], data[4 * i + 2]];

function expectInverted(n: Negative) {
  const { input, output } = frames({ input: { ...MEASURE_BAG }, output: negativePatch(n) });
  let worst = 0;
  for (let i = 0; i < W * H; i++) {
    const want = invertPixel(n, pixelOf(input, i));
    const got = pixelOf(output, i);
    for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(got[c] - want[c]) / Math.max(1, Math.abs(want[c])));
  }
  expect(worst).toBeLessThan(2e-3);
}

describe("Film Negative on the renderer", () => {
  it("changes nothing while off", () => {
    const off = negativePatch({ ...COLOUR_FILM, stock: "off" });
    const ours = frames({ off }).off;
    const without = frames({ off: {} }, false).off;
    expect(ours.every((v, i) => v === without[i])).toBe(true);
  });

  it("inverts colour film as model.ts does", () => {
    expectInverted({ ...COLOUR_FILM, stock: "colour", base: [90, 40, 20], dmax: 2, offset: -0.1, low: [1.1, 1, 0.9], high: [0.95, 1, 1.2] });
  });

  it("inverts B&W film as model.ts does, neutral", () => {
    const n: Negative = { ...BW_FILM, stock: "bw", base: [50, 50, 50] };
    expectInverted(n);
    const out = frames({ out: negativePatch(n) }).out;
    for (let i = 0; i < W * H; i++) {
      const [r, g, b] = pixelOf(out, i);
      expect(Math.abs(r - g) + Math.abs(r - b)).toBeLessThan(1e-4);
    }
  });

  it("hands the pickers the scan without the baseline tone", () => {
    const { plain, rest } = frames({ plain: { ...MEASURE_BAG }, rest: {} });
    // At rest the RAW baseline tone has lifted the scan by the decode point
    // (the camera refit comes after it); measuring, nothing has.
    let lifted = 0;
    for (let i = 0; i < plain.length / 4; i++) {
      const p = pixelOf(plain, i);
      const r = pixelOf(rest, i);
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(r[c] - baselineTone(p[c]))).toBeLessThan(2e-3);
        lifted = Math.max(lifted, r[c] - p[c]);
      }
    }
    expect(lifted).toBeGreaterThan(0.05);
    // The bare base at the left edge arrives as scanned.
    const brightest = Math.max(...Array.from({ length: plain.length / 4 }, (_, i) => plain[4 * i]));
    expect(Math.abs(brightest - 0.9)).toBeLessThan(2e-3);
  });
});
