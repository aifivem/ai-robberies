import { AdminWorld, hidePrompt, loadLocaleTexts, notify, onPromptPressed, progress, showPrompt, triggerServerCallback, Zones } from "@aicore-fivem/lib/client";
import { record } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { ANIMS, EVENTS, readPlaces, readTargets, robbedKey } from "common/robbery";
import { Vaults } from "./vaults";

const world = new AdminWorld(["places", "targets"]);
const texts = loadLocaleTexts();
const content = { places: readPlaces(world.get("places")), targets: readTargets(world.get("targets")) };
const BLIP_TEXT = "AIROB_BLIP";
AddTextEntry(BLIP_TEXT, "~a~");
const errorText = (v: unknown, fallback: string): string => {
  const key = typeof record(v).error === "string" ? String(record(v).error) : fallback;
  return texts[key] ?? key;
};

/** A prompt at every target ("Rob" or "Emptied" from its GlobalState key) and the places' blips. */
class Spots {
  private readonly zones = new Zones();
  private blips: number[] = [];
  busy = false;

  rebuild(): void {
    this.zones.clear();
    for (const blip of this.blips) RemoveBlip(blip);
    this.blips = [];
    for (const target of content.targets.values()) {
      const id = target.id;
      this.zones.add(id, {
        shape: { type: "sphere", center: target.coords, radius: 1.2 },
        interval: 300,
        onEnter: () => showPrompt(id, GlobalState[robbedKey(id)] === true ? Locale("ROB_PROMPT_EMPTY", target.label) : Locale("ROB_PROMPT", target.label)),
        onExit: () => hidePrompt(id),
      });
    }
    for (const place of content.places.values()) {
      if (!place.blip) continue;
      const blip = AddBlipForCoord(place.coords.x, place.coords.y, place.coords.z);
      SetBlipSprite(blip, 500);
      SetBlipScale(blip, 0.7);
      SetBlipAsShortRange(blip, true);
      BeginTextCommandSetBlipName(BLIP_TEXT);
      AddTextComponentSubstringPlayerName(place.label);
      EndTextCommandSetBlipName(blip);
      this.blips.push(blip);
    }
  }

  async rob(id: string): Promise<void> {
    const target = content.targets.get(id);
    if (!target) return;
    const started = record(await triggerServerCallback(EVENTS.start, [id]).catch(() => null));
    if (started.ok !== true || typeof started.token !== "number" || typeof started.seconds !== "number") return notify(errorText(started, "ROB_ERR_FAR"), "error");
    const done = await progress({ label: Locale("ROB_WORKING"), duration: started.seconds * 1000, anim: ANIMS[target.kind] });
    if (!done) return;
    const result = record(await triggerServerCallback(EVENTS.finish, [started.token]).catch(() => null));
    if (result.ok !== true) notify(errorText(result, "ROB_ERR_FAR"), "error");
  }
}

const spots = new Spots();
const vaults = new Vaults();
spots.rebuild();
vaults.rebuild(content.targets.values());
AddStateBagChangeHandler("", "global", (_bag: string, key: string, value: unknown) => vaults.changed(key, value === true));
world.onChange("places", () => {
  content.places = readPlaces(world.get("places"));
  spots.rebuild();
});
world.onChange("targets", () => {
  content.targets = readTargets(world.get("targets"));
  spots.rebuild();
  vaults.rebuild(content.targets.values());
});

onPromptPressed((id) => {
  if (spots.busy || !content.targets.has(id)) return;
  spots.busy = true;
  void spots.rob(id).finally(() => (spots.busy = false));
});
