/*aicore-client-errors*/(function(){var n=GetCurrentResourceName(),s={},c=0;var r=function(t){t=String(t).replace(/\^\d/g,"");var k=t.slice(0,300);if(s[k]||c>=20)return;s[k]=1;c++;try{TriggerServerEvent("ai-core:clientError",n,t.slice(0,4000))}catch(e){}};globalThis.__aicoreReportError=r;var l=console.log;console.log=function(){var a=arguments[0];if(typeof a==="string"&&a.indexOf("SCRIPT ERROR")!==-1)r(a);return l.apply(console,arguments)}})();
try{
(function() {

// ../../../packages/lib/src/fivem/callbackNames.ts
/**
	* Callback wire format, the same on both sides:
	*   request  `aicore:cb:<name>`              (callerResource, id, ...args)
	*   response `aicore:cbr:<callerResource>`   (id, ok, result)
	* The response goes only to the resource that asked, so two resources never see each other's replies.
	*/
	const requestEvent = (name) => `aicore:cb:${name}`;
	const responseEvent = (resource) => `aicore:cbr:${resource}`;
	/** Default time a caller waits for an answer before the promise rejects. */
	const DEFAULT_CALLBACK_TIMEOUT = 3e4;

// ../../../packages/lib/src/shared/wait.ts
/** Resolves after `ms` milliseconds. */
	function sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
	/**
	* Resolves with the first value `check` returns that is not undefined, checking once per tick.
	* Rejects after `timeoutMs` (default 10 s); pass `false` to wait forever.
	* Return `cond || undefined` from `check` to wait for a truthy condition.
	*/
	function waitFor(check, timeoutMs = 1e4) {
		return new Promise((resolve, reject) => {
			const started = Date.now();
			const poll = () => {
				const value = check();
				if (value !== void 0) return resolve(value);
				if (timeoutMs !== false && Date.now() - started > timeoutMs) return reject(/* @__PURE__ */ new Error(`waitFor timed out after ${timeoutMs} ms`));
				setTimeout(poll, 0);
			};
			poll();
		});
	}

// ../../../packages/lib/src/shared/read.ts
/** Small readers for panel content (`data/*.json`): every one returns the fallback when the value is missing or wrong. */
	/** A finite number clamped to `[min, max]`, else the fallback. */
	function num(value, fallback, min = -Infinity, max = Infinity) {
		return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
	}
	/** `num` rounded to an integer. */
	function int(value, fallback, min = -Infinity, max = Infinity) {
		return Math.round(num(value, fallback, min, max));
	}
	/** A boolean, else the fallback. */
	function bool(value, fallback) {
		return typeof value === "boolean" ? value : fallback;
	}
	/** A trimmed non-empty string cut to `max`, else the fallback. */
	function str(value, fallback, max = 64) {
		return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
	}
	/** The value as a plain object, or an empty one. */
	function record(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
	}
	/** A position with heading; each missing field comes from the fallback. */
	function vec4(value, fallback) {
		const v = record(value);
		return {
			x: num(v.x, fallback.x),
			y: num(v.y, fallback.y),
			z: num(v.z, fallback.z),
			heading: num(v.heading, fallback.heading)
		};
	}

// ../../../packages/lib/src/shared/index.ts
	function isRecord(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}
	/** Fills `{0}`, `{1}`... with the arguments by position (a translation may reorder or repeat them). */
	function formatText(template, args) {
		return template.replace(/\{(\d+)\}/g, (match, index) => {
			const value = args[Number(index)];
			return value === void 0 ? match : String(value);
		});
	}
	/** Console output prefixed with the resource name, so server logs show where a line came from. */
	function createLogger(resource) {
		const prefix = `[${resource}]`;
		return {
			info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
			warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
			error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
		};
	}

// ../../../packages/lib/src/client/netEvent.ts
	const log$4 = createLogger(GetCurrentResourceName());
	/**
	* Whether the net event being handled came from the server (read it before the first `await`). On a client only
	* events from the server carry a source (65535 in the docs); a local emit by any resource carries none.
	*/
	const fromServer = () => Boolean(globalThis.source);
	function onServerEvent(name, first, second) {
		const [handler, parse] = typeof first === "function" ? [first, null] : [second, first.args];
		onNet(name, (...raw) => {
			if (!fromServer() || !handler) return;
			const args = parse ? parse(raw) : [];
			if (!args) return log$4.warn(`event ${name} from the server had invalid arguments`);
			Promise.resolve().then(() => handler(...args)).catch((error) => log$4.error(`event ${name} failed`, error));
		});
	}

// ../../../packages/lib/src/client/callback.ts
	const resource$1 = GetCurrentResourceName();
	const log$3 = createLogger(resource$1);
	const pending = /* @__PURE__ */ new Map();
	let nextId$1 = 0;
	onNet(responseEvent(resource$1), (id, ok, result) => {
		if (!fromServer()) return;
		const entry = typeof id === "number" ? pending.get(id) : void 0;
		if (!entry) return;
		pending.delete(id);
		clearTimeout(entry.timer);
		if (ok === true) entry.resolve(result);
		else entry.reject(/* @__PURE__ */ new Error("server callback failed"));
	});
	/**
	* Asks the server (`onClientCallback(name, ...)` there) and resolves with its answer. The answer is unknown:
	* parse it. Rejects when the server reports an error or does not answer within `timeoutMs`.
	*/
	function triggerServerCallback(name, args = [], timeoutMs = DEFAULT_CALLBACK_TIMEOUT) {
		const id = ++nextId$1;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(/* @__PURE__ */ new Error(`server callback ${name} timed out`));
			}, timeoutMs);
			pending.set(id, {
				resolve,
				reject,
				timer
			});
			emitNet(requestEvent(name), resource$1, id, ...args);
		});
	}

