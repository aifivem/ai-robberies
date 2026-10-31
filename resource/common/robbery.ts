import {
  bool,
  int,
  num,
  readBlipStyle,
  record,
  str,
  vec4,
  type Vec4,
} from "@aicore-fivem/lib/shared";

/** ai-robberies' contracts and panel content. No natives. */

export const EVENTS = {
  /** Callback: (targetId) -> { ok, entered? } starts robbing a target (checks, item, police count); the server runs the progress bar and the reward. */
  start: "ai-robberies:start",
  /** Callback: () -> { ok } leaves the house the player is inside. */
  exit: "ai-robberies:exit",
  /** Server -> player: (placeId | null, to: Vec4) the player is inside this house now (or left): teleport to `to`. */
  inside: "ai-robberies:client:inside",
  /** Callback: () -> { ok } pays for an armored truck job at the giver. */
  truckStart: "ai-robberies:truckStart",
  /** Server -> player: (netId, x, y, z) the armored truck to rob and its rear doors. */
  truckJob: "ai-robberies:client:truckJob",
  /** Callback: () -> { ok } plants the charge at the truck's rear doors (server-run progress; the doors blow after a fuse). */
  truckPlant: "ai-robberies:truckPlant",
  /** Server -> players near the truck: (netId) the rear doors are open. */
  truckOpen: "ai-robberies:client:truckOpen",
  /** Callback: () -> { ok } grabs the cash (server-run progress). */
  truckLoot: "ai-robberies:truckLoot",
  /** Server -> players who knew the truck: () the truck job is over. */
  truckEnd: "ai-robberies:client:truckEnd",
} as const;

/** ai-core metadata key: the house a character is inside (a character that left the game inside comes back at the door). */
export const INSIDE_META = "robbery_house";

/** GlobalState prefix of a target that was robbed and waits for its place's cooldown (`rob:<id>`, true while emptied). */
export const ROBBED_PREFIX = "rob:";

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

type Point = { x: number; y: number; z: number };
const point = (v: unknown): Point => {
  const p = record(v);
  return { x: num(p.x, 0), y: num(p.y, 0), z: num(p.z, 0) };
};

const ZERO4 = { x: 0, y: 0, z: 0, heading: 0 };
/** A panel point left at (0, 0, 0) means "none". */
const optional4 = (v: unknown): Vec4 | null => {
  const p = vec4(v, ZERO4);
  return p.x === 0 && p.y === 0 ? null : p;
};

export interface TruckSettings {
  /** Where robbers pay for an armored truck job; (0, 0, 0) turns the job off. */
  giver: Vec4;
  price: number;
  minPolice: number;
  /** Minutes between two trucks (server wide). */
  cooldown: number;
  /** Item spent to blow the rear doors. */
  item: string;
  cashMin: number;
  cashMax: number;
  spawns: Vec4[];
  /** Account the job price is taken from. */
  account: string;
  truckModel: string;
  guardModel: string;
  guardWeapon: string;
  /** Minutes before an unrobbed truck goes away. */
  lifetime: number;
  plantSeconds: number;
  fuseSeconds: number;
  lootSeconds: number;
}

export interface BlipStyle {
  sprite: number;
  color: number;
  scale: number;
}

export interface Settings {
  policeJobs: string[];
  account: string;
  /** Map blip of places with the map switch on. */
  blip: BlipStyle;
  truck: TruckSettings;
}

export function readSettings(raw: unknown): Settings {
  const v = record(raw);
  const jobs = Array.isArray(v.policeJobs)
    ? v.policeJobs.filter((j): j is string => typeof j === "string")
    : [];
  const t = record(v.truck);
  const cashMin = int(t.cashMin, 2000, 0);
  const blip = record(v.blip);
  return {
    policeJobs: jobs.length > 0 ? jobs : ["police"],
    account: str(v.account, "cash", 32),
    blip: readBlipStyle(blip, { sprite: 500, color: 0, scale: 0.7 }),
    truck: {
      giver: vec4(t.giver, ZERO4),
      price: int(t.price, 500, 0),
      minPolice: int(t.minPolice, 2, 0, 32),
      cooldown: int(t.cooldown, 45, 1, 1440),
      item: str(t.item, "c4", 48),
      cashMin,
      cashMax: Math.max(cashMin, int(t.cashMax, 5000, 0)),
      spawns: (Array.isArray(t.spawns) ? t.spawns : []).map((row) =>
        vec4(record(row).coords, ZERO4),
      ),
      account: str(t.account, "bank", 32),
      truckModel: str(t.truckModel, "stockade", 64),
      guardModel: str(t.guardModel, "s_m_m_security_01", 64),
      guardWeapon: str(t.guardWeapon, "WEAPON_CARBINERIFLE", 64),
      lifetime: int(t.lifetime, 20, 1, 240),
      plantSeconds: int(t.plantSeconds, 5, 1, 120),
      fuseSeconds: int(t.fuseSeconds, 10, 1, 120),
      lootSeconds: int(t.lootSeconds, 10, 1, 120),
    },
  };
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
  /** Houses: where a robber appears inside after breaking in (the exit prompt is there too); null for other places. */
  interior: Vec4 | null;
}

/** One place record (`panel.records` / `world.records`). */
export function readPlace(id: string, v: Record<string, unknown>): Place {
  return {
    id,
    label: str(v.label, id, 48),
    coords: point(v.coords),
    minPolice: int(v.minPolice, 0, 0, 32),
    cooldown: int(v.cooldown, 30, 1, 1440),
    alertChance: int(v.alertChance, 100, 0, 100),
    blip: bool(v.blip, false),
    interior: optional4(v.interior),
  };
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
