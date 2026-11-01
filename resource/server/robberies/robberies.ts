import {
  inventory,
  KeyedCooldowns,
  minigameFor,
  notify,
  PlayerMap,
  progressFor,
} from "@aicore-fivem/lib/server";
import { Locale } from "common";
import { ANIMS, AUTO_MINIGAME, type Target } from "common/targets";

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

export const robberies = new Robberies();