// ../../../packages/shared/src/core.ts
/** Names owned by ai-core that other resources, the bridges and the build step use. */
	const CORE = {
		resource: "ai-core",
		/** Client -> server: (resource: string, text: string). Sent by the reporter every client bundle carries. */
		clientErrorEvent: "ai-core:clientError",
		/** (src, character: CharacterInfo) after a character is loaded and spawned. */
		playerLoadedEvent: "ai-core:playerLoaded",
		/** (src, charId, reason: UnloadReason) before a character's state is dropped. */
		playerUnloadedEvent: "ai-core:playerUnloaded",
		/** (src, account: string, balance: number, delta: number, reason: string) */
		moneyChangedEvent: "ai-core:moneyChanged",
		/** (src, jobs: JobMembership[]) */
		jobsChangedEvent: "ai-core:jobsChanged",
		/** (src, job: string | null) */
		dutyChangedEvent: "ai-core:dutyChanged",
		/** (src, gangs: GangMembership[]) */
		gangsChangedEvent: "ai-core:gangsChanged",
		/** (src, gang: string | null) */
		activeGangChangedEvent: "ai-core:activeGangChanged",
		/** (src, charIds: number[]) each time a player's character screen loads; an appearance resource answers with portraits. */
		characterScreenEvent: "ai-core:characterScreen",
		/** (resource: string | null) the inventory behind ai-core's inventory layer changed (the bridge drops its item cache). */
		inventoryChangedEvent: "ai-core:inventoryChanged",
		/** (src, name: string, status: Record<string, number> | null) a player used an item; status = the needs it gives, from inventories that define them. */
		itemUsedEvent: "ai-core:itemUsed",
		/** (src, killer: number | null, weaponHash: number) a player with a loaded character died; fired from FXServer's `onPedDeath` (needs `PED_DEATH_STATE_KEY`). */
		playerDiedEvent: "ai-core:playerDied",
		clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
		clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
		/** (charId: number, url: string) a portrait image of a character on the character screen (e.g. `https://nui-img/<txd>/<txd>`). */
		clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
		/** (charId: number) ai-appearance holds this character's look: ai-core dresses its scene ped with `ApplyCharacterAppearance`. */
		clientCharacterLookEvent: "ai-core:client:characterLook",
		/** (resource: string, id: string) the interaction key was pressed while that resource's prompt was on top. */
		clientPromptPressedEvent: "ai-core:client:promptPressed",
		/** (key: keyof PlayerCache, value) a cached value of the local player changed (one watcher in ai-core for every resource). */
		clientCacheEvent: "ai-core:client:cache",
		/** Server -> client callback: (model: string) the `CreateVehicleServerSetter` type of a model, null when the game has no such vehicle (ai-core's client answers for every resource, lib `spawnVehicle`). */
		vehicleTypeCallback: "ai-core:vehicleType",
		/** GlobalState: "prompt" | "target", how lib `Points` let players interact (ai-core panel setting). */
		interactionStateKey: "ai:interaction",
		charactersCallback: "ai-core:characters",
		createCharacterCallback: "ai-core:createCharacter",
		deleteCharacterCallback: "ai-core:deleteCharacter",
		selectCharacterCallback: "ai-core:selectCharacter",
		/** Server -> client: (notification: Notification) a notification card on the player's screen. */
		clientNotifyEvent: "ai-core:client:notify",
		/** Server -> client: (spawn: SpawnPoint) puts the loaded character into the world. */
		spawnEvent: "ai-core:client:spawn",
		/** Server -> client: () the character was let go (switch); show the character screen again. */
		openCharactersEvent: "ai-core:client:openCharacters"
	};

// ../../../packages/shared/src/admin.ts
/** Event names of the admin panel (owned by ai-core). */
	const ADMIN = {
		/** ACE every panel action checks: `add_ace group.admin ai.admin allow`. */
		ace: "ai.admin",
		/** Callback: (keybinds: KeybindInfo[] the admin's client knows) -> AdminPanelSnapshot[]. */
		openCallback: "ai-core:admin:open",
		applyCallback: "ai-core:admin:apply",
		closeEvent: "ai-core:admin:close",
		/** Server -> client: () open the panel (the `aiadmin` command, checked on the server). */
		showEvent: "ai-core:admin:show",
		/** Server -> admins with the panel open: (delta: AdminDelta). */
		deltaEvent: "ai-core:admin:delta",
		/** Server -> client of a world (`sync: "all"`) file: (file, key | null, value). Prefixed with the resource name. */
		worldEvent: (resource) => `${resource}:admin:world`,
		/** Callback: () -> { [file]: { key: value } } world records changed since the resource started. */
		worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
	};

// ../../../packages/shared/src/menu.ts
	const MENU_EVENTS = {
		/** Client local: (resource, requestId, itemId | null) the player picked an item or closed the menu. */
		menuResult: "ai-core:client:menuResult",
		/** Client local: (resource, requestId, itemId) the pointer or focus is on an item (previews). */
		menuHover: "ai-core:client:menuHover",
		/** Client local: (resource, requestId, values | null) the player confirmed or closed the input dialog. */
		inputResult: "ai-core:client:inputResult"
	};

// ../../../packages/lib/src/client/adminWorld.ts
/**
	* The client copy of a resource's world panel files (`sync: "all"`): the file FiveM cached at start, then the
	* records changed since start (asked once), then live changes. Never polls.
	*/
	var AdminWorld = class {
		data = /* @__PURE__ */ new Map();
		handlers = /* @__PURE__ */ new Map();
		resource = GetCurrentResourceName();
		/** Resolves once the changes since start are applied (or could not be loaded): the data is current from then on. */
		ready;
		/** `files`: the world files this client mirrors (each must be in the resource's `files`). */
		constructor(files) {
			const log = createLogger(this.resource);
			for (const file of files) {
				const raw = LoadResourceFile(this.resource, `data/${file}.json`);
				try {
					const parsed = raw ? JSON.parse(raw) : {};
					this.data.set(file, isRecord(parsed) ? parsed : {});
				} catch (error) {
					log.error(`data/${file}.json is not valid JSON`, error);
					this.data.set(file, {});
				}
			}
			onServerEvent(ADMIN.worldEvent(this.resource), { args: ([file, key, value]) => typeof file === "string" ? [
				file,
				typeof key === "string" && key !== "" ? key : void 0,
				value
			] : null }, (file, key, value) => this.put(file, key, value));
			this.ready = triggerServerCallback(ADMIN.worldChangesCallback(this.resource)).then((changes) => {
				if (!isRecord(changes)) return;
				for (const [file, records] of Object.entries(changes)) {
					if (!isRecord(records)) continue;
					for (const [key, value] of Object.entries(records)) this.put(file, key === "" ? void 0 : key, value);
				}
			}, (error) => log.error("loading the panel changes since start failed", error));
		}
		/** The current content of a file: the settings object, or `{ key: record }`. Read only; parse what you use. */
		get(file) {
			return this.data.get(file) ?? {};
		}
		onChange(file, handler) {
			this.handlers.set(file, [...this.handlers.get(file) ?? [], handler]);
		}
		put(file, key, value) {
			const data = this.data.get(file);
			if (!data) return;
			if (key === void 0) {
				if (isRecord(value)) this.data.set(file, value);
			} else if (value === null) delete data[key];
			else data[key] = value;
			for (const handler of this.handlers.get(file) ?? []) handler(key, value);
		}
	};

