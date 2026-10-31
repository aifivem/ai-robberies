import {
  Blips,
  callAction,
  fadeIn,
  fadeOut,
  onServerEvent,
  player,
  Points,
} from "@aicore-fivem/lib/client";
import { readVec4, RecordObjects, type Vec4 } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readPlace, readTarget, type Target } from "common/robbery";
import { content, FALLBACK, world } from "./content";
import "./truck";
import { Vaults } from "./vaults";

import { robbed } from "./robbed";

/**
 * A point at every target ("Rob" or "Emptied" from its GlobalState key), the vault zones of door targets and the
 * places' blips, each kept per record: one edited target rebuilds only its own point and zone, one edited place only
 * its blip and its own targets. Targets inside a house only exist while the player is inside it, together with its
 * exit point.
 */
class Spots {
  readonly points = new Points();
  private readonly blips = new Blips();
  private readonly vaults = new Vaults();
  private insideId: string | null = null;
  /** Target ids per place (every target, shown or not), for the targets of one place. */
  private readonly byPlace = new Map<string, Set<string>>();
  /** Built after the maps above: `RecordObjects` builds at once. */
  readonly targets = new RecordObjects(
    world,
    "targets",
    readTarget,
    (id, target) => this.addTarget(id, target),
  );
  private readonly places = new RecordObjects(
    world,
    "places",
    readPlace,
    (id, place) => {
      if (!place.blip) return;
      this.blips.add(id, {
        ...content.settings.blip,
        coords: place.coords,
        label: place.label,
      });
      return () => this.blips.remove(id);
    },
  );

  constructor() {
    // A place's interior decides where its targets show; the blip look is a setting every place reads.
    world.onChange("places", (key) =>
      key === undefined ? this.targets.rebuildAll() : this.rebuildPlace(key),
    );
    world.onChange("settings", () => this.places.rebuildAll());
  }

  private addTarget(id: string, target: Target): () => void {
    let ids = this.byPlace.get(target.place);
    if (!ids) this.byPlace.set(target.place, (ids = new Set()));
    ids.add(id);
    this.vaults.add(target);
    const house =
      content.places.get(target.place)?.interior != null &&
      target.kind !== "entry";
    const shown = house === (this.insideId === target.place);
    if (shown)
      this.points.add(id, {
        coords: target.coords,
        radius: 1.2,
        interval: 300,
        label: () =>
          Locale(
            robbed.get(id) === true ? "ROB_PROMPT_EMPTY" : "ROB_PROMPT",
            target.label,
          ),
        icon: "mask",
        onPressed: () => this.rob(id),
      });
    return () => {
      if (shown) this.points.remove(id);
      this.vaults.remove(id);
      ids.delete(id);
      if (ids.size === 0) this.byPlace.delete(target.place);
    };
  }

  /** The targets of one place again (its interior changed, or the player entered / left it). */
  private rebuildPlace(placeId: string): void {
    // A copy: each rebuild takes the id out of the set and puts it back (a live Set would visit it again).
    const ids = Array.from(this.byPlace.get(placeId) ?? []);
    for (const id of ids) this.targets.rebuild(id);
  }

  /** The player entered a house (`id`) or left one (null): the targets of both and the exit point follow. */
  setInside(id: string | null): void {
    const was = this.insideId;
    this.insideId = id;
    if (was !== null) this.rebuildPlace(was);
    if (id !== null && id !== was) this.rebuildPlace(id);
    this.points.remove("exit");
    const inside = id ? content.places.get(id)?.interior : null;
    if (inside)
      this.points.add("exit", {
        coords: inside,
        label: Locale("ROB_PROMPT_EXIT"),
        icon: "door-open",
        radius: 1.5,
        interval: 300,
        onPressed: () => this.exit(),
      });
  }

  /** A changed `rob:<id>` key. */
  robbedChanged(id: string, value: boolean): void {
    this.vaults.changed(id, value);
    this.points.refresh(id);
  }

  async rob(id: string): Promise<void> {
    if (!this.targets.records.has(id)) return;
    // The server runs the progress bar and hands out the loot.
    await callAction(EVENTS.start, [id], FALLBACK);
  }

  /** The screen goes black first; the server's `inside` event teleports and lifts the fade. */
  async exit(): Promise<void> {
    await fadeOut();
    if (!(await callAction(EVENTS.exit, [], FALLBACK))) await fadeIn(300);
  }
}

const spots = new Spots();
robbed.onChange((id, value) => spots.robbedChanged(id, value === true));

onServerEvent(
  EVENTS.inside,
  {
    // A malformed target is refused (never a teleport to 0, 0, 0).
    args: ([id, to]): [string | null, Vec4] | null => {
      const point = readVec4(to);
      return (id == null || typeof id === "string") && point
        ? [id ?? null, point]
        : null;
    },
  },
  (id, to) => {
    spots.setInside(id);
    void player.teleport(to, { heading: to.heading });
  },
);
