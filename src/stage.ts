// The GPU side: model.ts invertPixel on `lin`, linear Rec.709, in the decode
// phase, ahead of white balance and every tone tool, so they edit the
// positive. plainSource has core read a RAW scan as the sensor recorded it
// while the inversion is on. Stock 3 passes the negative through, at work, for
// the captures the pickers and Auto read. The host rewrites every whole word
// that matches a uniform key, so every local starts with "fn".

import { DEFAULT_NEGATIVE, RANGES } from "./model";
import { STAGE_ID } from "./params";
import type { ProcessingStageContribution, UniformDeclaration } from "./safelight";

const INVERT_GLSL = `
if (stock == 1 || stock == 2) {
  vec3 fnIn = stock == 2 ? vec3(dot(lin, vec3(0.2126, 0.7152, 0.0722))) : lin;
  vec3 fnBase = (stock == 2 ? vec3(base.r) : base) / 100.0;
  vec3 fnDensity = log2(max(fnIn, vec3(2.3283064365386963e-10)) / fnBase) * 0.30102999566398120;
  vec3 fnCorrected = high / dmax * fnDensity + high * offset * low;
  vec3 fnPrint = pow(max(exp2(exposure) * (1.0 + black / 100.0 - exp2(fnCorrected * 3.32192809488736235)), vec3(0.0)), vec3(grade));
  float fnGloss = gloss / 100.0;
  float fnRoll = max(1.0 - fnGloss, 1e-6);
  vec3 fnSoft = fnGloss + (1.0 - exp(-(fnPrint - fnGloss) / fnRoll)) * fnRoll;
  lin = mix(fnPrint, fnSoft, greaterThan(fnPrint, vec3(fnGloss)));
}`;

const n = DEFAULT_NEGATIVE;

const float = (key: keyof typeof RANGES, label: string, value: number): UniformDeclaration => ({
  key,
  glslType: "float",
  default: value,
  range: RANGES[key],
  label,
});

const vec3 = (key: "base" | "low" | "high", label: string): UniformDeclaration => ({
  key,
  glslType: "vec3",
  default: [...n[key]],
  label,
});

export function invertStage(): ProcessingStageContribution {
  return {
    id: STAGE_ID,
    name: "Film Negative",
    phase: "decode",
    priority: 900,
    glsl: INVERT_GLSL.trimStart(),
    uniforms: [
      { key: "stock", glslType: "int", default: 0, label: "Film type" },
      vec3("base", "Film base"),
      float("dmax", "D max", n.dmax),
      float("offset", "Scan bias", n.offset),
      vec3("low", "Shadows colour"),
      vec3("high", "Highlights white balance"),
      float("black", "Paper black", n.black),
      float("grade", "Paper grade", n.grade),
      float("gloss", "Paper gloss", n.gloss),
      float("exposure", "Print exposure", n.exposure),
    ],
    dormantWhen: { stock: 0 },
    plainSource: true,
  };
}
