import {
  Blips,
  callAction,
  fadeIn,
  fadeOut,
  onServerEvent,
  player,
  Points,
} from "@aicore-fivem/lib/client";
import { readVec4, type Vec4 } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/robbery";
import { content, FALLBACK, world } from "./content";
import "./truck";
import { Vaults } from "./vaults";

import { robbed } from "./robbed";

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
          ...content.settings.blip,
          coords: place.coords,
          label: place.label,
        });
  }

  async rob(id: string): Promise<void> {
    const target = content.targets.get(id);
    if (!target) return;
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
const vaults = new Vaults();
spots.rebuild();
vaults.rebuild(content.targets.values());
robbed.onChange((id, value) => {
  vaults.changed(id, value === true);
  spots.points.refresh();
});
world.onChange("places", () => spots.rebuild());
world.onChange("settings", () => spots.rebuild());
world.onChange("targets", () => {
  spots.rebuild();
  vaults.rebuild(content.targets.values());
});

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
    spots.insideId = id;
    spots.rebuild();
    void player.teleport(to, { heading: to.heading });
  },
);
