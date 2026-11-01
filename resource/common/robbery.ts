/** ai-robberies' contracts (panel content: `settings.ts`, `places.ts`, `targets.ts`). No natives. */

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
