import {
  callAction,
  createBlip,
  notify,
  onServerEvent,
  Points,
} from "@aicore-fivem/lib/client";
import { oneArg, readFinite, readId } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/robbery";
import { content, FALLBACK, world } from "./content";

/**
 * The armored truck job on this client: the giver's point, a route blip to the truck the server spawned, and a
 * point at its rear doors (plant the charge, then grab the cash). The server checks every step.
 */
class TruckJob {
  private readonly points = new Points();
  private blip = 0;
  private netId = 0;
  private open = false;

  rebuildGiver(): void {
    this.points.remove("giver");
    const { giver, price } = content.settings.truck;
    if (giver.x === 0 && giver.y === 0) return;
    this.points.add("giver", {
      coords: giver,
      label: Locale("ROB_PROMPT_TRUCK", price),
      icon: "truck",
      radius: 1.5,
      onPressed: () => this.start(),
    });
  }

  job(netId: number, rear: { x: number; y: number; z: number }): void {
    this.netId = netId;
    if (this.blip) RemoveBlip(this.blip);
    this.blip = createBlip({
      coords: rear,
      label: Locale("ROB_BLIP_TRUCK"),
      sprite: 67,
      color: 1,
      scale: 1,
      shortRange: false,
    });
    SetBlipRoute(this.blip, true);
    const at = {
      coords: rear,
      radius: 2,
      interval: 300,
      onPressed: () => this.rear(),
    };
    this.points.add("plant", {
      ...at,
      label: Locale("ROB_PROMPT_TRUCK_PLANT"),
      icon: "bomb",
      canShow: () => !this.open,
    });
    this.points.add("loot", {
      ...at,
      label: Locale("ROB_PROMPT_TRUCK_LOOT"),
      icon: "sack-dollar",
      canShow: () => this.open,
    });
  }

  opened(netId: number): void {
    if (netId !== this.netId) return;
    this.open = true;
    this.points.refresh();
  }

  end(): void {
    if (this.blip) RemoveBlip(this.blip);
    this.blip = 0;
    this.netId = 0;
    this.open = false;
    this.points.remove("plant");
    this.points.remove("loot");
  }

  async start(): Promise<void> {
    const ok = await callAction(EVENTS.truckStart, [], {
      ...FALLBACK,
      timeout: 15_000,
    });
    if (ok) notify(Locale("ROB_TRUCK_STARTED"), "info", 8000);
  }

  /** Plant or loot, whichever the doors allow now; the server runs the progress bar. */
  async rear(): Promise<void> {
    await callAction(
      this.open ? EVENTS.truckLoot : EVENTS.truckPlant,
      [],
      FALLBACK,
    );
  }
}

const truck = new TruckJob();
truck.rebuildGiver();
world.onChange("settings", () => truck.rebuildGiver());

onServerEvent(
  EVENTS.truckJob,
  {
    args: ([netId, x, y, z]): [number, number, number, number] | null => {
      const id = readId(netId);
      const [px, py, pz] = [readFinite(x), readFinite(y), readFinite(z)];
      return id !== null && px !== null && py !== null && pz !== null
        ? [id, px, py, pz]
        : null;
    },
  },
  (netId, x, y, z) => truck.job(netId, { x, y, z }),
);
onServerEvent(
  EVENTS.truckOpen,
  {
    args: oneArg(readId),
  },
  (netId) => truck.opened(netId),
);
onServerEvent(EVENTS.truckEnd, () => truck.end());
