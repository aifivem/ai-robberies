import { AdminWorld } from "@aicore-fivem/lib/client";
import { readPlace, readSettings } from "common/robbery";

/** The panel files every client module reads, kept current by the panel's views (targets: `index.ts`). */
export const world = new AdminWorld(["settings", "places", "targets"]);
const settings = world.view("settings", readSettings);
export const content = {
  get settings() {
    return settings.value;
  },
  places: world.records("places", readPlace),
};

export const FALLBACK = { fallback: "ROB_ERR_FAR" };