// ../../../packages/lib/src/client/cache.ts
/** The unarmed "weapon" hash: cached as `false`. */
	const UNARMED = GetHashKey("WEAPON_UNARMED") | 0;
	/** The weapon in a ped's hand, `false` when unarmed. */
	function readWeapon(ped) {
		const weapon = GetSelectedPedWeapon(ped) | 0;
		return weapon === UNARMED ? false : weapon;
	}
	/** The vehicle, seat and weapon of a ped right now (also ai-core's watcher). */
	function readPlayerState(ped) {
		const vehicle = GetVehiclePedIsIn(ped, false);
		let seat = false;
		if (vehicle) for (let i = -1; i < GetVehicleMaxNumberOfPassengers(vehicle); i++) {
			if (GetPedInVehicleSeat(vehicle, i) !== ped) continue;
			seat = i;
			break;
		}
		return {
			vehicle: vehicle || false,
			seat,
			weapon: readWeapon(ped)
		};
	}
	/**
	* The local player's often read values (ped, player id, server id, vehicle, seat, weapon), like ox_lib's `cache`:
	* read `cache.ped` instead of calling PlayerPedId() in loops. One watcher in ai-core updates every resource through
	* a local event, so no resource polls for these itself. Read only.
	*/
	const ped = PlayerPedId();
	const cache = {
		ped,
		playerId: PlayerId(),
		serverId: GetPlayerServerId(PlayerId()),
		...readPlayerState(ped)
	};
	const handlers = /* @__PURE__ */ new Map();
	const valid = (key, value) => key === "ped" || key === "playerId" || key === "serverId" ? typeof value === "number" : typeof value === "number" || value === false;
	on(CORE.clientCacheEvent, (key, value) => {
		if (typeof key !== "string" || !(key in cache)) return;
		const name = key;
		if (!valid(name, value) || cache[name] === value) return;
		const old = cache[name];
		cache[name] = value;
		for (const handler of handlers.get(name) ?? []) handler(value, old);
	});

// ../../../packages/lib/src/client/zones.ts
/**
	* Zones on this client: inside / outside checks at each zone's own interval, never per frame. Built for any count
	* (measured with 1,000,000 zones): zones sit in a grid of 64 m cells and a check looks only at the player's cell and
	* the zones the player is in.
	*/
	const log$2 = createLogger(GetCurrentResourceName());
	const CELL = 64;
	/** A zone wider than this many cells is kept in one list checked every time instead of in the grid. */
	const MAX_CELLS = 64;
	const cellKey = (cx, cy) => cx + 32768 << 16 | cy + 32768;
	function contains(shape, x, y, z) {
		switch (shape.type) {
			case "sphere": {
				const dx = x - shape.center.x;
				const dy = y - shape.center.y;
				const dz = z - shape.center.z;
				return dx * dx + dy * dy + dz * dz <= shape.radius * shape.radius;
			}
			case "cylinder": {
				const dx = x - shape.center.x;
				const dy = y - shape.center.y;
				return dx * dx + dy * dy <= shape.radius * shape.radius && Math.abs(z - shape.center.z) <= shape.height;
			}
			case "poly": {
				if (z < shape.minZ || z > shape.maxZ) return false;
				let inside = false;
				const p = shape.points;
				for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
					const a = p[i];
					const b = p[j];
					if (a.y > y !== b.y > y && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
				}
				return inside;
			}
			default: return shape;
		}
	}
	/** Ground bounding box of a shape: [minX, minY, maxX, maxY]. */
	function bounds(shape) {
		if (shape.type !== "poly") return [
			shape.center.x - shape.radius,
			shape.center.y - shape.radius,
			shape.center.x + shape.radius,
			shape.center.y + shape.radius
		];
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const p of shape.points) {
			minX = Math.min(minX, p.x);
			minY = Math.min(minY, p.y);
			maxX = Math.max(maxX, p.x);
			maxY = Math.max(maxY, p.y);
		}
		return [
			minX,
			minY,
			maxX,
			maxY
		];
	}
	var Zone = class {
		options;
		inside = false;
		nextCheck = 0;
		interval;
		/** Grid cells the zone is filed under; empty when it is in the large list. */
		cells = [];
		constructor(options) {
			this.options = options;
			this.interval = Math.max(50, options.interval ?? 500);
		}
	};
	/**
	* The zones of one resource. One timer serves them all at the shortest interval any zone asks for; each zone is
	* checked only when its own interval has passed. With no zones the timer stops (an active JS timer costs every frame).
	*/
	var Zones = class {
		zones = /* @__PURE__ */ new Map();
		grid = /* @__PURE__ */ new Map();
		large = /* @__PURE__ */ new Set();
		insideNow = /* @__PURE__ */ new Set();
		/** How many zones use each interval, so the shortest one is found without walking every zone. */
		intervals = /* @__PURE__ */ new Map();
		timer = null;
		period = 0;
		/** Adds (or replaces) a zone. A replaced zone the player was in fires its onExit first. */
		add(id, options) {
			this.remove(id);
			const zone = new Zone(options);
			this.zones.set(id, zone);
			const [minX, minY, maxX, maxY] = bounds(options.shape);
			const x0 = Math.floor(minX / CELL);
			const y0 = Math.floor(minY / CELL);
			const x1 = Math.floor(maxX / CELL);
			const y1 = Math.floor(maxY / CELL);
			if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS) this.large.add(zone);
			else for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
				const key = cellKey(cx, cy);
				let cell = this.grid.get(key);
				if (!cell) this.grid.set(key, cell = /* @__PURE__ */ new Set());
				cell.add(zone);
				zone.cells.push(key);
			}
			this.intervals.set(zone.interval, (this.intervals.get(zone.interval) ?? 0) + 1);
			this.schedule();
		}
		remove(id) {
			const zone = this.zones.get(id);
			if (!zone) return;
			this.zones.delete(id);
			this.large.delete(zone);
			for (const key of zone.cells) {
				const cell = this.grid.get(key);
				cell?.delete(zone);
				if (cell?.size === 0) this.grid.delete(key);
			}
			const left = (this.intervals.get(zone.interval) ?? 1) - 1;
			if (left > 0) this.intervals.set(zone.interval, left);
			else this.intervals.delete(zone.interval);
			if (this.insideNow.delete(zone)) this.fire(zone, false);
			this.schedule();
		}
		/** Removes every zone (exits fire for the ones the player is in). */
		clear() {
			const inside = [...this.insideNow];
			this.zones.clear();
			this.grid.clear();
			this.large.clear();
			this.insideNow.clear();
			this.intervals.clear();
			for (const zone of inside) this.fire(zone, false);
			this.schedule();
		}
		isInside(id) {
			return this.zones.get(id)?.inside ?? false;
		}
		get size() {
			return this.zones.size;
		}
		schedule() {
			let period = 0;
			for (const interval of this.intervals.keys()) period = period === 0 ? interval : Math.min(period, interval);
			if (period === this.period) return;
			if (this.timer) clearInterval(this.timer);
			this.timer = period ? setInterval(() => this.check(), period) : null;
			this.period = period;
		}
		check() {
			const now = GetGameTimer();
			const [x = 0, y = 0, z = 0] = GetEntityCoords(cache.ped, false);
			for (const zone of this.insideNow) this.test(zone, now, x, y, z);
			for (const zone of this.large) this.test(zone, now, x, y, z);
			const cell = this.grid.get(cellKey(Math.floor(x / CELL), Math.floor(y / CELL)));
			if (cell) for (const zone of cell) this.test(zone, now, x, y, z);
		}
		test(zone, now, x, y, z) {
			if (now < zone.nextCheck) return;
			zone.nextCheck = now + zone.interval;
			const inside = contains(zone.options.shape, x, y, z);
			if (inside === zone.inside) return;
			if (inside) this.insideNow.add(zone);
			else this.insideNow.delete(zone);
			this.fire(zone, inside);
		}
		fire(zone, inside) {
			zone.inside = inside;
			try {
				if (inside) zone.options.onEnter?.();
				else zone.options.onExit?.();
			} catch (error) {
				log$2.error("zone handler failed", error);
			}
		}
	};

