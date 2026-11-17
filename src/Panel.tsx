// The panel: the film type and Auto, then the film base, the film's density
// range, the two colour balances (colour film only) and the print. Every row
// edits the photo's bag through the param scope; a drag writes live and
// commits on release, so one gesture is one undo step. A picker hands the
// canvas to AreaOverlay and reads what is dragged there (measure.ts).

import { PICKERS, autoFit, pickArea, type PickerKind, type Result } from "./measure";
import type { Uv, UvRect } from "./metering";
import { RANGES, startOf, type Negative, type RGB, type Range, type Stock } from "./model";
import { negativePatch, readNegative } from "./params";
import { React, api } from "./rt";
import type { OverlayRect2, ParamScope } from "./safelight";

const STOCKS: readonly { value: Stock; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "colour", label: "Colour" },
  { value: "bw", label: "B&W" },
];

const CHANNELS = ["Red", "Green", "Blue"] as const;

type NumberKey = "dmax" | "offset" | "black" | "grade" | "gloss" | "exposure";
type ColourKey = "base" | "low" | "high";

const LABEL: Readonly<Record<NumberKey, string>> = {
  dmax: "D max",
  offset: "Scan bias",
  black: "Paper black",
  grade: "Paper grade",
  gloss: "Paper gloss",
  exposure: "Print exposure",
};

const commitLabel = (name: string) => `Film Negative ${name.toLowerCase()}`;

const withChannel = (v: RGB, c: number, x: number): RGB => [c === 0 ? x : v[0], c === 1 ? x : v[1], c === 2 ? x : v[2]];

export function FilmNegativePanel() {
  const scope = api.develop.useParamScope();
  const { AutoButton } = api.components;
  const { SegmentedControl, Stack, tokens } = api.ui;
  const hasPhoto = api.stores.useDevelopStore((s) => s.photoId !== null);
  const n = readNegative(scope.getParams());
  const [status, setStatus] = React.useState("");
  const [armed, setArmed] = React.useState<PickerKind | null>(null);
  const held = api.develop.useCanvasToolHeld();

  // Core lets go of the canvas on Escape, or when another tool takes it.
  React.useEffect(() => {
    if (!held) setArmed(null);
  }, [held]);

  const report = React.useCallback((r: Result) => setStatus(r.kind === "done" ? r.status : r.reason), []);

  const chooseStock = (stock: Stock) => {
    if (stock === n.stock) return;
    const values: Partial<Negative> = n.stock === "off" && stock !== "off" ? { ...startOf(stock), stock } : { stock };
    scope.setParams(negativePatch(values));
    scope.commit("Film Negative film type");
  };

  const arm = (kind: PickerKind) => {
    if (armed === kind) {
      cancelArea();
      setArmed(null);
      setStatus("");
      return;
    }
    setArmed(kind);
    setStatus(`${PICKERS[kind].name}: drag over ${PICKERS[kind].over}, or click it. Esc cancels.`);
    armArea(
      (at) => {
        setArmed(null);
        setStatus("Reading…");
        void pickArea(kind, at).then(report);
      },
      () => {
        setArmed(null);
        setStatus("");
      },
    );
  };

  const runAuto = () => {
    setStatus("Reading…");
    void autoFit().then(report);
  };

  return (
    <div style={{ padding: 8 }}>
      <Stack gap={6}>
        <SegmentedControl size="sm" value={n.stock} options={[...STOCKS]} onChange={(v) => chooseStock(STOCKS.find((s) => s.value === v)?.value ?? "off")} />
        <AutoButton title="Auto: fit the film and the print to this photo" disabled={!hasPhoto} onClick={runAuto} />
      </Stack>
      {n.stock !== "off" && <Rows scope={scope} n={n} armed={armed} arm={arm} />}
      <div role="status" aria-live="polite" style={{ color: tokens.textMuted, fontSize: 11, minHeight: 14, marginTop: 4 }}>
        {status}
      </div>
    </div>
  );
}

interface RowsProps {
  scope: ParamScope;
  n: Negative;
  armed: PickerKind | null;
  arm: (kind: PickerKind) => void;
}

