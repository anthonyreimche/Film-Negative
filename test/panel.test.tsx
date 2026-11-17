// The panel: film type, the rows each film type shows, the pickers on the
// image and Auto. Every row edits the stage's values in the photo's bag.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activate } from "../src/index";
import { BW_FILM, COLOUR_FILM, DEFAULT_NEGATIVE } from "../src/model";
import { MEASURE_BAG, key, negativePatch, readNegative } from "../src/params";
import { AreaOverlay, FilmNegativePanel } from "../src/Panel";
import { React } from "../src/rt";
import { fakeApi, floatFrame, type RigOptions } from "./support/fake-api";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const NEGATIVE = [0.8, 0.36, 0.18] as const;

function setup(options: RigOptions = {}) {
  const rig = fakeApi(options);
  activate(rig.api);
  rig.setRender(() => floatFrame(40, 30, () => NEGATIVE));
  const view = render(<FilmNegativePanel />);
  return { rig, view };
}

const flush = () => act(() => vi.advanceTimersByTimeAsync(0));
const labels = (rig: ReturnType<typeof fakeApi>, root: ParentNode) => rig.sliders(root).map((s) => s.label);
const section = (name: string) => screen.getByRole("region", { name });
const colourBag = (over = {}) => negativePatch({ ...COLOUR_FILM, stock: "colour", ...over });

/** Drag across the middle of a 400×300 image with the picker's overlay. */
function dragAcross() {
  const overlay = render(React.createElement(AreaOverlay, { rect: { x: 0, y: 0, w: 400, h: 300 } }));
  const surface = overlay.getByTestId("area-surface");
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 400, height: 300 }));
  Object.defineProperty(surface, "offsetWidth", { value: 400 });
  Object.defineProperty(surface, "offsetHeight", { value: 300 });
  fireEvent.pointerDown(surface, { clientX: 100, clientY: 60, pointerId: 1, button: 0 });
  fireEvent.pointerMove(surface, { clientX: 300, clientY: 240, pointerId: 1 });
  fireEvent.pointerUp(surface, { clientX: 300, clientY: 240, pointerId: 1 });
}

