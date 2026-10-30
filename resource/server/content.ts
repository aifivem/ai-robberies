import { AdminPanel, online, resourceExport } from "@aicore-fivem/lib/server";
import { readPlace, readSettings, readTarget } from "common/robbery";
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

export const random = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

export const policeOnDuty = () =>
  content.settings.policeJobs.reduce(
    (sum, job) => sum + online.onDutyFor(job).size,
    0,
  );
