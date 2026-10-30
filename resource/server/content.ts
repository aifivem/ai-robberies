import { AdminPanel, resourceExport } from "@aicore-fivem/lib/server";
import { readPlaces, readSettings, readTargets } from "common/robbery";
import { robberiesSchema } from "./schema";

export const core = resourceExport("ai-core");
export const panel = new AdminPanel(robberiesSchema);
/** Panel content, parsed again after every change. */
export const content = { settings: readSettings(panel.get("settings")), places: readPlaces(panel.get("places")), targets: readTargets(panel.get("targets")) };
panel.onChange("settings", () => (content.settings = readSettings(panel.get("settings"))));
panel.onChange("places", () => (content.places = readPlaces(panel.get("places"))));
panel.onChange("targets", () => (content.targets = readTargets(panel.get("targets"))));

export const fail = (error: string) => ({ ok: false as const, error });
export const random = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

export function pos(source: number): { x: number; y: number; z: number } {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
  return { x, y, z };
}

export const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const near = (source: number, at: { x: number; y: number; z: number }, metres: number) => distance(pos(source), at) <= metres;
export const policeOnDuty = () => content.settings.policeJobs.reduce((sum, job) => sum + core.GetOnDutyCount(job), 0);
