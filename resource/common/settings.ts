import {
  int,
  readBlipStyle,
  record,
  str,
  vec4,
  type Vec4,
} from "@aicore-fivem/lib/shared";
import { ZERO4 } from "./point";

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
