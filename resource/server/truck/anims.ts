export type Step = "plant" | "loot";

export const STEP_ANIMS: Record<Step, { dict: string; clip: string }> = {
  plant: {
    dict: "anim@heists@ornate_bank@thermal_charge",
    clip: "thermal_charge",
  },
  loot: { dict: "anim@heists@ornate_bank@grab_cash", clip: "grab" },
};
