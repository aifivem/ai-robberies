import { bool, int, str, type Vec4 } from "@aicore-fivem/lib/shared";
import { optional4, point, type Point } from "./point";

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
