exports = globalThis.exports;
let node_fs_promises = require("node:fs/promises");
// ../../../packages/lib/src/server/rateLimit.ts
var SourceLock = class {
	active = new Set();
	async run(source, busy, task) {
		if (this.active.has(source)) return busy;
		this.active.add(source);
		try {
			return await task();
		} finally {
			this.active.delete(source);
		}
	}
	release(source) {
		this.active.delete(source);
	}
}, RateLimit = class {
	count;
	windowMs;
	hits = new Map();
	constructor(count, windowMs) {
		this.count = count, this.windowMs = windowMs;
	}
	take(source) {
		let now = GetGameTimer(), recent = (this.hits.get(source) ?? []).filter((at) => now - at < this.windowMs);
		return recent.length >= this.count ? (this.hits.set(source, recent), !1) : (recent.push(now), this.hits.set(source, recent), !0);
	}
	release(source) {
		this.hits.delete(source);
	}
};
// ../../../packages/lib/src/shared/wait.ts
function waitFor(check, timeoutMs = 1e4, intervalMs = 0) {
	return new Promise((resolve, reject) => {
		let started = Date.now(), poll = () => {
			let value = check();
			if (value !== void 0) return resolve(value);
			if (timeoutMs !== !1 && Date.now() - started > timeoutMs) return reject(Error(`waitFor timed out after ${timeoutMs} ms`));
			setTimeout(poll, intervalMs);
		};
		poll();
	});
}
// ../../../packages/lib/src/shared/read.ts
function num(value, fallback, min = -Infinity, max = Infinity) {
	return typeof value == "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function int(value, fallback, min = -Infinity, max = Infinity) {
	return Math.round(num(value, fallback, min, max));
}
function bool(value, fallback) {
	return typeof value == "boolean" ? value : fallback;
}
function str(value, fallback, max = 64) {
	return typeof value == "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function record(value) {
	return typeof value == "object" && value && !Array.isArray(value) ? value : {};
}
function vec4(value, fallback) {
	let v = record(value);
	return {
		x: num(v.x, fallback.x),
		y: num(v.y, fallback.y),
		z: num(v.z, fallback.z),
		heading: num(v.heading, fallback.heading)
	};
}
// ../../../packages/lib/src/shared/strict.ts
function readText(value, max) {
	if (typeof value != "string") return null;
	let text = value.trim();
	return text ? text.slice(0, max) : null;
}
const oneArg = (read) => ([value]) => {
	let parsed = read(value);
	return parsed === null ? null : [parsed];
}, fail = (error) => ({
	ok: !1,
	error
}), randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1)), pickRandom = (list) => list[Math.floor(Math.random() * list.length)], rollChance = (percent) => Math.random() * 100 < percent, isPublic = (rule) => rule.jobs.length === 0 && rule.gangs.length === 0, BLIP_STYLE_FIELDS = {
	sprite: {
		type: "number",
		min: 0,
		max: 1e3,
		integer: !0
	},
	color: {
		type: "number",
		min: 0,
		max: 100,
		integer: !0
	},
	scale: {
		type: "number",
		min: .3,
		max: 2
	}
};
function readBlipStyle(value, fallback) {
	let v = record(value);
	return {
		sprite: int(v.sprite, fallback.sprite, 0, 1e3),
		color: int(v.color, fallback.color, 0, 100),
		scale: num(v.scale, fallback.scale, .3, 2)
	};
}
// ../../../packages/lib/src/shared/records.ts
const isObject = (value) => typeof value == "object" && !!value && !Array.isArray(value);
function readRecords(raw, readOne) {
	let out = new Map();
	if (!isObject(raw)) return out;
	for (let key in raw) {
		let value = raw[key];
		if (!isObject(value)) continue;
		let parsed = readOne(key, value);
		parsed !== null && out.set(key, parsed);
	}
	return out;
}
var FileViews = class {
	read;
	updaters = new Map();
	constructor(read) {
		this.read = read;
	}
	view(file, parse) {
		let box = { value: parse(this.read(file)) };
		return this.on(file, () => box.value = parse(this.read(file))), box;
	}
	records(file, readOne) {
		let live = new LiveRecords(readOne);
		return live.reset(this.read(file)), this.on(file, (key, value) => live.update(key, value, this.read(file))), live.map;
	}
	changed(file, key, value) {
		for (let update of this.updaters.get(file) ?? []) update(key, value);
	}
	on(file, update) {
		let list = this.updaters.get(file);
		list ? list.push(update) : this.updaters.set(file, [update]);
	}
}, LiveRecords = class {
	readOne;
	map = new Map();
	constructor(readOne) {
		this.readOne = readOne;
	}
	reset(raw) {
		this.map.clear();
		for (let [key, value] of readRecords(raw, this.readOne)) this.map.set(key, value);
	}
	update(key, value, whole) {
		if (key === void 0) return this.reset(whole);
		let parsed = isObject(value) ? this.readOne(key, value) : null;
		parsed === null ? this.map.delete(key) : this.map.set(key, parsed);
	}
};
// ../../../packages/lib/src/shared/lang.ts
function formatText(template, args) {
	return template.replace(/\{(\d+)\}/g, (match, index) => {
		let value = args[Number(index)];
		return value === void 0 ? match : String(value);
	});
}
// ../../../packages/lib/src/shared/index.ts
function isRecord(value) {
	return typeof value == "object" && !!value && !Array.isArray(value);
}
function logSafe(text, max) {
	return text.replace(/\r?\n/g, " | ").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\^\d/g, "").slice(0, max);
}
function previewJson(value, max) {
	let out = "", walk = (v, depth) => {
		if (out.length >= max) return;
		if (typeof v == "string") {
			out += JSON.stringify(v.length > max ? v.slice(0, max) : v);
			return;
		}
		if (typeof v != "object" || !v) {
			out += String(v);
			return;
		}
		if (depth > 4) {
			out += Array.isArray(v) ? "[...]" : "{...}";
			return;
		}
		if (Array.isArray(v)) {
			out += "[";
			for (let i = 0; i < v.length && out.length < max; i++) i > 0 && (out += ","), walk(v[i], depth + 1);
			out += "]";
			return;
		}
		out += "{";
		let first = !0;
		for (let key in v) {
			if (out.length >= max) break;
			first || (out += ","), first = !1, out += `${JSON.stringify(key.slice(0, 50))}:`, walk(v[key], depth + 1);
		}
		out += "}";
	};
	return walk(value, 0), out.slice(0, max);
}
function createLogger(resource) {
	let prefix = `[${resource}]`;
	return {
		info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
		warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
		error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
	};
}
function withoutSchemaKey(value) {
	if (!isRecord(value) || !("$schema" in value)) return value;
	let { $schema: _schema, ...rest } = value;
	return rest;
}
var DataFile = class {
	resource;
	name;
	log;
	writes = Promise.resolve();
	pending = void 0;
	timer = null;
	schemaRef = null;
	constructor(resource, name, log) {
		this.resource = resource, this.name = name, this.log = log;
	}
	hasSchemaRef() {
		return (LoadResourceFile(this.resource, this.path) ?? "").includes("\"$schema\"");
	}
	read() {
		for (let path of [this.path, `${this.path}.bak`]) {
			let raw = LoadResourceFile(this.resource, path);
			if (raw) try {
				return withoutSchemaKey(JSON.parse(raw));
			} catch (error) {
				this.log.error(`${this.resource}/${path} is not valid JSON${path === this.path ? ", trying the backup" : ""}`, error);
			}
		}
		return null;
	}
	write(value) {
		this.pending = value, this.timer ||= setTimeout(() => {
			this.timer = null;
			let data = this.schemaRef && isRecord(this.pending) ? {
				$schema: this.schemaRef,
				...this.pending
			} : this.pending, text = `${JSON.stringify(data, null, 2)}\n`;
			this.writes = this.writes.then(() => this.flush(text)).catch((error) => this.log.error(`saving ${this.resource}/${this.path} failed`, error));
		}, 250);
	}
	get path() {
		return `data/${this.name}.json`;
	}
	async flush(text) {
		let file = `${GetResourcePath(this.resource)}/${this.path}`;
		await (0, node_fs_promises.mkdir)(file.slice(0, file.lastIndexOf("/")), { recursive: !0 }), await (0, node_fs_promises.writeFile)(`${file}.tmp`, text, "utf8"), await (0, node_fs_promises.copyFile)(file, `${file}.bak`).catch(() => void 0), await (0, node_fs_promises.rename)(`${file}.tmp`, file);
	}
};
// ../../../packages/shared/src/core.ts
const CORE = {
	resource: "ai-core",
	clientErrorEvent: "ai-core:clientError",
	playerLoadedEvent: "ai-core:playerLoaded",
	playerUnloadedEvent: "ai-core:playerUnloaded",
	moneyChangedEvent: "ai-core:moneyChanged",
	jobsChangedEvent: "ai-core:jobsChanged",
	dutyChangedEvent: "ai-core:dutyChanged",
	gangsChangedEvent: "ai-core:gangsChanged",
	activeGangChangedEvent: "ai-core:activeGangChanged",
	metaChangedEvent: "ai-core:metaChanged",
	definitionsChangedEvent: "ai-core:definitionsChanged",
	characterScreenEvent: "ai-core:characterScreen",
	inventoryChangedEvent: "ai-core:inventoryChanged",
	itemUsedEvent: "ai-core:itemUsed",
	playerDiedEvent: "ai-core:playerDied",
	clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
	clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
	clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
	characterLooksEvent: "ai-core:client:characterLooks",
	clientCacheEvent: "ai-core:client:cache",
	clientHudVisibleEvent: "ai-core:client:hudVisible",
	clientWorldSyncEvent: "ai-core:client:worldSync",
	clientDefinitionsEvent: "ai-core:client:definitions",
	vehicleTypeCallback: "ai-core:vehicleType",
	interactionStateKey: "ai:interaction",
	pvpStateKey: "ai:pvp",
	medicalStateKey: "ai:medical",
	clientDeadEvent: "ai-core:client:dead",
	mdtStateKey: "ai:mdt",
	billsEvent: "ai-core:client:bills",
	payBillCallback: "ai-core:payBill",
	clientSeatbeltEvent: "ai-core:client:seatbelt",
	stressRelayEvent: "ai-core:client:stress",
	notifyStateKey: "ai:notify",
	charactersCallback: "ai-core:characters",
	createCharacterCallback: "ai-core:createCharacter",
	deleteCharacterCallback: "ai-core:deleteCharacter",
	selectCharacterCallback: "ai-core:selectCharacter",
	spawnEvent: "ai-core:client:spawn",
	chooseSpawnEvent: "ai-core:client:chooseSpawn",
	spawnChoiceCallback: "ai-core:spawnChoice",
	openCharactersEvent: "ai-core:client:openCharacters"
}, ADMIN = {
	ace: "ai.admin",
	openCallback: "ai-core:admin:open",
	panelDataCallback: "ai-core:admin:panelData",
	applyCallback: "ai-core:admin:apply",
	closeEvent: "ai-core:admin:close",
	showEvent: "ai-core:admin:show",
	deltaEvent: "ai-core:admin:delta",
	recommendationEvent: "ai-core:admin:recommendation",
	worldEvent: (resource) => `${resource}:admin:world`,
	worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
}, VEHICLE_BAGS = {
	owned: "ai:owned",
	id: "ai:vid",
	props: "ai:props",
	setup: "ai:setup",
	fuel: "fuel"
}, SKILL_STAGES = {
	easy: {
		area: 50,
		speed: .6
	},
	medium: {
		area: 40,
		speed: .85
	},
	hard: {
		area: 25,
		speed: 1
	}
}, LOCKPICK_AREAS = {
	easy: 18,
	medium: 11,
	hard: 6
}, LIB_UI = {
	resource: "ai-lib",
	notifyEvent: "ai-lib:client:notify",
	promptPressedEvent: "ai-lib:client:promptPressed",
	cancelProgressEvent: "ai-lib:client:cancelProgress",
	progressForCallback: "ai-lib:progressFor",
	progressForCancelEvent: "ai-lib:client:progressForCancel",
	minigameForCallback: "ai-lib:minigameFor",
	zoneEvent: "ai-lib:client:zone",
	modelPointEvent: "ai-lib:client:modelPoint"
}, named = new Set();
function registerExport(name, handler) {
	named.add(name), globalThis.exports(name, handler);
	let first = name.charAt(0), twin = (first === first.toUpperCase() ? first.toLowerCase() : first.toUpperCase()) + name.slice(1);
	twin !== name && !named.has(twin) && globalThis.exports(twin, handler);
}
function resourceExport(resource) {
	return globalThis.exports[resource];
}
function isResourceStarted(resource) {
	return GetResourceState(resource) === "started";
}
function optionalExport(resource) {
	return isResourceStarted(resource) ? globalThis.exports[resource] : null;
}
function readLocaleFile(resource, lang) {
	let raw = LoadResourceFile(resource, `locales/${lang}.json`);
	if (!raw) return {};
	let parsed = JSON.parse(raw);
	if (!isRecord(parsed)) return {};
	let texts = {};
	for (let [key, value] of Object.entries(parsed)) typeof value == "string" && (texts[key] = value);
	return texts;
}
function createLocale() {
	let texts = loadLocaleTexts();
	return (key, ...args) => formatText(texts[key] ?? key, args);
}
function loadLocaleTexts(resource = GetCurrentResourceName()) {
	let lang = GetConvar("ai:locale", "en"), texts = {
		...readLocaleFile(resource, "en"),
		...lang === "en" ? {} : readLocaleFile(resource, lang)
	};
	for (let key of Object.keys(texts)) texts[key] = (texts[key] ?? "").replace(/\$\{([A-Z0-9_]+)\}/g, (match, ref) => texts[ref] ?? match);
	return texts;
}
// ../../../packages/lib/src/fivem/callbackNames.ts
const requestEvent = (name) => `aicore:cb:${name}`, responseEvent = (resource) => `aicore:cbr:${resource}`;
// ../../../packages/lib/src/server/position.ts
function entityCoords(entity) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(entity);
	return {
		x,
		y,
		z
	};
}
const coordsOf = (source) => entityCoords(GetPlayerPed(String(source)));
function isNear(source, point, metres) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source))), dx = x - point.x, dy = y - point.y, dz = z - point.z;
	return dx * dx + dy * dy + dz * dz <= metres * metres;
}
resourceExport(CORE.resource);
const log$6 = createLogger(GetCurrentResourceName()), gates = new Set();
on("playerDropped", () => {
	let source = Number(globalThis.source);
	for (let gate of gates) gate.release(source);
});
var ClientGate = class {
	name;
	options;
	limit;
	lock;
	refusals = new Map();
	constructor(name, options, defaultRate) {
		this.name = name, this.options = options, this.limit = new RateLimit(options.rate?.count ?? defaultRate, options.rate?.windowMs ?? 1e3), this.lock = options.lock ? new SourceLock() : null, gates.add(this);
	}
	check(source, raw) {
		if (!(source > 0) || !GetPlayerName(String(source))) return null;
		if (!this.limit.take(source)) return this.refuse(source, "rate limit"), null;
		for (let guard of this.options.guards ?? []) {
			let verdict = guard(source);
			if (verdict !== !0) return typeof verdict == "string" && this.refuse(source, verdict), null;
		}
		if (!this.options.args) return [];
		let args = this.options.args(raw);
		return args === null && this.refuse(source, () => `invalid arguments ${logSafe(previewJson(raw, 200), 200)}`), args;
	}
	run(source, busy, task) {
		return this.lock ? this.lock.run(source, busy, async () => task()) : Promise.resolve(task());
	}
	release(source) {
		this.limit.release(source), this.lock?.release(source), this.refusals.delete(source);
	}
	refuse(source, reason) {
		let now = GetGameTimer(), last = this.refusals.get(source);
		if (last && now - last.at < 1e4) {
			last.skipped++;
			return;
		}
		let more = last?.skipped ? ` (+${last.skipped} more refused)` : "";
		this.refusals.set(source, {
			at: now,
			skipped: 0
		}), log$6.warn(`${this.name} refused for ${GetPlayerName(String(source))} (${source}): ${typeof reason == "string" ? reason : reason()}${more}`);
	}
};
// ../../../packages/lib/src/server/callback.ts
const log$5 = createLogger(GetCurrentResourceName()), resource$1 = GetCurrentResourceName(), REFUSED = Symbol("refused");
function onClientCallback(name, first, second) {
	let [handler, options] = typeof first == "function" ? [first, second ?? {}] : [second, first], gate = new ClientGate(name, options, 20);
	onNet(requestEvent(name), async (caller, id, ...raw) => {
		let source = Number(globalThis.source);
		if (typeof caller != "string" || caller.length > 64 || typeof id != "number") return;
		let args = gate.check(source, raw);
		if (!args) return emitNet(responseEvent(caller), source, id, !1, null);
		try {
			let result = await gate.run(source, REFUSED, () => handler(source, ...args));
			result === REFUSED ? emitNet(responseEvent(caller), source, id, !1, null) : emitNet(responseEvent(caller), source, id, !0, result ?? null);
		} catch (error) {
			log$5.error(`callback ${name} failed for ${source}`, error), emitNet(responseEvent(caller), source, id, !1, null);
		}
	});
}
const pending = new Map();
let nextId = 0;
onNet(responseEvent(resource$1), (id, ok, result) => {
	let entry = typeof id == "number" ? pending.get(id) : void 0;
	entry && entry.source === Number(globalThis.source) && (pending.delete(id), clearTimeout(entry.timer), ok === !0 ? entry.resolve(result) : entry.reject(Error("client callback failed")));
});
function triggerClientCallback(name, source, args = [], timeoutMs = 3e4) {
	let id = ++nextId;
	return new Promise((resolve, reject) => {
		let timer = setTimeout(() => {
			pending.delete(id), reject(Error(`client callback ${name} timed out for ${source}`));
		}, timeoutMs);
		pending.set(id, {
			source,
			resolve,
			reject,
			timer
		}), emitNet(requestEvent(name), source, resource$1, id, ...args);
	});
}
// ../../../packages/lib/src/server/admin/patch.ts
function toPatch(value) {
	if (!isRecord(value) || typeof value.file != "string") return null;
	let key = typeof value.key == "string" ? value.key : void 0;
	switch (value.action) {
		case "set": return typeof value.section == "string" ? {
			file: value.file,
			action: "set",
			key,
			section: value.section,
			value: value.value
		} : null;
		case "create": return key && typeof value.label == "string" ? {
			file: value.file,
			action: "create",
			key,
			label: value.label
		} : null;
		case "delete": return key ? {
			file: value.file,
			action: "delete",
			key
		} : null;
		case "run": return typeof value.id == "string" && value.id.length <= 64 ? {
			file: value.file,
			action: "run",
			key,
			id: value.id
		} : null;
		case "import": {
			if (!isRecord(value.records)) return null;
			let records = {};
			for (let [k, v] of Object.entries(value.records)) isRecord(v) && (records[k] = v);
			return Object.keys(records).length > 0 && Object.keys(records).length <= 500 ? {
				file: value.file,
				action: "import",
				records
			} : null;
		}
		default: return null;
	}
}
const clone = (value) => value === void 0 ? value : JSON.parse(JSON.stringify(value)), core$25 = resourceExport(CORE.resource), ERR = {
	type: "ADMIN_ERR_TYPE",
	range: "ADMIN_ERR_RANGE",
	length: "ADMIN_ERR_LENGTH",
	pattern: "ADMIN_ERR_PATTERN",
	required: "ADMIN_ERR_REQUIRED",
	lookup: "ADMIN_ERR_LOOKUP"
}, lookups = new class {
	lists = new Map();
	values(source) {
		let cached = this.lists.get(source);
		if (cached && Date.now() - cached.at < 2e3) return cached.values.size > 0 ? cached.values : null;
		let list = [];
		try {
			list = core$25.GetLookupValues(source);
		} catch {}
		let values = new Set(Array.isArray(list) ? list.filter((v) => typeof v == "string") : []);
		return this.lists.set(source, {
			at: Date.now(),
			values
		}), values.size > 0 ? values : null;
	}
}(), isVec = (value, keys) => isRecord(value) && keys.every((k) => typeof value[k] == "number" && Number.isFinite(value[k]));
function validate(spec, value, path) {
	if (value == null) return spec.optional ? null : {
		error: ERR.required,
		path
	};
	let fail = (error) => ({
		error,
		path
	});
	switch (spec.type) {
		case "text": return typeof value == "string" ? value.length < (spec.min ?? 1) || value.length > (spec.max ?? 120) ? fail(ERR.length) : spec.pattern && !new RegExp(spec.pattern).test(value) ? fail(ERR.pattern) : spec.lookup && value !== "" && lookups.values(spec.lookup)?.has(value) === !1 ? fail(ERR.lookup) : null : fail(ERR.type);
		case "number": return typeof value != "number" || !Number.isFinite(value) || spec.integer && !Number.isInteger(value) ? fail(ERR.type) : spec.min !== void 0 && value < spec.min || spec.max !== void 0 && value > spec.max ? fail(ERR.range) : null;
		case "bool": return typeof value == "boolean" ? null : fail(ERR.type);
		case "enum": return spec.values.includes(value) ? null : fail(ERR.type);
		case "names": {
			if (!Array.isArray(value) || value.length > (spec.max ?? 50)) return fail(ERR.length);
			let pattern = new RegExp(spec.pattern ?? "^[\\w.:-]+$"), seen = new Set();
			for (let name of value) {
				if (typeof name != "string" || name.length > (spec.itemMax ?? 64) || seen.has(name)) return fail(ERR.type);
				if (!pattern.test(name)) return fail(ERR.pattern);
				if (spec.lookup && lookups.values(spec.lookup)?.has(name) === !1) return fail(ERR.lookup);
				seen.add(name);
			}
			return null;
		}
		case "vec3": return isVec(value, [
			"x",
			"y",
			"z"
		]) ? null : fail(ERR.type);
		case "vec4": return isVec(value, [
			"x",
			"y",
			"z",
			"heading"
		]) ? null : fail(ERR.type);
		case "object":
			if (!isRecord(value)) return fail(ERR.type);
			for (let key of Object.keys(value)) if (!(key in spec.fields)) return {
				error: ERR.type,
				path: `${path}.${key}`
			};
			for (let [key, field] of Object.entries(spec.fields)) {
				let refusal = validate(field, value[key], `${path}.${key}`);
				if (refusal) return refusal;
			}
			return null;
		case "list":
			if (!Array.isArray(value)) return fail(ERR.type);
			if (value.length < (spec.min ?? 0) || value.length > (spec.max ?? 100)) return fail(ERR.length);
			for (let i = 0; i < value.length; i++) {
				let refusal = validate(spec.of, value[i], `${path}.${i + 1}`);
				if (refusal) return refusal;
			}
			return null;
		default: return spec;
	}
}
// ../../../packages/lib/src/server/admin/edit.ts
const DEFAULT_KEY = "^[a-z0-9_]{2,32}$";
function imported(spec, value) {
	let base = clone(spec.newRecord ?? {}), out = {};
	for (let name of Object.keys(spec.sections)) {
		let v = name in value ? value[name] : base[name];
		v !== void 0 && (out[name] = clone(v));
	}
	return out;
}
function linked(spec, value, ctx) {
	return spec.type === "text" && spec.records && typeof value == "string" && value !== "" && !(value in ctx.get(spec.records)) ? "ADMIN_ERR_LOOKUP" : null;
}
function checkEdit(patch, spec, ctx) {
	let data = ctx.get(patch.file);
	if (patch.action === "create") return spec.kind !== "records" || !new RegExp(spec.keyPattern ?? DEFAULT_KEY).test(patch.key) ? ERR.pattern : patch.key in data ? "ADMIN_ERR_EXISTS" : null;
	if (patch.action === "delete") return spec.kind !== "records" || !(patch.key in data) ? ERR.type : spec.locked?.includes(patch.key) ? "ADMIN_ERR_LOCKED" : null;
	if (patch.action === "import") {
		if (spec.kind !== "records") return ERR.type;
		let pattern = new RegExp(spec.keyPattern ?? DEFAULT_KEY);
		for (let [key, value] of Object.entries(patch.records)) {
			if (!pattern.test(key)) return ERR.pattern;
			let record = imported(spec, value);
			for (let [name, section] of Object.entries(spec.sections)) {
				let refusal = validate(section, record[name], name);
				if (refusal) return refusal.error;
				let link = linked(section, record[name], ctx);
				if (link) return link;
			}
			let ruled = ctx.rule(patch.file)?.(key, record);
			if (ruled) return ruled;
		}
		return null;
	}
	let section = spec.sections[patch.section];
	if (!section || spec.kind === "records" && (!patch.key || !(patch.key in data))) return ERR.type;
	let refusal = validate(section, patch.value, patch.section);
	if (refusal) return refusal.error;
	let link = linked(section, patch.value, ctx);
	if (link) return link;
	let current = spec.kind === "records" ? data[patch.key ?? ""] : data, next = {
		...isRecord(current) ? current : {},
		[patch.section]: patch.value
	};
	return ctx.rule(patch.file)?.(patch.key, next) ?? null;
}
function applyEdit(data, patch, spec) {
	if (patch.action === "import") {
		for (let [key, value] of Object.entries(patch.records)) data[key] = imported(spec, value);
		return Object.keys(patch.records);
	}
	if (patch.action === "create") {
		let record = clone(spec.newRecord ?? {});
		spec.labelPath && (record[spec.labelPath] = patch.label), data[patch.key] = record;
	} else if (patch.action === "delete") delete data[patch.key];
	else {
		let target = spec.kind === "records" ? data[patch.key ?? ""] : data;
		if (!isRecord(target)) return [];
		patch.value === void 0 || patch.value === null ? delete target[patch.section] : target[patch.section] = clone(patch.value);
	}
	return [spec.kind === "records" ? patch.key : void 0];
}
// ../../../packages/lib/src/server/admin/jsonSchema.ts
const SCHEMA_KEY = {
	type: "string",
	description: "This file's JSON Schema (for editors)."
};
function langFile(resource) {
	try {
		let raw = JSON.parse(LoadResourceFile(resource, "locales/en.json") ?? "{}");
		return isRecord(raw) ? Object.fromEntries(Object.entries(raw).filter((e) => typeof e[1] == "string")) : {};
	} catch {
		return {};
	}
}
function texts(resource) {
	return {
		...langFile("ai-core"),
		...langFile(resource)
	};
}
function collect(fields, prefix, lang, out) {
	for (let field of fields) {
		if (field.widget === "action") continue;
		let path = prefix + field.path, label = lang[field.label] ?? field.label, hint = field.hint ? lang[field.hint] ?? field.hint : "";
		out.has(path) || out.set(path, hint ? `${label}: ${hint}` : label), field.widget === "list" && collect(field.rows, `${path}[].`, lang, out);
	}
}
function describe(schema, file, lang) {
	let out = new Map();
	for (let tab of schema.tabs) if (tab.file === file) for (let card of tab.cards) collect(card.fields, "", lang, out);
	return out;
}
function toJson(spec, path, desc) {
	let description = desc.get(path), base = description ? { description } : {};
	switch (spec.type) {
		case "text": return {
			...base,
			type: "string",
			minLength: spec.min,
			maxLength: spec.max,
			pattern: spec.pattern
		};
		case "number": return {
			...base,
			type: spec.integer ? "integer" : "number",
			minimum: spec.min,
			maximum: spec.max
		};
		case "bool": return {
			...base,
			type: "boolean"
		};
		case "enum": return {
			...base,
			enum: spec.values
		};
		case "names": return {
			...base,
			type: "array",
			maxItems: spec.max,
			uniqueItems: !0,
			items: {
				type: "string",
				maxLength: spec.itemMax,
				pattern: spec.pattern
			}
		};
		case "vec3":
		case "vec4": {
			let keys = spec.type === "vec3" ? [
				"x",
				"y",
				"z"
			] : [
				"x",
				"y",
				"z",
				"heading"
			];
			return {
				...base,
				type: "object",
				required: keys,
				properties: Object.fromEntries(keys.map((k) => [k, { type: "number" }]))
			};
		}
		case "object": return {
			...base,
			...objectOf(spec.fields, path ? `${path}.` : "", desc)
		};
		case "list": return {
			...base,
			type: "array",
			minItems: spec.min,
			maxItems: spec.max,
			items: toJson(spec.of, `${path}[]`, desc)
		};
		default: return spec;
	}
}
function objectOf(fields, prefix, desc) {
	return {
		type: "object",
		properties: Object.fromEntries(Object.entries(fields).map(([k, s]) => [k, toJson(s, prefix + k, desc)])),
		required: Object.entries(fields).filter(([, s]) => !s.optional).map(([k]) => k)
	};
}
function fileSchema(resource, schema, name, spec) {
	let desc = describe(schema, name, texts(resource)), title = `${resource}/data/${name}.json`, body = spec.kind === "settings" ? (() => {
		let obj = objectOf(spec.sections, "", desc), required = obj.required.filter((k) => !(k in (spec.defaults ?? {})));
		return {
			...obj,
			properties: {
				$schema: SCHEMA_KEY,
				...obj.properties
			},
			required
		};
	})() : {
		type: "object",
		properties: { $schema: SCHEMA_KEY },
		patternProperties: { [spec.keyPattern ?? "^[a-z0-9_]{2,32}$"]: objectOf(spec.sections, "", desc) },
		additionalProperties: !1
	};
	return `${JSON.stringify({
		$schema: "http://json-schema.org/draft-07/schema#",
		title,
		...body
	}, null, 2)}\n`;
}
function writeSchema(resource, name, text, log) {
	let path = `data/schemas/${name}.schema.json`;
	if (LoadResourceFile(resource, path) === text) return;
	let dir = `${GetResourcePath(resource)}/data/schemas`;
	(0, node_fs_promises.mkdir)(dir, { recursive: !0 }).then(() => (0, node_fs_promises.writeFile)(`${dir}/${name}.schema.json`, text, "utf8")).catch((error) => log.error(`writing ${resource}/${path} failed`, error));
}
// ../../../packages/lib/src/server/admin/panel.ts
const core$24 = resourceExport(CORE.resource);
var AdminPanel = class {
	schema;
	data = new Map();
	dataFiles = new Map();
	handlers = new Map();
	rules = new Map();
	actions = new Map();
	views = new FileViews((file) => this.get(file));
	worldChanges = new Map();
	resource = GetCurrentResourceName();
	log = createLogger(this.resource);
	editor = 0;
	constructor(schema) {
		this.schema = schema;
		for (let [name, spec] of Object.entries(schema.files)) this.load(name, spec);
		registerExport("AdminPanelSnapshot", () => this.snapshot()), registerExport("AdminPanelData", () => this.dataSnapshot()), registerExport("AdminPanelSummary", () => this.summary()), registerExport("AdminPanelApply", (admin, patch) => this.apply(admin, patch)), onClientCallback(ADMIN.worldChangesCallback(this.resource), () => Object.fromEntries(this.worldChanges), { rate: {
			count: 4,
			windowMs: 1e4
		} }), setImmediate(() => core$24.RegisterAdminPanel(this.resource));
	}
	get(file) {
		return this.data.get(file) ?? {};
	}
	onChange(file, handler) {
		this.handlers.set(file, [...this.handlers.get(file) ?? [], handler]);
	}
	rule(file, rule) {
		this.rules.set(file, rule);
	}
	onAction(id, handler) {
		this.actions.set(id, handler);
	}
	view(file, read) {
		return this.views.view(file, read);
	}
	records(file, readOne) {
		return this.views.records(file, readOne);
	}
	snapshot() {
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data: this.dataSnapshot()
		};
	}
	dataSnapshot() {
		return clone(Object.fromEntries(this.data));
	}
	summary() {
		let data = {}, index = {};
		for (let [file, spec] of Object.entries(this.schema.files)) {
			let content = this.data.get(file);
			if (spec.kind !== "records") {
				data[file] = clone(content ?? {});
				continue;
			}
			let labels = {};
			for (let [key, record] of Object.entries(content ?? {})) labels[key] = labelOf(record, spec.labelPath) ?? key;
			index[file] = labels;
		}
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data,
			loaded: !1,
			index
		};
	}
	apply(admin, raw) {
		let patch = toPatch(raw), spec = patch ? this.schema.files[patch.file] : void 0;
		if (!patch || !spec) return {
			ok: !1,
			error: ERR.type
		};
		this.editor = admin;
		try {
			if (patch.action === "run") return this.run(admin, patch, spec);
			if (spec.memory) return {
				ok: !1,
				error: ERR.type
			};
			let error = checkEdit(patch, spec, {
				get: (file) => this.get(file),
				rule: (file) => this.rules.get(file)
			});
			return error ? (this.log.warn(`admin ${admin} edit refused (${error}): ${previewJson(patch, 300)}`), {
				ok: !1,
				error
			}) : (this.store(patch, spec), { ok: !0 });
		} finally {
			this.editor = 0;
		}
	}
	run(admin, patch, spec) {
		let handler = this.actions.get(patch.id), data = this.get(patch.file), target = spec.kind === "records" ? data[patch.key ?? ""] : data;
		if (!handler || !isRecord(target)) return {
			ok: !1,
			error: ERR.type
		};
		try {
			let error = handler(admin, clone(target), patch.key);
			return error ? {
				ok: !1,
				error
			} : { ok: !0 };
		} catch (error) {
			return this.log.error(`panel action ${patch.id} failed`, error), {
				ok: !1,
				error: ERR.type
			};
		}
	}
	commit(file, key, value) {
		let data = this.data.get(file);
		data && (key === void 0 ? isRecord(value) && this.data.set(file, clone(value)) : value === null ? delete data[key] : data[key] = clone(value), this.changed(file, key));
	}
	commitAfter(file, key, value) {
		setImmediate(() => this.commit(file, key, value));
	}
	store(patch, spec) {
		let data = this.data.get(patch.file) ?? {}, keys = applyEdit(data, patch, spec);
		if (keys.length !== 0) {
			this.data.set(patch.file, data);
			for (let key of keys) this.changed(patch.file, key);
		}
	}
	changed(file, key) {
		let spec = this.schema.files[file], data = this.get(file), value = key === void 0 ? data : data[key] ?? null;
		this.dataFiles.get(file)?.write(data), this.views.changed(file, key, value);
		for (let handler of this.handlers.get(file) ?? []) handler(key, value);
		if (core$24.AdminPanelChanged({
			resource: this.resource,
			file,
			key,
			value: clone(value)
		}), spec?.sync !== "all") return;
		let changes = this.worldChanges.get(file) ?? {};
		changes[key ?? ""] = clone(value), this.worldChanges.set(file, changes), emitNet(ADMIN.worldEvent(this.resource), -1, file, key ?? null, value);
	}
	load(name, spec) {
		if (spec.memory) {
			this.data.set(name, {});
			return;
		}
		let file = new DataFile(this.resource, name, this.log);
		this.dataFiles.set(name, file), file.schemaRef = `./schemas/${name}.schema.json`, writeSchema(this.resource, name, fileSchema(this.resource, this.schema, name, spec), this.log);
		let raw = file.read(), data = isRecord(raw) ? raw : {}, filled = !1;
		if (spec.kind === "settings") for (let [section, value] of Object.entries(spec.defaults ?? {})) section in data || (data[section] = clone(value), filled = !0);
		this.data.set(name, data), (filled || raw === null || !file.hasSchemaRef()) && file.write(data);
	}
};
function labelOf(record, path) {
	if (!path) return null;
	let at = record;
	for (let part of path.split(".")) {
		if (typeof at != "object" || !at) return null;
		at = at[part];
	}
	return typeof at == "string" && at !== "" ? at : null;
}
// ../../../packages/lib/src/server/log.ts
function aiLog(channel, message, options) {
	optionalExport("ai-core")?.Log(channel, message, options);
}
function aiLogChannels(channels) {
	optionalExport("ai-core")?.LogChannels(channels);
}
// ../../../packages/lib/src/server/notify.ts
function notify(source, text, kind = "info", duration) {
	let notification = {
		text,
		kind,
		duration
	};
	emitNet(LIB_UI.notifyEvent, source, notification);
}
// ../../../packages/lib/src/server/inventory.ts
const core$23 = resourceExport(CORE.resource), inventory = {
	addItem: (inv, item, count = 1, metadata, slot) => core$23.AddItem(inv, item, count, metadata, slot),
	removeItem: (inv, item, count = 1, metadata, slot) => core$23.RemoveItem(inv, item, count, metadata, slot),
	getItemCount: (inv, item, metadata) => core$23.GetItemCount(inv, item, metadata),
	hasItem: (inv, item, count = 1) => core$23.HasItem(inv, item, count),
	canCarryItem: (inv, item, count = 1, metadata) => core$23.CanCarryItem(inv, item, count, metadata),
	getItems: (inv) => core$23.GetItems(inv),
	clearInventory: (inv) => core$23.ClearInventory(inv),
	registerStash: (name, label, slots, maxWeight, jobs = []) => core$23.RegisterStash(name, label, slots, maxWeight, jobs),
	openInventory: (source, inv) => core$23.OpenInventory(source, inv),
	registerUsableItem: (name, handler) => core$23.RegisterUsableItem(name, handler),
	registerShop: (name, label, items) => core$23.RegisterShop(name, label, items),
	openShop: (source, name) => core$23.OpenShop(source, name),
	getItemDefinition: (name) => core$23.GetItemDefinition(name)
}, core$22 = resourceExport(CORE.resource);
function reindex(index, source, before, after) {
	for (let name of before) {
		let set = index.get(name);
		set && (set.delete(source), set.size === 0 && index.delete(name));
	}
	for (let name of after) {
		let set = index.get(name);
		set || index.set(name, set = new Set()), set.add(source);
	}
}
var OnlinePlayers = class {
	players = new Map();
	onDuty = new Map();
	jobIndex = new Map();
	gangIndex = new Map();
	started = !1;
	start() {
		if (this.started) return;
		this.started = !0;
		let load = (source, character) => {
			this.drop(source), this.players.set(source, {
				character,
				jobs: [],
				jobNames: [],
				gangs: [],
				gangNames: [],
				duty: null
			}), this.setJobs(source, core$22.GetJobs(source) ?? []), this.setGangs(source, core$22.GetGangs(source) ?? []), this.setDuty(source, core$22.GetDutyJob(source));
		};
		on(CORE.playerLoadedEvent, load), on(CORE.playerUnloadedEvent, (source) => this.drop(source)), on(CORE.jobsChangedEvent, (source, jobs) => this.setJobs(source, jobs)), on(CORE.gangsChangedEvent, (source, gangs) => this.setGangs(source, gangs)), on(CORE.dutyChangedEvent, (source, job) => this.setDuty(source, job));
		for (let source of core$22.GetLoadedSources()) {
			let character = core$22.GetCharacter(source);
			character && load(source, character);
		}
	}
	drop(source) {
		let player = this.players.get(source);
		player && (this.setDuty(source, null), reindex(this.jobIndex, source, player.jobNames, []), reindex(this.gangIndex, source, player.gangNames, []), this.players.delete(source));
	}
	setJobs(source, jobs) {
		let player = this.players.get(source);
		if (!player) return;
		let names = jobs.map((m) => m.job);
		reindex(this.jobIndex, source, player.jobNames, names), player.jobs = jobs, player.jobNames = names;
	}
	setGangs(source, gangs) {
		let player = this.players.get(source);
		if (!player) return;
		let names = gangs.map((m) => m.gang);
		reindex(this.gangIndex, source, player.gangNames, names), player.gangs = gangs, player.gangNames = names;
	}
	setDuty(source, job) {
		let player = this.players.get(source);
		if (!player) return;
		if (player.duty) {
			let set = this.onDuty.get(player.duty);
			set?.delete(source), set?.size === 0 && this.onDuty.delete(player.duty);
		}
		if (player.duty = job, !job) return;
		let set = this.onDuty.get(job);
		set || this.onDuty.set(job, set = new Set()), set.add(source);
	}
	sources() {
		return this.start(), this.players.keys();
	}
	get size() {
		return this.start(), this.players.size;
	}
	character(source) {
		return this.start(), this.players.get(source)?.character ?? null;
	}
	charId(source) {
		return this.start(), this.players.get(source)?.character.id;
	}
	name(source, options = {}) {
		let c = this.character(source);
		return c ? `${c.firstname} ${c.lastname}` : options.fallback === !1 ? "" : GetPlayerName(String(source));
	}
	jobs(source) {
		return this.start(), this.players.get(source)?.jobNames ?? [];
	}
	gangs(source) {
		return this.start(), this.players.get(source)?.gangNames ?? [];
	}
	jobGrade(source, job) {
		return this.start(), this.players.get(source)?.jobs.find((m) => m.job === job)?.grade ?? null;
	}
	gangGrade(source, gang) {
		return this.start(), this.players.get(source)?.gangs.find((m) => m.gang === gang)?.grade ?? null;
	}
	jobMembers(job) {
		return this.start(), this.jobIndex.get(job) ?? EMPTY;
	}
	gangMembers(gang) {
		return this.start(), this.gangIndex.get(gang) ?? EMPTY;
	}
	dutyJob(source) {
		return this.start(), this.players.get(source)?.duty ?? null;
	}
	onDutyIn(source, jobs) {
		let duty = this.dutyJob(source);
		return duty !== null && jobs.includes(duty);
	}
	allows(source, rule) {
		if (isPublic(rule)) return !0;
		let min = (name) => rule.grades[name] ?? 0;
		for (let gang of rule.gangs) {
			let grade = this.gangGrade(source, gang);
			if (grade !== null && grade >= min(gang)) return !0;
		}
		let duty = rule.onDuty ? this.dutyJob(source) : null;
		for (let job of rule.jobs) {
			let grade = this.jobGrade(source, job);
			if (grade !== null && grade >= min(job) && (!rule.onDuty || duty === job)) return !0;
		}
		return !1;
	}
	countOnDuty(jobs) {
		this.start();
		let count = 0;
		for (let job of jobs) count += this.onDuty.get(job)?.size ?? 0;
		return count;
	}
	onDutyFor(job) {
		return this.start(), this.onDuty.get(job) ?? EMPTY;
	}
};
const EMPTY = new Set(), online = new OnlinePlayers(), core$21 = resourceExport(CORE.resource), vehicleKeys = {
	give: (source, vehicle, purpose = "temporary") => core$21.GiveVehicleKeys(source, vehicle, purpose),
	remove: (source, vehicle) => core$21.RemoveVehicleKeys(source, vehicle),
	has: (source, vehicle) => core$21.HasVehicleKeys(source, vehicle)
}, core$20 = resourceExport(CORE.resource), fuel = {
	get: (vehicle) => core$20.GetVehicleFuel(vehicle),
	set: (vehicle, level) => core$20.SetVehicleFuel(vehicle, level),
	provider: () => core$20.GetFuelSystem()
}, TYPES = new Set([
	"automobile",
	"bike",
	"boat",
	"heli",
	"plane",
	"submarine",
	"trailer",
	"train"
]), types = new Map(), votes = new Map();
async function vehicleType(model, asker) {
	let known = types.get(model);
	if (known !== void 0) return known;
	let answer = await triggerClientCallback(CORE.vehicleTypeCallback, asker, [model]).catch(() => null);
	if (typeof answer != "string" || !TYPES.has(answer)) return null;
	let seen = votes.get(model) ?? new Map(), first = seen.get(answer);
	return first !== void 0 && first !== asker ? (types.set(model, answer), votes.delete(model)) : (seen.set(answer, asker), votes.set(model, seen)), answer;
}
async function seatPlayer(vehicle, source, seat) {
	let ped = GetPlayerPed(String(source));
	return ped ? waitFor(() => {
		if (!DoesEntityExist(vehicle)) return !1;
		if (GetPedInVehicleSeat(vehicle, seat) === ped) return !0;
		SetPedIntoVehicle(ped, vehicle, seat);
	}, 2e3, 150).catch(() => !1) : !1;
}
function randomPlate(prefix) {
	let digit = () => String(Math.floor(Math.random() * 10));
	if (prefix !== void 0) {
		let plate = prefix.slice(0, 8);
		for (; plate.length < 8;) plate += digit();
		return plate;
	}
	let letter = () => "ABCDEFGHJKLMNPRSTUVWXYZ"[Math.floor(Math.random() * 23)] ?? "A";
	return `${digit()}${digit()}${letter()}${letter()}${letter()}${digit()}${digit()}${digit()}`;
}
async function spawnVehicle(options) {
	let type = options.asker === void 0 ? options.type ?? "automobile" : await vehicleType(options.model, options.asker);
	if (!type) return null;
	let { x, y, z, heading } = options.coords, vehicle = CreateVehicleServerSetter(GetHashKey(options.model), type, x, y, z, heading);
	if (!await waitFor(() => DoesEntityExist(vehicle) || void 0, 5e3).catch(() => !1)) return null;
	options.persistent !== !1 && SetEntityOrphanMode(vehicle, 2);
	let plate = (options.plate ?? randomPlate()).slice(0, 8);
	SetVehicleNumberPlateText(vehicle, plate), options.bucket !== void 0 && SetEntityRoutingBucket(vehicle, options.bucket), options.locked && SetVehicleDoorsLocked(vehicle, 2);
	let state = Entity(vehicle).state;
	options.fuel !== void 0 && fuel.set(vehicle, options.fuel), options.props && state.set(VEHICLE_BAGS.props, options.props, !0), options.setup && state.set(VEHICLE_BAGS.setup, options.setup, !0);
	for (let [key, value] of Object.entries(options.bags ?? {})) state.set(key, value, !0);
	if (options.keysTo !== void 0) {
		let synced = await waitFor(() => !DoesEntityExist(vehicle) || GetVehicleNumberPlateText(vehicle).trim() === plate.trim() || void 0, 3e3).catch(() => !1);
		vehicleKeys.give(options.keysTo, synced && DoesEntityExist(vehicle) ? vehicle : plate.trim(), options.purpose ?? "temporary");
	}
	let riders = [...options.driver === void 0 ? [] : [{
		source: options.driver,
		seat: -1
	}], ...options.seats ?? []];
	return await Promise.all(riders.map((r) => seatPlayer(vehicle, r.source, r.seat))), vehicle;
}
// ../../../packages/lib/src/server/proximity.ts
const core$19 = resourceExport(CORE.resource);
function within(point, radius, candidates) {
	let out = [];
	for (let source of candidates) {
		let p = coordsOf(source);
		Math.hypot(p.x - point.x, p.y - point.y, p.z - point.z) <= radius && out.push(source);
	}
	return out;
}
function playersNearEntity(entity, radius) {
	if (!DoesEntityExist(entity)) return [];
	let owner = NetworkGetEntityOwner(entity);
	return owner <= 0 ? [] : within(entityCoords(entity), radius, [owner, ...core$19.GetPlayersInScope(owner)]);
}
// ../../../packages/lib/src/server/players.ts
const log$4 = createLogger(GetCurrentResourceName()), dropped = new Set();
let listening$1 = !1;
function onDropped(fn) {
	listening$1 || (listening$1 = !0, on("playerDropped", () => {
		let source = Number(globalThis.source);
		for (let handler of dropped) handler(source);
	})), dropped.add(fn);
}
var PlayerMap = class extends Map {
	constructor(options = {}) {
		super(), onDropped((source) => {
			if (!this.has(source)) return;
			let value = this.get(source);
			this.delete(source), options.onDrop?.(source, value);
		});
	}
}, KeyedCooldowns = class {
	until = new Map();
	sweepAt = 64;
	ready(key) {
		return this.left(key) === 0;
	}
	start(key, ms) {
		ms <= 0 ? this.until.delete(key) : (this.until.size >= this.sweepAt && this.sweep(), this.until.set(key, GetGameTimer() + ms));
	}
	take(key, ms) {
		return this.ready(key) ? (this.start(key, ms), !0) : !1;
	}
	left(key) {
		let until = this.until.get(key);
		if (until === void 0) return 0;
		let left = until - GetGameTimer();
		return left > 0 ? left : (this.until.delete(key), 0);
	}
	clear(key) {
		this.until.delete(key);
	}
	sweep() {
		let now = GetGameTimer();
		for (let [key, until] of this.until) until <= now && this.until.delete(key);
		this.sweepAt = Math.max(64, this.until.size * 2);
	}
};
function onCharacter(handlers) {
	let live = new Map(), deliver = (source, character) => {
		if (live.set(source, character.id), handlers.loaded) try {
			let result = handlers.loaded(source, character);
			result instanceof Promise && result.catch((error) => log$4.error(`character loaded handler failed for ${source}`, error));
		} catch (error) {
			log$4.error(`character loaded handler failed for ${source}`, error);
		}
	}, end = (source, charId, reason) => {
		if (live.delete(source)) try {
			handlers.unloaded?.(source, charId, reason);
		} catch (error) {
			log$4.error(`character unloaded handler failed for ${source}`, error);
		}
	};
	on(CORE.playerLoadedEvent, (source, character) => {
		let previous = live.get(source);
		previous !== void 0 && end(source, previous, "switch"), deliver(source, character);
	}), on(CORE.playerUnloadedEvent, (source, charId, reason) => end(source, charId, reason === "dropped" ? "dropped" : "switch")), onDropped((source) => setImmediate(() => {
		let charId = live.get(source);
		charId !== void 0 && end(source, charId, "dropped");
	})), setImmediate(() => {
		for (let source of online.sources()) {
			if (live.has(source)) continue;
			let character = online.character(source);
			character && deliver(source, character);
		}
	});
}
// ../../../packages/lib/src/server/progressFor.ts
const running = new PlayerMap({ onDrop: (_source, settle) => settle(!1) });
on(CORE.playerUnloadedEvent, (source) => {
	let settle = running.get(source);
	settle && settle(!1);
});
function progressFor(source, options) {
	let previous = running.get(source);
	previous && (previous(!1), emitNet(LIB_UI.progressForCancelEvent, source));
	let { minRatio = .8, ...bar } = options, startedAt = GetGameTimer();
	return new Promise((resolve) => {
		let done = !1, settle = (ok) => {
			done || (done = !0, running.get(source) === settle && running.delete(source), resolve(ok));
		};
		running.set(source, settle), triggerClientCallback(LIB_UI.progressForCallback, source, [bar], bar.duration + 15e3).then((answer) => settle(answer === !0 && GetGameTimer() - startedAt >= bar.duration * minRatio), () => settle(!1));
	});
}
// ../../../packages/lib/src/server/definitions.ts
const core$18 = resourceExport("ai-core");
new class {
	jobs = new Map();
	gangs = new Map();
	constructor() {
		on(CORE.definitionsChangedEvent, (file, name) => {
			typeof name == "string" && (file === "jobs" ? this.jobs.delete(name) : file === "gangs" && this.gangs.delete(name));
		});
	}
	job(name) {
		let def = this.jobs.get(name);
		return def === void 0 && this.jobs.set(name, def = core$18.GetJobDefinition(name) ?? null), def;
	}
	gang(name) {
		let def = this.gangs.get(name);
		return def === void 0 && this.gangs.set(name, def = core$18.GetGangDefinition(name) ?? null), def;
	}
}();
async function minigameFor(source, options) {
	let level = options.difficulty ?? "medium", request = options.game === "lockpick" ? {
		kind: "lockpick",
		pins: Math.min(6, Math.max(1, Math.floor(options.pins ?? 1))),
		area: LOCKPICK_AREAS[level],
		picks: Math.min(10, Math.max(1, Math.floor(options.picks ?? 1)))
	} : {
		kind: "skillCheck",
		stages: Array.from({ length: Math.min(10, Math.max(1, options.rounds ?? 2)) }, () => SKILL_STAGES[level]),
		keys: options.keys ?? ["e"]
	}, startedAt = GetGameTimer(), answer = await triggerClientCallback(LIB_UI.minigameForCallback, source, [request], 12e4).catch(() => null);
	return answer === !0 || answer === "opened" ? GetGameTimer() - startedAt < (options.minMs ?? 0) ? "lost" : "won" : answer === "broken" ? "broken" : "lost";
}
// ../../../packages/lib/src/server/command.ts
const resource = GetCurrentResourceName();
createLogger(resource), new class {
	list = [];
	sent = new Map();
	announced = 0;
	queued = !1;
	listening = !1;
	add(command) {
		this.listening || this.listen(), this.list.push(command), this.queued || (this.queued = !0, setImmediate(() => this.flush()));
	}
	refresh(source) {
		let before = this.sent.get(source), now = new Set(), add = [];
		for (let command of this.list) for (let name of command.info.names) command.allowed(source, name) && (now.add(name), before?.has(name) || add.push(command.suggestion(name)));
		if (this.sent.set(source, now), add.length && emitNet("chat:addSuggestions", source, add), before) for (let name of before) now.has(name) || emitNet("chat:removeSuggestion", source, `/${name}`);
	}
	flush() {
		this.queued = !1, optionalExport(CORE.resource)?.RegisterCommands(resource, this.list.slice(this.announced).map((c) => c.info)), this.announced = this.list.length;
		for (let player of getPlayers()) this.refresh(Number(player));
	}
	listen() {
		this.listening = !0;
		let refresh = (source) => this.refresh(Number(source));
		on(CORE.playerLoadedEvent, refresh), on(CORE.jobsChangedEvent, refresh), on(CORE.gangsChangedEvent, refresh), on("playerDropped", () => this.sent.delete(Number(globalThis.source))), on("onResourceStop", (name) => {
			if (name === resource) for (let command of this.list) for (let n of command.info.names) emitNet("chat:removeSuggestion", -1, `/${n}`);
		});
	}
}(), createLogger(GetCurrentResourceName()), createLogger("aicore-lib");
// ../../../packages/lib/src/fivem/byResource.ts
const stopHandlers = [];
let listening = !1;
function onAnyStop(handler) {
	if (stopHandlers.push(handler), listening) return;
	listening = !0;
	let event = IsDuplicityVersion() ? "onResourceStop" : "onClientResourceStop";
	on(event, (resource) => {
		for (let stop of stopHandlers) stop(resource);
	});
}
function onStop(fn) {
	let self = GetCurrentResourceName();
	onAnyStop((resource) => {
		resource === self && fn();
	});
}
let log = null;
var ScheduledJob = class {
	interval;
	fn;
	name;
	gen = 0;
	active = !1;
	stopped = !1;
	quietUntil = 0;
	skipped = 0;
	constructor(interval, fn, name) {
		this.interval = interval, this.fn = fn, this.name = name;
	}
	get running() {
		return this.active;
	}
	set(active) {
		active === this.active || active && this.stopped || (this.active = active, active ? scheduler.activate(this) : scheduler.deactivate(this));
	}
	stop() {
		this.set(!1), this.stopped = !0;
	}
	call() {
		try {
			let result = this.fn();
			result instanceof Promise && result.catch((error) => this.fail(error));
		} catch (error) {
			this.fail(error);
		}
	}
	fail(error) {
		let now = GetGameTimer();
		if (now < this.quietUntil) {
			this.skipped++;
			return;
		}
		this.quietUntil = now + 1e4;
		let more = this.skipped ? ` (+${this.skipped} more)` : "";
		this.skipped = 0, log ??= createLogger(GetCurrentResourceName()), log.error(`job "${this.name}" failed${more}`, error instanceof Error ? error.stack ?? error.message : error);
	}
}, Group = class {
	interval;
	jobs = Array(8);
	gens = Array(8).fill(0);
	dues = Array(8).fill(0);
	head = 0;
	mask = 7;
	count = 0;
	constructor(interval) {
		this.interval = interval;
	}
	get front() {
		return this.dues[this.head] ?? 0;
	}
	compactAt = 64;
	push(job, due) {
		this.count >= this.compactAt && this.compact(), this.count > this.mask && this.grow();
		let i = this.head + this.count & this.mask;
		this.jobs[i] = job, this.gens[i] = job.gen, this.dues[i] = due, this.count++;
	}
	run(now) {
		for (let left = this.count; left > 0 && this.count > 0; left--) {
			let i = this.head, due = this.dues[i] ?? 0;
			if (due > now) return;
			let job = this.jobs[i], gen = this.gens[i];
			if (this.jobs[i] = void 0, this.head = i + 1 & this.mask, this.count--, !job || job.gen !== gen) continue;
			let next = due + this.interval;
			next <= now && (next = now + this.interval), this.push(job, next), job.call();
		}
	}
	compact() {
		let kept = 0;
		for (let n = 0; n < this.count; n++) {
			let i = this.head + n & this.mask, job = this.jobs[i];
			if (!job || job.gen !== this.gens[i]) continue;
			let k = this.head + kept & this.mask;
			this.jobs[k] = job, this.gens[k] = this.gens[i] ?? 0, this.dues[k] = this.dues[i] ?? 0, kept++;
		}
		for (let n = kept; n < this.count; n++) this.jobs[this.head + n & this.mask] = void 0;
		this.count = kept, this.compactAt = Math.max(64, kept * 2);
	}
	grow() {
		let size = (this.mask + 1) * 2, jobs = Array(size), gens = Array(size).fill(0), dues = Array(size).fill(0);
		for (let n = 0; n < this.count; n++) {
			let i = this.head + n & this.mask;
			jobs[n] = this.jobs[i], gens[n] = this.gens[i] ?? 0, dues[n] = this.dues[i] ?? 0;
		}
		this.jobs = jobs, this.gens = gens, this.dues = dues, this.head = 0, this.mask = size - 1;
	}
};
const scheduler = new class {
	groups = [];
	byInterval = new Map();
	tick = null;
	active = 0;
	nextDue = Infinity;
	running = !1;
	activate(job) {
		job.gen++, this.active++;
		let due = GetGameTimer() + job.interval, group = this.byInterval.get(job.interval);
		group || (group = new Group(job.interval), this.byInterval.set(job.interval, group), this.groups.push(group)), group.push(job, due), due < this.nextDue && (this.nextDue = due), this.tick ??= setTick(this.onTick);
	}
	deactivate(job) {
		job.gen++, this.active--, this.active === 0 && !this.running && this.halt();
	}
	halt() {
		this.tick !== null && clearTick(this.tick), this.tick = null, this.groups.length = 0, this.byInterval.clear(), this.nextDue = Infinity;
	}
	onTick = () => {
		let now = GetGameTimer();
		if (now < this.nextDue) return;
		let groups = this.groups;
		this.running = !0;
		for (let i = 0; i < groups.length; i++) {
			let group = groups[i];
			group && group.count > 0 && group.front <= now && group.run(now);
		}
		if (this.running = !1, this.active === 0) return this.halt();
		let soonest = Infinity, kept = 0;
		for (let i = 0; i < groups.length; i++) {
			let group = groups[i];
			group && (group.count === 0 ? this.byInterval.delete(group.interval) : (groups[kept++] = group, group.front < soonest && (soonest = group.front)));
		}
		groups.length = kept, this.nextDue = soonest;
	};
}();
function every(ms, fn, options = {}) {
	let job = new ScheduledJob(Math.max(0, Math.floor(ms)), fn, options.name ?? (fn.name || "anonymous"));
	return options.active !== !1 && job.set(!0), job;
}
// ../../../packages/lib/src/fivem/state.ts
const stateBoolean = (v) => typeof v == "boolean" ? v : void 0;
IsDuplicityVersion();
var Mirror = class {
	key;
	parse;
	values = new Map();
	listeners = new Set();
	constructor(key, parse) {
		this.key = key, this.parse = parse;
	}
	onChange(listener) {
		return this.listeners.add(listener), () => this.listeners.delete(listener);
	}
	store(id, raw) {
		this.apply(id, raw == null ? void 0 : this.parse(raw));
	}
	apply(id, value) {
		let old = this.values.get(id);
		if (this.values.set(id, value), old !== value) for (let listener of this.listeners) listener(id, value, old);
	}
};
const prefixListeners = new Map();
let prefixHandler = !1;
function listenPrefix(prefix, listener) {
	let set = prefixListeners.get(prefix);
	set || prefixListeners.set(prefix, set = new Set()), set.add(listener), prefixHandler || (prefixHandler = !0, AddStateBagChangeHandler("", "global", (_bag, key, value) => {
		for (let [p, listeners] of prefixListeners) if (key.startsWith(p)) for (let l of listeners) l(key, value);
	}));
}
var GlobalGroup$1 = class extends Mirror {
	prefix;
	constructor(prefix, parse) {
		super(prefix, parse), this.prefix = prefix;
		let keys = GetStateBagKeys("global");
		for (let key of Array.isArray(keys) ? keys : []) {
			if (typeof key != "string" || !key.startsWith(prefix)) continue;
			let raw = GlobalState[key];
			this.values.set(key.slice(prefix.length), raw == null ? void 0 : parse(raw));
		}
		listenPrefix(prefix, (key, value) => this.store(key.slice(prefix.length), value));
	}
	get(id) {
		return this.values.get(id);
	}
	put(id, value) {
		this.apply(id, value);
	}
	ids() {
		return this.values.keys();
	}
}, GlobalGroup = class extends GlobalGroup$1 {
	set(id, value) {
		GlobalState.set(this.prefix + id, value ?? null, !0), this.put(id, value);
	}
};
resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/dispatch.ts
const core$14 = resourceExport(CORE.resource), dispatch = { alert: (alert) => core$14.SendDispatchAlert(alert) };
resourceExport(CORE.resource);
// ../../../packages/lib/src/server/buckets.ts
const core$12 = resourceExport(CORE.resource), buckets = {
	acquire: (tag) => core$12.AcquireBucket(tag),
	release: (id) => core$12.ReleaseBucket(id)
};
resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/doors.ts
const core$4 = resourceExport(CORE.resource), doors = {
	setLocked: (id, locked, by) => core$4.SetDoorLocked(id, locked, by),
	isLocked: (id) => core$4.IsDoorLocked(id),
	provider: () => core$4.GetDoorlockSystem()
};
resourceExport(CORE.resource), resourceExport(CORE.resource), resourceExport(CORE.resource);
// resource/common/locale.ts
const Locale = createLocale();
GetCurrentResourceName(), IsDuplicityVersion();
// resource/common/robbery.ts
const EVENTS = {
	start: "ai-robberies:start",
	exit: "ai-robberies:exit",
	inside: "ai-robberies:client:inside",
	truckStart: "ai-robberies:truckStart",
	truckJob: "ai-robberies:client:truckJob",
	truckPlant: "ai-robberies:truckPlant",
	truckOpen: "ai-robberies:client:truckOpen",
	truckLoot: "ai-robberies:truckLoot",
	truckEnd: "ai-robberies:client:truckEnd"
}, INSIDE_META = "robbery_house", KINDS = [
	"register",
	"safe",
	"locker",
	"vitrine",
	"door",
	"entry",
	"loot"
], point = (v) => {
	let p = record(v);
	return {
		x: num(p.x, 0),
		y: num(p.y, 0),
		z: num(p.z, 0)
	};
}, ZERO4 = {
	x: 0,
	y: 0,
	z: 0,
	heading: 0
}, optional4 = (v) => {
	let p = vec4(v, ZERO4);
	return p.x === 0 && p.y === 0 ? null : p;
};
function readSettings(raw) {
	let v = record(raw), jobs = Array.isArray(v.policeJobs) ? v.policeJobs.filter((j) => typeof j == "string") : [], t = record(v.truck), cashMin = int(t.cashMin, 2e3, 0), blip = record(v.blip);
	return {
		policeJobs: jobs.length > 0 ? jobs : ["police"],
		account: str(v.account, "cash", 32),
		blip: readBlipStyle(blip, {
			sprite: 500,
			color: 0,
			scale: .7
		}),
		truck: {
			giver: vec4(t.giver, ZERO4),
			price: int(t.price, 500, 0),
			minPolice: int(t.minPolice, 2, 0, 32),
			cooldown: int(t.cooldown, 45, 1, 1440),
			item: str(t.item, "c4", 48),
			cashMin,
			cashMax: Math.max(cashMin, int(t.cashMax, 5e3, 0)),
			spawns: (Array.isArray(t.spawns) ? t.spawns : []).map((row) => vec4(record(row).coords, ZERO4)),
			account: str(t.account, "bank", 32),
			truckModel: str(t.truckModel, "stockade", 64),
			guardModel: str(t.guardModel, "s_m_m_security_01", 64),
			guardWeapon: str(t.guardWeapon, "WEAPON_CARBINERIFLE", 64),
			lifetime: int(t.lifetime, 20, 1, 240),
			plantSeconds: int(t.plantSeconds, 5, 1, 120),
			fuseSeconds: int(t.fuseSeconds, 10, 1, 120),
			lootSeconds: int(t.lootSeconds, 10, 1, 120)
		}
	};
}
function readPlace(id, v) {
	return {
		id,
		label: str(v.label, id, 48),
		coords: point(v.coords),
		minPolice: int(v.minPolice, 0, 0, 32),
		cooldown: int(v.cooldown, 30, 1, 1440),
		alertChance: int(v.alertChance, 100, 0, 100),
		blip: bool(v.blip, !1),
		interior: optional4(v.interior)
	};
}
const MINIGAMES = [
	"auto",
	"none",
	"skillCheck",
	"lockpick"
], DIFFICULTIES = [
	"easy",
	"medium",
	"hard"
], AUTO_MINIGAME = {
	register: "lockpick",
	safe: "skillCheck",
	locker: "skillCheck",
	vitrine: "none",
	door: "skillCheck",
	entry: "lockpick",
	loot: "none"
};
function readTarget(id, v) {
	let cashMin = int(v.cashMin, 0, 0, 1e6), rewardMin = int(v.rewardMin, 0, 0, 100);
	return {
		id,
		place: str(v.place, "", 48),
		label: str(v.label, id, 48),
		kind: KINDS.includes(v.kind) ? v.kind : "register",
		coords: point(v.coords),
		item: str(v.item, "", 48),
		consume: bool(v.consume, !1),
		seconds: int(v.seconds, 20, 1, 600),
		cashMin,
		cashMax: Math.max(cashMin, int(v.cashMax, 0, 0, 1e6)),
		reward: str(v.reward, "", 48),
		rewardMin,
		rewardMax: Math.max(rewardMin, int(v.rewardMax, 0, 0, 100)),
		door: str(v.door, "", 64),
		vaultModel: str(v.vaultModel, "", 64),
		vaultClosed: num(v.vaultClosed, 0, -720, 720),
		vaultOpen: num(v.vaultOpen, 0, -720, 720),
		minigame: MINIGAMES.find((m) => m === v.minigame) ?? "auto",
		difficulty: DIFFICULTIES.find((d) => d === v.difficulty) ?? "medium"
	};
}
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
}, robberiesSchema = {
	title: "ADMIN_TITLE",
	icon: "mask",
	files: {
		settings: {
			kind: "settings",
			sync: "all",
			sections: {
				policeJobs: {
					type: "names",
					lookup: "job",
					max: 10,
					itemMax: 32,
					pattern: "^[a-z0-9_]{2,32}$"
				},
				account: {
					type: "text",
					lookup: "account",
					min: 2,
					max: 32
				},
				blip: {
					type: "object",
					optional: !0,
					fields: BLIP_STYLE_FIELDS
				},
				truck: {
					type: "object",
					fields: {
						account: {
							type: "text",
							lookup: "account",
							min: 2,
							max: 32,
							optional: !0
						},
						truckModel: {
							type: "text",
							min: 1,
							max: 64,
							optional: !0
						},
						guardModel: {
							type: "text",
							min: 1,
							max: 64,
							optional: !0
						},
						guardWeapon: {
							type: "text",
							min: 1,
							max: 64,
							optional: !0
						},
						lifetime: {
							type: "number",
							min: 1,
							max: 240,
							integer: !0,
							optional: !0
						},
						plantSeconds: {
							type: "number",
							min: 1,
							max: 120,
							integer: !0,
							optional: !0
						},
						fuseSeconds: {
							type: "number",
							min: 1,
							max: 120,
							integer: !0,
							optional: !0
						},
						lootSeconds: {
							type: "number",
							min: 1,
							max: 120,
							integer: !0,
							optional: !0
						},
						giver: { type: "vec4" },
						price: {
							type: "number",
							min: 0,
							max: 1e6,
							integer: !0
						},
						minPolice: {
							type: "number",
							min: 0,
							max: 32,
							integer: !0
						},
						cooldown: {
							type: "number",
							min: 1,
							max: 1440,
							integer: !0
						},
						item: {
							type: "text",
							lookup: "item",
							min: 2,
							max: 48
						},
						cashMin: {
							type: "number",
							min: 0,
							max: 1e6,
							integer: !0
						},
						cashMax: {
							type: "number",
							min: 0,
							max: 1e6,
							integer: !0
						},
						spawns: {
							type: "list",
							max: 30,
							of: {
								type: "object",
								fields: { coords: { type: "vec4" } }
							}
						}
					}
				}
			}
		},
		places: {
			kind: "records",
			sync: "all",
			labelPath: "label",
			newRecord: {
				label: "",
				coords: {
					x: 0,
					y: 0,
					z: 0
				},
				minPolice: 0,
				cooldown: 30,
				alertChance: 100,
				blip: !1,
				interior: {
					x: 0,
					y: 0,
					z: 0,
					heading: 0
				}
			},
			sections: {
				label: {
					type: "text",
					min: 1,
					max: 48
				},
				coords: { type: "vec3" },
				minPolice: {
					type: "number",
					min: 0,
					max: 32,
					integer: !0
				},
				cooldown: {
					type: "number",
					min: 1,
					max: 1440,
					integer: !0
				},
				alertChance: {
					type: "number",
					min: 0,
					max: 100,
					integer: !0
				},
				blip: { type: "bool" },
				interior: { type: "vec4" }
			}
		},
		targets: {
			kind: "records",
			sync: "all",
			keyPattern: "^[a-z0-9_]{2,64}$",
			labelPath: "label",
			newRecord: {
				place: "",
				label: "",
				kind: "register",
				coords: {
					x: 0,
					y: 0,
					z: 0
				},
				item: "",
				consume: !1,
				seconds: 20,
				cashMin: 0,
				cashMax: 0,
				reward: "",
				rewardMin: 0,
				rewardMax: 0,
				door: "",
				vaultModel: "",
				vaultClosed: 0,
				vaultOpen: 0,
				minigame: "auto",
				difficulty: "medium"
			},
			sections: {
				place: {
					type: "text",
					min: 1,
					max: 48
				},
				label: {
					type: "text",
					min: 1,
					max: 48
				},
				kind: {
					type: "enum",
					values: [
						"register",
						"safe",
						"locker",
						"vitrine",
						"door",
						"entry",
						"loot"
					]
				},
				coords: { type: "vec3" },
				item: {
					type: "text",
					lookup: "item",
					min: 0,
					max: 48
				},
				consume: { type: "bool" },
				seconds: {
					type: "number",
					min: 1,
					max: 600,
					integer: !0
				},
				cashMin: {
					type: "number",
					min: 0,
					max: 1e6,
					integer: !0
				},
				cashMax: {
					type: "number",
					min: 0,
					max: 1e6,
					integer: !0
				},
				reward: {
					type: "text",
					lookup: "item",
					min: 0,
					max: 48
				},
				rewardMin: {
					type: "number",
					min: 0,
					max: 100,
					integer: !0
				},
				rewardMax: {
					type: "number",
					min: 0,
					max: 100,
					integer: !0
				},
				door: {
					type: "text",
					min: 0,
					max: 64
				},
				vaultModel: {
					type: "text",
					min: 0,
					max: 64
				},
				vaultClosed: {
					type: "number",
					min: -720,
					max: 720
				},
				vaultOpen: {
					type: "number",
					min: -720,
					max: 720
				},
				minigame: {
					type: "enum",
					values: [
						"auto",
						"none",
						"skillCheck",
						"lockpick"
					]
				},
				difficulty: {
					type: "enum",
					values: [
						"easy",
						"medium",
						"hard"
					]
				}
			}
		}
	},
	tabs: [
		{
			id: "places",
			file: "places",
			icon: "store",
			label: "ADMIN_TAB_PLACES",
			desc: "ADMIN_TAB_PLACES_DESC",
			createLabel: "ADMIN_NEW_PLACE",
			deleteLabel: "ADMIN_DELETE_PLACE",
			deleteDesc: "ADMIN_DELETE_PLACE_DESC",
			cards: [{
				icon: "store",
				title: "ADMIN_C_PLACE",
				desc: "ADMIN_C_PLACE_DESC",
				fields: [
					{
						widget: "text",
						path: "label",
						suggest: { from: "coords" },
						label: "ADMIN_F_LABEL",
						placeholder: "ADMIN_P_LABEL"
					},
					{
						widget: "point",
						path: "coords",
						label: "ADMIN_F_COORDS",
						hint: "ADMIN_H_COORDS",
						ground: !0
					},
					{
						widget: "number",
						path: "minPolice",
						label: "ADMIN_F_MIN_POLICE",
						hint: "ADMIN_H_MIN_POLICE",
						min: 0,
						max: 32
					},
					{
						widget: "number",
						path: "cooldown",
						label: "ADMIN_F_COOLDOWN",
						hint: "ADMIN_H_COOLDOWN",
						min: 1,
						max: 1440,
						unit: "min"
					},
					{
						widget: "number",
						path: "alertChance",
						label: "ADMIN_F_ALERT",
						hint: "ADMIN_H_ALERT",
						min: 0,
						max: 100,
						unit: "%"
					},
					{
						widget: "switch",
						path: "blip",
						label: "ADMIN_F_BLIP"
					}
				]
			}, {
				icon: "location-dot",
				title: "ADMIN_C_HOUSE",
				desc: "ADMIN_C_HOUSE_DESC",
				fields: [{
					widget: "point",
					path: "interior",
					label: "ADMIN_F_INTERIOR",
					hint: "ADMIN_H_INTERIOR",
					heading: !0,
					ground: !0
				}]
			}]
		},
		{
			id: "targets",
			file: "targets",
			icon: "box-open",
			label: "ADMIN_TAB_TARGETS",
			desc: "ADMIN_TAB_TARGETS_DESC",
			listSub: "place",
			createLabel: "ADMIN_NEW_TARGET",
			deleteLabel: "ADMIN_DELETE_TARGET",
			cards: [
				{
					icon: "box-open",
					title: "ADMIN_C_TARGET",
					desc: "ADMIN_C_TARGET_DESC",
					fields: [
						{
							widget: "text",
							path: "place",
							label: "ADMIN_F_PLACE",
							hint: "ADMIN_H_PLACE",
							placeholder: "ADMIN_P_PLACE"
						},
						{
							widget: "text",
							path: "label",
							suggest: { from: "coords" },
							label: "ADMIN_F_TARGET_LABEL",
							placeholder: "ADMIN_P_TARGET_LABEL"
						},
						{
							widget: "select",
							path: "kind",
							label: "ADMIN_F_KIND",
							hint: "ADMIN_H_KIND",
							options: [
								{
									value: "register",
									label: "ADMIN_O_REGISTER"
								},
								{
									value: "safe",
									label: "ADMIN_O_SAFE"
								},
								{
									value: "locker",
									label: "ADMIN_O_LOCKER"
								},
								{
									value: "vitrine",
									label: "ADMIN_O_VITRINE"
								},
								{
									value: "door",
									label: "ADMIN_O_DOOR"
								},
								{
									value: "entry",
									label: "ADMIN_O_ENTRY"
								},
								{
									value: "loot",
									label: "ADMIN_O_LOOT"
								}
							]
						},
						{
							widget: "point",
							path: "coords",
							label: "ADMIN_F_TARGET_COORDS",
							hint: "ADMIN_H_TARGET_COORDS",
							ground: !0
						},
						{
							widget: "number",
							path: "seconds",
							label: "ADMIN_F_SECONDS",
							min: 1,
							max: 600,
							unit: "s"
						},
						{
							widget: "text",
							lookup: "item",
							path: "item",
							label: "ADMIN_F_ITEM",
							hint: "ADMIN_H_ITEM",
							placeholder: "ADMIN_P_ITEM"
						},
						{
							widget: "switch",
							path: "consume",
							label: "ADMIN_F_CONSUME"
						},
						{
							widget: "select",
							path: "minigame",
							label: "ADMIN_F_MINIGAME",
							hint: "ADMIN_H_MINIGAME",
							options: [
								{
									value: "auto",
									label: "ADMIN_O_MINIGAME_AUTO"
								},
								{
									value: "none",
									label: "ADMIN_O_MINIGAME_NONE"
								},
								{
									value: "skillCheck",
									label: "ADMIN_O_MINIGAME_SKILL"
								},
								{
									value: "lockpick",
									label: "ADMIN_O_MINIGAME_LOCKPICK"
								}
							]
						},
						{
							widget: "select",
							path: "difficulty",
							label: "ADMIN_F_DIFFICULTY",
							showIf: {
								path: "minigame",
								values: [
									"auto",
									"skillCheck",
									"lockpick"
								]
							},
							options: [
								{
									value: "easy",
									label: "ADMIN_O_EASY"
								},
								{
									value: "medium",
									label: "ADMIN_O_MEDIUM"
								},
								{
									value: "hard",
									label: "ADMIN_O_HARD"
								}
							]
						}
					]
				},
				{
					icon: "lock",
					title: "ADMIN_C_DOOR",
					desc: "ADMIN_C_DOOR_DESC",
					fields: [
						{
							widget: "text",
							path: "door",
							label: "ADMIN_F_DOOR",
							hint: "ADMIN_H_DOOR",
							placeholder: "ADMIN_P_DOOR"
						},
						{
							widget: "text",
							path: "vaultModel",
							label: "ADMIN_F_VAULT_MODEL",
							hint: "ADMIN_H_VAULT_MODEL",
							placeholder: "ADMIN_P_VAULT_MODEL"
						},
						{
							widget: "number",
							path: "vaultClosed",
							label: "ADMIN_F_VAULT_CLOSED",
							min: -720,
							max: 720,
							step: .5,
							unit: "°"
						},
						{
							widget: "number",
							path: "vaultOpen",
							label: "ADMIN_F_VAULT_OPEN",
							min: -720,
							max: 720,
							step: .5,
							unit: "°"
						}
					]
				},
				{
					icon: "money-bill-wave",
					title: "ADMIN_C_REWARD",
					desc: "ADMIN_C_REWARD_DESC",
					fields: [
						{
							widget: "number",
							path: "cashMin",
							label: "ADMIN_F_CASH_MIN",
							min: 0,
							max: 1e6,
							unit: "$"
						},
						{
							widget: "number",
							path: "cashMax",
							label: "ADMIN_F_CASH_MAX",
							min: 0,
							max: 1e6,
							unit: "$"
						},
						{
							widget: "text",
							lookup: "item",
							path: "reward",
							label: "ADMIN_F_REWARD",
							hint: "ADMIN_H_REWARD",
							placeholder: "ADMIN_P_REWARD"
						},
						{
							widget: "number",
							path: "rewardMin",
							label: "ADMIN_F_REWARD_MIN",
							min: 0,
							max: 100
						},
						{
							widget: "number",
							path: "rewardMax",
							label: "ADMIN_F_REWARD_MAX",
							min: 0,
							max: 100
						}
					]
				}
			]
		},
		{
			id: "settings",
			file: "settings",
			icon: "sliders",
			label: "ADMIN_TAB_SETTINGS",
			desc: "ADMIN_TAB_SETTINGS_DESC",
			cards: [{
				icon: "sliders",
				title: "ADMIN_C_SETTINGS",
				desc: "ADMIN_C_SETTINGS_DESC",
				fields: [
					{
						widget: "tags",
						lookup: "job",
						path: "policeJobs",
						label: "ADMIN_F_POLICE_JOBS",
						hint: "ADMIN_H_POLICE_JOBS",
						placeholder: "ADMIN_P_POLICE_JOBS"
					},
					{
						widget: "text",
						lookup: "account",
						path: "account",
						label: "ADMIN_F_ACCOUNT",
						hint: "ADMIN_H_ACCOUNT",
						placeholder: "ADMIN_P_ACCOUNT"
					},
					{
						widget: "blip",
						path: "blip",
						label: "ADMIN_F_BLIP_STYLE",
						hint: "ADMIN_H_BLIP_STYLE"
					}
				]
			}, {
				icon: "car-side",
				title: "ADMIN_C_TRUCK",
				desc: "ADMIN_C_TRUCK_DESC",
				fields: [
					{
						widget: "point",
						path: "truck.giver",
						label: "ADMIN_F_TRUCK_GIVER",
						hint: "ADMIN_H_TRUCK_GIVER",
						heading: !0,
						ground: !0
					},
					{
						widget: "number",
						path: "truck.price",
						label: "ADMIN_F_TRUCK_PRICE",
						hint: "ADMIN_H_TRUCK_PRICE",
						min: 0,
						max: 1e6,
						unit: "$"
					},
					{
						widget: "text",
						lookup: "account",
						path: "truck.account",
						label: "ADMIN_F_TRUCK_ACCOUNT",
						hint: "ADMIN_H_TRUCK_ACCOUNT",
						placeholder: "ADMIN_P_ACCOUNT"
					},
					{
						widget: "model",
						kind: "vehicle",
						path: "truck.truckModel",
						label: "ADMIN_F_TRUCK_MODEL"
					},
					{
						widget: "model",
						kind: "ped",
						path: "truck.guardModel",
						label: "ADMIN_F_GUARD_MODEL"
					},
					{
						widget: "text",
						path: "truck.guardWeapon",
						label: "ADMIN_F_GUARD_WEAPON",
						hint: "ADMIN_H_GUARD_WEAPON",
						placeholder: "ADMIN_P_GUARD_WEAPON"
					},
					{
						widget: "number",
						path: "truck.lifetime",
						label: "ADMIN_F_TRUCK_LIFETIME",
						hint: "ADMIN_H_TRUCK_LIFETIME",
						min: 1,
						max: 240,
						unit: "min"
					},
					{
						widget: "number",
						path: "truck.plantSeconds",
						label: "ADMIN_F_TRUCK_PLANT",
						min: 1,
						max: 120,
						unit: "s"
					},
					{
						widget: "number",
						path: "truck.fuseSeconds",
						label: "ADMIN_F_TRUCK_FUSE",
						hint: "ADMIN_H_TRUCK_FUSE",
						min: 1,
						max: 120,
						unit: "s"
					},
					{
						widget: "number",
						path: "truck.lootSeconds",
						label: "ADMIN_F_TRUCK_LOOT",
						min: 1,
						max: 120,
						unit: "s"
					},
					{
						widget: "number",
						path: "truck.minPolice",
						label: "ADMIN_F_MIN_POLICE",
						min: 0,
						max: 32
					},
					{
						widget: "number",
						path: "truck.cooldown",
						label: "ADMIN_F_TRUCK_COOLDOWN",
						min: 1,
						max: 1440,
						unit: "min"
					},
					{
						widget: "text",
						path: "truck.item",
						label: "ADMIN_F_TRUCK_ITEM",
						hint: "ADMIN_H_TRUCK_ITEM",
						placeholder: "ADMIN_P_TRUCK_ITEM"
					},
					{
						widget: "number",
						path: "truck.cashMin",
						label: "ADMIN_F_CASH_MIN",
						min: 0,
						max: 1e6,
						unit: "$"
					},
					{
						widget: "number",
						path: "truck.cashMax",
						label: "ADMIN_F_CASH_MAX",
						min: 0,
						max: 1e6,
						unit: "$"
					},
					{
						widget: "list",
						path: "truck.spawns",
						label: "ADMIN_F_TRUCK_SPAWNS",
						addLabel: "ADMIN_ADD_TRUCK_SPAWN",
						max: 30,
						newRow: { coords: {
							x: 0,
							y: 0,
							z: 0,
							heading: 0
						} },
						rows: [{
							widget: "point",
							path: "coords",
							label: "ADMIN_F_TRUCK_SPAWN",
							heading: !0,
							ground: !0
						}]
					}
				]
			}]
		}
	]
}, core = resourceExport("ai-core"), panel = new AdminPanel(robberiesSchema), settings = panel.view("settings", readSettings), content = {
	get settings() {
		return settings.value;
	},
	places: panel.records("places", readPlace),
	targets: panel.records("targets", readTarget)
}, policeOnDuty = () => online.countOnDuty(content.settings.policeJobs), houses = new class {
	inside = new Map();
	worlds = new Map();
	insideOf(source) {
		return this.inside.get(source);
	}
	move(source, at, id) {
		let previous = this.inside.get(source);
		previous !== id && (previous && this.leave(previous), id && this.join(id)), id ? this.inside.set(source, id) : this.inside.delete(source), SetPlayerRoutingBucket(String(source), id ? this.worlds.get(id)?.bucket ?? 0 : 0), core.SetMeta(source, INSIDE_META, id), emitNet(EVENTS.inside, source, id, at);
	}
	join(id) {
		let world = this.worlds.get(id);
		world ? world.count++ : this.worlds.set(id, {
			bucket: buckets.acquire(`robbery:${id}`),
			count: 1
		});
	}
	leave(id) {
		let world = this.worlds.get(id);
		!world || --world.count > 0 || (this.worlds.delete(id), buckets.release(world.bucket));
	}
	enter(source, place) {
		place.interior && this.move(source, place.interior, place.id);
	}
	exit(source) {
		let place = content.places.get(this.inside.get(source) ?? "");
		return place ? (this.move(source, {
			...place.coords,
			heading: 0
		}, null), !0) : !1;
	}
	rejoin(source) {
		let id = core.GetMeta(source, INSIDE_META), place = typeof id == "string" ? content.places.get(id) : void 0;
		place && this.move(source, {
			...place.coords,
			heading: 0
		}, null);
	}
	forget(source) {
		let id = this.inside.get(source);
		id !== void 0 && (this.inside.delete(source), this.leave(id));
	}
	stop() {
		for (let source of this.inside.keys()) SetPlayerRoutingBucket(String(source), 0);
	}
}();
onClientCallback(EVENTS.exit, (source) => {
	let place = content.places.get(houses.insideOf(source) ?? "");
	return !place?.interior || !isNear(source, place.interior, 3) ? fail("ROB_ERR_FAR") : houses.exit(source) ? { ok: !0 } : fail("ROB_ERR_FAR");
}, { lock: !0 }), onCharacter({
	loaded: (source) => houses.rejoin(source),
	unloaded: (source) => houses.forget(source)
}), onStop(() => houses.stop());
// resource/server/truck.ts
const STEP_ANIMS = {
	plant: {
		dict: "anim@heists@ornate_bank@thermal_charge",
		clip: "thermal_charge"
	},
	loot: {
		dict: "anim@heists@ornate_bank@grab_cash",
		clip: "grab"
	}
};
function rearOf(vehicle) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(vehicle), h = GetEntityHeading(vehicle) * Math.PI / 180;
	return {
		x: x + Math.sin(h) * 4,
		y: y - Math.cos(h) * 4,
		z
	};
}
const truck = new class {
	vehicle = 0;
	guards = [];
	strays = [];
	attacking = new Set();
	known = new Set();
	open = !1;
	planted = !1;
	looted = !1;
	nextAllowed = 0;
	watcher = every(2e3, () => this.guard(), {
		active: !1,
		name: "truckGuards"
	});
	ender = null;
	starting = !1;
	get active() {
		return this.starting || this.vehicle !== 0 && DoesEntityExist(this.vehicle);
	}
	get waitMs() {
		return Math.max(0, this.nextAllowed - Date.now());
	}
	async spawn(source) {
		this.starting = !0;
		try {
			return await this.create(source);
		} finally {
			this.starting = !1;
		}
	}
	async create(source) {
		let s = content.settings.truck, at = pickRandom(s.spawns);
		if (!at) return !1;
		this.nextAllowed = Date.now() + s.cooldown * 6e4;
		let vehicle = await spawnVehicle({
			model: s.truckModel,
			type: "automobile",
			coords: at,
			locked: !0
		});
		if (vehicle === null) return !1;
		this.vehicle = vehicle, this.open = !1, this.planted = !1, this.looted = !1;
		let h = at.heading * Math.PI / 180;
		for (let side of [-1, 1]) {
			let guard = CreatePed(4, GetHashKey(s.guardModel), at.x + Math.cos(h) * 2.2 * side, at.y + Math.sin(h) * 2.2 * side, at.z, at.heading, !0, !0);
			await waitFor(() => DoesEntityExist(guard) || void 0, 5e3).catch(() => !1) ? (SetEntityOrphanMode(guard, 2), GiveWeaponToPed(guard, GetHashKey(s.guardWeapon), 250, !1, !0), SetPedArmour(guard, 100), this.guards.push(guard)) : this.strays.push(guard);
		}
		return this.watcher.set(!0), this.ender = setTimeout(() => this.end(), s.lifetime * 6e4), this.tell(source, !0), !0;
	}
	tell(source, job) {
		if (this.known.has(source) && !job) return;
		this.known.add(source);
		let rear = rearOf(this.vehicle);
		emitNet(EVENTS.truckJob, source, NetworkGetNetworkIdFromEntity(this.vehicle), rear.x, rear.y, rear.z);
	}
	guard() {
		if (!this.active) return this.end();
		this.dropStrays();
		for (let source of playersNearEntity(this.vehicle, 40)) for (let guard of this.guards) this.attacking.has(guard) || !DoesEntityExist(guard) || GetEntityHealth(guard) <= 100 || (TaskCombatPed(guard, GetPlayerPed(String(source)), 0, 16), this.attacking.add(guard));
	}
	dropStrays() {
		if (this.strays.length !== 0) {
			for (let ped of this.strays) DoesEntityExist(ped) && DeleteEntity(ped);
			this.strays = this.strays.filter((ped) => !DoesEntityExist(ped));
		}
	}
	guardsDown() {
		return this.guards.every((g) => !DoesEntityExist(g) || GetEntityHealth(g) <= 100);
	}
	atRear(source) {
		return this.active && isNear(source, rearOf(this.vehicle), 3);
	}
	async step(source, kind, seconds) {
		return await progressFor(source, {
			label: Locale(kind === "loot" ? "ROB_TRUCK_LOOTING" : "ROB_TRUCK_PLANTING"),
			duration: seconds * 1e3,
			anim: STEP_ANIMS[kind],
			face: rearOf(this.vehicle)
		}) && this.atRear(source);
	}
	get isOpen() {
		return this.open;
	}
	get isLooted() {
		return this.looted;
	}
	get isPlanted() {
		return this.planted;
	}
	blow(fuseMs) {
		this.planted = !0;
		let vehicle = this.vehicle;
		setTimeout(() => {
			if (!this.active || this.vehicle !== vehicle) return;
			SetVehicleDoorBroken(this.vehicle, 2, !1), SetVehicleDoorBroken(this.vehicle, 3, !1), this.open = !0;
			for (let source of playersNearEntity(this.vehicle, 100)) this.tell(source, !1);
			let netId = NetworkGetNetworkIdFromEntity(this.vehicle);
			for (let source of this.known) emitNet(EVENTS.truckOpen, source, netId);
		}, fuseMs);
	}
	loot() {
		this.looted = !0, this.ender && clearTimeout(this.ender), this.ender = setTimeout(() => this.end(), 6e4);
	}
	end() {
		this.watcher.set(!1), this.ender && clearTimeout(this.ender), this.ender = null;
		for (let entity of [
			this.vehicle,
			...this.guards,
			...this.strays
		]) entity && DoesEntityExist(entity) && DeleteEntity(entity);
		for (let source of this.known) emitNet(EVENTS.truckEnd, source);
		this.vehicle = 0, this.planted = !1, this.guards = [], this.strays = [], this.attacking.clear(), this.known.clear();
	}
}();
onClientCallback(EVENTS.truckStart, async (source) => {
	let s = content.settings.truck;
	return s.giver.x === 0 && s.giver.y === 0 || !isNear(source, s.giver, 3) ? fail("ROB_ERR_FAR") : truck.active ? fail("ROB_ERR_TRUCK_BUSY") : truck.waitMs > 0 ? fail("ROB_ERR_TRUCK_WAIT") : policeOnDuty() < s.minPolice ? fail("ROB_ERR_POLICE") : s.spawns.length === 0 ? fail("ROB_ERR_FAR") : core.RemoveMoney(source, s.account, s.price, "robbery:truck") ? await truck.spawn(source) ? (aiLog("robberies", "armored truck job", { source }), { ok: !0 }) : (core.AddMoney(source, s.account, s.price, "robbery:truck:refund"), fail("ROB_ERR_FAR")) : fail("ROB_ERR_MONEY");
}, { lock: !0 }), onClientCallback(EVENTS.truckPlant, (source) => !truck.atRear(source) || truck.isOpen ? fail("ROB_ERR_FAR") : truck.isPlanted ? fail("ROB_ERR_BUSY") : truck.guardsDown() ? inventory.hasItem(source, content.settings.truck.item) ? (plant(source), { ok: !0 }) : fail("ROB_ERR_ITEM") : fail("ROB_ERR_GUARDS"), { lock: !0 });
async function plant(source) {
	let s = content.settings.truck;
	if (!(!await truck.step(source, "plant", s.plantSeconds) || truck.isOpen || truck.isPlanted)) {
		if (!inventory.removeItem(source, s.item, 1)) return notify(source, Locale("ROB_ERR_ITEM"), "error");
		dispatch.alert({
			code: "10-90",
			title: Locale("ROB_TRUCK_ALERT"),
			coords: coordsOf(source),
			source,
			icon: "truck",
			blip: {
				sprite: 67,
				color: 1
			},
			priority: "high"
		}), notify(source, Locale("ROB_TRUCK_FUSE"), "warning", s.fuseSeconds * 1e3), truck.blow(s.fuseSeconds * 1e3);
	}
}
onClientCallback(EVENTS.truckLoot, (source) => !truck.atRear(source) || !truck.isOpen ? fail("ROB_ERR_FAR") : truck.isLooted ? fail("ROB_ERR_EMPTY") : (loot(source), { ok: !0 }), { lock: !0 });
async function loot(source) {
	let s = content.settings.truck;
	if (!await truck.step(source, "loot", s.lootSeconds)) return;
	if (truck.isLooted) return notify(source, Locale("ROB_ERR_EMPTY"), "error");
	truck.loot();
	let cash = randomInt(s.cashMin, s.cashMax);
	core.AddMoney(source, content.settings.account, cash, "robbery:truck"), notify(source, Locale("ROB_CASH", cash), "success"), aiLog("robberies", "armored truck looted", {
		source,
		metadata: { cash }
	});
}
onStop(() => truck.end());
// resource/server/index.ts
const robbed = new GlobalGroup("rob:", stateBoolean);
aiLogChannels({ robberies: {} });
const UNARMED = GetHashKey("WEAPON_UNARMED");
for (let id of content.targets.keys()) robbed.get(id) === !0 && robbed.set(id, !1);
const robberies = new class {
	runs = new PlayerMap();
	busy = new Map();
	alerted = new KeyedCooldowns();
	taken(target, source) {
		let claim = this.busy.get(target.id);
		return !claim || claim.source === source ? !1 : GetGameTimer() < claim.until && this.runs.get(claim.source) === target;
	}
	async run(source, target) {
		this.busy.set(target.id, {
			source,
			until: GetGameTimer() + target.seconds * 2e3 + 135e3
		}), this.runs.set(source, target);
		let done = await this.minigame(source, target) && await progressFor(source, {
			label: Locale("ROB_WORKING"),
			duration: target.seconds * 1e3,
			anim: ANIMS[target.kind],
			face: target.coords
		});
		return this.runs.get(source) === target && this.runs.delete(source), this.busy.get(target.id)?.source === source && this.busy.delete(target.id), done;
	}
	async minigame(source, target) {
		let game = target.minigame === "auto" ? AUTO_MINIGAME[target.kind] : target.minigame;
		if (game === "none") return !0;
		let outcome = await minigameFor(source, {
			game,
			difficulty: target.difficulty
		});
		return outcome === "won" || (outcome === "broken" && target.item ? (inventory.removeItem(source, target.item, 1), notify(source, Locale("ROB_PICK_BROKE"), "error")) : notify(source, Locale("ROB_MINIGAME_LOST"), "warning"), !1);
	}
	shouldAlert(placeId, minutes) {
		return this.alerted.take(placeId, minutes * 6e4);
	}
}();
onClientCallback(EVENTS.start, {
	args: oneArg((v) => readText(v, 64)),
	lock: !0
}, (source, id) => {
	let target = content.targets.get(id), place = target ? content.places.get(target.place) : void 0;
	return !target || !place || !isNear(source, target.coords, 2.5) || place.interior && target.kind !== "entry" && houses.insideOf(source) !== place.id ? fail("ROB_ERR_FAR") : target.kind === "entry" && robbed.get(id) === !0 ? (houses.enter(source, place), {
		ok: !0,
		entered: !0
	}) : robbed.get(id) === !0 ? fail("ROB_ERR_EMPTY") : robberies.taken(target, source) ? fail("ROB_ERR_BUSY") : policeOnDuty() < place.minPolice ? fail("ROB_ERR_POLICE") : target.item && !inventory.hasItem(source, target.item) ? fail("ROB_ERR_ITEM") : target.kind === "vitrine" && GetSelectedPedWeapon(GetPlayerPed(String(source))) === UNARMED ? fail("ROB_ERR_WEAPON") : (place.alertChance > 0 && robberies.shouldAlert(place.id, place.cooldown) && rollChance(place.alertChance) && dispatch.alert({
		code: "10-90",
		title: Locale("ROB_ALERT"),
		message: place.label,
		coords: place.coords,
		source,
		icon: "sack-dollar",
		priority: "high"
	}), rob(source, target), { ok: !0 });
});
async function rob(source, target) {
	if (!await robberies.run(source, target)) return;
	let place = content.places.get(target.place);
	if (!place || !isNear(source, target.coords, 3)) return;
	if (robbed.get(target.id) === !0) return notify(source, Locale("ROB_ERR_EMPTY"), "error");
	if (target.item && target.consume && !inventory.removeItem(source, target.item, 1)) return notify(source, Locale("ROB_ERR_ITEM"), "error");
	if (robbed.set(target.id, !0), setTimeout(() => robbed.set(target.id, !1), place.cooldown * 6e4), target.kind === "entry" && houses.enter(source, place), target.kind === "door" && target.door) {
		let door = target.door;
		doors.setLocked(door, !1, source), setTimeout(() => doors.setLocked(door, !0), place.cooldown * 6e4);
	}
	let cash = target.cashMax > 0 ? randomInt(target.cashMin, target.cashMax) : 0;
	cash > 0 && core.AddMoney(source, content.settings.account, cash, `robbery:${place.id}`);
	let count = target.reward ? randomInt(target.rewardMin, target.rewardMax) : 0;
	count > 0 && !inventory.addItem(source, target.reward, count) && notify(source, Locale("ROB_NO_ROOM"), "warning"), cash > 0 && notify(source, Locale("ROB_CASH", cash), "success"), aiLog("robberies", `robbed ${target.id}`, {
		source,
		metadata: {
			place: place.id,
			cash,
			reward: target.reward,
			count
		}
	});
}
