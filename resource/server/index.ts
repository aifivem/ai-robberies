import { AdminPanel, aiLog, aiLogChannels, notify, onClientCallback, optionalExport, resourceExport } from "@aicore-fivem/lib/server";
import { asArgs } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readPlaces, readSettings, readTargets, robbedKey, type Target } from "common/robbery";
import { robberiesSchema } from "./schema";

const core = resourceExport("ai-core");
const panel = new AdminPanel(robberiesSchema);
/** Panel content, parsed again after every change. */
const content = { settings: readSettings(panel.get("settings")), places: readPlaces(panel.get("places")), targets: readTargets(panel.get("targets")) };
panel.onChange("settings", () => (content.settings = readSettings(panel.get("settings"))));
panel.onChange("places", () => (content.places = readPlaces(panel.get("places"))));
panel.onChange("targets", () => (content.targets = readTargets(panel.get("targets"))));
aiLogChannels({ robberies: {} });

const fail = (error: string) => ({ ok: false as const, error });
const UNARMED = GetHashKey("WEAPON_UNARMED");
const random = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const near = (source: number, at: { x: number; y: number; z: number }, metres: number) => {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
  return Math.hypot(x - at.x, y - at.y, z - at.z) <= metres;
};

// A restart forgets the cooldown timers: every target starts full again.
for (const id of content.targets.keys()) if (GlobalState[robbedKey(id)] === true) GlobalState.set(robbedKey(id), false, true);

/** Robberies in progress (one per player, one player per target) and the police alerts already sent per place. */
class Robberies {
  private readonly runs = new Map<number, { token: number; target: Target; startedAt: number }>();
  private readonly busy = new Map<string, number>();
  private readonly alerted = new Map<string, number>();
  private nextToken = 0;

  start(source: number, target: Target): number {
    this.drop(source);
    const token = ++this.nextToken;
    this.runs.set(source, { token, target, startedAt: Date.now() });
    this.busy.set(target.id, source);
    return token;
  }

  /** The target is being robbed by someone else whose run is still within its time. */
  taken(target: Target, source: number): boolean {
    const by = this.busy.get(target.id);
    if (by === undefined || by === source) return false;
    const run = this.runs.get(by);
    return run !== undefined && Date.now() - run.startedAt < target.seconds * 2000 + 15_000;
  }

  take(source: number, token: number): { target: Target; startedAt: number } | null {
    const run = this.runs.get(source);
    if (!run || run.token !== token) return null;
    this.drop(source);
    return run;
  }

  drop(source: number): void {
    const run = this.runs.get(source);
    if (run && this.busy.get(run.target.id) === source) this.busy.delete(run.target.id);
    this.runs.delete(source);
  }

  /** True the first time per place cooldown window. */
  shouldAlert(placeId: string, minutes: number): boolean {
    if ((this.alerted.get(placeId) ?? 0) > Date.now()) return false;
    this.alerted.set(placeId, Date.now() + minutes * 60_000);
    return true;
  }
}

const robberies = new Robberies();
const policeOnDuty = () => content.settings.policeJobs.reduce((sum, job) => sum + core.GetOnDutyCount(job), 0);

onClientCallback(EVENTS.start, { args: ([id]) => asArgs(typeof id === "string" ? id : null), lock: true }, (source, id) => {
  const target = content.targets.get(id);
  const place = target ? content.places.get(target.place) : undefined;
  if (!target || !place) return fail("ROB_ERR_FAR");
  if (!near(source, target.coords, 2.5)) return fail("ROB_ERR_FAR");
  if (GlobalState[robbedKey(id)] === true) return fail("ROB_ERR_EMPTY");
  if (robberies.taken(target, source)) return fail("ROB_ERR_BUSY");
  if (policeOnDuty() < place.minPolice) return fail("ROB_ERR_POLICE");
  if (target.item && (optionalExport("ai-inventory")?.GetItemCount(source, target.item) ?? 0) < 1) return fail("ROB_ERR_ITEM");
  if (target.kind === "vitrine" && GetSelectedPedWeapon(GetPlayerPed(String(source))) === UNARMED) return fail("ROB_ERR_WEAPON");
  if (place.alertChance > 0 && robberies.shouldAlert(place.id, place.cooldown) && Math.random() * 100 < place.alertChance)
    optionalExport("ai-police")?.SendAlert(place.coords.x, place.coords.y, place.coords.z, Locale("ROB_ALERT", place.label));
  const token = robberies.start(source, target);
  return { ok: true, token, seconds: target.seconds };
});

onClientCallback(EVENTS.finish, { args: ([token]) => asArgs(typeof token === "number" ? token : null), lock: true }, (source, token) => {
  const run = robberies.take(source, token);
  if (!run) return fail("ROB_ERR_FAR");
  const { target } = run;
  const place = content.places.get(target.place);
  if (!place || Date.now() - run.startedAt < target.seconds * 800 || !near(source, target.coords, 3)) return fail("ROB_ERR_FAR");
  if (GlobalState[robbedKey(target.id)] === true) return fail("ROB_ERR_EMPTY");
  const inventory = optionalExport("ai-inventory");
  if (target.item && target.consume && !inventory?.RemoveItem(source, target.item, 1)) return fail("ROB_ERR_ITEM");
  GlobalState.set(robbedKey(target.id), true, true);
  setTimeout(() => GlobalState.set(robbedKey(target.id), false, true), place.cooldown * 60_000);
  if (target.kind === "door" && target.door) {
    const doors = optionalExport("ai-doorlock");
    doors?.SetDoorState(target.door, false);
    setTimeout(() => optionalExport("ai-doorlock")?.SetDoorState(target.door, true), place.cooldown * 60_000);
  }
  const cash = target.cashMax > 0 ? random(target.cashMin, target.cashMax) : 0;
  if (cash > 0) core.AddMoney(source, content.settings.account, cash, `robbery:${place.id}`);
  const count = target.reward ? random(target.rewardMin, target.rewardMax) : 0;
  if (count > 0 && !inventory?.AddItem(source, target.reward, count)) notify(source, Locale("ROB_NO_ROOM"), "warning");
  if (cash > 0) notify(source, Locale("ROB_CASH", cash), "success");
  aiLog("robberies", `robbed ${target.id}`, { source, metadata: { place: place.id, cash, reward: target.reward, count } });
  return { ok: true };
});

on("playerDropped", () => robberies.drop(Number(globalThis.source)));
