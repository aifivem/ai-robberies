import {
  aiLog,
  aiLogChannels,
  dispatch,
  doors,
  GlobalGroup,
  inventory,
  isNear,
  KeyedCooldowns,
  minigameFor,
  notify,
  onClientCallback,
  PlayerMap,
  progressFor,
  stateBoolean,
} from "@aicore-fivem/lib/server";
import {
  fail,
  oneArg,
  randomInt,
  readText,
  rollChance,
} from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  ANIMS,
  AUTO_MINIGAME,
  EVENTS,
  ROBBED_PREFIX,
  type Target,
} from "common/robbery";
import { content, core, policeOnDuty } from "./content";
import { houses } from "./houses";
import "./truck";

const robbed = new GlobalGroup(ROBBED_PREFIX, stateBoolean);

aiLogChannels({ robberies: {} });
const UNARMED = GetHashKey("WEAPON_UNARMED");

// A restart forgets the cooldown timers: every target starts full again.
for (const id of content.targets.keys())
  if (robbed.get(id) === true) robbed.set(id, false);

/**
 * Robberies in progress (one per player, freed on drop), who works on which target, and the police alerts already
 * sent per place.
 */
class Robberies {
  private readonly runs = new PlayerMap<Target>();
  /** targetId -> the player on it and until when the claim holds. */
  private readonly busy = new Map<string, { source: number; until: number }>();
  private readonly alerted = new KeyedCooldowns<string>();

  /** The target is being robbed by someone else whose run is still running and within its time. */
  taken(target: Target, source: number): boolean {
    const claim = this.busy.get(target.id);
    if (!claim || claim.source === source) return false;
    return (
      GetGameTimer() < claim.until && this.runs.get(claim.source) === target
    );
  }

  /**
   * Claims the target, plays its minigame and runs the server-timed progress bar facing it; true when both went
   * through. A newer run of the same player ends this one (false) and keeps its own claim.
   */
  async run(source: number, target: Target): Promise<boolean> {
    this.busy.set(target.id, {
      source,
      until: GetGameTimer() + target.seconds * 2000 + 135_000,
    });
    this.runs.set(source, target);
    const done =
      (await this.minigame(source, target)) &&
      (await progressFor(source, {
        label: Locale("ROB_WORKING"),
        duration: target.seconds * 1000,
        anim: ANIMS[target.kind],
        face: target.coords,
      }));
    if (this.runs.get(source) === target) this.runs.delete(source);
    if (this.busy.get(target.id)?.source === source)
      this.busy.delete(target.id);
    return done;
  }

  /** The target's minigame (none: passes); a lost game notifies, a broken pick takes the target's item. */
  private async minigame(source: number, target: Target): Promise<boolean> {
    const game =
      target.minigame === "auto" ? AUTO_MINIGAME[target.kind] : target.minigame;
    if (game === "none") return true;
    const outcome = await minigameFor(source, {
      game,
      difficulty: target.difficulty,
    });
    if (outcome === "won") return true;
    if (outcome === "broken" && target.item) {
      inventory.removeItem(source, target.item, 1);
      notify(source, Locale("ROB_PICK_BROKE"), "error");
    } else notify(source, Locale("ROB_MINIGAME_LOST"), "warning");
    return false;
  }

  /** True the first time per place cooldown window. */
  shouldAlert(placeId: string, minutes: number): boolean {
    return this.alerted.take(placeId, minutes * 60_000);
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

/** A robbery after the start checks: the progress bar, then the loot if the player is still at the target. */
async function rob(source: number, target: Target): Promise<void> {
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
