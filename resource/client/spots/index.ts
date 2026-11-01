import { onServerEvent, player } from "@aicore-fivem/lib/client";
import { readVec4, type Vec4 } from "@aicore-fivem/lib/shared";
import { EVENTS } from "common/robbery";
import { robbed } from "./robbed";
import { spots } from "./spots";

robbed.onChange((id, value) => spots.robbedChanged(id, value === true));

onServerEvent(
  EVENTS.inside,
  {
    // A malformed target is refused (never a teleport to 0, 0, 0).
    args: ([id, to]): [string | null, Vec4] | null => {
      const point = readVec4(to);
      return (id == null || typeof id === "string") && point
        ? [id ?? null, point]
        : null;
    },
  },
  (id, to) => {
    spots.setInside(id);
    void player.teleport(to, { heading: to.heading });
  },
);
