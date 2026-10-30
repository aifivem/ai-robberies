import {
  aiLog,
  aiLogChannels,
  dispatch,
  GlobalGroup,
  inventory,
  isNear,
  notify,
  onClientCallback,
  optionalExport,
  PendingActions,
  stateBoolean,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readId, readText } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, ROBBED_PREFIX, type Target } from "common/robbery";
import { content, core, policeOnDuty, random } from "./content";
import { houses } from "./houses";
import "./truck";

const robbed = new GlobalGroup(ROBBED_PREFIX, stateBoolean);

aiLogChannels({ robberies: {} });
const UNARMED = GetHashKey("WEAPON_UNARMED");

// A restart forgets the cooldown timers: every target starts full again.
for (const id of content.targets.keys())
  if (robbed.get(id) === true) robbed.set(id, false);

/**
 * Robberies in progress (lib `PendingActions`: one per player, token, 80% of the time, freed on drop), who works on
 * which target, and the police alerts already sent per place.
 */
class Robberies {
  private readonly runs = new PendingActions<Target>();
  /** targetId -> the player on it and until when the claim holds. */
  private readonly busy = new Map<string, { source: number; until: number }>();
  private readonly alerted = new Map<string, number>();

  start(source: number, target: Target): number {
    this.busy.set(target.id, {
      source,
      until: GetGameTimer() + target.seconds * 2000 + 15_000,
    });
    return this.runs.start(source, target, target.seconds * 1000);
  }

  /** The target is being robbed by someone else whose run is still running and within its time. */
  taken(target: Target, source: number): boolean {
    const claim = this.busy.get(target.id);
    if (!claim || claim.source === source) return false;
    return (
      GetGameTimer() < claim.until &&
      this.runs.peek(claim.source)?.id === target.id
    );
  }

  /** The player's run for this token when enough time passed; frees the target either way. */
  take(source: number, token: number): Target | null {
    const target = this.runs.peek(source);
    const done = this.runs.take(source, token);
    if (target && this.runs.peek(source) === null)
      if (this.busy.get(target.id)?.source === source)
        this.busy.delete(target.id);
    return done;
  }

  /** True the first time per place cooldown window. */
  shouldAlert(placeId: string, minutes: number): boolean {
    if ((this.alerted.get(placeId) ?? 0) > Date.now()) return false;
    this.alerted.set(placeId, Date.now() + minutes * 60_000);
    return true;
  }
}

const robberies = new Robberies();

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
      Math.random() * 100 < place.alertChance
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
    const token = robberies.start(source, target);
    return { ok: true, token, seconds: target.seconds };
  },
);

onClientCallback(
  EVENTS.finish,
  { args: oneArg(readId), lock: true },
  (source, token) => {
    const target = robberies.take(source, token);
    if (!target) return fail("ROB_ERR_FAR");
    const place = content.places.get(target.place);
    if (!place || !isNear(source, target.coords, 3)) return fail("ROB_ERR_FAR");
    if (robbed.get(target.id) === true) return fail("ROB_ERR_EMPTY");
    if (
      target.item &&
      target.consume &&
      !inventory.removeItem(source, target.item, 1)
    )
      return fail("ROB_ERR_ITEM");
    robbed.set(target.id, true);
    setTimeout(() => robbed.set(target.id, false), place.cooldown * 60_000);
    if (target.kind === "entry") houses.enter(source, place);
    if (target.kind === "door" && target.door) {
      const doors = optionalExport("ai-doorlock");
      doors?.SetDoorState(target.door, false);
      setTimeout(
        () => optionalExport("ai-doorlock")?.SetDoorState(target.door, true),
        place.cooldown * 60_000,
      );
    }
    const cash =
      target.cashMax > 0 ? random(target.cashMin, target.cashMax) : 0;
    if (cash > 0)
      core.AddMoney(
        source,
        content.settings.account,
        cash,
        `robbery:${place.id}`,
      );
    const count = target.reward
      ? random(target.rewardMin, target.rewardMax)
      : 0;
    if (count > 0 && !inventory.addItem(source, target.reward, count))
      notify(source, Locale("ROB_NO_ROOM"), "warning");
    if (cash > 0) notify(source, Locale("ROB_CASH", cash), "success");
    aiLog("robberies", `robbed ${target.id}`, {
      source,
      metadata: { place: place.id, cash, reward: target.reward, count },
    });
    return { ok: true };
  },
);
