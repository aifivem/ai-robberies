import {
  aiLog,
  doors,
  inventory,
  isNear,
  notify,
} from "@aicore-fivem/lib/server";
import { randomInt } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import type { Target } from "common/targets";
import { content, core } from "../content";
import { houses } from "../houses/houses";
import { robberies } from "./robberies";
import { robbed } from "./robbed";

/** A robbery after the start checks: the progress bar, then the loot if the player is still at the target. */
export async function rob(source: number, target: Target): Promise<void> {
  if (!(await robberies.run(source, target))) return;
  const place = content.places.get(target.place);
  if (!place || !isNear(source, target.coords, 3)) return;
  if (robbed.get(target.id) === true)
    return notify(source, Locale("ROB_ERR_EMPTY"), "error");
  if (
    target.item &&
    target.consume &&
    !inventory.removeItem(source, target.item, 1)
  )
    return notify(source, Locale("ROB_ERR_ITEM"), "error");
  robbed.set(target.id, true);
  setTimeout(() => robbed.set(target.id, false), place.cooldown * 60_000);
  if (target.kind === "entry") houses.enter(source, place);
  if (target.kind === "door" && target.door) {
    const door = target.door;
    doors.setLocked(door, false, source);
    setTimeout(() => doors.setLocked(door, true), place.cooldown * 60_000);
  }
  const cash =
    target.cashMax > 0 ? randomInt(target.cashMin, target.cashMax) : 0;
  if (cash > 0)
    core.AddMoney(
      source,
      content.settings.account,
      cash,
      `robbery:${place.id}`,
    );
  const count = target.reward
    ? randomInt(target.rewardMin, target.rewardMax)
    : 0;
  if (count > 0 && !inventory.addItem(source, target.reward, count))
    notify(source, Locale("ROB_NO_ROOM"), "warning");
  if (cash > 0) notify(source, Locale("ROB_CASH", cash), "success");
  aiLog("robberies", `robbed ${target.id}`, {
    source,
    metadata: { place: place.id, cash, reward: target.reward, count },
  });
}
