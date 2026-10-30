import { AdminWorld, loadLocaleTexts } from "@aicore-fivem/lib/client"
import { record } from "@aicore-fivem/lib/shared"
import { readPlaces, readSettings, readTargets } from "common/robbery"

/** The panel files every client module reads, parsed again after each change. */
export const world = new AdminWorld(["settings", "places", "targets"])
export const content = {
  settings: readSettings(world.get("settings")),
  places: readPlaces(world.get("places")),
  targets: readTargets(world.get("targets")),
}
world.onChange(
  "settings",
  () => (content.settings = readSettings(world.get("settings")))
)

const texts = loadLocaleTexts()
/** The translated error of a callback answer. */
export const errorText = (v: unknown, fallback: string): string => {
  const key =
    typeof record(v).error === "string" ? String(record(v).error) : fallback
  return texts[key] ?? key
}
