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
function waitFor(check, timeoutMs = 1e4) {
	return new Promise((resolve, reject) => {
		let started = Date.now(), poll = () => {
			let value = check();
			if (value !== void 0) return resolve(value);
			if (timeoutMs !== !1 && Date.now() - started > timeoutMs) return reject(Error(`waitFor timed out after ${timeoutMs} ms`));
			setTimeout(poll, 0);
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
// ../../../packages/lib/src/shared/index.ts
function isRecord(value) {
	return typeof value == "object" && !!value && !Array.isArray(value);
}
function logSafe(text, max) {
	return text.replace(/\r?\n/g, " | ").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\^\d/g, "").slice(0, max);
}
function formatText(template, args) {
	return template.replace(/\{(\d+)\}/g, (match, index) => {
		let value = args[Number(index)];
		return value === void 0 ? match : String(value);
	});
}
const asArgs = (value) => value === null ? null : [value];
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
	characterScreenEvent: "ai-core:characterScreen",
	inventoryChangedEvent: "ai-core:inventoryChanged",
	itemUsedEvent: "ai-core:itemUsed",
	playerDiedEvent: "ai-core:playerDied",
	clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
	clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
	clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
	clientCharacterLookEvent: "ai-core:client:characterLook",
	clientPromptPressedEvent: "ai-core:client:promptPressed",
	clientCacheEvent: "ai-core:client:cache",
	clientHudVisibleEvent: "ai-core:client:hudVisible",
	vehicleTypeCallback: "ai-core:vehicleType",
	interactionStateKey: "ai:interaction",
	charactersCallback: "ai-core:characters",
	createCharacterCallback: "ai-core:createCharacter",
	deleteCharacterCallback: "ai-core:deleteCharacter",
	selectCharacterCallback: "ai-core:selectCharacter",
	clientNotifyEvent: "ai-core:client:notify",
	spawnEvent: "ai-core:client:spawn",
	openCharactersEvent: "ai-core:client:openCharacters"
}, ADMIN = {
	ace: "ai.admin",
	openCallback: "ai-core:admin:open",
	applyCallback: "ai-core:admin:apply",
	closeEvent: "ai-core:admin:close",
	showEvent: "ai-core:admin:show",
	deltaEvent: "ai-core:admin:delta",
	worldEvent: (resource) => `${resource}:admin:world`,
	worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
}, VEHICLE_BAGS = {
	owned: "ai:owned",
	id: "ai:vid",
	props: "ai:props",
	fuel: "fuel"
};
// ../../../packages/lib/src/fivem/exports.ts
function registerExport(name, handler) {
	globalThis.exports(name, handler);
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
resourceExport(CORE.resource);
const log$4 = createLogger(GetCurrentResourceName()), gates = new Set();
on("playerDropped", () => {
	let source = Number(globalThis.source);
	for (let gate of gates) gate.release(source);
});
var ClientGate = class {
	name;
	options;
	limit;
	lock;
	constructor(name, options, defaultRate) {
		this.name = name, this.options = options, this.limit = new RateLimit(options.rate?.count ?? defaultRate, options.rate?.windowMs ?? 1e3), this.lock = options.lock ? new SourceLock() : null, gates.add(this);
	}
	check(source, raw) {
		if (!(source > 0) || !GetPlayerName(String(source)) || !this.limit.take(source)) return null;
		for (let guard of this.options.guards ?? []) {
			let verdict = guard(source);
			if (verdict !== !0) return typeof verdict == "string" && this.refuse(source, verdict), null;
		}
		if (!this.options.args) return [];
		let args = this.options.args(raw);
		return args === null && this.refuse(source, `invalid arguments ${logSafe(JSON.stringify(raw) ?? "", 200)}`), args;
	}
	run(source, busy, task) {
		return this.lock ? this.lock.run(source, busy, async () => task()) : Promise.resolve(task());
	}
	release(source) {
		this.limit.release(source), this.lock?.release(source);
	}
	refuse(source, reason) {
		log$4.warn(`${this.name} refused for ${GetPlayerName(String(source))} (${source}): ${reason}`);
	}
};
// ../../../packages/lib/src/server/callback.ts
const log$3 = createLogger(GetCurrentResourceName()), resource$1 = GetCurrentResourceName(), REFUSED = Symbol("refused");
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
			log$3.error(`callback ${name} failed for ${source}`, error), emitNet(responseEvent(caller), source, id, !1, null);
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
const clone = (value) => value === void 0 ? value : JSON.parse(JSON.stringify(value)), core$6 = resourceExport(CORE.resource), ERR = {
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
			list = core$6.GetLookupValues(source);
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
const core$5 = resourceExport(CORE.resource), DEFAULT_KEY = "^[a-z0-9_]{2,32}$";
function imported(spec, value) {
	let base = clone(spec.newRecord ?? {}), out = {};
	for (let name of Object.keys(spec.sections)) {
		let v = name in value ? value[name] : base[name];
		v !== void 0 && (out[name] = clone(v));
	}
	return out;
}
var AdminPanel = class {
	schema;
	data = new Map();
	dataFiles = new Map();
	handlers = new Map();
	rules = new Map();
	worldChanges = new Map();
	resource = GetCurrentResourceName();
	log = createLogger(this.resource);
	constructor(schema) {
		this.schema = schema;
		for (let [name, spec] of Object.entries(schema.files)) this.load(name, spec);
		registerExport("AdminPanelSnapshot", () => this.snapshot()), registerExport("AdminPanelApply", (admin, patch) => this.apply(admin, patch)), onClientCallback(ADMIN.worldChangesCallback(this.resource), () => Object.fromEntries(this.worldChanges)), setImmediate(() => core$5.RegisterAdminPanel(this.resource));
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
	snapshot() {
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data: clone(Object.fromEntries(this.data))
		};
	}
	apply(admin, raw) {
		let patch = toPatch(raw), spec = patch ? this.schema.files[patch.file] : void 0;
		if (!patch || !spec || spec.memory) return {
			ok: !1,
			error: ERR.type
		};
		let error = this.check(patch, spec);
		return error ? (this.log.warn(`admin ${admin} edit refused (${error}): ${JSON.stringify(patch).slice(0, 300)}`), {
			ok: !1,
			error
		}) : (this.store(patch, spec), { ok: !0 });
	}
	commit(file, key, value) {
		let data = this.data.get(file);
		data && (key === void 0 ? isRecord(value) && this.data.set(file, clone(value)) : value === null ? delete data[key] : data[key] = clone(value), this.changed(file, key));
	}
	check(patch, spec) {
		let data = this.get(patch.file);
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
				}
				let ruled = this.rules.get(patch.file)?.(key, record);
				if (ruled) return ruled;
			}
			return null;
		}
		let section = spec.sections[patch.section];
		if (!section || spec.kind === "records" && (!patch.key || !(patch.key in data))) return ERR.type;
		let refusal = validate(section, patch.value, patch.section);
		if (refusal) return refusal.error;
		let current = spec.kind === "records" ? data[patch.key ?? ""] : data, next = {
			...isRecord(current) ? current : {},
			[patch.section]: patch.value
		};
		return this.rules.get(patch.file)?.(patch.key, next) ?? null;
	}
	store(patch, spec) {
		let data = this.data.get(patch.file) ?? {};
		if (patch.action === "create") {
			let record = clone(spec.newRecord ?? {});
			spec.labelPath && (record[spec.labelPath] = patch.label), data[patch.key] = record;
		} else if (patch.action === "delete") delete data[patch.key];
		else if (patch.action === "import") {
			for (let [key, value] of Object.entries(patch.records)) data[key] = imported(spec, value);
			this.data.set(patch.file, data);
			for (let key of Object.keys(patch.records)) this.changed(patch.file, key);
			return;
		} else {
			let target = spec.kind === "records" ? data[patch.key ?? ""] : data;
			if (!isRecord(target)) return;
			patch.value === void 0 || patch.value === null ? delete target[patch.section] : target[patch.section] = clone(patch.value);
		}
		this.data.set(patch.file, data), this.changed(patch.file, spec.kind === "records" ? patch.key : void 0);
	}
	changed(file, key) {
		let spec = this.schema.files[file], data = this.get(file), value = key === void 0 ? data : data[key] ?? null;
		this.dataFiles.get(file)?.write(data);
		for (let handler of this.handlers.get(file) ?? []) handler(key, value);
		if (core$5.AdminPanelChanged({
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
	emitNet(CORE.clientNotifyEvent, source, notification);
}
// ../../../packages/lib/src/server/inventory.ts
const core$4 = resourceExport(CORE.resource), inventory = {
	addItem: (inv, item, count = 1, metadata, slot) => core$4.AddItem(inv, item, count, metadata, slot),
	removeItem: (inv, item, count = 1, metadata, slot) => core$4.RemoveItem(inv, item, count, metadata, slot),
	getItemCount: (inv, item, metadata) => core$4.GetItemCount(inv, item, metadata),
	hasItem: (inv, item, count = 1) => core$4.HasItem(inv, item, count),
	canCarryItem: (inv, item, count = 1, metadata) => core$4.CanCarryItem(inv, item, count, metadata),
	getItems: (inv) => core$4.GetItems(inv),
	clearInventory: (inv) => core$4.ClearInventory(inv),
	registerStash: (name, label, slots, maxWeight, jobs = []) => core$4.RegisterStash(name, label, slots, maxWeight, jobs),
	openInventory: (source, inv) => core$4.OpenInventory(source, inv),
	registerUsableItem: (name, handler) => core$4.RegisterUsableItem(name, handler),
	getItemDefinition: (name) => core$4.GetItemDefinition(name)
}, core$3 = resourceExport(CORE.resource);
var OnlinePlayers = class {
	players = new Map();
	onDuty = new Map();
	started = !1;
	start() {
		if (this.started) return;
		this.started = !0;
		let load = (source, character) => {
			this.put(source, character, (core$3.GetJobs(source) ?? []).map((m) => m.job), (core$3.GetGangs(source) ?? []).map((m) => m.gang)), this.setDuty(source, core$3.GetDutyJob(source));
		};
		on(CORE.playerLoadedEvent, load), on(CORE.playerUnloadedEvent, (source) => this.drop(source)), on(CORE.jobsChangedEvent, (source, jobs) => {
			let player = this.players.get(source);
			player && (player.jobs = jobs.map((m) => m.job));
		}), on(CORE.gangsChangedEvent, (source, gangs) => {
			let player = this.players.get(source);
			player && (player.gangs = gangs.map((m) => m.gang));
		}), on(CORE.dutyChangedEvent, (source, job) => this.setDuty(source, job));
		for (let source of core$3.GetLoadedSources()) {
			let character = core$3.GetCharacter(source);
			character && load(source, character);
		}
	}
	put(source, character, jobs, gangs) {
		this.drop(source), this.players.set(source, {
			character,
			jobs,
			gangs,
			duty: null
		});
	}
	drop(source) {
		this.setDuty(source, null), this.players.delete(source);
	}
	setDuty(source, job) {
		let player = this.players.get(source);
		if (!player || (player.duty && this.onDuty.get(player.duty)?.delete(source), player.duty = job, !job)) return;
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
	jobs(source) {
		return this.start(), this.players.get(source)?.jobs ?? [];
	}
	gangs(source) {
		return this.start(), this.players.get(source)?.gangs ?? [];
	}
	dutyJob(source) {
		return this.start(), this.players.get(source)?.duty ?? null;
	}
	onDutyFor(job) {
		return this.start(), this.onDuty.get(job) ?? EMPTY;
	}
};
const EMPTY = new Set();
new OnlinePlayers();
// ../../../packages/lib/src/server/vehicleKeys.ts
const core$2 = resourceExport(CORE.resource), vehicleKeys = {
	give: (source, vehicle, purpose = "temporary") => core$2.GiveVehicleKeys(source, vehicle, purpose),
	remove: (source, vehicle) => core$2.RemoveVehicleKeys(source, vehicle),
	has: (source, vehicle) => core$2.HasVehicleKeys(source, vehicle)
}, TYPES = new Set([
	"automobile",
	"bike",
	"boat",
	"heli",
	"plane",
	"submarine",
	"trailer",
	"train"
]), types = new Map();
async function vehicleType(model, asker) {
	let known = types.get(model);
	if (known !== void 0) return known;
	let answer = await triggerClientCallback(CORE.vehicleTypeCallback, asker, [model]).catch(() => null);
	return typeof answer != "string" || !TYPES.has(answer) ? null : (types.set(model, answer), answer);
}
async function spawnVehicle(options) {
	let type = options.asker === void 0 ? options.type ?? "automobile" : await vehicleType(options.model, options.asker);
	if (!type) return null;
	let { x, y, z, heading } = options.coords, vehicle = CreateVehicleServerSetter(GetHashKey(options.model), type, x, y, z, heading);
	if (!await waitFor(() => DoesEntityExist(vehicle) || void 0, 5e3).catch(() => !1)) return null;
	options.persistent !== !1 && SetEntityOrphanMode(vehicle, 2), options.plate && SetVehicleNumberPlateText(vehicle, options.plate.slice(0, 8));
	let state = Entity(vehicle).state;
	options.fuel !== void 0 && state.set(VEHICLE_BAGS.fuel, options.fuel, !0);
	for (let [key, value] of Object.entries(options.bags ?? {})) state.set(key, value, !0);
	return options.driver !== void 0 && SetPedIntoVehicle(GetPlayerPed(String(options.driver)), vehicle, -1), options.keysTo !== void 0 && vehicleKeys.give(options.keysTo, vehicle, options.purpose ?? "temporary"), vehicle;
}
// ../../../packages/lib/src/server/proximity.ts
const core$1 = resourceExport(CORE.resource), posOf = (source) => {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
	return {
		x,
		y,
		z
	};
};
function within(point, radius, candidates) {
	let out = [];
	for (let source of candidates) {
		let p = posOf(source);
		Math.hypot(p.x - point.x, p.y - point.y, p.z - point.z) <= radius && out.push(source);
	}
	return out;
}
function playersNearEntity(entity, radius) {
	if (!DoesEntityExist(entity)) return [];
	let owner = NetworkGetEntityOwner(entity);
	if (owner <= 0) return [];
	let [x = 0, y = 0, z = 0] = GetEntityCoords(entity);
	return within({
		x,
		y,
		z
	}, radius, [owner, ...core$1.GetPlayersInScope(owner)]);
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
// resource/common/locale.ts
const Locale = createLocale(), ResourceName = GetCurrentResourceName();
IsDuplicityVersion();
// resource/common/robbery.ts
const EVENTS = {
	start: "ai-robberies:start",
	finish: "ai-robberies:finish",
	exit: "ai-robberies:exit",
	inside: "ai-robberies:client:inside",
	truckStart: "ai-robberies:truckStart",
	truckJob: "ai-robberies:client:truckJob",
	truckPlant: "ai-robberies:truckPlant",
	truckPlanted: "ai-robberies:truckPlanted",
	truckOpen: "ai-robberies:client:truckOpen",
	truckLoot: "ai-robberies:truckLoot",
	truckLooted: "ai-robberies:truckLooted",
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
	let v = record(raw), jobs = Array.isArray(v.policeJobs) ? v.policeJobs.filter((j) => typeof j == "string") : [], t = record(v.truck), cashMin = int(t.cashMin, 2e3, 0);
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
	let out = new Map();
	for (let [id, value] of Object.entries(record(raw))) {
		let v = record(value);
		out.set(id, {
			id,
			label: str(v.label, id, 48),
			coords: point(v.coords),
			minPolice: int(v.minPolice, 0, 0, 32),
			cooldown: int(v.cooldown, 30, 1, 1440),
			alertChance: int(v.alertChance, 100, 0, 100),
			blip: bool(v.blip, !1),
			interior: optional4(v.interior)
		});
	}
	return out;
}
function readTargets(raw) {
	let out = new Map();
	for (let [id, value] of Object.entries(record(raw))) {
		let v = record(value), cashMin = int(v.cashMin, 0, 0, 1e6), rewardMin = int(v.rewardMin, 0, 0, 100);
		out.set(id, {
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
			vaultOpen: num(v.vaultOpen, 0, -720, 720)
		});
	}
	return out;
}
// resource/server/schema.ts
const robberiesSchema = {
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
				truck: {
					type: "object",
					fields: {
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
				vaultOpen: 0
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
				fields: [{
					widget: "tags",
					lookup: "job",
					path: "policeJobs",
					label: "ADMIN_F_POLICE_JOBS",
					hint: "ADMIN_H_POLICE_JOBS",
					placeholder: "ADMIN_P_POLICE_JOBS"
				}, {
					widget: "text",
					lookup: "account",
					path: "account",
					label: "ADMIN_F_ACCOUNT",
					hint: "ADMIN_H_ACCOUNT",
					placeholder: "ADMIN_P_ACCOUNT"
				}]
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
}, core = resourceExport("ai-core"), panel = new AdminPanel(robberiesSchema), content = {
	settings: readSettings(panel.get("settings")),
	places: readPlaces(panel.get("places")),
	targets: readTargets(panel.get("targets"))
};
panel.onChange("settings", () => content.settings = readSettings(panel.get("settings"))), panel.onChange("places", () => content.places = readPlaces(panel.get("places"))), panel.onChange("targets", () => content.targets = readTargets(panel.get("targets")));
const fail = (error) => ({
	ok: !1,
	error
}), random = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
function pos(source) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
	return {
		x,
		y,
		z
	};
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), near = (source, at, metres) => distance(pos(source), at) <= metres, policeOnDuty = () => content.settings.policeJobs.reduce((sum, job) => sum + core.GetOnDutyCount(job), 0), houses = new class {
	inside = new Map();
	buckets = new Map();
	bucketOf(id) {
		let bucket = this.buckets.get(id);
		return bucket === void 0 && (bucket = 7e3 + this.buckets.size, this.buckets.set(id, bucket), SetRoutingBucketPopulationEnabled(bucket, !1), SetRoutingBucketEntityLockdownMode(bucket, "strict")), bucket;
	}
	insideOf(source) {
		return this.inside.get(source);
	}
	move(source, at, bucket, id) {
		let ped = GetPlayerPed(String(source));
		SetPlayerRoutingBucket(String(source), bucket), SetEntityCoords(ped, at.x, at.y, at.z, !1, !1, !1, !1), SetEntityHeading(ped, at.heading), id ? this.inside.set(source, id) : this.inside.delete(source), core.SetMeta(source, INSIDE_META, id), emitNet(EVENTS.inside, source, id);
	}
	enter(source, place) {
		place.interior && this.move(source, place.interior, this.bucketOf(place.id), place.id);
	}
	exit(source) {
		let place = content.places.get(this.inside.get(source) ?? "");
		return place ? (this.move(source, {
			...place.coords,
			heading: 0
		}, 0, null), !0) : !1;
	}
	rejoin(source) {
		let id = core.GetMeta(source, INSIDE_META), place = typeof id == "string" ? content.places.get(id) : void 0;
		place && this.move(source, {
			...place.coords,
			heading: 0
		}, 0, null);
	}
	drop(source) {
		this.inside.delete(source);
	}
}();
onClientCallback(EVENTS.exit, (source) => {
	let place = content.places.get(houses.insideOf(source) ?? "");
	if (!place?.interior) return fail("ROB_ERR_FAR");
	let [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
	return Math.hypot(x - place.interior.x, y - place.interior.y, z - place.interior.z) > 3 ? fail("ROB_ERR_FAR") : houses.exit(source) ? { ok: !0 } : fail("ROB_ERR_FAR");
}, { lock: !0 }), on(CORE.playerLoadedEvent, (source) => houses.rejoin(source)), on("playerDropped", () => houses.drop(Number(globalThis.source)));
// resource/server/truck.ts
const FUSE_MS = 1e4;
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
	attacking = new Set();
	known = new Set();
	open = !1;
	looted = !1;
	nextAllowed = 0;
	watcher = null;
	ender = null;
	runs = new Map();
	nextToken = 0;
	get active() {
		return this.vehicle !== 0 && DoesEntityExist(this.vehicle);
	}
	get waitMs() {
		return Math.max(0, this.nextAllowed - Date.now());
	}
	async spawn(source) {
		let s = content.settings.truck, at = s.spawns[random(0, s.spawns.length - 1)];
		if (!at) return !1;
		this.nextAllowed = Date.now() + s.cooldown * 6e4;
		let vehicle = await spawnVehicle({
			model: "stockade",
			type: "automobile",
			coords: at
		});
		if (vehicle === null) return !1;
		SetVehicleDoorsLocked(vehicle, 2), this.vehicle = vehicle, this.open = !1, this.looted = !1;
		let h = at.heading * Math.PI / 180;
		for (let side of [-1, 1]) {
			let guard = CreatePed(4, GetHashKey("s_m_m_security_01"), at.x + Math.cos(h) * 2.2 * side, at.y + Math.sin(h) * 2.2 * side, at.z, at.heading, !0, !0);
			await waitFor(() => DoesEntityExist(guard) || void 0, 5e3).catch(() => !1) && (SetEntityOrphanMode(guard, 2), GiveWeaponToPed(guard, GetHashKey("WEAPON_CARBINERIFLE"), 250, !1, !0), SetPedArmour(guard, 100), this.guards.push(guard));
		}
		return this.watcher = setInterval(() => this.guard(), 2e3), this.ender = setTimeout(() => this.end(), 12e5), this.tell(source, !0), !0;
	}
	tell(source, job) {
		if (this.known.has(source) && !job) return;
		this.known.add(source);
		let rear = rearOf(this.vehicle);
		emitNet(EVENTS.truckJob, source, NetworkGetNetworkIdFromEntity(this.vehicle), rear.x, rear.y, rear.z);
	}
	guard() {
		if (!this.active) return this.end();
		for (let source of playersNearEntity(this.vehicle, 40)) for (let guard of this.guards) this.attacking.has(guard) || !DoesEntityExist(guard) || GetEntityHealth(guard) <= 100 || (TaskCombatPed(guard, GetPlayerPed(String(source)), 0, 16), this.attacking.add(guard));
	}
	guardsDown() {
		return this.guards.every((g) => !DoesEntityExist(g) || GetEntityHealth(g) <= 100);
	}
	atRear(source) {
		return this.active && near(source, rearOf(this.vehicle), 3);
	}
	start(source, kind) {
		let token = ++this.nextToken;
		return this.runs.set(source, {
			token,
			kind,
			startedAt: Date.now()
		}), token;
	}
	take(source, token, kind, seconds) {
		let run = this.runs.get(source);
		return this.runs.delete(source), run !== void 0 && run.token === token && run.kind === kind && Date.now() - run.startedAt >= seconds * 800 && this.atRear(source);
	}
	get isOpen() {
		return this.open;
	}
	get isLooted() {
		return this.looted;
	}
	blow() {
		setTimeout(() => {
			if (!this.active) return;
			SetVehicleDoorBroken(this.vehicle, 2, !1), SetVehicleDoorBroken(this.vehicle, 3, !1), this.open = !0;
			for (let source of playersNearEntity(this.vehicle, 100)) this.tell(source, !1);
			let netId = NetworkGetNetworkIdFromEntity(this.vehicle);
			for (let source of this.known) emitNet(EVENTS.truckOpen, source, netId);
		}, FUSE_MS);
	}
	loot() {
		this.looted = !0, this.ender && clearTimeout(this.ender), this.ender = setTimeout(() => this.end(), 6e4);
	}
	end() {
		this.watcher && clearInterval(this.watcher), this.ender && clearTimeout(this.ender), this.watcher = null, this.ender = null;
		for (let entity of [this.vehicle, ...this.guards]) entity && DoesEntityExist(entity) && DeleteEntity(entity);
		for (let source of this.known) emitNet(EVENTS.truckEnd, source);
		this.vehicle = 0, this.guards = [], this.attacking.clear(), this.known.clear(), this.runs.clear();
	}
}();
onClientCallback(EVENTS.truckStart, async (source) => {
	let s = content.settings.truck;
	return s.giver.x === 0 && s.giver.y === 0 || !near(source, s.giver, 3) ? fail("ROB_ERR_FAR") : truck.active ? fail("ROB_ERR_TRUCK_BUSY") : truck.waitMs > 0 ? fail("ROB_ERR_TRUCK_WAIT") : policeOnDuty() < s.minPolice ? fail("ROB_ERR_POLICE") : s.spawns.length === 0 ? fail("ROB_ERR_FAR") : core.RemoveMoney(source, "bank", s.price, "robbery:truck") ? await truck.spawn(source) ? (aiLog("robberies", "armored truck job", { source }), { ok: !0 }) : (core.AddMoney(source, "bank", s.price, "robbery:truck:refund"), fail("ROB_ERR_FAR")) : fail("ROB_ERR_MONEY");
}, { lock: !0 }), onClientCallback(EVENTS.truckPlant, (source) => !truck.atRear(source) || truck.isOpen ? fail("ROB_ERR_FAR") : truck.guardsDown() ? inventory.hasItem(source, content.settings.truck.item) ? {
	ok: !0,
	token: truck.start(source, "plant"),
	seconds: 5
} : fail("ROB_ERR_ITEM") : fail("ROB_ERR_GUARDS"), { lock: !0 }), onClientCallback(EVENTS.truckPlanted, {
	args: ([token]) => asArgs(typeof token == "number" ? token : null),
	lock: !0
}, (source, token) => {
	if (!truck.take(source, token, "plant", 5) || truck.isOpen) return fail("ROB_ERR_FAR");
	if (!inventory.removeItem(source, content.settings.truck.item, 1)) return fail("ROB_ERR_ITEM");
	let p = pos(source);
	return optionalExport("ai-police")?.SendAlert(p.x, p.y, p.z, Locale("ROB_TRUCK_ALERT")), notify(source, Locale("ROB_TRUCK_FUSE"), "warning", FUSE_MS), truck.blow(), { ok: !0 };
}), onClientCallback(EVENTS.truckLoot, (source) => !truck.atRear(source) || !truck.isOpen ? fail("ROB_ERR_FAR") : truck.isLooted ? fail("ROB_ERR_EMPTY") : {
	ok: !0,
	token: truck.start(source, "loot"),
	seconds: 10
}, { lock: !0 }), onClientCallback(EVENTS.truckLooted, {
	args: ([token]) => asArgs(typeof token == "number" ? token : null),
	lock: !0
}, (source, token) => {
	if (!truck.take(source, token, "loot", 10) || truck.isLooted) return fail("ROB_ERR_EMPTY");
	truck.loot();
	let s = content.settings.truck, cash = random(s.cashMin, s.cashMax);
	return core.AddMoney(source, content.settings.account, cash, "robbery:truck"), notify(source, Locale("ROB_CASH", cash), "success"), aiLog("robberies", "armored truck looted", {
		source,
		metadata: { cash }
	}), { ok: !0 };
}), on("playerDropped", () => truck.runs.delete(Number(globalThis.source))), on("onResourceStop", (resource) => resource === ResourceName && truck.end());
// resource/server/index.ts
const robbed = new GlobalGroup("rob:", stateBoolean);
aiLogChannels({ robberies: {} });
const UNARMED = GetHashKey("WEAPON_UNARMED");
for (let id of content.targets.keys()) robbed.get(id) === !0 && robbed.set(id, !1);
const robberies = new class {
	runs = new Map();
	busy = new Map();
	alerted = new Map();
	nextToken = 0;
	start(source, target) {
		this.drop(source);
		let token = ++this.nextToken;
		return this.runs.set(source, {
			token,
			target,
			startedAt: Date.now()
		}), this.busy.set(target.id, source), token;
	}
	taken(target, source) {
		let by = this.busy.get(target.id);
		if (by === void 0 || by === source) return !1;
		let run = this.runs.get(by);
		return run !== void 0 && Date.now() - run.startedAt < target.seconds * 2e3 + 15e3;
	}
	take(source, token) {
		let run = this.runs.get(source);
		return !run || run.token !== token ? null : (this.drop(source), run);
	}
	drop(source) {
		let run = this.runs.get(source);
		run && this.busy.get(run.target.id) === source && this.busy.delete(run.target.id), this.runs.delete(source);
	}
	shouldAlert(placeId, minutes) {
		return (this.alerted.get(placeId) ?? 0) > Date.now() ? !1 : (this.alerted.set(placeId, Date.now() + minutes * 6e4), !0);
	}
}();
onClientCallback(EVENTS.start, {
	args: ([id]) => asArgs(typeof id == "string" ? id : null),
	lock: !0
}, (source, id) => {
	let target = content.targets.get(id), place = target ? content.places.get(target.place) : void 0;
	return !target || !place || !near(source, target.coords, 2.5) || place.interior && target.kind !== "entry" && houses.insideOf(source) !== place.id ? fail("ROB_ERR_FAR") : target.kind === "entry" && robbed.get(id) === !0 ? (houses.enter(source, place), {
		ok: !0,
		entered: !0
	}) : robbed.get(id) === !0 ? fail("ROB_ERR_EMPTY") : robberies.taken(target, source) ? fail("ROB_ERR_BUSY") : policeOnDuty() < place.minPolice ? fail("ROB_ERR_POLICE") : target.item && !inventory.hasItem(source, target.item) ? fail("ROB_ERR_ITEM") : target.kind === "vitrine" && GetSelectedPedWeapon(GetPlayerPed(String(source))) === UNARMED ? fail("ROB_ERR_WEAPON") : (place.alertChance > 0 && robberies.shouldAlert(place.id, place.cooldown) && Math.random() * 100 < place.alertChance && optionalExport("ai-police")?.SendAlert(place.coords.x, place.coords.y, place.coords.z, Locale("ROB_ALERT", place.label)), {
		ok: !0,
		token: robberies.start(source, target),
		seconds: target.seconds
	});
}), onClientCallback(EVENTS.finish, {
	args: ([token]) => asArgs(typeof token == "number" ? token : null),
	lock: !0
}, (source, token) => {
	let run = robberies.take(source, token);
	if (!run) return fail("ROB_ERR_FAR");
	let { target } = run, place = content.places.get(target.place);
	if (!place || Date.now() - run.startedAt < target.seconds * 800 || !near(source, target.coords, 3)) return fail("ROB_ERR_FAR");
	if (robbed.get(target.id) === !0) return fail("ROB_ERR_EMPTY");
	if (target.item && target.consume && !inventory.removeItem(source, target.item, 1)) return fail("ROB_ERR_ITEM");
	robbed.set(target.id, !0), setTimeout(() => robbed.set(target.id, !1), place.cooldown * 6e4), target.kind === "entry" && houses.enter(source, place), target.kind === "door" && target.door && (optionalExport("ai-doorlock")?.SetDoorState(target.door, !1), setTimeout(() => optionalExport("ai-doorlock")?.SetDoorState(target.door, !0), place.cooldown * 6e4));
	let cash = target.cashMax > 0 ? random(target.cashMin, target.cashMax) : 0;
	cash > 0 && core.AddMoney(source, content.settings.account, cash, `robbery:${place.id}`);
	let count = target.reward ? random(target.rewardMin, target.rewardMax) : 0;
	return count > 0 && !inventory.addItem(source, target.reward, count) && notify(source, Locale("ROB_NO_ROOM"), "warning"), cash > 0 && notify(source, Locale("ROB_CASH", cash), "success"), aiLog("robberies", `robbed ${target.id}`, {
		source,
		metadata: {
			place: place.id,
			cash,
			reward: target.reward,
			count
		}
	}), { ok: !0 };
}), on("playerDropped", () => robberies.drop(Number(globalThis.source)));
