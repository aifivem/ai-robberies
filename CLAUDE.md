# ai-robberies

Store, bank, jewelery and house robberies as panel data: places (police needed, cooldown, alert chance, optional house interior) and their targets (register, safe, locker, vitrine, door, entry, loot) with tool, time and reward; plus the armored truck job. Depends on ai-core (money, on-duty counts, prompts, progress); uses ai-inventory (tools, loot), ai-police (`SendAlert`) and ai-doorlock (door targets) when they run. Research: `docs/research/ai-robberies.md`.

## Decisions

- Two-step timed action: `start` checks everything and hands a token, the client runs the progress, `finish` checks the time (80%) and distance again before paying.
- A robbed target is the GlobalState key `rob:<targetId>` (true while empty) cleared by a server timer after the place's cooldown; at resource start every key is reset.
- A door target without an ai-doorlock id swings its vault map object on every client near it (`resource/client/vaults.ts`), driven by the same GlobalState key.
- The police alert goes once per place per cooldown, on the first target of a visit.
- Houses: routing bucket 7000 + n per house (`resource/server/houses.ts`); the house a character is in is ai-core metadata `robbery_house` and a rejoin puts them at the door. Targets of a house other than its entry only work and show for players inside it.
- Armored truck (`resource/server/truck.ts`): server-created stockade and guard peds (orphan mode 2), guards get `TaskCombatPed` from the server once a player is within 40 m; the rear doors are `SetVehicleDoorBroken` on the server after the fuse.

## Contracts

- Callbacks: `resource/common/robbery.ts`. GlobalState `rob:<targetId>`.
- Items used: `lockpick`, `drill`, `electronickit`, `c4`, loot `rolex`, `goldchain`, `diamond_ring` (ai-inventory `data/items.json`). Metadata `robbery_house`.

## Entry points

- Checks and rewards `resource/server/index.ts`, panel `resource/server/schema.ts`; prompts `resource/client/index.ts`, vault doors `resource/client/vaults.ts`.
