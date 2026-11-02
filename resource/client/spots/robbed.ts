import { GlobalGroup, stateBoolean } from "@aifivem/lib/client";
import { ROBBED_PREFIX } from "common/robbery";

/** Which targets are emptied (GlobalState `rob:<id>`), read from memory. */
export const robbed = new GlobalGroup(ROBBED_PREFIX, stateBoolean);