// ../../../packages/lib/src/fivem/exports.ts
/** Typed access to another resource's exports (types come from CitizenExports in @aicore-fivem/shared). */
	function resourceExport(resource) {
		return globalThis.exports[resource];
	}
	/** Whether a resource is running now. */
	function isResourceStarted(resource) {
		return GetResourceState(resource) === "started";
	}
	/** Calls an export of a resource whose exports have no type here (a third-party script); parse the result. */
	function callExport(resource, name, ...args) {
		const fn = Reflect.get(Object(globalThis.exports[resource]), name);
		if (typeof fn !== "function") throw new Error(`${resource} has no export ${name}`);
		return Reflect.apply(fn, void 0, args);
	}

// ../../../packages/lib/src/client/prompt.ts
	const core$3 = resourceExport(CORE.resource);
	/**
	* ai-core's prompt (the "press E" box on the right): this resource shows and hides its own prompts by id; the
	* interaction key is one rebindable keybind in ai-core, so nothing polls keys per frame. Show a prompt on a zone's
	* enter, hide it on exit, act in `onPromptPressed`.
	*/
	function showPrompt(id, text) {
		core$3.ShowPrompt(id, text);
	}
	function hidePrompt(id) {
		core$3.HidePrompt(id);
	}
	/** The player pressed the interaction key while this resource's prompt `id` was the one on top. */
	function onPromptPressed(handler) {
		const resource = GetCurrentResourceName();
		on(CORE.clientPromptPressedEvent, (owner, id) => {
			if (owner === resource && typeof id === "string") handler(id);
		});
	}

// ../../../packages/lib/src/client/blip.ts
	const LABEL = `AI_BLIP_${GetCurrentResourceName()}`;
	AddTextEntry(LABEL, "~a~");
	/** Creates a named blip at a point and returns its handle (`RemoveBlip` it, or use `Blips`). */
	function createBlip(options) {
		const { x, y, z } = options.coords;
		const blip = AddBlipForCoord(x, y, z);
		SetBlipSprite(blip, options.sprite);
		SetBlipColour(blip, options.color);
		SetBlipScale(blip, options.scale ?? .8);
		SetBlipDisplay(blip, options.display ?? 4);
		SetBlipAsShortRange(blip, options.shortRange ?? true);
		if (options.label !== void 0) {
			BeginTextCommandSetBlipName(LABEL);
			AddTextComponentSubstringPlayerName(options.label);
			EndTextCommandSetBlipName(blip);
		}
		return blip;
	}
	/** A script's blips by id: `add` replaces a blip with the same id, `clear` removes them all (a panel rebuild). */
	var Blips = class {
		blips = /* @__PURE__ */ new Map();
		add(id, options) {
			this.remove(id);
			const blip = createBlip(options);
			this.blips.set(id, blip);
			return blip;
		}
		get(id) {
			return this.blips.get(id);
		}
		remove(id) {
			const blip = this.blips.get(id);
			if (blip === void 0) return;
			RemoveBlip(blip);
			this.blips.delete(id);
		}
		clear() {
			for (const blip of this.blips.values()) RemoveBlip(blip);
			this.blips.clear();
		}
	};

// ../../../packages/lib/src/client/streaming.ts
/**
	* Loads a model and resolves with its hash. Rejects when the model does not exist or does not load in time.
	* Call `SetModelAsNoLongerNeeded(hash)` once the entity is created.
	*/
	async function requestModel(model, timeoutMs = 1e4) {
		const hash = typeof model === "number" ? model : GetHashKey(model);
		if (!IsModelInCdimage(hash)) throw new Error(`model ${model} does not exist`);
		RequestModel(hash);
		await waitFor(() => HasModelLoaded(hash) || void 0, timeoutMs);
		return hash;
	}
	/** Loads an animation dictionary. Call `RemoveAnimDict(dict)` when it is no longer played. */
	async function requestAnimDict(dict, timeoutMs = 1e4) {
		if (!DoesAnimDictExist(dict)) throw new Error(`anim dict ${dict} does not exist`);
		RequestAnimDict(dict);
		await waitFor(() => HasAnimDictLoaded(dict) || void 0, timeoutMs);
		return dict;
	}

// ../../../packages/lib/src/client/localPed.ts
	const log$1 = createLogger(GetCurrentResourceName());
	/** One zone set for every local ped of this resource: peds exist only while their player is near. */
	const zones = new Zones();
	let nextId = 0;
	/**
	* A ped only this client sees (a shopkeeper, a job NPC): created when the player comes near, deleted when they leave,
	* frozen, invincible and deaf to events. Never networked, so strict entity lockdown does not matter.
	*/
	var LocalPed = class {
		options;
		id = `ped:${++nextId}`;
		handle = 0;
		wanted = false;
		constructor(options) {
			this.options = options;
			const { x, y, z } = options.coords;
			zones.add(this.id, {
				shape: {
					type: "sphere",
					center: {
						x,
						y,
						z
					},
					radius: options.distance ?? 50
				},
				interval: 1e3,
				onEnter: () => void this.spawn(),
				onExit: () => this.despawn()
			});
		}
		/** The ped while it exists, else 0. */
		get entity() {
			return this.handle;
		}
		/** Deletes the ped for good. */
		remove() {
			zones.remove(this.id);
			this.despawn();
		}
		async spawn() {
			this.wanted = true;
			const o = this.options;
			try {
				const hash = await requestModel(o.model);
				if (o.anim) await requestAnimDict(o.anim.dict);
				if (!this.wanted || this.handle) return;
				const { x, y, z, heading } = o.coords;
				const ped = CreatePed(4, hash, x, y, o.ground === false ? z : z - 1, heading, false, false);
				SetModelAsNoLongerNeeded(hash);
				FreezeEntityPosition(ped, true);
				SetEntityInvincible(ped, true);
				SetBlockingOfNonTemporaryEvents(ped, true);
				SetPedCanRagdoll(ped, false);
				if (o.scenario) TaskStartScenarioInPlace(ped, o.scenario, 0, true);
				else if (o.anim) TaskPlayAnim(ped, o.anim.dict, o.anim.clip, 8, 8, -1, 1, 0, false, false, false);
				this.handle = ped;
				o.onSpawn?.(ped);
			} catch (error) {
				log$1.error(`local ped ${o.model} could not be created`, error);
			}
		}
		despawn() {
			this.wanted = false;
			if (!this.handle) return;
			const ped = this.handle;
			this.handle = 0;
			this.options.onDespawn?.(ped);
			DeleteEntity(ped);
		}
	};
	on("onResourceStop", (resource) => {
		if (resource === GetCurrentResourceName()) zones.clear();
	});

