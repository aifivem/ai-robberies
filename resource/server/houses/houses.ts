import { buckets } from "@aicore-fivem/lib/server";
import type { Vec4 } from "@aicore-fivem/lib/shared";
import type { Place } from "common/places";
import { EVENTS, INSIDE_META } from "common/robbery";
import { content, core } from "../content";

/**
 * Robbers inside houses. Each occupied house is its own routing bucket from lib `buckets` (taken when the first robber
 * enters, given back when the last one leaves), so two houses sharing an interior never meet; the house is also the
 * character's metadata for a rejoin. The server switches the bucket, the client teleports (`inside` event).
 */
class Houses {
  private readonly inside = new Map<number, string>();
  private readonly worlds = new Map<
    string,
    { bucket: number; count: number }
  >();

  insideOf(source: number): string | undefined {
    return this.inside.get(source);
  }

  private move(source: number, at: Vec4, id: string | null): void {
    const previous = this.inside.get(source);
    if (previous !== id) {
      if (previous) this.leave(previous);
      if (id) this.join(id);
    }
    if (id) this.inside.set(source, id);
    else this.inside.delete(source);
    SetPlayerRoutingBucket(
      String(source),
      id ? (this.worlds.get(id)?.bucket ?? 0) : 0,
    );
    core.SetMeta(source, INSIDE_META, id);
    emitNet(EVENTS.inside, source, id, at);
  }

  private join(id: string): void {
    const world = this.worlds.get(id);
    if (world) world.count++;
    else
      this.worlds.set(id, {
        bucket: buckets.acquire(`robbery:${id}`),
        count: 1,
      });
  }

  private leave(id: string): void {
    const world = this.worlds.get(id);
    if (!world || --world.count > 0) return;
    this.worlds.delete(id);
    buckets.release(world.bucket);
  }

  enter(source: number, place: Place): void {
    if (place.interior) this.move(source, place.interior, place.id);
  }

  exit(source: number): boolean {
    const place = content.places.get(this.inside.get(source) ?? "");
    if (!place) return false;
    this.move(source, { ...place.coords, heading: 0 }, null);
    return true;
  }

  /** A character that left the game inside a house (or was inside at a restart) comes back at its door. */
  rejoin(source: number): void {
    const id = core.GetMeta(source, INSIDE_META);
    const place = typeof id === "string" ? content.places.get(id) : undefined;
    if (place) this.move(source, { ...place.coords, heading: 0 }, null);
  }

  /** The player is gone (drop, logout); the metadata stays for the rejoin. */
  forget(source: number): void {
    const id = this.inside.get(source);
    if (id === undefined) return;
    this.inside.delete(source);
    this.leave(id);
  }

  /** Back to the shared world before ai-core takes the buckets back. */
  stop(): void {
    for (const source of this.inside.keys())
      SetPlayerRoutingBucket(String(source), 0);
  }
}

export const houses = new Houses();
