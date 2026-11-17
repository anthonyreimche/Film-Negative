// A stand-in Safelight API for unit tests, over real React and zustand. It has
// only what this extension uses: reading any other member throws, naming it,
// so a test shows what to add here when the extension starts using more.
//
// The develop store holds the photo, its DevelopParams and its param bag; the param scope reads and writes that bag, or
// a mask's when the rig is made for a mask. Float captures call the render the
// test hands the rig, with what they were asked for. Core's Slider is a stub
// that keeps the props it was last drawn with.

import * as React from "react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type {
  AutoButtonProps,
  ButtonProps,
  CanvasPoint,
  CanvasTool,
  CatalogPhoto,
  CatalogState,
  DevelopParams,
  DevelopState,
  FloatCaptureOptions,
  FloatFrame,
  HistogramData,
  LiveFloatCaptureOptions,
  PanelContribution,
  ParamScope,
  PickDragTool,
  ProcessingStageContribution,
  RowProps,
  SafelightAPI,
  SectionProps,
  SegmentedControlProps,
  SelectProps,
  SettingsContribution,
  SliderProps,
  StackProps,
  UITokens,
} from "../../src/safelight";
import { EXT_ID } from "../../src/params";

type FakeDevelop = Pick<
  DevelopState,
  "photoId" | "params" | "previewParams" | "paramBag" | "histogram" | "showClipping" | "setShowClipping" | "setParam" | "setDynParams" | "commitEdit"
>;
type FakeDevelopStore = UseBoundStore<StoreApi<FakeDevelop>>;

/** Basic's tone values and the rest a test sets, over the fake's defaults. */
export type ParamValues = Partial<Pick<DevelopParams, "exposure" | "contrast" | "highlights" | "shadows" | "whites" | "blacks" | "processVersion">>;

export interface RenderCall {
  kind: "view" | "photo";
  params: DevelopParams;
  options: LiveFloatCaptureOptions | FloatCaptureOptions | undefined;
}

export interface RigOptions {
  bag?: Record<string, unknown>;
  params?: ParamValues;
  maskId?: string;
  photoId?: string | null;
}

export interface Rig {
  api: SafelightAPI;
  panels: PanelContribution[];
  stages: ProcessingStageContribution[];
  settingsSections: SettingsContribution[];
  bag(): Readonly<Record<string, unknown>>;
  maskBag(): Readonly<Record<string, unknown>>;
  /** Basic's tone values as the photo holds them. */
  params(): ParamValues;
  commits: string[];
  sliders(root: ParentNode): SliderProps[];
  settings: Map<string, unknown>;
  renders: RenderCall[];
  /** How float captures answer; null (the default) as without float targets. */
  setRender(render: (call: RenderCall) => FloatFrame | null): void;
  setCanvasSize(width: number, height: number): void;
  pickDrag(): PickDragTool | null;
  dropPickDrag(): void;
  canvasTool(): CanvasTool | null;
  dropCanvasTool(): void;
  viewValues(): Record<string, unknown> | null;
  develop: FakeDevelopStore;
  settle(): void;
}

/** A fake of `T` from the members a test needs: reading any other member
 *  throws, naming it. `T` is assignable to `Partial<T>`, so the assertion
 *  narrows rather than converts. */
export function fake<T extends object>(members: Partial<T>, path: string): T {
  return new Proxy(members, {
    get(obj, key, receiver) {
      if (typeof key === "symbol" || key === "then" || key === "toJSON" || key === "$$typeof") return Reflect.get(obj, key, receiver);
      if (!(key in obj)) throw new Error(`The fake API has no ${path}.${key}. Add it to test/support/fake-api.ts.`);
      return Reflect.get(obj, key, receiver);
    },
  }) as T;
}

const TOKENS: UITokens = {
  surface0: "var(--color-surface-0)",
  surface1: "var(--color-surface-1)",
  surface2: "var(--color-surface-2)",
  surface3: "var(--color-surface-3)",
  surface4: "var(--color-surface-4)",
  border: "var(--color-border)",
  borderSubtle: "var(--color-border-subtle)",
  textPrimary: "var(--color-text-primary)",
  textSecondary: "var(--color-text-secondary)",
  textMuted: "var(--color-text-muted)",
  accent: "var(--color-accent)",
  accentHover: "var(--color-accent-hover)",
  sliderFill: "var(--color-slider-fill)",
  rating: "var(--color-rating)",
  labelRed: "var(--color-label-red)",
  labelYellow: "var(--color-label-yellow)",
  labelGreen: "var(--color-label-green)",
  labelBlue: "var(--color-label-blue)",
  labelPurple: "var(--color-label-purple)",
  white: "var(--color-white)",
  fontMono: "var(--font-mono)",
  fontCode: "var(--font-code)",
};

let histogramSerial = 0;

