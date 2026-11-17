// Film Negative, a Safelight extension (GPL-3.0-or-later): turns scanned
// colour and black and white negatives into positives, a port of darktable's
// negadoctor (docs/SPEC.md). Registers the inversion stage and its Develop
// panel.

import { DEFAULT_NEGATIVE } from "./model";
import { EXT_ID, negativePatch } from "./params";
import { FilmNegativePanel } from "./Panel";
import { initRuntime } from "./rt";
import type { SafelightAPI } from "./safelight";
import { invertStage } from "./stage";

export const PANEL_ID = `${EXT_ID}.panel`;

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  host.registerProcessingStage(invertStage());
  host.registerPanel({
    id: PANEL_ID,
    title: "Film Negative",
    component: FilmNegativePanel,
    defaultDock: { module: "develop", direction: "right", width: 280 },
    onReset: () => {
      const dev = host.stores.useDevelopStore.getState();
      dev.setDynParams(negativePatch(DEFAULT_NEGATIVE));
      void dev.commitEdit("Film Negative reset");
    },
  });
}
