import { playersNearEntity } from "@aicore-fivem/lib/server";
import { waitFor, type Vec4 } from "@aicore-fivem/lib/shared";

/** The truck's two armed guards (server-created peds) and the ones whose entity has not shown up yet. */
export class Guards {
  private guards: number[] = [];
  /** Guards created whose entity did not show up in time: deleted once they do, or at the end. */
  private strays: number[] = [];
  private readonly attacking = new Set<number>();

  /** One guard on each side of the truck spot. */
  async spawn(at: Vec4, model: string, weapon: string): Promise<void> {
    const h = (at.heading * Math.PI) / 180;
    for (const side of [-1, 1]) {
      const guard = CreatePed(
        4,
        GetHashKey(model),
        at.x + Math.cos(h) * 2.2 * side,
        at.y + Math.sin(h) * 2.2 * side,
        at.z,
        at.heading,
        true,
        true,
      );
      if (
        !(await waitFor(() => DoesEntityExist(guard) || undefined, 5000).catch(
          () => false,
        ))
      ) {
        this.strays.push(guard);
        continue;
      }
      SetEntityOrphanMode(guard, 2);
      GiveWeaponToPed(guard, GetHashKey(weapon), 250, false, true);
      SetPedArmour(guard, 100);
      this.guards.push(guard);
    }
  }

  /** Guards turn on the first player within 40 m. */
  attackNear(vehicle: number): void {
    this.dropStrays();
    for (const source of playersNearEntity(vehicle, 40)) {
      for (const guard of this.guards) {
        if (
          this.attacking.has(guard) ||
          !DoesEntityExist(guard) ||
          GetEntityHealth(guard) <= 100
        )
          continue;
        TaskCombatPed(guard, GetPlayerPed(String(source)), 0, 16);
        this.attacking.add(guard);
      }
    }
  }

  private dropStrays(): void {
    if (this.strays.length === 0) return;
    for (const ped of this.strays) if (DoesEntityExist(ped)) DeleteEntity(ped);
    this.strays = this.strays.filter((ped) => !DoesEntityExist(ped));
  }

  allDown(): boolean {
    return this.guards.every(
      (g) => !DoesEntityExist(g) || GetEntityHealth(g) <= 100,
    );
  }

  /** Deletes every guard and stray. */
  clear(): void {
    for (const entity of [...this.guards, ...this.strays])
      if (entity && DoesEntityExist(entity)) DeleteEntity(entity);
    this.guards = [];
    this.strays = [];
    this.attacking.clear();
  }
}