function subscribable<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
      for (const l of listeners) l();
    },
    use: () =>
      React.useSyncExternalStore(
        (l) => {
          listeners.add(l);
          return () => listeners.delete(l);
        },
        () => value,
      ),
  };
}

export function fakeApi(options: RigOptions = {}): Rig {
  const panels: PanelContribution[] = [];
  const stages: ProcessingStageContribution[] = [];
  const settingsSections: SettingsContribution[] = [];
  const commits: string[] = [];
  const renders: RenderCall[] = [];
  const settings = new Map<string, unknown>();
  const settingsListeners = new Set<(key: string, value: unknown) => void>();
  const defaults = new Map<string, unknown>();
  const sliderProps = new Map<number, SliderProps>();
  let nextSlider = 0;
  let render: (call: RenderCall) => FloatFrame | null = () => null;
  let canvas = { width: 400, height: 300 };
  const pick = subscribable<PickDragTool | null>(null);
  const tool = subscribable<CanvasTool | null>(null);
  let viewValues: Record<string, unknown> | null = null;
  const maskId = options.maskId ?? null;
  const mask = create<{ bag: Record<string, unknown> }>()(() => ({ bag: {} }));

  const paramsOf = (values: ParamValues): DevelopParams =>
    fake<DevelopParams>(
      { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, processVersion: 2, ...values },
      "params",
    );

  const develop = create<FakeDevelop>()((set, get) => ({
    photoId: options.photoId === undefined ? "photo-1" : options.photoId,
    params: paramsOf(options.params ?? {}),
    previewParams: null,
    paramBag: { ...(options.bag ?? {}) },
    histogram: null,
    showClipping: 0,
    setShowClipping: (mode) => set({ showClipping: mode }),
    setParam: (key, value) => {
      const now = get().params;
      const values: ParamValues = {
        exposure: now.exposure,
        contrast: now.contrast,
        highlights: now.highlights,
        shadows: now.shadows,
        whites: now.whites,
        blacks: now.blacks,
        processVersion: now.processVersion,
      };
      set({ params: paramsOf({ ...values, [key]: value }) });
    },
    setDynParams: (patch) =>
      set((s) => {
        const next = { ...s.paramBag, ...patch };
        for (const [key, value] of Object.entries(patch)) if (value === undefined) delete next[key];
        return { paramBag: next };
      }),
    commitEdit: async (label) => void commits.push(label),
  }));

  const photo = fake<CatalogPhoto>(
    { id: "photo-1", exif: {} },
    "photo",
  );
  const catalog = create<Pick<CatalogState, "photos">>()(() => ({ photos: [photo] }));

  function useParamScope(): ParamScope {
    const photoBag = develop((s) => s.paramBag);
    const maskBag = mask((s) => s.bag);
    const stored = maskId ? maskBag : photoBag;
    return {
      maskId,
      getParam: (key) => (key in stored ? stored[key] : defaults.get(key)),
      getParams: () => (maskId ? mask.getState().bag : develop.getState().paramBag),
      setParams: (patch) => {
        if (!maskId) return develop.getState().setDynParams(patch);
        mask.setState((s) => ({ bag: { ...s.bag, ...patch } }));
      },
      commit: (label) => void commits.push(label),
    };
  }

  function Slider(props: SliderProps) {
    const id = React.useRef(nextSlider++).current;
    sliderProps.set(id, props);
    return React.createElement("div", { "data-slider": id }, `${props.label} ${props.value}`);
  }

  function AutoButton({ onClick, disabled, title }: AutoButtonProps) {
    return React.createElement("button", { type: "button", onClick, disabled, title }, "Auto");
  }

  const ui = fake<SafelightAPI["ui"]>(
    {
      Button: ({ active, variant: _variant, size: _size, full: _full, ...rest }: ButtonProps) =>
        React.createElement("button", { type: "button", "data-active": active ? "true" : "false", ...rest }),
      SegmentedControl: ({ value, onChange, options: opts }: SegmentedControlProps) =>
        React.createElement(
          "div",
          { role: "radiogroup" },
          ...opts.map((o) =>
            React.createElement(
              "button",
              { key: o.value, type: "button", role: "radio", "aria-checked": o.value === value, title: o.title, onClick: () => onChange(o.value) },
              o.label,
            ),
          ),
        ),
      Select: ({ value, onChange, options: opts, ariaLabel }: SelectProps) =>
        React.createElement(
          "select",
          { value, "aria-label": ariaLabel, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) },
          ...(opts ?? []).map((o) => React.createElement("option", { key: o.value, value: o.value }, o.label)),
        ),
      Section: ({ title, right, children }: SectionProps) =>
        React.createElement("section", { "aria-label": typeof title === "string" ? title : undefined }, title, right, children),
      Row: ({ children, style }: RowProps) => React.createElement("div", { style }, children),
      Stack: ({ children, style }: StackProps) => React.createElement("div", { style }, children),
      tokens: TOKENS,
    },
    "api.ui",
  );

  const developApi = fake<SafelightAPI["develop"]>(
    {
      useParamScope,
      usePickDragHeld: () => pick.use() !== null,
      setPickDrag: (t) => pick.set(t),
      useCanvasToolHeld: () => tool.use() !== null,
      setCanvasTool: (t) => tool.set(t),
      setViewValues: (values) => void (viewValues = values),
      captureFrame: async () => fake<ImageBitmap>({ width: canvas.width, height: canvas.height, close: () => undefined }, "bitmap"),
      captureFloatFrame: async (params, opts) => {
        const call: RenderCall = { kind: "view", params, options: opts };
        renders.push(call);
        return render(call);
      },
      renderPhotoFloatFrame: async (_id, params, opts) => {
        const call: RenderCall = { kind: "photo", params, options: opts };
        renders.push(call);
        return render(call);
      },
    },
    "api.develop",
  );

  const api = fake<SafelightAPI>(
    {
      version: 1,
      extensionId: EXT_ID,
      react: React,
      registerPanel: (c) => void panels.push(c),
      registerProcessingStage: (c) => {
        stages.push(c);
        for (const u of c.uniforms) defaults.set(`${c.id}.${u.key}`, u.default);
      },
      registerSettings: (c) => void settingsSections.push(c),
      components: fake<SafelightAPI["components"]>({ Slider, AutoButton }, "api.components"),
      ui,
      develop: developApi,
      stores: fake<SafelightAPI["stores"]>(
        { useDevelopStore: storeOf<DevelopState, FakeDevelop>(develop, "develop state"), useCatalogStore: storeOf<CatalogState, Pick<CatalogState, "photos">>(catalog, "catalog state") },
        "api.stores",
      ),
      settings: fake<SafelightAPI["settings"]>(
        {
          get: <T>(key: string, fallback: T): T => (settings.has(key) ? narrow(settings.get(key), fallback) : fallback),
          set: (key, value) => {
            settings.set(key, value);
            for (const listener of settingsListeners) listener(key, value);
          },
          onChange: (listener) => {
            settingsListeners.add(listener);
            return () => settingsListeners.delete(listener);
          },
        },
        "api.settings",
      ),
    },
    "api",
  );

  return {
    api,
    panels,
    stages,
    settingsSections,
    bag: () => develop.getState().paramBag,
    maskBag: () => mask.getState().bag,
    params: () => {
      const p = develop.getState().params;
      return { exposure: p.exposure, contrast: p.contrast, highlights: p.highlights, shadows: p.shadows, whites: p.whites, blacks: p.blacks };
    },
    commits,
    sliders: (root) =>
      [...root.querySelectorAll("[data-slider]")].map((el) => {
        const props = sliderProps.get(Number(el.getAttribute("data-slider")));
        if (!props) throw new Error("a slider without props");
        return props;
      }),
    settings,
    renders,
    setRender: (r) => void (render = r),
    setCanvasSize: (width, height) => void (canvas = { width, height }),
    pickDrag: pick.get,
    dropPickDrag: () => pick.set(null),
    canvasTool: tool.get,
    dropCanvasTool: () => tool.set(null),
    viewValues: () => viewValues,
    develop,
    settle: () => develop.setState({ histogram: fake<HistogramData>({}, `histogram#${++histogramSerial}`) }),
  };
}

