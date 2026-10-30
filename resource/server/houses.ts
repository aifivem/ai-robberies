import { onClientCallback } from "@aicore-fivem/lib/server";
import { CORE } from "@aicore-fivem/shared";
import { EVENTS, INSIDE_META, type Place } from "common/robbery";
import { content, core, fail } from "./content";

/**
 * Robbers inside houses. Each house is its own routing bucket (7000 + n; ai-properties uses 5000+, ai-core 50000+),
 * so two houses sharing an interior never meet; the house is also the character's metadata for a rejoin.
 */
class Houses {
  private readonly inside = new Map<number, string>();
  private readonly buckets = new Map<string, number>();

  private bucketOf(id: string): number {
    let bucket = this.buckets.get(id);
    if (bucket === undefined) {
      bucket = 7000 + this.buckets.size;
      this.buckets.set(id, bucket);
      SetRoutingBucketPopulationEnabled(bucket, false);
      SetRoutingBucketEntityLockdownMode(bucket, "strict");
    }
    return bucket;
  }

  insideOf(source: number): string | undefined {
    return this.inside.get(source);
  }

  private move(
    source: number,
    at: { x: number; y: number; z: number; heading: number },
    bucket: number,
    id: string | null,
  ): void {
    const ped = GetPlayerPed(String(source));
    SetPlayerRoutingBucket(String(source), bucket);
    SetEntityCoords(ped, at.x, at.y, at.z, false, false, false, false);
    SetEntityHeading(ped, at.heading);
    if (id) this.inside.set(source, id);
    else this.inside.delete(source);
    core.SetMeta(source, INSIDE_META, id);
    emitNet(EVENTS.inside, source, id);
  }

  enter(source: number, place: Place): void {
    if (place.interior)
      this.move(source, place.interior, this.bucketOf(place.id), place.id);
  }

  exit(source: number): boolean {
    const place = content.places.get(this.inside.get(source) ?? "");
    if (!place) return false;
    this.move(source, { ...place.coords, heading: 0 }, 0, null);
    return true;
  }

  /** A character that left the game inside a house comes back at its door. */
  rejoin(source: number): void {
    const id = core.GetMeta(source, INSIDE_META);
    const place = typeof id === "string" ? content.places.get(id) : undefined;
    if (place) this.move(source, { ...place.coords, heading: 0 }, 0, null);
  }

  drop(source: number): void {
    this.inside.delete(source);
  }
}

export const houses = new Houses();

onClientCallback(
  EVENTS.exit,
  (source) => {
    const place = content.places.get(houses.insideOf(source) ?? "");
    if (!place?.interior) return fail("ROB_ERR_FAR");
    const [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
    if (
      Math.hypot(
        x - place.interior.x,
        y - place.interior.y,
        z - place.interior.z,
      ) > 3
    )
      return fail("ROB_ERR_FAR");
    return houses.exit(source) ? { ok: true } : fail("ROB_ERR_FAR");
  },
  { lock: true },
);
on(CORE.playerLoadedEvent, (source: number) => houses.rejoin(source));
on("playerDropped", () => houses.drop(Number(globalThis.source)));