function Rows({ scope, n, armed, arm }: RowsProps) {
  const { Slider } = api.components;
  const { Button, Row, Section } = api.ui;
  const start = startOf(n.stock);
  const bw = n.stock === "bw";

  const pick = (kind: PickerKind, label = "Pick") => (
    <Button
      key={kind}
      size="sm"
      active={armed === kind}
      aria-pressed={armed === kind}
      title={`Pick ${PICKERS[kind].name}: ${PICKERS[kind].over} (Esc cancels)`}
      onClick={() => arm(kind)}
    >
      {label}
    </Button>
  );

  const slider = (label: string, value: number, range: Range, rest: number, write: (v: number) => Partial<Negative>, name: string) => (
    <Slider
      key={label}
      label={label}
      value={value}
      min={range.min}
      max={range.max}
      step={range.step}
      defaultValue={rest}
      onChange={(v) => scope.setParams(negativePatch(write(v)))}
      onCommit={() => scope.commit(commitLabel(name))}
    />
  );

  const number = (k: NumberKey) => slider(LABEL[k], n[k], RANGES[k], start[k], (v) => ({ [k]: v }), LABEL[k]);

  const colour = (k: ColourKey, name: string) =>
    CHANNELS.map((label, c) =>
      slider(label, n[k][c], RANGES[k], start[k][c], (v) => ({ [k]: withChannel(n[k], c, v) }), name),
    );

  return (
    <>
      <Section title="Film base" right={pick("base")}>
        {bw ? slider("Density", n.base[0], RANGES.base, start.base[0], (v) => ({ base: [v, v, v] }), "Film base") : colour("base", "Film base")}
      </Section>
      <Section title="Film">
        {number("dmax")}
        {number("offset")}
        <Row gap={6}>
          {pick("dmax", "Pick D max")}
          {pick("offset", "Pick Scan bias")}
        </Row>
      </Section>
      {!bw && (
        <>
          <Section title="Shadows colour" right={pick("low")}>
            {colour("low", "Shadows colour")}
          </Section>
          <Section title="Highlights white balance" right={pick("high")}>
            {colour("high", "Highlights white balance")}
          </Section>
        </>
      )}
      <Section title="Print">
        {number("black")}
        {number("grade")}
        {number("gloss")}
        {number("exposure")}
        <Row gap={6}>
          {pick("black", "Pick Paper black")}
          {pick("exposure", "Pick Print exposure")}
        </Row>
      </Section>
    </>
  );
}

let pendingArea: { pick: (at: UvRect | Uv) => void; cancel: () => void } | null = null;

/** Hand the canvas to AreaOverlay; `pick` gets what was dragged or clicked. */
function armArea(pick: (at: UvRect | Uv) => void, cancel: () => void): void {
  pendingArea?.cancel();
  pendingArea = { pick, cancel };
  api.develop.setCanvasTool({
    overlay: AreaOverlay,
    onEscape: () => {
      pendingArea?.cancel();
      pendingArea = null;
    },
  });
}

function cancelArea(): void {
  pendingArea = null;
  api.develop.setCanvasTool(null);
}

/** A drag shorter than this, in screen pixels, is a click on a spot. */
const CLICK_PX = 4;

/** The picker's rectangle over the image. `rect` is the box the frame shows;
 *  the pointer is placed by its fraction across this surface, which zooming
 *  the interface leaves as it is. */
export function AreaOverlay({ rect }: { rect: OverlayRect2 }) {
  const { tokens } = api.ui;
  const [drag, setDrag] = React.useState<{ from: Uv; to: Uv; startX: number; startY: number } | null>(null);

  const uvAt = (e: React.PointerEvent<HTMLDivElement>): Uv => {
    const el = e.currentTarget;
    const b = el.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * el.offsetWidth;
    const y = ((e.clientY - b.top) / b.height) * el.offsetHeight;
    return { x: (x - rect.x) / rect.w, y: (y - rect.y) / rect.h };
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const to = uvAt(e);
    const moved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= CLICK_PX;
    const at: UvRect | Uv = moved ? { x0: drag.from.x, y0: drag.from.y, x1: to.x, y1: to.y } : drag.from;
    setDrag(null);
    const pending = pendingArea;
    pendingArea = null;
    api.develop.setCanvasTool(null);
    pending?.pick(at);
  };

  const box =
    drag &&
    ({
      left: rect.x + Math.min(drag.from.x, drag.to.x) * rect.w,
      top: rect.y + Math.min(drag.from.y, drag.to.y) * rect.h,
      width: Math.abs(drag.to.x - drag.from.x) * rect.w,
      height: Math.abs(drag.to.y - drag.from.y) * rect.h,
    } as const);

  return (
    <div
      data-testid="area-surface"
      style={{ position: "absolute", inset: 0, cursor: "crosshair", pointerEvents: "auto" }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const at = uvAt(e);
        setDrag({ from: at, to: at, startX: e.clientX, startY: e.clientY });
      }}
      onPointerMove={(e) => drag && setDrag({ ...drag, to: uvAt(e) })}
      onPointerUp={finish}
    >
      {box && <div style={{ position: "absolute", ...box, border: `1px solid ${tokens.accent}`, pointerEvents: "none" }} />}
    </div>
  );
}
