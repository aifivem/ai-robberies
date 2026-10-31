import {
  aiLog,
  coordsOf,
  dispatch,
  every,
  inventory,
  isNear,
  notify,
  onClientCallback,
  playersNearEntity,
  progressFor,
  spawnVehicle,
} from "@aicore-fivem/lib/server";
import { fail, waitFor } from "@aicore-fivem/lib/shared";
import { Locale, ResourceName } from "common";
import { EVENTS } from "common/robbery";
import { content, core, policeOnDuty, random } from "./content";

type Step = "plant" | "loot";

const STEP_ANIMS: Record<Step, { dict: string; clip: string }> = {
  plant: {
    dict: "anim@heists@ornate_bank@thermal_charge",
    clip: "thermal_charge",
  },
  loot: { dict: "anim@heists@ornate_bank@grab_cash", clip: "grab" },
};

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
    this.planted = false;
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
    for (const entity of [this.vehicle, ...this.guards, ...this.strays])
      if (entity && DoesEntityExist(entity)) DeleteEntity(entity);
    for (const source of this.known) emitNet(EVENTS.truckEnd, source);
    this.vehicle = 0;
    this.planted = false;
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
    if (truck.isPlanted) return fail("ROB_ERR_BUSY");
    if (!truck.guardsDown()) return fail("ROB_ERR_GUARDS");
    if (!inventory.hasItem(source, content.settings.truck.item))
      return fail("ROB_ERR_ITEM");
    void plant(source);
    return { ok: true };
  },
  { lock: true },
);

/** The charge goes on after the progress bar; the doors blow after the fuse. */
async function plant(source: number): Promise<void> {
  const s = content.settings.truck;
  if (
    !(await truck.step(source, "plant", s.plantSeconds)) ||
    truck.isOpen ||
    truck.isPlanted
  )
    return;
  if (!inventory.removeItem(source, s.item, 1))
    return notify(source, Locale("ROB_ERR_ITEM"), "error");
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
}

onClientCallback(
  EVENTS.truckLoot,
  (source) => {
    if (!truck.atRear(source) || !truck.isOpen) return fail("ROB_ERR_FAR");
    if (truck.isLooted) return fail("ROB_ERR_EMPTY");
    void loot(source);
    return { ok: true };
  },
  { lock: true },
);

/** The cash after the progress bar, once per truck (the first player to finish takes it). */
async function loot(source: number): Promise<void> {
  const s = content.settings.truck;
  if (!(await truck.step(source, "loot", s.lootSeconds))) return;
  if (truck.isLooted) return notify(source, Locale("ROB_ERR_EMPTY"), "error");
  truck.loot();
  const cash = random(s.cashMin, s.cashMax);
  core.AddMoney(source, content.settings.account, cash, "robbery:truck");
  notify(source, Locale("ROB_CASH", cash), "success");
  aiLog("robberies", "armored truck looted", { source, metadata: { cash } });
}

on(
  "onResourceStop",
  (resource: string) => resource === ResourceName && truck.end(),
);
