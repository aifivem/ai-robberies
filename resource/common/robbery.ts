import { bool, int, num, record, str } from "@aicore-fivem/lib/shared";

/** ai-robberies' contracts and panel content. No natives. */

export const EVENTS = {
  /** Callback: (targetId) -> { ok, token, seconds } starts robbing a target (checks, item, police count). */
  start: "ai-robberies:start",
  /** Callback: (token) -> { ok } the progress ran out: reward, cooldown. */
  finish: "ai-robberies:finish",
} as const;

/** GlobalState key of a target that was robbed and waits for its place's cooldown (true while emptied). */
export const robbedKey = (targetId: string) => `rob:${targetId}`;

/** register / safe / locker / vitrine give money and items; door opens an ai-doorlock door until the cooldown ends. */
export type TargetKind = "register" | "safe" | "locker" | "vitrine" | "door";
const KINDS: TargetKind[] = ["register", "safe", "locker", "vitrine", "door"];

type Point = { x: number; y: number; z: number };
const point = (v: unknown): Point => {
  const p = record(v);
  return { x: num(p.x, 0), y: num(p.y, 0), z: num(p.z, 0) };
};

export interface Settings {
  policeJobs: string[];
  account: string;
}

export function readSettings(raw: unknown): Settings {
  const v = record(raw);
  const jobs = Array.isArray(v.policeJobs) ? v.policeJobs.filter((j): j is string => typeof j === "string") : [];
  return { policeJobs: jobs.length > 0 ? jobs : ["police"], account: str(v.account, "cash", 32) };
}

export interface Place {
  id: string;
  label: string;
  coords: Point;
  /** Officers on duty needed before anything here can be robbed. */
  minPolice: number;
  /** Minutes a robbed target stays empty (and an opened door open). */
  cooldown: number;
  /** Percent chance the first target of a visit alerts the police. */
  alertChance: number;
  blip: boolean;
}

export function readPlaces(raw: unknown): Map<string, Place> {
  const out = new Map<string, Place>();
  for (const [id, value] of Object.entries(record(raw))) {
    const v = record(value);
    out.set(id, {
      id,
      label: str(v.label, id, 48),
      coords: point(v.coords),
      minPolice: int(v.minPolice, 0, 0, 32),
      cooldown: int(v.cooldown, 30, 1, 1440),
      alertChance: int(v.alertChance, 100, 0, 100),
      blip: bool(v.blip, false),
    });
  }
  return out;
}

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
}

export function readTargets(raw: unknown): Map<string, Target> {
  const out = new Map<string, Target>();
  for (const [id, value] of Object.entries(record(raw))) {
    const v = record(value);
    const cashMin = int(v.cashMin, 0, 0, 1_000_000);
    const rewardMin = int(v.rewardMin, 0, 0, 100);
    out.set(id, {
      id,
      place: str(v.place, "", 48),
      label: str(v.label, id, 48),
      kind: KINDS.includes(v.kind as TargetKind) ? (v.kind as TargetKind) : "register",
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
    });
  }
  return out;
}

/** The animation each kind plays during its progress. */
export const ANIMS: Record<TargetKind, { dict: string; clip: string }> = {
  register: { dict: "oddjobs@shop_robbery@rob_till", clip: "loop" },
  safe: { dict: "mini@safe_cracking", clip: "dial_turn_anti_fast_1" },
  locker: { dict: "anim@heists@fleeca_bank@drilling", clip: "drill_straight_idle" },
  vitrine: { dict: "missheist_jewel", clip: "smash_case" },
  door: { dict: "anim@heists@ornate_bank@hack", clip: "hack_loop" },
};