// ../../../packages/lib/src/client/point.ts
	const log = createLogger(GetCurrentResourceName());
	const TARGET = "ox_target";
	const target = (name, ...args) => callExport(TARGET, name, ...args);
	/** Prompt mode, or target mode when the owner picked it and a resource answers the ox_target API (ai-target does). */
	const style = () => GlobalState[CORE.interactionStateKey] === "target" && isResourceStarted(TARGET) ? "target" : "prompt";
	const groups = /* @__PURE__ */ new Set();
	const byPrompt = /* @__PURE__ */ new Map();
	let busy = false;
	let nextGroup = 0;
	var Point = class {
		promptId;
		options;
		inside = false;
		ped = null;
		targetZone = null;
		/** The prompt text on screen, null while hidden. */
		shown = null;
		/** The label the target option was registered with. */
		targetLabel = null;
		constructor(promptId, options) {
			this.promptId = promptId;
			this.options = options;
		}
		text() {
			const { label } = this.options;
			if (typeof label === "string") return label;
			try {
				return label();
			} catch (error) {
				log.error("point label failed", error);
				return "";
			}
		}
		allowed() {
			try {
				return this.options.canShow?.() ?? true;
			} catch (error) {
				log.error("point canShow failed", error);
				return false;
			}
		}
		press() {
			if (busy || !this.allowed()) return;
			let result;
			try {
				result = this.options.onPressed();
			} catch (error) {
				return log.error("point onPressed failed", error);
			}
			if (!(result instanceof Promise)) return;
			busy = true;
			result.catch((error) => log.error("point onPressed failed", error)).finally(() => busy = false);
		}
		/** The prompt follows inside + canShow + the current label (prompt mode only). */
		sync(group) {
			const text = (this.options.promptOnly ? "prompt" : group) === "prompt" && this.inside && this.allowed() ? this.text() : null;
			if (text === this.shown) return;
			this.shown = text;
			if (text !== null) showPrompt(this.promptId, text);
			else hidePrompt(this.promptId);
		}
		targetOption() {
			this.targetLabel = this.text();
			return [{
				name: this.promptId,
				label: this.targetLabel,
				icon: this.options.icon,
				distance: this.options.radius ?? 2,
				canInteract: () => this.allowed(),
				onSelect: () => this.press()
			}];
		}
	};
	/**
	* Interaction points of a script (counters, shop doors, NPCs): one object per point instead of zones + prompts +
	* blips + peds by hand. Each point shows as ai-core's prompt (interaction key) or as a target option, as the owner
	* picks in ai-core's panel (Interaction); the same `onPressed` runs either way. Rebuild with `clear()` + `add()` when
	* the panel changes the points; call `refresh()` when what `canShow` reads changes (job, duty, vehicle).
	*/
	var Points = class {
		zones = new Zones();
		blips = new Blips();
		points = /* @__PURE__ */ new Map();
		prefix = `pt${++nextGroup}:`;
		constructor() {
			groups.add(this);
		}
		/** Adds (or replaces) a point. */
		add(id, options) {
			this.remove(id);
			const point = new Point(this.prefix + id, options);
			this.points.set(id, point);
			byPrompt.set(point.promptId, point);
			if (options.ped) {
				const ped = options.ped;
				point.ped = new LocalPed({
					...ped,
					coords: ped.coords ?? {
						...options.coords,
						heading: 0
					},
					onSpawn: (entity) => style() === "target" && !options.promptOnly && target("addLocalEntity", entity, point.targetOption()),
					onDespawn: (entity) => style() === "target" && !options.promptOnly && target("removeLocalEntity", entity, point.promptId)
				});
			}
			if (options.blip) this.blips.add(id, {
				...options.blip,
				coords: options.blip.coords ?? options.coords
			});
			this.zones.add(id, {
				shape: options.height !== void 0 ? {
					type: "cylinder",
					center: options.coords,
					radius: options.radius ?? 2,
					height: options.height
				} : {
					type: "sphere",
					center: options.coords,
					radius: options.radius ?? 2
				},
				interval: options.interval,
				onEnter: () => {
					point.inside = true;
					point.sync(style());
					options.onEnter?.();
				},
				onExit: () => {
					point.inside = false;
					point.sync(style());
					options.onExit?.();
				}
			});
			this.attach(point, style());
		}
		remove(id) {
			const point = this.points.get(id);
			if (!point) return;
			this.zones.remove(id);
			this.detach(point);
			point.sync("target");
			point.ped?.remove();
			this.blips.remove(id);
			byPrompt.delete(point.promptId);
			this.points.delete(id);
		}
		clear() {
			for (const id of [...this.points.keys()]) this.remove(id);
		}
		/**
		* Checks `canShow` and a function `label` again (prompt mode; targets ask `canShow` when opened and get a changed
		* label re-registered). Inside a state bag change handler the new value is not readable yet: call it in a `setTimeout`.
		*/
		refresh(id) {
			const mode = style();
			const one = id !== void 0 ? this.points.get(id) : void 0;
			for (const point of one ? [one] : id === void 0 ? this.points.values() : []) {
				point.sync(mode);
				if (mode === "target" && !point.options.promptOnly && typeof point.options.label === "function" && point.targetLabel !== point.text()) {
					this.detach(point);
					this.attach(point, mode);
				}
			}
		}
		isInside(id) {
			return this.points.get(id)?.inside ?? false;
		}
		/** Puts every point on the current interaction style (style switch, target resource restart). */
		restyle() {
			const mode = style();
			for (const point of this.points.values()) {
				this.detach(point);
				this.attach(point, mode);
				point.sync(mode);
			}
		}
		attach(point, mode) {
			if (mode !== "target" || point.options.promptOnly) return;
			const ped = point.ped?.entity;
			if (point.ped) {
				if (ped) target("addLocalEntity", ped, point.targetOption());
				return;
			}
			point.targetZone = target("addSphereZone", {
				coords: point.options.coords,
				radius: point.options.targetRadius ?? 1,
				options: point.targetOption()
			});
		}
		detach(point) {
			if (!isResourceStarted(TARGET)) return void (point.targetZone = null);
			if (point.targetZone != null) target("removeZone", point.targetZone);
			point.targetZone = null;
			const ped = point.ped?.entity;
			if (ped) target("removeLocalEntity", ped, point.promptId);
		}
	};
	onPromptPressed((id) => byPrompt.get(id)?.press());
	const restyleAll = () => {
		for (const group of groups) group.restyle();
	};
	AddStateBagChangeHandler(CORE.interactionStateKey, "global", () => setTimeout(restyleAll, 0));
	for (const event of ["onClientResourceStart", "onClientResourceStop"]) on(event, (resource) => {
		if (resource === TARGET || resource === "ai-target") setTimeout(restyleAll, 0);
	});

