// The param bag: what the stage's uniforms read, and how the panel reads and
// writes it.

import { describe, expect, it } from "vitest";
import { BW_FILM, COLOUR_FILM, DEFAULT_NEGATIVE } from "../src/model";
import { MEASURE_BAG, STAGE_ID, key, negativePatch, readNegative } from "../src/params";

describe("readNegative", () => {
  it("reads an empty bag as off, with colour film's values", () => {
    expect(readNegative({})).toEqual(DEFAULT_NEGATIVE);
    expect(DEFAULT_NEGATIVE).toEqual({ ...COLOUR_FILM, stock: "off" });
  });

  it("reads what negativePatch wrote", () => {
    const n = { ...BW_FILM, stock: "bw" as const, base: [80, 81, 82] as const, exposure: 0.3 };
    expect(readNegative(negativePatch(n))).toEqual(n);
  });

  it("reads a value that isn't one as its default", () => {
    const bag = {
      [key("stock")]: 7,
      [key("dmax")]: Number.NaN,
      [key("base")]: [1, 2],
      [key("low")]: "1,1,1",
      [key("grade")]: null,
    };
    expect(readNegative(bag)).toEqual(DEFAULT_NEGATIVE);
  });

  it("clamps a value outside its range", () => {
    expect(readNegative({ [key("dmax")]: 40, [key("high")]: [0, 1, 9] })).toMatchObject({ dmax: 6, high: [0.25, 1, 2] });
  });
});

describe("negativePatch", () => {
  it("writes the stock as the stage's index and the colours as vec3", () => {
    expect(negativePatch({ stock: "colour", base: [90, 40, 20] })).toEqual({
      [`${STAGE_ID}.stock`]: 1,
      [`${STAGE_ID}.base`]: [90, 40, 20],
    });
    expect(negativePatch({ stock: "off" })).toEqual({ [key("stock")]: 0 });
    expect(negativePatch({ stock: "bw" })).toEqual({ [key("stock")]: 2 });
  });

  it("measures with stock 3, the pass-through the pickers read", () => {
    expect(MEASURE_BAG).toEqual({ [key("stock")]: 3 });
  });
});
