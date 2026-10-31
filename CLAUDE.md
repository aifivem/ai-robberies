# ai-robberies

Store, bank, jewelery and house robberies as panel data: places (police needed, cooldown, alert chance, optional house interior) and their targets (register, safe, locker, vitrine, door, entry, loot) with tool, time and reward; plus the armored truck job. Depends on ai-core (money, on-duty counts, prompts, progress); uses the active inventory through ai-core's inventory layer (lib `inventory`) (tools, loot), police alerts through lib `dispatch` and ai-doorlock (door targets) when they run.

## Decisions

- Each target plays a minigame before its bar (lib `minigameFor`; panel per target: automatic by kind (`AUTO_MINIGAME`), none, skill check, lockpick, and a difficulty); a lost game frees the claim, a broken lockpick takes one of the target's item. The minigame is the client's word: the server still runs the bar and every check after it.
- Timed actions run on the server (robberies `rob`, the truck's `plant` / `loot`): the start callback checks everything and answers `{ ok }`, then lib `progressFor` runs the bar facing the target (counts after 80 % of the time; a newer start of the same player ends the older one) and distance, stock and items are checked again before paying. Who works on a target is a claim (`busy`) that counts only while that player's run is still running.
- A robbed target is the GlobalState key `rob:<targetId>` (true while empty) cleared by a server timer after the place's cooldown; at resource start every key is reset.
- A door target without an ai-doorlock id swings its vault map object on every client near it (`resource/client/vaults.ts`), driven by the same GlobalState key.
- The police alert goes once per place per cooldown, on the first target of a visit.
- Houses (`resource/server/houses.ts`): a routing bucket from lib `buckets` per occupied house (taken by the first robber, given back by the last; players go back to bucket 0 on resource stop). The server switches the bucket and sends `inside(id, to)`; the client teleports with `player.teleport` (fade and collision, the entry after a break-in too). The house a character is in is ai-core metadata `robbery_house`; `onCharacter` `loaded` (rejoin and the replay after a restart) puts them at the door. Targets of a house other than its entry only work and show for players inside it.
- Armored truck (`resource/server/truck.ts`): truck from lib `spawnVehicle` (`locked`, no keys) and server-created guard peds (orphan mode 2), guards get `TaskCombatPed` from the server once a player is within 40 m; the rear doors are `SetVehicleDoorBroken` on the server after the fuse. A guard whose entity does not appear in time is kept as a stray and deleted once it shows up or at the end. Models, guard weapon, lifetime, plant / fuse / loot seconds and the job price account are panel settings (`settings.truck`).
- Police counts come from lib `online.onDutyFor`; the places' blip look is the panel setting `settings.blip`.

## Contracts

- Callbacks: `resource/common/robbery.ts`. GlobalState `rob:<targetId>`.
- Items used: `lockpick`, `drill`, `electronickit`, `c4`, loot `rolex`, `goldchain`, `diamond_ring` (ai-inventory `data/items.json`). Metadata `robbery_house`.

## Entry points

- Checks and rewards `resource/server/index.ts`, houses `resource/server/houses.ts`, armored truck `resource/server/truck.ts`, panel `resource/server/schema.ts`; interaction points (lib `Points`, one per target, its label follows the lib `GlobalGroup` mirror of `rob:<id>`) `resource/client/index.ts`, vault doors `resource/client/vaults.ts`, truck job `resource/client/truck.ts`.
