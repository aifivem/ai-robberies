import {
  aiLog,
  coordsOf,
  dispatch,
  every,
  inventory,
  isNear,
  notify,
  onClientCallback,
  PendingActions,
  playersNearEntity,
  spawnVehicle,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readId, waitFor } from "@aicore-fivem/lib/shared";
import { Locale, ResourceName } from "common";
import { EVENTS } from "common/robbery";
import { content, core, policeOnDuty, random } from "./content";

type Step = "plant" | "loot";

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
  private guards: number[] = [];
  /** Guards created whose entity did not show up in time: deleted once they do, or at the end. */
  private strays: number[] = [];
  private readonly attacking = new Set<number>();
  private readonly known = new Set<number>();
  private open = false;
  private looted = false;
  private nextAllowed = 0;
  private readonly watcher = every(2000, () => this.guard(), {
    active: false,
    name: "truckGuards",
  });
  private ender: ReturnType<typeof setTimeout> | null = null;
  /** Plant / loot progress per player (lib `PendingActions`: token, 80% of the time, freed on drop). */
  private readonly runs = new PendingActions<Step>();

  get active(): boolean {
    return this.vehicle !== 0 && DoesEntityExist(this.vehicle);
  }

  get waitMs(): number {
    return Math.max(0, this.nextAllowed - Date.now());
  }

  async spawn(source: number): Promise<boolean> {
    const s = content.settings.truck;
    const at = s.spawns[random(0, s.spawns.length - 1)];
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
    this.looted = false;
    const h = (at.heading * Math.PI) / 180;
    for (const side of [-1, 1]) {
      const guard = CreatePed(
        4,
        GetHashKey(s.guardModel),
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
      GiveWeaponToPed(guard, GetHashKey(s.guardWeapon), 250, false, true);
      SetPedArmour(guard, 100);
      this.guards.push(guard);
    }
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
    this.dropStrays();
    for (const source of playersNearEntity(this.vehicle, 40)) {
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

  guardsDown(): boolean {
    return this.guards.every(
      (g) => !DoesEntityExist(g) || GetEntityHealth(g) <= 100,
    );
  }

  atRear(source: number): boolean {
    return this.active && isNear(source, rearOf(this.vehicle), 3);
  }

  start(source: number, kind: Step, seconds: number): number {
    return this.runs.start(source, kind, seconds * 1000);
  }

  /** The player's step for this token (a wrong token leaves the running one alone), done in time and at the rear. */
  take(source: number, token: number, kind: Step): boolean {
    return this.runs.take(source, token) === kind && this.atRear(source);
  }

  get isOpen(): boolean {
    return this.open;
  }

  get isLooted(): boolean {
    return this.looted;
  }

  blow(fuseMs: number): void {
    setTimeout(() => {
      if (!this.active) return;
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
    for (const entity of [this.vehicle, ...this.guards, ...this.strays])
      if (entity && DoesEntityExist(entity)) DeleteEntity(entity);
    for (const source of this.known) emitNet(EVENTS.truckEnd, source);
    this.vehicle = 0;
    this.guards = [];
    this.strays = [];
    this.attacking.clear();
    this.known.clear();
  }
}

const truck = new Truck();

onClientCallback(
  EVENTS.truckStart,
  async (source) => {
    const s = content.settings.truck;
    if (s.giver.x === 0 && s.giver.y === 0) return fail("ROB_ERR_FAR");
    if (!isNear(source, s.giver, 3)) return fail("ROB_ERR_FAR");
    if (truck.active) return fail("ROB_ERR_TRUCK_BUSY");
    if (truck.waitMs > 0) return fail("ROB_ERR_TRUCK_WAIT");
    if (policeOnDuty() < s.minPolice) return fail("ROB_ERR_POLICE");
    if (s.spawns.length === 0) return fail("ROB_ERR_FAR");
    if (!core.RemoveMoney(source, s.account, s.price, "robbery:truck"))
      return fail("ROB_ERR_MONEY");
    if (!(await truck.spawn(source))) {
      core.AddMoney(source, s.account, s.price, "robbery:truck:refund");
      return fail("ROB_ERR_FAR");
    }
    aiLog("robberies", "armored truck job", { source });
    return { ok: true };
  },
  { lock: true },
);

onClientCallback(
  EVENTS.truckPlant,
  (source) => {
    if (!truck.atRear(source) || truck.isOpen) return fail("ROB_ERR_FAR");
    if (!truck.guardsDown()) return fail("ROB_ERR_GUARDS");
    const s = content.settings.truck;
    if (!inventory.hasItem(source, s.item)) return fail("ROB_ERR_ITEM");
    return {
      ok: true,
      token: truck.start(source, "plant", s.plantSeconds),
      seconds: s.plantSeconds,
    };
  },
  { lock: true },
);

onClientCallback(
  EVENTS.truckPlanted,
  { args: oneArg(readId), lock: true },
  (source, token) => {
    if (!truck.take(source, token, "plant") || truck.isOpen)
      return fail("ROB_ERR_FAR");
    const s = content.settings.truck;
    if (!inventory.removeItem(source, s.item, 1)) return fail("ROB_ERR_ITEM");
    dispatch.alert({
      code: "10-90",
      title: Locale("ROB_TRUCK_ALERT"),
      coords: coordsOf(source),
      source,
      icon: "truck",
      blip: { sprite: 67, color: 1 },
      priority: "high",
    });
    notify(source, Locale("ROB_TRUCK_FUSE"), "warning", s.fuseSeconds * 1000);
    truck.blow(s.fuseSeconds * 1000);
    return { ok: true };
  },
);

onClientCallback(
  EVENTS.truckLoot,
  (source) => {
    if (!truck.atRear(source) || !truck.isOpen) return fail("ROB_ERR_FAR");
    if (truck.isLooted) return fail("ROB_ERR_EMPTY");
    const seconds = content.settings.truck.lootSeconds;
    return { ok: true, token: truck.start(source, "loot", seconds), seconds };
  },
  { lock: true },
);

onClientCallback(
  EVENTS.truckLooted,
  { args: oneArg(readId), lock: true },
  (source, token) => {
    if (!truck.take(source, token, "loot") || truck.isLooted)
      return fail("ROB_ERR_EMPTY");
    truck.loot();
    const s = content.settings.truck;
    const cash = random(s.cashMin, s.cashMax);
    core.AddMoney(source, content.settings.account, cash, "robbery:truck");
    notify(source, Locale("ROB_CASH", cash), "success");
    aiLog("robberies", "armored truck looted", { source, metadata: { cash } });
    return { ok: true };
  },
);

on(
  "onResourceStop",
  (resource: string) => resource === ResourceName && truck.end(),
);
