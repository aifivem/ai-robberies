# ai-robberies

Store, bank and jewelery robberies as panel data: places (police needed, cooldown, alert chance) and their targets (register, safe, locker, vitrine, door) with tool, time and reward. Depends on ai-core (money, on-duty counts, prompts, progress); uses ai-inventory (tools, loot), ai-police (`SendAlert`) and ai-doorlock (door targets) when they run. Research: `docs/research/ai-robberies.md`.

## Decisions

- Two-step timed action: `start` checks everything and hands a token, the client runs the progress, `finish` checks the time (80%) and distance again before paying.
- A robbed target is the GlobalState key `rob:<targetId>` (true while empty) cleared by a server timer after the place's cooldown; at resource start every key is reset.
- A door target without an ai-doorlock id swings its vault map object on every client near it (`resource/client/vaults.ts`), driven by the same GlobalState key.
- The police alert goes once per place per cooldown, on the first target of a visit.

## Contracts

- Callbacks: `resource/common/robbery.ts`. GlobalState `rob:<targetId>`.
- Items used: `lockpick`, `drill`, `electronickit`, loot `rolex`, `goldchain`, `diamond_ring` (ai-inventory `data/items.json`).

## Entry points

- Checks and rewards `resource/server/index.ts`, panel `resource/server/schema.ts`; prompts `resource/client/index.ts`, vault doors `resource/client/vaults.ts`.
