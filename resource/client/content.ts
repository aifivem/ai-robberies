import { AdminWorld } from "@aicore-fivem/lib/client";
import { readPlace } from "common/places";
import { readSettings } from "common/settings";

/** The panel files every client module reads, kept current by the panel's views (targets: `spots/spots.ts`). */
export const world = new AdminWorld(["settings", "places", "targets"]);
const settings = world.view("settings", readSettings);
export const content = {
  get settings() {
    return settings.value;
  },
  places: world.records("places", readPlace),
};

export const FALLBACK = { fallback: "ROB_ERR_FAR" };
