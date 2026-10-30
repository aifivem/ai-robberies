import {
  Blips,
  fadeOut,
  notify,
  onServerEvent,
  Points,
  progress,
  triggerServerCallback,
} from "@aicore-fivem/lib/client";
import { record, sleep } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  ANIMS,
  EVENTS,
  readPlaces,
  readTargets,
  robbedKey,
} from "common/robbery";
import { content, errorText, world } from "./content";
import "./truck";
import { Vaults } from "./vaults";

/**
 * A point at every target ("Rob" or "Emptied" from its GlobalState key) and the places' blips. Targets inside a
 * house only exist while the player is inside it, together with its exit point.
 */
class Spots {
  readonly points = new Points();
  private readonly blips = new Blips();
  insideId: string | null = null;

  rebuild(): void {
    this.points.clear();
    this.blips.clear();
    for (const target of content.targets.values()) {
      const id = target.id;
      const house =
        content.places.get(target.place)?.interior != null &&
        target.kind !== "entry";
      if (house !== (this.insideId === target.place)) continue;
      const robbed = () => GlobalState[robbedKey(id)] === true;
      const at = {
        coords: target.coords,
        radius: 1.2,
        interval: 300,
        onPressed: () => this.rob(id),
      };
      this.points.add(id, {
        ...at,
        label: Locale("ROB_PROMPT", target.label),
        icon: "mask",
        canShow: () => !robbed(),
      });
      this.points.add(`${id}:empty`, {
        ...at,
        label: Locale("ROB_PROMPT_EMPTY", target.label),
        icon: "box-open",
        canShow: robbed,
      });
    }
    const inside = this.insideId
      ? content.places.get(this.insideId)?.interior
      : null;
    if (inside)
      this.points.add("exit", {
        coords: inside,
        label: Locale("ROB_PROMPT_EXIT"),
        icon: "door-open",
        radius: 1.5,
        interval: 300,
        onPressed: () => this.exit(),
      });
    for (const place of content.places.values())
      if (place.blip)
        this.blips.add(place.id, {
          coords: place.coords,
          label: place.label,
          sprite: 500,
          color: 0,
          scale: 0.7,
        });
  }

  async rob(id: string): Promise<void> {
    const target = content.targets.get(id);
    if (!target) return;
    const started = record(
      await triggerServerCallback(EVENTS.start, [id]).catch(() => null),
    );
    if (started.entered === true) return;
    if (
      started.ok !== true ||
      typeof started.token !== "number" ||
      typeof started.seconds !== "number"
    )
      return notify(errorText(started, "ROB_ERR_FAR"), "error");
    const done = await progress({
      label: Locale("ROB_WORKING"),
      duration: started.seconds * 1000,
      anim: ANIMS[target.kind],
    });
    if (!done) return;
    const result = record(
      await triggerServerCallback(EVENTS.finish, [started.token]).catch(
        () => null,
      ),
    );
    if (result.ok !== true) notify(errorText(result, "ROB_ERR_FAR"), "error");
  }

  async exit(): Promise<void> {
    await fadeOut();
    const result = record(
      await triggerServerCallback(EVENTS.exit, []).catch(() => null),
    );
    if (result.ok !== true) notify(errorText(result, "ROB_ERR_FAR"), "error");
    await sleep(400);
    DoScreenFadeIn(300);
  }
}

const spots = new Spots();
const vaults = new Vaults();
spots.rebuild();
vaults.rebuild(content.targets.values());
AddStateBagChangeHandler(
  "",
  "global",
  (_bag: string, key: string, value: unknown) => {
    if (!key.startsWith("rob:")) return;
    vaults.changed(key, value === true);
    // The handler runs before GlobalState holds the new value.
    setTimeout(() => spots.points.refresh(), 0);
  },
);
world.onChange("places", () => {
  content.places = readPlaces(world.get("places"));
  spots.rebuild();
});
world.onChange("targets", () => {
  content.targets = readTargets(world.get("targets"));
  spots.rebuild();
  vaults.rebuild(content.targets.values());
});

onServerEvent(
  EVENTS.inside,
  {
    args: ([id]): [string | null] | null =>
      id == null ? [null] : typeof id === "string" ? [id] : null,
  },
  (id) => {
    spots.insideId = id;
    spots.rebuild();
  },
);
