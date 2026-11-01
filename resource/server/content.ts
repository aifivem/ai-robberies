import { AdminPanel, online, resourceExport } from "@aicore-fivem/lib/server";
import { readPlace } from "common/places";
import { readSettings } from "common/settings";
import { readTarget } from "common/targets";
import { robberiesSchema } from "./schema";

export const core = resourceExport("ai-core");
export const panel = new AdminPanel(robberiesSchema);
const settings = panel.view("settings", readSettings);
/** Panel content, kept current by the panel's views. */
export const content = {
  get settings() {
    return settings.value;
  },
  places: panel.records("places", readPlace),
  targets: panel.records("targets", readTarget),
};

export const policeOnDuty = () =>
  online.countOnDuty(content.settings.policeJobs);
