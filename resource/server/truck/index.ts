import {
  aiLog,
  coordsOf,
  dispatch,
  inventory,
  isNear,
  notify,
  onClientCallback,
  onStop,
} from "@aicore-fivem/lib/server";
import { fail, randomInt } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/robbery";
import { content, core, policeOnDuty } from "../content";
import { truck } from "./truck";

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
  const cash = randomInt(s.cashMin, s.cashMax);
  core.AddMoney(source, content.settings.account, cash, "robbery:truck");
  notify(source, Locale("ROB_CASH", cash), "success");
  aiLog("robberies", "armored truck looted", { source, metadata: { cash } });
}

onStop(() => truck.end());
