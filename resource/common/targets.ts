import { bool, int, num, str } from "@aicore-fivem/lib/shared";
import { point, type Point } from "./point";

/**
 * register / safe / locker / vitrine / loot give money and items; door opens an ai-doorlock door until the cooldown
 * ends; entry breaks into a house (a place with an interior) and takes the robber inside.
 */
export type TargetKind =
  "register" | "safe" | "locker" | "vitrine" | "door" | "entry" | "loot";
const KINDS: TargetKind[] = [
  "register",
  "safe",
  "locker",
  "vitrine",
  "door",
  "entry",
  "loot",
];

export interface Target {
  id: string;
  place: string;
  label: string;
  kind: TargetKind;
  coords: Point;
  /** Item the player must carry (empty: none); `consume` spends one. */
  item: string;
  consume: boolean;
  seconds: number;
  cashMin: number;
  cashMax: number;
  /** Item reward (empty: none), rewardMin..rewardMax of it. */
  reward: string;
  rewardMin: number;
  rewardMax: number;
  /** ai-doorlock door id (door targets). */
  door: string;
  /** Door targets without a door id swing this map object (a bank vault) locally on every client. */
  vaultModel: string;
  vaultClosed: number;
  vaultOpen: number;
  /** Played before the progress bar: "auto" picks by kind (`AUTO_MINIGAME`). */
  minigame: TargetMinigame;
  difficulty: "easy" | "medium" | "hard";
}

export type TargetMinigame = "auto" | "none" | "skillCheck" | "lockpick";
const MINIGAMES: TargetMinigame[] = ["auto", "none", "skillCheck", "lockpick"];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

/** The minigame "auto" means for each kind. */
export const AUTO_MINIGAME: Record<
  TargetKind,
  "none" | "skillCheck" | "lockpick"
> = {
  register: "lockpick",
  safe: "skillCheck",
  locker: "skillCheck",
  vitrine: "none",
  door: "skillCheck",
  entry: "lockpick",
  loot: "none",
};

/** One target record (`panel.records` / `world.records`). */
export function readTarget(id: string, v: Record<string, unknown>): Target {
  const cashMin = int(v.cashMin, 0, 0, 1_000_000);
  const rewardMin = int(v.rewardMin, 0, 0, 100);
  return {
    id,
    place: str(v.place, "", 48),
    label: str(v.label, id, 48),
    kind: KINDS.includes(v.kind as TargetKind)
      ? (v.kind as TargetKind)
      : "register",
    coords: point(v.coords),
    item: str(v.item, "", 48),
    consume: bool(v.consume, false),
    seconds: int(v.seconds, 20, 1, 600),
    cashMin,
    cashMax: Math.max(cashMin, int(v.cashMax, 0, 0, 1_000_000)),
    reward: str(v.reward, "", 48),
    rewardMin,
    rewardMax: Math.max(rewardMin, int(v.rewardMax, 0, 0, 100)),
    door: str(v.door, "", 64),
    vaultModel: str(v.vaultModel, "", 64),
    vaultClosed: num(v.vaultClosed, 0, -720, 720),
    vaultOpen: num(v.vaultOpen, 0, -720, 720),
    minigame: MINIGAMES.find((m) => m === v.minigame) ?? "auto",
    difficulty: DIFFICULTIES.find((d) => d === v.difficulty) ?? "medium",
  };
}

/** The animation each kind plays during its progress. */
export const ANIMS: Record<TargetKind, { dict: string; clip: string }> = {
  register: { dict: "oddjobs@shop_robbery@rob_till", clip: "loop" },
  safe: { dict: "mini@safe_cracking", clip: "dial_turn_anti_fast_1" },
  locker: {
    dict: "anim@heists@fleeca_bank@drilling",
    clip: "drill_straight_idle",
  },
  vitrine: { dict: "missheist_jewel", clip: "smash_case" },
  door: { dict: "anim@heists@ornate_bank@hack", clip: "hack_loop" },
  entry: { dict: "veh@break_in@0h@p_m_one@", clip: "low_force_entry_ds" },
  loot: {
    dict: "anim@gangops@facility@servers@bodysearch@",
    clip: "player_search",
  },
};
