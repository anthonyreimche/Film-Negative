// The pickers and Auto on the open photo. Each reads the negative where the
// inversion reads it: a float capture at core's "decode" point with the stage
// passing the negative through (MEASURE_BAG), so a RAW scan arrives as the
// sensor recorded it. A picker reads the live view where it was dragged; Auto
// renders the whole photo as cropped. Each result is one undo step; a photo
// that changed while a reading was in flight gets nothing.

import { areaStats, frameStats, type Frame, type Uv, type UvRect } from "./metering";
import {
  autoNegative,
  baseAtStart,
  pickBase,
  pickBlack,
  pickDmax,
  pickExposure,
  pickHighlights,
  pickOffset,
  pickShadows,
  type Negative,
  type RGB,
} from "./model";
import { MEASURE_BAG, negativePatch, readNegative } from "./params";
import { api } from "./rt";
import type { DevelopState, FloatCaptureOptions } from "./safelight";

export type Result = { kind: "done"; status: string } | { kind: "failed"; reason: string };

export type PickerKind = "base" | "dmax" | "offset" | "low" | "high" | "black" | "exposure";

interface Picker {
  /** What it is called in the panel and the undo history. */
  name: string;
  /** What to drag over. */
  over: string;
  reads: "mean" | "min" | "max";
  apply: (n: Negative, v: RGB) => Partial<Negative>;
}

export const PICKERS: Readonly<Record<PickerKind, Picker>> = {
  base: { name: "Film base", over: "bare film, such as the rebate between frames", reads: "mean", apply: pickBase },
  dmax: { name: "D max", over: "the densest part of the film", reads: "min", apply: pickDmax },
  offset: { name: "Scan bias", over: "the thinnest part of the film", reads: "max", apply: pickOffset },
  low: { name: "Shadows colour", over: "something that should print neutral black", reads: "mean", apply: pickShadows },
  high: { name: "Highlights white balance", over: "something that should print neutral white", reads: "mean", apply: pickHighlights },
  black: { name: "Paper black", over: "the thinnest part of the picture", reads: "max", apply: pickBlack },
  exposure: { name: "Print exposure", over: "the densest part of the picture", reads: "min", apply: pickExposure },
};

const MEASURE: FloatCaptureOptions = { point: "decode", space: { encoding: "linear", primaries: "rec709" }, paramBag: { ...MEASURE_BAG } };
/** A picker's view frame: plenty for an area, small enough to read at once. */
const VIEW_EDGE = 1024;

const NO_PHOTO = "No photo is open.";
const NO_FRAME = "Couldn't read the photo: this graphics card has no float render targets.";
const MOVED_ON = "The photo changed before the reading finished.";
const OFF_FRAME = "That was off the image.";

/** Ends a reading whose answer would no longer be wanted or possible. */
class Stop extends Error {}

const develop = (): DevelopState => api.stores.useDevelopStore.getState();

interface Session {
  photoId: string;
  negative: Negative;
}

function begin(): Session {
  const s = develop();
  if (!s.photoId) throw new Stop(NO_PHOTO);
  return { photoId: s.photoId, negative: readNegative(s.paramBag) };
}

function checked(session: Session, frame: Frame | null): Frame {
  if (develop().photoId !== session.photoId) throw new Stop(MOVED_ON);
  if (!frame) throw new Stop(NO_FRAME);
  return frame;
}

function commit(session: Session, values: Partial<Negative>, label: string): void {
  if (develop().photoId !== session.photoId) throw new Stop(MOVED_ON);
  develop().setDynParams(negativePatch(values));
  void develop().commitEdit(`Film Negative ${label}`);
}

async function run(work: () => Promise<Result>): Promise<Result> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof Stop) return { kind: "failed", reason: err.message };
    console.warn("[film-negative] reading failed:", err);
    return { kind: "failed", reason: "The reading failed; see the console." };
  }
}

/** Set `kind` from the area dragged (or the spot clicked) on the live view. */
export function pickArea(kind: PickerKind, at: UvRect | Uv): Promise<Result> {
  return run(async () => {
    const session = begin();
    const s = develop();
    const frame = checked(session, await api.develop.captureFloatFrame(s.previewParams ?? s.params, { ...MEASURE, maxEdge: VIEW_EDGE }));
    const stats = areaStats(frame, at, session.negative.stock);
    if (!stats) throw new Stop(OFF_FRAME);
    const picker = PICKERS[kind];
    commit(session, picker.apply(session.negative, stats[picker.reads]), picker.name.toLowerCase());
    return { kind: "done", status: `${picker.name} set.` };
  });
}

/** Fit the whole photo (model.ts autoNegative). */
export function autoFit(): Promise<Result> {
  return run(async () => {
    const session = begin();
    const s = develop();
    const stock = session.negative.stock === "off" ? "colour" : session.negative.stock;
    const frame = checked(session, await api.develop.renderPhotoFloatFrame(session.photoId, s.previewParams ?? s.params, MEASURE));
    const reading = frameStats(frame, stock);
    if (!reading) throw new Stop(NO_FRAME);
    const start = { ...session.negative, stock };
    const measureBase = baseAtStart(start);
    const fitted = autoNegative(start, { dense: reading.dense, thin: reading.thin, ...(measureBase ? { base: reading.base } : {}) });
    commit(session, fitted, "auto");
    return { kind: "done", status: measureBase ? "Fitted, with the film base read from the frame." : "Fitted to the film base set." };
  });
}