// ../../../packages/lib/src/client/player.ts
/** Fades the screen out and resolves once it is black. */
	async function fadeOut(ms = 300) {
		DoScreenFadeOut(ms);
		await waitFor(() => IsScreenFadedOut() || void 0, ms + 2e3).catch(() => void 0);
	}

// ../../../packages/lib/src/client/notify.ts
	const core$2 = resourceExport(CORE.resource);
	/** Shows a notification card on this player's screen (ai-core draws it); `text` is already translated. */
	function notify(text, kind = "info", duration) {
		core$2.Notify({
			text,
			kind,
			duration
		});
	}
	/**
	* Runs a timed action with ai-core's progress bar and an optional animation; resolves true when it ran out, false
	* when cancelled (death, getting into a vehicle). Checks ten times a second, nothing per frame.
	*/
	async function progress(options) {
		const ped = cache.ped;
		if (options.anim) {
			await requestAnimDict(options.anim.dict);
			TaskPlayAnim(ped, options.anim.dict, options.anim.clip, 3, 3, options.duration, options.anim.flag ?? 49, 0, false, false, false);
		}
		core$2.ShowProgress(options.label, options.duration);
		const end = GetGameTimer() + options.duration;
		const done = await new Promise((resolve) => {
			const timer = setInterval(() => {
				const cancelled = IsEntityDead(cache.ped) || !options.allowVehicle && cache.vehicle !== false;
				if (!cancelled && GetGameTimer() < end) return;
				clearInterval(timer);
				resolve(!cancelled);
			}, 100);
		});
		if (options.anim) StopAnimTask(ped, options.anim.dict, options.anim.clip, 1);
		core$2.HideProgress();
		return done;
	}

// ../../../packages/lib/src/client/menu.ts
	const core$1 = resourceExport(CORE.resource);
	/** Menus and input dialogs this resource asked ai-core for, waiting for the player's answer. */
	var Requests = class {
		resource = GetCurrentResourceName();
		waiting = /* @__PURE__ */ new Map();
		hovers = /* @__PURE__ */ new Map();
		nextId = 0;
		constructor() {
			const answer = (owner, id, value) => {
				if (owner !== this.resource || typeof id !== "number") return;
				this.waiting.get(id)?.(value);
				this.waiting.delete(id);
				this.hovers.delete(id);
			};
			on(MENU_EVENTS.menuHover, (owner, id, item) => {
				if (owner === this.resource && typeof id === "number" && typeof item === "string") this.hovers.get(id)?.(item);
			});
			on(MENU_EVENTS.menuResult, answer);
			on(MENU_EVENTS.inputResult, answer);
		}
		ask(open, read, onHover) {
			const id = ++this.nextId;
			this.waiting.set(id, read);
			if (onHover) this.hovers.set(id, onHover);
			open(id);
		}
	};
	const requests = new Requests();

// ../../../packages/lib/src/client/inventory.ts
	const core = resourceExport(CORE.resource);

// ../../../packages/lib/src/client/vehicleProps.ts
	const MOD_TYPES = Array.from({ length: 50 }, (_, i) => i);

// ../../../packages/lib/src/client/keybind.ts
	const resource = GetCurrentResourceName();

// ../../../packages/lib/src/fivem/locale.ts
/** Convar holding the language (`setr ai:locale "en"` in misc.cfg); replicated so clients read it too. */
	const LOCALE_CONVAR = "ai:locale";
	function readLocaleFile(resource, lang) {
		const raw = LoadResourceFile(resource, `locales/${lang}.json`);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (!isRecord(parsed)) return {};
		const texts = {};
		for (const [key, value] of Object.entries(parsed)) if (typeof value === "string") texts[key] = value;
		return texts;
	}
	/**
	* The resource's lang texts: `locales/en.json` (complete base) overlaid with `locales/<ai:locale>.json`.
	* `${OTHER_KEY}` inside a text is replaced by that text once at load. Returns `t(key, ...args)` filling
	* `{0}`, `{1}`...; a missing key returns the key itself so it is visible in game.
	*
	*   const t = createLocale<typeof import("../../locales/en.json")>();
	*   t("NOTIFY_NO_MONEY", price);
	*/
	function createLocale() {
		const texts = loadLocaleTexts();
		return (key, ...args) => formatText(texts[key] ?? key, args);
	}
	/**
	* The resource's merged lang table (`en.json` overlaid with the `ai:locale` language, `${KEY}` references
	* resolved). A NUI gets this once and fills `{0}` placeholders itself.
	*/
	function loadLocaleTexts(resource = GetCurrentResourceName()) {
		const lang = GetConvar(LOCALE_CONVAR, "en");
		const texts = {
			...readLocaleFile(resource, "en"),
			...lang === "en" ? {} : readLocaleFile(resource, lang)
		};
		for (const key of Object.keys(texts)) texts[key] = (texts[key] ?? "").replace(/\$\{([A-Z0-9_]+)\}/g, (match, ref) => texts[ref] ?? match);
		return texts;
	}

// resource/common/locale.ts
/** This resource's lang texts: `Locale("NOTIFY_NO_MONEY", price)`; keys typed from locales/en.json. */
	const Locale = createLocale();

// resource/common/resource.ts
	const ResourceName = GetCurrentResourceName();
	const ResourceContext = IsDuplicityVersion() ? "server" : "client";

