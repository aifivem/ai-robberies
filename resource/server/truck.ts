import { aiLog, notify, onClientCallback, optionalExport } from "@aicore-fivem/lib/server";
import { asArgs, waitFor } from "@aicore-fivem/lib/shared";
import { Locale, ResourceName } from "common";
import { EVENTS } from "common/robbery";
import { content, core, distance, fail, near, policeOnDuty, pos, random } from "./content";

const TRUCK_MODEL = "stockade";
const GUARD_MODEL = "s_m_m_security_01";
const GUARD_WEAPON = "WEAPON_CARBINERIFLE";
const LIFETIME_MS = 20 * 60_000;
const PLANT_SECONDS = 5;
const FUSE_MS = 10_000;
const LOOT_SECONDS = 10;

/** The rear doors of a truck, 4 m behind its centre. */
function rearOf(vehicle: number): { x: number; y: number; z: number } {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(vehicle);
  const h = (GetEntityHeading(vehicle) * Math.PI) / 180;
  return { x: x + Math.sin(h) * 4, y: y - Math.cos(h) * 4, z };
}

/**
 * The armored truck job (one at a time, server wide): a parked stockade with two armed guards who attack players who
 * come close; the guards must be down before the charge goes on the rear doors; the doors blow after a fuse and the
 * cash can be grabbed once.
 */
class Truck {
  private vehicle = 0;
  private guards: number[] = [];
  private readonly attacking = new Set<number>();
  private readonly known = new Set<number>();
  private open = false;
  private looted = false;
  private nextAllowed = 0;
  private watcher: ReturnType<typeof setInterval> | null = null;
  private ender: ReturnType<typeof setTimeout> | null = null;
  readonly runs = new Map<number, { token: number; kind: "plant" | "loot"; startedAt: number }>();
  private nextToken = 0;

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
    const vehicle = CreateVehicleServerSetter(GetHashKey(TRUCK_MODEL), "automobile", at.x, at.y, at.z, at.heading);
    if (!(await waitFor(() => DoesEntityExist(vehicle) || undefined, 5000).catch(() => false))) return false;
    SetEntityOrphanMode(vehicle, 2);
    SetVehicleDoorsLocked(vehicle, 2);
    this.vehicle = vehicle;
    this.open = false;
    this.looted = false;
    const h = (at.heading * Math.PI) / 180;
    for (const side of [-1, 1]) {
      const guard = CreatePed(4, GetHashKey(GUARD_MODEL), at.x + Math.cos(h) * 2.2 * side, at.y + Math.sin(h) * 2.2 * side, at.z, at.heading, true, true);
      if (!(await waitFor(() => DoesEntityExist(guard) || undefined, 5000).catch(() => false))) continue;
      SetEntityOrphanMode(guard, 2);
      GiveWeaponToPed(guard, GetHashKey(GUARD_WEAPON), 250, false, true);
      SetPedArmour(guard, 100);
      this.guards.push(guard);
    }
    this.watcher = setInterval(() => this.guard(), 2000);
    this.ender = setTimeout(() => this.end(), LIFETIME_MS);
    this.tell(source, true);
    return true;
  }

  /** Tells a player where the truck is (once). */
  tell(source: number, job: boolean): void {
    if (this.known.has(source) && !job) return;
    this.known.add(source);
    const rear = rearOf(this.vehicle);
    emitNet(EVENTS.truckJob, source, NetworkGetNetworkIdFromEntity(this.vehicle), rear.x, rear.y, rear.z);
  }

  /** Guards turn on the first player within 40 m. */
  private guard(): void {
    if (!this.active) return this.end();
    const [x = 0, y = 0, z = 0] = GetEntityCoords(this.vehicle);
    for (const source of core.GetLoadedSources()) {
      if (distance(pos(source), { x, y, z }) > 40) continue;
      for (const guard of this.guards) {
        if (this.attacking.has(guard) || !DoesEntityExist(guard) || GetEntityHealth(guard) <= 100) continue;
        TaskCombatPed(guard, GetPlayerPed(String(source)), 0, 16);
        this.attacking.add(guard);
      }
    }
  }

  guardsDown(): boolean {
    return this.guards.every((g) => !DoesEntityExist(g) || GetEntityHealth(g) <= 100);
  }

  atRear(source: number): boolean {
    return this.active && near(source, rearOf(this.vehicle), 3);
  }

  start(source: number, kind: "plant" | "loot"): number {
    const token = ++this.nextToken;
    this.runs.set(source, { token, kind, startedAt: Date.now() });
    return token;
  }

  take(source: number, token: number, kind: "plant" | "loot", seconds: number): boolean {
    const run = this.runs.get(source);
    this.runs.delete(source);
    return run !== undefined && run.token === token && run.kind === kind && Date.now() - run.startedAt >= seconds * 800 && this.atRear(source);
  }

  get isOpen(): boolean {
    return this.open;
  }

  get isLooted(): boolean {
    return this.looted;
  }

  blow(): void {
    setTimeout(() => {
      if (!this.active) return;
      SetVehicleDoorBroken(this.vehicle, 2, false);
      SetVehicleDoorBroken(this.vehicle, 3, false);
      this.open = true;
      const rear = rearOf(this.vehicle);
      for (const source of core.GetLoadedSources()) if (distance(pos(source), rear) <= 100) this.tell(source, false);
      const netId = NetworkGetNetworkIdFromEntity(this.vehicle);
      for (const source of this.known) emitNet(EVENTS.truckOpen, source, netId);
    }, FUSE_MS);
  }

  loot(): void {
    this.looted = true;
    if (this.ender) clearTimeout(this.ender);
    this.ender = setTimeout(() => this.end(), 60_000);
  }

  end(): void {
    if (this.watcher) clearInterval(this.watcher);
    if (this.ender) clearTimeout(this.ender);
    this.watcher = null;
    this.ender = null;
    for (const entity of [this.vehicle, ...this.guards]) if (entity && DoesEntityExist(entity)) DeleteEntity(entity);
    for (const source of this.known) emitNet(EVENTS.truckEnd, source);
    this.vehicle = 0;
    this.guards = [];
    this.attacking.clear();
    this.known.clear();
    this.runs.clear();
  }
}

