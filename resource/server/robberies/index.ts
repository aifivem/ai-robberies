import {
  aiLogChannels,
  dispatch,
  inventory,
  isNear,
  onClientCallback,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readText, rollChance } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/robbery";
import { content, policeOnDuty } from "../content";
import { houses } from "../houses/houses";
import { rob } from "./rob";
import { robberies } from "./robberies";
import { robbed } from "./robbed";

aiLogChannels({ robberies: {} });
const UNARMED = GetHashKey("WEAPON_UNARMED");

// A restart forgets the cooldown timers: every target starts full again.
for (const id of content.targets.keys())
  if (robbed.get(id) === true) robbed.set(id, false);

onClientCallback(
  EVENTS.start,
  { args: oneArg((v) => readText(v, 64)), lock: true },
  (source, id) => {
    const target = content.targets.get(id);
    const place = target ? content.places.get(target.place) : undefined;
    if (!target || !place) return fail("ROB_ERR_FAR");
    if (!isNear(source, target.coords, 2.5)) return fail("ROB_ERR_FAR");
    // Inside a house only its own targets count; a house broken into stays open until its cooldown ends.
    if (
      place.interior &&
      target.kind !== "entry" &&
      houses.insideOf(source) !== place.id
    )
      return fail("ROB_ERR_FAR");
    if (target.kind === "entry" && robbed.get(id) === true) {
      houses.enter(source, place);
      return { ok: true, entered: true };
    }
    if (robbed.get(id) === true) return fail("ROB_ERR_EMPTY");
    if (robberies.taken(target, source)) return fail("ROB_ERR_BUSY");
    if (policeOnDuty() < place.minPolice) return fail("ROB_ERR_POLICE");
    if (target.item && !inventory.hasItem(source, target.item))
      return fail("ROB_ERR_ITEM");
    if (
      target.kind === "vitrine" &&
      GetSelectedPedWeapon(GetPlayerPed(String(source))) === UNARMED
    )
      return fail("ROB_ERR_WEAPON");
    if (
      place.alertChance > 0 &&
      robberies.shouldAlert(place.id, place.cooldown) &&
      rollChance(place.alertChance)
    )
      dispatch.alert({
        code: "10-90",
        title: Locale("ROB_ALERT"),
        message: place.label,
        coords: place.coords,
        source,
        icon: "sack-dollar",
        priority: "high",
      });
    void rob(source, target);
    return { ok: true };
  },
);
