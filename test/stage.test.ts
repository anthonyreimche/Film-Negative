// The stage's contract with the host: where it runs, what it asks of core, and
// that its GLSL is the shape the host rewrites safely. The pixels themselves
// are checked on the real renderer (test/gpu).

import { describe, expect, it } from "vitest";
import { DEFAULT_NEGATIVE, RANGES } from "../src/model";
import { KEYS, STAGE_ID } from "../src/params";
import { invertStage } from "../src/stage";

const stage = invertStage();

describe("invertStage", () => {
  it("runs late in the decode phase, ahead of white balance", () => {
    expect(stage).toMatchObject({ id: STAGE_ID, phase: "decode", priority: 900 });
  });

  it("asks for the plain source and rests while off", () => {
    expect(stage.plainSource).toBe(true);
    expect(stage.dormantWhen).toEqual({ stock: 0 });
  });

  it("declares one uniform per value, with the defaults and ranges the panel uses", () => {
    expect(stage.uniforms.map((u) => u.key)).toEqual([...KEYS]);
    const by = Object.fromEntries(stage.uniforms.map((u) => [u.key, u]));
    expect(by.stock).toMatchObject({ glslType: "int", default: 0 });
    expect(by.base).toMatchObject({ glslType: "vec3", default: [...DEFAULT_NEGATIVE.base] });
    expect(by.low).toMatchObject({ glslType: "vec3", default: [1, 1, 1] });
    expect(by.dmax).toMatchObject({ glslType: "float", default: DEFAULT_NEGATIVE.dmax, range: RANGES.dmax });
    expect(by.exposure).toMatchObject({ glslType: "float", default: DEFAULT_NEGATIVE.exposure });
  });

  it("isn't maskable and leaves Dynamic's detail off, which an inversion would turn inside out", () => {
    expect(stage.mask).toBeUndefined();
    expect(stage.keepsDetail).toBeUndefined();
  });

  it("names no local after a uniform: the host rewrites every whole word that matches one", () => {
    const declared = [...stage.glsl.matchAll(/\b(?:float|vec3|bool|int)\s+(\w+)/g)].map((m) => m[1]);
    for (const name of declared) expect(KEYS).not.toContain(name);
    for (const name of declared) expect(name.startsWith("fn")).toBe(true);
  });

  it("reads no texture: one draw costs nothing beyond its arithmetic", () => {
    expect(stage.glsl).not.toMatch(/\btexture|texelFetch\b/);
    expect(stage.passes).toBeUndefined();
  });
});