describe("film type", () => {
  it("starts off, with nothing but the film type and Auto", () => {
    const { rig, view } = setup();
    expect(screen.getByRole("radio", { name: "Off" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("button", { name: "Auto" })).toBeTruthy();
    expect(labels(rig, view.container)).toEqual([]);
  });

  it("loads colour film's values when Colour is chosen from Off, as one undo step", () => {
    const { rig } = setup({ bag: negativePatch({ base: [10, 10, 10] }) });
    fireEvent.click(screen.getByRole("radio", { name: "Colour" }));
    expect(readNegative(rig.bag())).toEqual({ ...COLOUR_FILM, stock: "colour" });
    expect(rig.commits).toEqual(["Film Negative film type"]);
  });

  it("loads B&W film's values when B&W is chosen from Off", () => {
    const { rig } = setup();
    fireEvent.click(screen.getByRole("radio", { name: "B&W" }));
    expect(readNegative(rig.bag())).toEqual({ ...BW_FILM, stock: "bw" });
  });

  it("keeps the values when switching between Colour and B&W, and when turning off", () => {
    const { rig } = setup({ bag: colourBag({ dmax: 2.5 }) });
    fireEvent.click(screen.getByRole("radio", { name: "B&W" }));
    expect(readNegative(rig.bag())).toMatchObject({ stock: "bw", dmax: 2.5, base: COLOUR_FILM.base });
    fireEvent.click(screen.getByRole("radio", { name: "Off" }));
    expect(readNegative(rig.bag())).toMatchObject({ stock: "off", dmax: 2.5 });
  });
});

describe("rows", () => {
  it("shows colour film's rows by section", () => {
    const { rig } = setup({ bag: colourBag() });
    expect(labels(rig, section("Film base"))).toEqual(["Red", "Green", "Blue"]);
    expect(labels(rig, section("Film"))).toEqual(["D max", "Scan bias"]);
    expect(labels(rig, section("Shadows colour"))).toEqual(["Red", "Green", "Blue"]);
    expect(labels(rig, section("Highlights white balance"))).toEqual(["Red", "Green", "Blue"]);
    expect(labels(rig, section("Print"))).toEqual(["Paper black", "Paper grade", "Paper gloss", "Print exposure"]);
  });

  it("shows one film base density and no colour rows for B&W", () => {
    const { rig } = setup({ bag: negativePatch({ ...BW_FILM, stock: "bw" }) });
    expect(labels(rig, section("Film base"))).toEqual(["Density"]);
    expect(screen.queryByRole("region", { name: "Shadows colour" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Highlights white balance" })).toBeNull();
  });

  it("writes a channel of a colour while dragged and commits on release", () => {
    const { rig } = setup({ bag: colourBag() });
    const green = rig.sliders(section("Film base"))[1];
    act(() => green.onChange(55));
    expect(rig.bag()[key("base")]).toEqual([113, 55, 27]);
    act(() => green.onCommit?.());
    expect(rig.commits).toEqual(["Film Negative film base"]);
  });

  it("writes the one B&W density to every channel", () => {
    const { rig } = setup({ bag: negativePatch({ ...BW_FILM, stock: "bw" }) });
    act(() => rig.sliders(section("Film base"))[0].onChange(90));
    expect(rig.bag()[key("base")]).toEqual([90, 90, 90]);
  });

  it("resets a row to the film type's starting value", () => {
    const { rig } = setup({ bag: negativePatch({ ...BW_FILM, stock: "bw" }) });
    const grade = rig.sliders(section("Print")).find((s) => s.label === "Paper grade");
    expect(grade?.defaultValue).toBe(BW_FILM.grade);
  });
});

describe("pickers", () => {
  it("samples the film base from a rectangle on the image, read at the stage's input", async () => {
    const { rig } = setup({ bag: colourBag() });
    fireEvent.click(within(section("Film base")).getByRole("button", { name: "Pick" }));
    expect(rig.canvasTool()).not.toBeNull();
    dragAcross();
    await flush();
    expect(rig.canvasTool()).toBeNull();
    const call = rig.renders.at(-1);
    expect(call?.kind).toBe("view");
    expect(call?.options).toMatchObject({ point: "decode", paramBag: MEASURE_BAG });
    readNegative(rig.bag()).base.forEach((v, c) => expect(v).toBeCloseTo(NEGATIVE[c] * 100, 4));
    expect(rig.commits).toEqual(["Film Negative film base"]);
  });

  it("offers a picker for D max, Scan bias, both colours, Paper black and Print exposure", () => {
    setup({ bag: colourBag() });
    expect(within(section("Film")).getAllByRole("button", { name: /^Pick/ }).map((b) => b.getAttribute("title"))).toEqual([
      "Pick D max: the densest part of the film (Esc cancels)",
      "Pick Scan bias: the thinnest part of the film (Esc cancels)",
    ]);
    expect(within(section("Shadows colour")).getByRole("button", { name: "Pick" })).toBeTruthy();
    expect(within(section("Highlights white balance")).getByRole("button", { name: "Pick" })).toBeTruthy();
    expect(within(section("Print")).getAllByRole("button", { name: /^Pick/ })).toHaveLength(2);
  });

  it("says so when the graphics card can't measure", async () => {
    const { rig } = setup({ bag: colourBag() });
    rig.setRender(() => null);
    fireEvent.click(within(section("Film base")).getByRole("button", { name: "Pick" }));
    dragAcross();
    await flush();
    expect(rig.commits).toEqual([]);
    expect(screen.getByRole("status").textContent).toMatch(/no float render targets/);
  });
});

describe("Auto", () => {
  it("fits the photo from a render at the stage's input and turns the inversion on, as one undo step", async () => {
    const { rig } = setup();
    rig.setRender(() =>
      floatFrame(60, 40, (x) => {
        const t = 0.02 + (0.5 * x) / 59;
        return [t, t * 0.45, t * 0.22];
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Auto" }));
    await flush();
    const call = rig.renders.at(-1);
    expect(call?.kind).toBe("photo");
    expect(call?.options).toMatchObject({ point: "decode", paramBag: MEASURE_BAG });
    const n = readNegative(rig.bag());
    expect(n.stock).toBe("colour");
    expect(n).not.toEqual({ ...DEFAULT_NEGATIVE, stock: "colour" });
    expect(rig.commits).toEqual(["Film Negative auto"]);
  });

  it("does nothing without a photo", () => {
    setup({ photoId: null });
    expect((screen.getByRole("button", { name: "Auto" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("reset", () => {
  it("turns the inversion off with colour film's values", () => {
    const { rig } = setup({ bag: colourBag({ dmax: 3 }) });
    act(() => rig.panels[0].onReset?.());
    expect(readNegative(rig.bag())).toEqual(DEFAULT_NEGATIVE);
    expect(rig.commits).toEqual(["Film Negative reset"]);
  });
});
