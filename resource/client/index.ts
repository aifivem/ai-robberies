import { hidePrompt, notify, onPromptPressed, onServerEvent, progress, showPrompt, triggerServerCallback, Zones } from "@aicore-fivem/lib/client";
import { record, sleep } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { ANIMS, EVENTS, readPlaces, readTargets, robbedKey } from "common/robbery";
import { content, errorText, world } from "./content";
import "./truck";
import { Vaults } from "./vaults";

const BLIP_TEXT = "AIROB_BLIP";
AddTextEntry(BLIP_TEXT, "~a~");

/**
 * A prompt at every target ("Rob" or "Emptied" from its GlobalState key) and the places' blips. Targets inside a
 * house only exist while the player is inside it, together with its exit prompt.
 */
class Spots {
  private readonly zones = new Zones();
  private blips: number[] = [];
  busy = false;
  insideId: string | null = null;

  rebuild(): void {
    this.zones.clear();
    for (const blip of this.blips) RemoveBlip(blip);
    this.blips = [];
    for (const target of content.targets.values()) {
      const id = target.id;
      const house = content.places.get(target.place)?.interior != null && target.kind !== "entry";
      if (house !== (this.insideId === target.place)) continue;
      this.zones.add(id, {
        shape: { type: "sphere", center: target.coords, radius: 1.2 },
        interval: 300,
        onEnter: () => showPrompt(id, GlobalState[robbedKey(id)] === true ? Locale("ROB_PROMPT_EMPTY", target.label) : Locale("ROB_PROMPT", target.label)),
        onExit: () => hidePrompt(id),
      });
    }
    const inside = this.insideId ? content.places.get(this.insideId)?.interior : null;
    if (inside)
      this.zones.add("rob:exit", { shape: { type: "sphere", center: inside, radius: 1.5 }, interval: 300, onEnter: () => showPrompt("rob:exit", Locale("ROB_PROMPT_EXIT")), onExit: () => hidePrompt("rob:exit") });
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
    if (started.entered === true) return;
    if (started.ok !== true || typeof started.token !== "number" || typeof started.seconds !== "number") return notify(errorText(started, "ROB_ERR_FAR"), "error");
    const done = await progress({ label: Locale("ROB_WORKING"), duration: started.seconds * 1000, anim: ANIMS[target.kind] });
    if (!done) return;
    const result = record(await triggerServerCallback(EVENTS.finish, [started.token]).catch(() => null));
    if (result.ok !== true) notify(errorText(result, "ROB_ERR_FAR"), "error");
  }

  async exit(): Promise<void> {
    DoScreenFadeOut(300);
    await sleep(350);
    const result = record(await triggerServerCallback(EVENTS.exit, []).catch(() => null));
    if (result.ok !== true) notify(errorText(result, "ROB_ERR_FAR"), "error");
    await sleep(400);
    DoScreenFadeIn(300);
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

onServerEvent(EVENTS.inside, { args: ([id]): [string | null] | null => (id == null ? [null] : typeof id === "string" ? [id] : null) }, (id) => {
  spots.insideId = id;
  spots.rebuild();
});

onPromptPressed((id) => {
  if (id === "rob:exit") return void spots.exit();
  if (spots.busy || !content.targets.has(id)) return;
  spots.busy = true;
  void spots.rob(id).finally(() => (spots.busy = false));
});
