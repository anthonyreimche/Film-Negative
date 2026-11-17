// Readings of the stage's input, a float frame of the negative: an area's
// mean, minimum and maximum for the pickers, and the frame's percentiles for
// Auto.

import { describe, expect, it } from "vitest";
import { areaStats, frameStats } from "../src/metering";
import { floatFrame } from "./support/fake-api";

describe("areaStats", () => {
  // Red runs with x, green with y, blue is flat.
  const frame = floatFrame(100, 50, (x, y) => [x / 100, y / 100, 0.25]);

  it("reads a dragged rectangle, corners in any order", () => {
    const stats = areaStats(frame, { x0: 0.5, y0: 0.6, x1: 0.1, y1: 0.2 }, "colour");
    [0.1, 0.1, 0.25].forEach((v, c) => expect(stats?.min[c]).toBeCloseTo(v, 6));
    expect(stats?.max[0]).toBeCloseTo(0.5, 6);
    expect(stats?.max[1]).toBeCloseTo(0.3, 6);
    expect(stats?.mean[0]).toBeCloseTo(0.3, 6);
    expect(stats?.mean[2]).toBeCloseTo(0.25, 6);
  });

  it("reads a click as a small square around it", () => {
    const stats = areaStats(frame, { x: 0.5, y: 0.5 }, "colour");
    expect(stats?.mean[0]).toBeCloseTo(0.5, 6);
    expect(stats?.min[0]).toBeLessThan(0.5);
    expect(stats?.max[0]).toBeGreaterThan(0.5);
  });

  it("reads B&W film as luminance on every channel", () => {
    const stats = areaStats(floatFrame(10, 10, () => [0.3, 0.2, 0.1]), { x0: 0, y0: 0, x1: 1, y1: 1 }, "bw");
    const y = 0.2126 * 0.3 + 0.7152 * 0.2 + 0.0722 * 0.1;
    stats?.mean.forEach((v) => expect(v).toBeCloseTo(y, 6));
  });

  it("reads nothing off the frame or on the host's blank 1×1 frame", () => {
    expect(areaStats(frame, { x: 1.5, y: 0.5 }, "colour")).toBeNull();
    expect(areaStats(floatFrame(1, 1, () => [1, 1, 1]), { x: 0.5, y: 0.5 }, "colour")).toBeNull();
  });
});

describe("frameStats", () => {
  // A rebate of bare film base round a picture whose transmission runs from
  // 0.02 to 0.5 across it.
  const BASE = [0.9, 0.4, 0.2] as const;
  const frame = floatFrame(200, 100, (x, y) => {
    if (x < 10 || x >= 190 || y < 5 || y >= 95) return BASE;
    const t = 0.02 + (0.48 * (x - 10)) / 179;
    return [t, t / 2, t / 4];
  });

  it("takes the film base from the whole frame's brightest", () => {
    frameStats(frame, "colour")?.base.forEach((v, c) => expect(v).toBeCloseTo(BASE[c], 6));
  });

  it("reads the densest and thinnest inside a 10 % border", () => {
    const stats = frameStats(frame, "colour");
    expect(stats?.dense[0]).toBeGreaterThan(0.02);
    expect(stats?.dense[0]).toBeLessThan(0.1);
    expect(stats?.thin[0]).toBeGreaterThan(0.4);
    expect(stats?.thin[0]).toBeLessThan(0.5);
  });

  it("reads nothing on the host's blank 1×1 frame", () => {
    expect(frameStats(floatFrame(1, 1, () => [1, 1, 1]), "colour")).toBeNull();
  });
});