// resource/common/robbery.ts
/** ai-robberies' contracts and panel content. No natives. */
	const EVENTS = {
		/** Callback: (targetId) -> { ok, token, seconds } starts robbing a target (checks, item, police count). */
		start: "ai-robberies:start",
		/** Callback: (token) -> { ok } the progress ran out: reward, cooldown. */
		finish: "ai-robberies:finish",
		/** Callback: () -> { ok } leaves the house the player is inside. */
		exit: "ai-robberies:exit",
		/** Server -> player: (placeId | null) the player is inside this house now (or left). */
		inside: "ai-robberies:client:inside",
		/** Callback: () -> { ok } pays for an armored truck job at the giver. */
		truckStart: "ai-robberies:truckStart",
		/** Server -> player: (netId, x, y, z) the armored truck to rob and its rear doors. */
		truckJob: "ai-robberies:client:truckJob",
		/** Callback: () -> { ok, token, seconds } starts planting the charge at the truck's rear doors. */
		truckPlant: "ai-robberies:truckPlant",
		/** Callback: (token) -> { ok } the charge is planted (the doors blow after a fuse). */
		truckPlanted: "ai-robberies:truckPlanted",
		/** Server -> players near the truck: (netId) the rear doors are open. */
		truckOpen: "ai-robberies:client:truckOpen",
		/** Callback: () -> { ok, token, seconds } starts grabbing the cash. */
		truckLoot: "ai-robberies:truckLoot",
		/** Callback: (token) -> { ok } the cash is grabbed. */
		truckLooted: "ai-robberies:truckLooted",
		/** Server -> players who knew the truck: () the truck job is over. */
		truckEnd: "ai-robberies:client:truckEnd"
	};
	/** GlobalState key of a target that was robbed and waits for its place's cooldown (true while emptied). */
	const robbedKey = (targetId) => `rob:${targetId}`;
	const KINDS = [
		"register",
		"safe",
		"locker",
		"vitrine",
		"door",
		"entry",
		"loot"
	];
	const point = (v) => {
		const p = record(v);
		return {
			x: num(p.x, 0),
			y: num(p.y, 0),
			z: num(p.z, 0)
		};
	};
	const ZERO4 = {
		x: 0,
		y: 0,
		z: 0,
		heading: 0
	};
	/** A panel point left at (0, 0, 0) means "none". */
	const optional4 = (v) => {
		const p = vec4(v, ZERO4);
		return p.x === 0 && p.y === 0 ? null : p;
	};
	function readSettings(raw) {
		const v = record(raw);
		const jobs = Array.isArray(v.policeJobs) ? v.policeJobs.filter((j) => typeof j === "string") : [];
		const t = record(v.truck);
		const cashMin = int(t.cashMin, 2e3, 0);
		return {
			policeJobs: jobs.length > 0 ? jobs : ["police"],
			account: str(v.account, "cash", 32),
			truck: {
				giver: vec4(t.giver, ZERO4),
				price: int(t.price, 500, 0),
				minPolice: int(t.minPolice, 2, 0, 32),
				cooldown: int(t.cooldown, 45, 1, 1440),
				item: str(t.item, "c4", 48),
				cashMin,
				cashMax: Math.max(cashMin, int(t.cashMax, 5e3, 0)),
				spawns: (Array.isArray(t.spawns) ? t.spawns : []).map((row) => vec4(record(row).coords, ZERO4))
			}
		};
	}
	function readPlaces(raw) {
		const out = /* @__PURE__ */ new Map();
		for (const [id, value] of Object.entries(record(raw))) {
			const v = record(value);
			out.set(id, {
				id,
				label: str(v.label, id, 48),
				coords: point(v.coords),
				minPolice: int(v.minPolice, 0, 0, 32),
				cooldown: int(v.cooldown, 30, 1, 1440),
				alertChance: int(v.alertChance, 100, 0, 100),
				blip: bool(v.blip, false),
				interior: optional4(v.interior)
			});
		}
		return out;
	}
	function readTargets(raw) {
		const out = /* @__PURE__ */ new Map();
		for (const [id, value] of Object.entries(record(raw))) {
			const v = record(value);
			const cashMin = int(v.cashMin, 0, 0, 1e6);
			const rewardMin = int(v.rewardMin, 0, 0, 100);
			out.set(id, {
				id,
				place: str(v.place, "", 48),
				label: str(v.label, id, 48),
				kind: KINDS.includes(v.kind) ? v.kind : "register",
				coords: point(v.coords),
				item: str(v.item, "", 48),
				consume: bool(v.consume, false),
				seconds: int(v.seconds, 20, 1, 600),
				cashMin,
				cashMax: Math.max(cashMin, int(v.cashMax, 0, 0, 1e6)),
				reward: str(v.reward, "", 48),
				rewardMin,
				rewardMax: Math.max(rewardMin, int(v.rewardMax, 0, 0, 100)),
				door: str(v.door, "", 64),
				vaultModel: str(v.vaultModel, "", 64),
				vaultClosed: num(v.vaultClosed, 0, -720, 720),
				vaultOpen: num(v.vaultOpen, 0, -720, 720)
			});
		}
		return out;
	}
	/** The animation each kind plays during its progress. */
	const ANIMS = {
		register: {
			dict: "oddjobs@shop_robbery@rob_till",
			clip: "loop"
		},
		safe: {
			dict: "mini@safe_cracking",
			clip: "dial_turn_anti_fast_1"
		},
		locker: {
			dict: "anim@heists@fleeca_bank@drilling",
			clip: "drill_straight_idle"
		},
		vitrine: {
			dict: "missheist_jewel",
			clip: "smash_case"
		},
		door: {
			dict: "anim@heists@ornate_bank@hack",
			clip: "hack_loop"
		},
		entry: {
			dict: "veh@break_in@0h@p_m_one@",
			clip: "low_force_entry_ds"
		},
		loot: {
			dict: "anim@gangops@facility@servers@bodysearch@",
			clip: "player_search"
		}
	};

// resource/client/content.ts
/** The panel files every client module reads, parsed again after each change. */
	const world = new AdminWorld([
		"settings",
		"places",
		"targets"
	]);
	const content = {
		settings: readSettings(world.get("settings")),
		places: readPlaces(world.get("places")),
		targets: readTargets(world.get("targets"))
	};
	world.onChange("settings", () => content.settings = readSettings(world.get("settings")));
	const texts = loadLocaleTexts();
	/** The translated error of a callback answer. */
	const errorText = (v, fallback) => {
		const key = typeof record(v).error === "string" ? String(record(v).error) : fallback;
		return texts[key] ?? key;
	};

// resource/client/truck.ts
/**
	* The armored truck job on this client: the giver's point, a route blip to the truck the server spawned, and a
	* point at its rear doors (plant the charge, then grab the cash). The server checks every step.
	*/
	var TruckJob = class {
		points = new Points();
		blip = 0;
		netId = 0;
		open = false;
		rebuildGiver() {
			this.points.remove("giver");
			const { giver, price } = content.settings.truck;
			if (giver.x === 0 && giver.y === 0) return;
			this.points.add("giver", {
				coords: giver,
				label: Locale("ROB_PROMPT_TRUCK", price),
				icon: "truck",
				radius: 1.5,
				onPressed: () => this.start()
			});
		}
		job(netId, rear) {
			this.netId = netId;
			if (this.blip) RemoveBlip(this.blip);
			this.blip = createBlip({
				coords: rear,
				label: Locale("ROB_BLIP_TRUCK"),
				sprite: 67,
				color: 1,
				scale: 1,
				shortRange: false
			});
			SetBlipRoute(this.blip, true);
			const at = {
				coords: rear,
				radius: 2,
				interval: 300,
				onPressed: () => this.rear()
			};
			this.points.add("plant", {
				...at,
				label: Locale("ROB_PROMPT_TRUCK_PLANT"),
				icon: "bomb",
				canShow: () => !this.open
			});
			this.points.add("loot", {
				...at,
				label: Locale("ROB_PROMPT_TRUCK_LOOT"),
				icon: "sack-dollar",
				canShow: () => this.open
			});
		}
		opened(netId) {
			if (netId !== this.netId) return;
			this.open = true;
			this.points.refresh();
		}
		end() {
			if (this.blip) RemoveBlip(this.blip);
			this.blip = 0;
			this.netId = 0;
			this.open = false;
			this.points.remove("plant");
			this.points.remove("loot");
		}
		async start() {
			const result = record(await triggerServerCallback(EVENTS.truckStart, [], 15e3).catch(() => null));
			if (result.ok !== true) return notify(errorText(result, "ROB_ERR_FAR"), "error");
			notify(Locale("ROB_TRUCK_STARTED"), "info", 8e3);
		}
		/** Plant or loot, whichever the doors allow now: two-step timed action. */
		async rear() {
			const loot = this.open;
			const started = record(await triggerServerCallback(loot ? EVENTS.truckLoot : EVENTS.truckPlant, []).catch(() => null));
			if (started.ok !== true || typeof started.token !== "number" || typeof started.seconds !== "number") return notify(errorText(started, "ROB_ERR_FAR"), "error");
			const anim = loot ? {
				dict: "anim@heists@ornate_bank@grab_cash",
				clip: "grab"
			} : {
				dict: "anim@heists@ornate_bank@thermal_charge",
				clip: "thermal_charge"
			};
			if (!await progress({
				label: Locale(loot ? "ROB_TRUCK_LOOTING" : "ROB_TRUCK_PLANTING"),
				duration: started.seconds * 1e3,
				anim
			})) return;
			const result = record(await triggerServerCallback(loot ? EVENTS.truckLooted : EVENTS.truckPlanted, [started.token]).catch(() => null));
			if (result.ok !== true) notify(errorText(result, "ROB_ERR_FAR"), "error");
		}
	};
	const truck = new TruckJob();
	truck.rebuildGiver();
	world.onChange("settings", () => truck.rebuildGiver());
	onServerEvent(EVENTS.truckJob, { args: ([netId, x, y, z]) => typeof netId === "number" && typeof x === "number" && typeof y === "number" && typeof z === "number" ? [
		netId,
		x,
		y,
		z
	] : null }, (netId, x, y, z) => truck.job(netId, {
		x,
		y,
		z
	}));
	onServerEvent(EVENTS.truckOpen, { args: ([netId]) => typeof netId === "number" ? [netId] : null }, (netId) => truck.opened(netId));
	onServerEvent(EVENTS.truckEnd, () => truck.end());

