import {
  every,
  isNear,
  playersNearEntity,
  progressFor,
  spawnVehicle,
} from "@aicore-fivem/lib/server";
import { pickRandom } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/robbery";
import { content } from "../content";
import { STEP_ANIMS, type Step } from "./anims";
import { Guards } from "./guards";

/** The rear doors of a truck, 4 m behind its centre. */
function rearOf(vehicle: number): { x: number; y: number; z: number } {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(vehicle);
  const h = (GetEntityHeading(vehicle) * Math.PI) / 180;
  return { x: x + Math.sin(h) * 4, y: y - Math.cos(h) * 4, z };
}

/**
 * The armored truck job (one at a time, server wide): a parked stockade with two armed guards who attack players who
 * come close; the guards must be down before the charge goes on the rear doors; the doors blow after a fuse and the
 * cash can be grabbed once. Models, weapon and times are panel settings (`settings.truck`).
 */
class Truck {
  private vehicle = 0;
  private readonly guards = new Guards();
  private readonly known = new Set<number>();
  private open = false;
  /** The charge is on (its fuse runs): no second plant. */
  private planted = false;
  private looted = false;
  private nextAllowed = 0;
  private readonly watcher = every(2000, () => this.guard(), {
    active: false,
    name: "truckGuards",
  });
  private ender: ReturnType<typeof setTimeout> | null = null;
  /** True from the start of `spawn` until it settles: a second job cannot start meanwhile (cooldown 0 included). */
  private starting = false;

  get active(): boolean {
    return (
      this.starting || (this.vehicle !== 0 && DoesEntityExist(this.vehicle))
    );
  }

  get waitMs(): number {
    return Math.max(0, this.nextAllowed - Date.now());
  }

  async spawn(source: number): Promise<boolean> {
    this.starting = true;
    try {
      return await this.create(source);
    } finally {
      this.starting = false;
    }
  }

  private async create(source: number): Promise<boolean> {
    const s = content.settings.truck;
    const at = pickRandom(s.spawns);
    if (!at) return false;
    this.nextAllowed = Date.now() + s.cooldown * 60_000;
    const vehicle = await spawnVehicle({
      model: s.truckModel,
      type: "automobile",
      coords: at,
      locked: true,
    });
    if (vehicle === null) return false;
    this.vehicle = vehicle;
    this.open = false;
    this.planted = false;
    this.looted = false;
    await this.guards.spawn(at, s.guardModel, s.guardWeapon);
    this.watcher.set(true);
    this.ender = setTimeout(() => this.end(), s.lifetime * 60_000);
    this.tell(source, true);
    return true;
  }

  /** Tells a player where the truck is (once). */
  tell(source: number, job: boolean): void {
    if (this.known.has(source) && !job) return;
    this.known.add(source);
    const rear = rearOf(this.vehicle);
    emitNet(
      EVENTS.truckJob,
      source,
      NetworkGetNetworkIdFromEntity(this.vehicle),
      rear.x,
      rear.y,
      rear.z,
    );
  }

  /** Guards turn on the first player within 40 m. */
  private guard(): void {
    if (!this.active) return this.end();
    this.guards.attackNear(this.vehicle);
  }

  guardsDown(): boolean {
    return this.guards.allDown();
  }

  atRear(source: number): boolean {
    return this.active && isNear(source, rearOf(this.vehicle), 3);
  }

  /** Plants or loots with the server-timed progress bar facing the doors; true when it ran out at the rear. */
  async step(source: number, kind: Step, seconds: number): Promise<boolean> {
    const done = await progressFor(source, {
      label: Locale(
        kind === "loot" ? "ROB_TRUCK_LOOTING" : "ROB_TRUCK_PLANTING",
      ),
      duration: seconds * 1000,
      anim: STEP_ANIMS[kind],
      face: rearOf(this.vehicle),
    });
    return done && this.atRear(source);
  }

  get isOpen(): boolean {
    return this.open;
  }

  get isLooted(): boolean {
    return this.looted;
  }

  get isPlanted(): boolean {
    return this.planted;
  }

  /** The charge is on: the doors of this truck blow after the fuse (a truck that ended meanwhile is left alone). */
  blow(fuseMs: number): void {
    this.planted = true;
    const vehicle = this.vehicle;
    setTimeout(() => {
      if (!this.active || this.vehicle !== vehicle) return;
      SetVehicleDoorBroken(this.vehicle, 2, false);
      SetVehicleDoorBroken(this.vehicle, 3, false);
      this.open = true;
      for (const source of playersNearEntity(this.vehicle, 100))
        this.tell(source, false);
      const netId = NetworkGetNetworkIdFromEntity(this.vehicle);
      for (const source of this.known) emitNet(EVENTS.truckOpen, source, netId);
    }, fuseMs);
  }

  loot(): void {
    this.looted = true;
    if (this.ender) clearTimeout(this.ender);
    this.ender = setTimeout(() => this.end(), 60_000);
  }

  end(): void {
    this.watcher.set(false);
    if (this.ender) clearTimeout(this.ender);
    this.ender = null;
    if (this.vehicle && DoesEntityExist(this.vehicle))
      DeleteEntity(this.vehicle);
    this.guards.clear();
    for (const source of this.known) emitNet(EVENTS.truckEnd, source);
    this.vehicle = 0;
    this.planted = false;
    this.known.clear();
  }
}

export const truck = new Truck();
