import { num, record, vec4, type Vec4 } from "@aicore-fivem/lib/shared";

export type Point = { x: number; y: number; z: number };
export const point = (v: unknown): Point => {
  const p = record(v);
  return { x: num(p.x, 0), y: num(p.y, 0), z: num(p.z, 0) };
};

export const ZERO4 = { x: 0, y: 0, z: 0, heading: 0 };
/** A panel point left at (0, 0, 0) means "none". */
export const optional4 = (v: unknown): Vec4 | null => {
  const p = vec4(v, ZERO4);
  return p.x === 0 && p.y === 0 ? null : p;
};