const truck = new Truck();

onClientCallback(
  EVENTS.truckStart,
  async (source) => {
    const s = content.settings.truck;
    if (s.giver.x === 0 && s.giver.y === 0) return fail("ROB_ERR_FAR");
    if (!near(source, s.giver, 3)) return fail("ROB_ERR_FAR");
    if (truck.active) return fail("ROB_ERR_TRUCK_BUSY");
    if (truck.waitMs > 0) return fail("ROB_ERR_TRUCK_WAIT");
    if (policeOnDuty() < s.minPolice) return fail("ROB_ERR_POLICE");
    if (s.spawns.length === 0) return fail("ROB_ERR_FAR");
    if (!core.RemoveMoney(source, "bank", s.price, "robbery:truck")) return fail("ROB_ERR_MONEY");
    if (!(await truck.spawn(source))) {
      core.AddMoney(source, "bank", s.price, "robbery:truck:refund");
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
    if ((optionalExport("ai-inventory")?.GetItemCount(source, content.settings.truck.item) ?? 0) < 1) return fail("ROB_ERR_ITEM");
    return { ok: true, token: truck.start(source, "plant"), seconds: PLANT_SECONDS };
  },
  { lock: true },
);

onClientCallback(EVENTS.truckPlanted, { args: ([token]) => asArgs(typeof token === "number" ? token : null), lock: true }, (source, token) => {
  if (!truck.take(source, token, "plant", PLANT_SECONDS) || truck.isOpen) return fail("ROB_ERR_FAR");
  if (!optionalExport("ai-inventory")?.RemoveItem(source, content.settings.truck.item, 1)) return fail("ROB_ERR_ITEM");
  const p = pos(source);
  optionalExport("ai-police")?.SendAlert(p.x, p.y, p.z, Locale("ROB_TRUCK_ALERT"));
  notify(source, Locale("ROB_TRUCK_FUSE"), "warning", FUSE_MS);
  truck.blow();
  return { ok: true };
});

onClientCallback(
  EVENTS.truckLoot,
  (source) => {
    if (!truck.atRear(source) || !truck.isOpen) return fail("ROB_ERR_FAR");
    if (truck.isLooted) return fail("ROB_ERR_EMPTY");
    return { ok: true, token: truck.start(source, "loot"), seconds: LOOT_SECONDS };
  },
  { lock: true },
);

onClientCallback(EVENTS.truckLooted, { args: ([token]) => asArgs(typeof token === "number" ? token : null), lock: true }, (source, token) => {
  if (!truck.take(source, token, "loot", LOOT_SECONDS) || truck.isLooted) return fail("ROB_ERR_EMPTY");
  truck.loot();
  const s = content.settings.truck;
  const cash = random(s.cashMin, s.cashMax);
  core.AddMoney(source, content.settings.account, cash, "robbery:truck");
  notify(source, Locale("ROB_CASH", cash), "success");
  aiLog("robberies", "armored truck looted", { source, metadata: { cash } });
  return { ok: true };
});

on("playerDropped", () => truck.runs.delete(Number(globalThis.source)));
on("onResourceStop", (resource: string) => resource === ResourceName && truck.end());
