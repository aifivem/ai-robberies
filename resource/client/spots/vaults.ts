import { Zones } from "@aicore-fivem/lib/client";
import type { Target } from "common/targets";
import { robbed } from "./robbed";

/**
 * Bank vault doors are map objects every client holds itself: near one, the client turns it to the open or closed
 * heading from its target's GlobalState key, and again whenever that key changes.
 */
export class Vaults {
  private readonly zones = new Zones();
  private readonly near = new Map<string, Target>();

  /** The vault zone of a door target that swings a map object (other targets have none). */
  add(target: Target): void {
    if (target.kind !== "door" || target.door || !target.vaultModel) return;
    this.zones.add(target.id, {
      shape: { type: "sphere", center: target.coords, radius: 40 },
      interval: 1000,
      onEnter: () => {
        this.near.set(target.id, target);
        this.apply(target, robbed.get(target.id) === true);
      },
      onExit: () => this.near.delete(target.id),
    });
  }

  /** Removes a target's vault zone (its exit fires when the player is near). */
  remove(id: string): void {
    this.zones.remove(id);
  }

  /** A changed `rob:<id>` key of a vault the player is near. */
  changed(id: string, open: boolean): void {
    const target = this.near.get(id);
    if (target) this.apply(target, open);
  }

  private apply(target: Target, open: boolean): void {
    const { x, y, z } = target.coords;
    const door = GetClosestObjectOfType(
      x,
      y,
      z,
      6,
      GetHashKey(target.vaultModel),
      false,
      false,
      false,
    );
    if (!door) return;
    SetEntityHeading(door, open ? target.vaultOpen : target.vaultClosed);
    FreezeEntityPosition(door, true);
  }
}