// resource/client/vaults.ts
/**
	* Bank vault doors are map objects every client holds itself: near one, the client turns it to the open or closed
	* heading from its target's GlobalState key, and again whenever that key changes.
	*/
	var Vaults = class {
		zones = new Zones();
		near = /* @__PURE__ */ new Map();
		rebuild(targets) {
			this.zones.clear();
			this.near.clear();
			for (const target of targets) {
				if (target.kind !== "door" || target.door || !target.vaultModel) continue;
				this.zones.add(target.id, {
					shape: {
						type: "sphere",
						center: target.coords,
						radius: 40
					},
					interval: 1e3,
					onEnter: () => {
						this.near.set(target.id, target);
						this.apply(target, GlobalState[robbedKey(target.id)] === true);
					},
					onExit: () => this.near.delete(target.id)
				});
			}
		}
		/** A changed `rob:<id>` key of a vault the player is near. */
		changed(key, open) {
			if (!key.startsWith("rob:")) return;
			const target = this.near.get(key.slice(4));
			if (target) this.apply(target, open);
		}
		apply(target, open) {
			const { x, y, z } = target.coords;
			const door = GetClosestObjectOfType(x, y, z, 6, GetHashKey(target.vaultModel), false, false, false);
			if (!door) return;
			SetEntityHeading(door, open ? target.vaultOpen : target.vaultClosed);
			FreezeEntityPosition(door, true);
		}
	};

// resource/client/index.ts
/**
	* A point at every target ("Rob" or "Emptied" from its GlobalState key) and the places' blips. Targets inside a
	* house only exist while the player is inside it, together with its exit point.
	*/
	var Spots = class {
		points = new Points();
		blips = new Blips();
		insideId = null;
		rebuild() {
			this.points.clear();
			this.blips.clear();
			for (const target of content.targets.values()) {
				const id = target.id;
				if ((content.places.get(target.place)?.interior != null && target.kind !== "entry") !== (this.insideId === target.place)) continue;
				const robbed = () => GlobalState[robbedKey(id)] === true;
				const at = {
					coords: target.coords,
					radius: 1.2,
					interval: 300,
					onPressed: () => this.rob(id)
				};
				this.points.add(id, {
					...at,
					label: Locale("ROB_PROMPT", target.label),
					icon: "mask",
					canShow: () => !robbed()
				});
				this.points.add(`${id}:empty`, {
					...at,
					label: Locale("ROB_PROMPT_EMPTY", target.label),
					icon: "box-open",
					canShow: robbed
				});
			}
			const inside = this.insideId ? content.places.get(this.insideId)?.interior : null;
			if (inside) this.points.add("exit", {
				coords: inside,
				label: Locale("ROB_PROMPT_EXIT"),
				icon: "door-open",
				radius: 1.5,
				interval: 300,
				onPressed: () => this.exit()
			});
			for (const place of content.places.values()) if (place.blip) this.blips.add(place.id, {
				coords: place.coords,
				label: place.label,
				sprite: 500,
				color: 0,
				scale: .7
			});
		}
		async rob(id) {
			const target = content.targets.get(id);
			if (!target) return;
			const started = record(await triggerServerCallback(EVENTS.start, [id]).catch(() => null));
			if (started.entered === true) return;
			if (started.ok !== true || typeof started.token !== "number" || typeof started.seconds !== "number") return notify(errorText(started, "ROB_ERR_FAR"), "error");
			if (!await progress({
				label: Locale("ROB_WORKING"),
				duration: started.seconds * 1e3,
				anim: ANIMS[target.kind]
			})) return;
			const result = record(await triggerServerCallback(EVENTS.finish, [started.token]).catch(() => null));
			if (result.ok !== true) notify(errorText(result, "ROB_ERR_FAR"), "error");
		}
		async exit() {
			await fadeOut();
			const result = record(await triggerServerCallback(EVENTS.exit, []).catch(() => null));
			if (result.ok !== true) notify(errorText(result, "ROB_ERR_FAR"), "error");
			await sleep(400);
			DoScreenFadeIn(300);
		}
	};
	const spots = new Spots();
	const vaults = new Vaults();
	spots.rebuild();
	vaults.rebuild(content.targets.values());
	AddStateBagChangeHandler("", "global", (_bag, key, value) => {
		if (!key.startsWith("rob:")) return;
		vaults.changed(key, value === true);
		setTimeout(() => spots.points.refresh(), 0);
	});
	world.onChange("places", () => {
		content.places = readPlaces(world.get("places"));
		spots.rebuild();
	});
	world.onChange("targets", () => {
		content.targets = readTargets(world.get("targets"));
		spots.rebuild();
		vaults.rebuild(content.targets.values());
	});
	onServerEvent(EVENTS.inside, { args: ([id]) => id == null ? [null] : typeof id === "string" ? [id] : null }, (id) => {
		spots.insideId = id;
		spots.rebuild();
	});

})();
}catch(e){globalThis.__aicoreReportError&&globalThis.__aicoreReportError("load: "+(e&&e.stack||e));throw e}