/** The stored setting when it has the fallback's type, else the fallback: the
 *  host stores whatever was set, as the real settings do. */
function narrow<T>(value: unknown, fallback: T): T {
  return typeof value === typeof fallback ? (value as T) : fallback;
}

/** A store as the extension sees it: the fake's state behind the strict proxy,
 *  so reading a member the fake lacks throws. */
function storeOf<Full extends object, Held extends Partial<Full>>(store: UseBoundStore<StoreApi<Held>>, path: string): UseBoundStore<StoreApi<Full>> {
  const view = (s: Held) => fake<Full>(s, path);
  return fake<UseBoundStore<StoreApi<Full>>>(
    Object.assign(<U>(selector: (s: Full) => U): U => store((s) => selector(view(s))), {
      getState: () => view(store.getState()),
      subscribe: (listener: (state: Full, prev: Full) => void) => store.subscribe((s, prev) => listener(view(s), view(prev))),
    }),
    `${path} store`,
  );
}

export const point = (x: number, y: number): CanvasPoint => ({ x, y });


/** A float frame of `width`×`height` from a texel function, rows top-down. */
export function floatFrame(width: number, height: number, texel: (x: number, y: number) => readonly [number, number, number]): FloatFrame {
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set([...texel(x, y), 1], (y * width + x) * 4);
  }
  return { data, width, height, space: { encoding: "linear", primaries: "rec709" }, point: "scene" };
}
