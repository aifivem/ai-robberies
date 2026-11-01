import type { PanelSchema } from "@aicore-fivem/shared";
import { placesFile, placesTab } from "./places";
import { settingsFile, settingsTab } from "./settings";
import { targetsFile, targetsTab } from "./targets";

/** ai-robberies' panel: places (store, bank, jewelery), what can be robbed there, and who counts as police. */
export const robberiesSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "mask",
  files: {
    settings: settingsFile,
    places: placesFile,
    targets: targetsFile,
  },
  tabs: [placesTab, targetsTab, settingsTab],
};
