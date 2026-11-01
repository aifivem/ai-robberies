import {
  isNear,
  onCharacter,
  onClientCallback,
  onStop,
} from "@aicore-fivem/lib/server";
import { fail } from "@aicore-fivem/lib/shared";
import { EVENTS } from "common/robbery";
import { content } from "../content";
import { houses } from "./houses";

onClientCallback(
  EVENTS.exit,
  (source) => {
    const place = content.places.get(houses.insideOf(source) ?? "");
    if (!place?.interior || !isNear(source, place.interior, 3))
      return fail("ROB_ERR_FAR");
    return houses.exit(source) ? { ok: true } : fail("ROB_ERR_FAR");
  },
  { lock: true },
);
onCharacter({
  loaded: (source) => houses.rejoin(source),
  unloaded: (source) => houses.forget(source),
});
onStop(() => houses.stop());
