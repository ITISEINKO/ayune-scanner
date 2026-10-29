const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { inflateRawSync, crc32 } = require("node:zlib");
const { mapLbyPanels } = require("./map-lby-panels.cjs");

const ORIGIN = "https://www.lbyerp.com";
const ROOT = path.resolve(__dirname, "../src/data/panel-locations");
const LIMIT = 64 * 1024 * 1024;
const sha = (data) => createHash("sha256").update(data).digest("hex");
const projectKey = (key) => assert(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(key), "Invalid project key");

function parseShareLink(input, now = Date.now()) {
	const url = new URL(input.trim());
	assert(url.origin === ORIGIN && url.pathname === "/" && !url.username && !url.password,
		"Use an https://www.lbyerp.com share link");
	const [route, query] = url.hash.slice(1).split("?");
	assert(route === "/cadVisitor", "Expected cadVisitor link");
	const params = new URLSearchParams(query);
	assert(params.getAll("token").length === 1, "Missing or duplicate share token");
	let data;
	try {
		const token = decodeURIComponent(params.get("token"));
		assert(token.length < 16384 && /^[A-Za-z0-9+/]+={0,2}$/.test(token));
		// Decode the supplied token using the public viewer's format; never generate or extend tokens.
		const key = "lby-temp-token-key-2024";
		const decoded = Buffer.from(token, "base64").toString("utf8");
		data = JSON.parse(decoded.split("").map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join(""));
	} catch { throw new Error("Invalid share token"); }
	assert(typeof data.orderId === "string" && /^\d{1,30}$/.test(data.orderId), "Invalid share order ID");
	assert(Number.isFinite(data.expireTime) && now <= data.expireTime, "Share link expired");
	assert(typeof data.endCustomerAddress === "string" && data.endCustomerAddress.trim(), "Missing project name in token");
	return { orderId: data.orderId, name: data.endCustomerAddress.trim() };
}

async function readRemote(url, label, signal) {
	const response = await fetch(url, { redirect: "error", signal });
	assert(response.ok, `${label}: HTTP ${response.status}`);
	const chunks = []; let size = 0;
	for await (const chunk of response.body) {
		size += chunk.length;
		assert(size <= LIMIT, `${label}: response exceeds 64 MiB`);
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

async function apiData(apiPath, label, signal) {
	const bytes = await readRemote(`${ORIGIN}/api/${apiPath}`, label, signal);
	let envelope;
	try { envelope = JSON.parse(bytes); } catch { throw new Error(`${label}: invalid JSON response`); }
	assert(envelope.code === 0 && envelope.data, `${label}: vendor rejected request (code ${envelope.code})`);
	return envelope.data;
}

function unzipModel(bytes, orderId) {
	let eocd = -1;
	for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) {
		if (bytes.readUInt32LE(at) === 0x06054b50 && at + 22 + bytes.readUInt16LE(at + 20) === bytes.length) { eocd = at; break; }
	}
	assert(eocd >= 0 && bytes.readUInt16LE(eocd + 4) === 0 && bytes.readUInt16LE(eocd + 6) === 0, "Invalid or split ZIP");
	const count = bytes.readUInt16LE(eocd + 10), start = bytes.readUInt32LE(eocd + 16);
	assert(count > 0 && count < 1000 && start + bytes.readUInt32LE(eocd + 12) === eocd, "Invalid ZIP directory");
	const candidates = []; let at = start;
	for (let i = 0; i < count; i++) {
		assert(at + 46 <= eocd && bytes.readUInt32LE(at) === 0x02014b50, "Invalid ZIP entry");
		const nameLength = bytes.readUInt16LE(at + 28), extra = bytes.readUInt16LE(at + 30), comment = bytes.readUInt16LE(at + 32);
		assert(at + 46 + nameLength + extra + comment <= eocd, "Truncated ZIP entry");
		const name = bytes.toString("utf8", at + 46, at + 46 + nameLength);
		if (name.endsWith(".json")) candidates.push({ name, flags: bytes.readUInt16LE(at + 8), method: bytes.readUInt16LE(at + 10),
			crc: bytes.readUInt32LE(at + 16), compressed: bytes.readUInt32LE(at + 20), size: bytes.readUInt32LE(at + 24), local: bytes.readUInt32LE(at + 42) });
		at += 46 + nameLength + extra + comment;
	}
	assert(candidates.length === 1 && candidates[0].name === `${orderId}.json`, "Expected one order JSON in ZIP");
	const entry = candidates[0];
	assert(!(entry.flags & 1) && [0, 8].includes(entry.method) && entry.size <= LIMIT, "Unsupported or oversized ZIP entry");
	assert(entry.local + 30 <= start && bytes.readUInt32LE(entry.local) === 0x04034b50, "Invalid ZIP local entry");
	const offset = entry.local + 30 + bytes.readUInt16LE(entry.local + 26) + bytes.readUInt16LE(entry.local + 28);
	assert(offset + entry.compressed <= start, "Truncated ZIP payload");
	const compressed = bytes.subarray(offset, offset + entry.compressed);
	const raw = entry.method === 8 ? inflateRawSync(compressed, { maxOutputLength: LIMIT }) : compressed;
	assert(raw.length === entry.size && crc32(raw) === entry.crc, "ZIP size/checksum mismatch");
	return raw;
}

async function fetchProject(link, key, signal = AbortSignal.timeout(240000), onProgress = (_stage) => {}) {
	projectKey(key);
	const source = parseShareLink(link);
	onProgress("downloading");
	const [panels, models] = await Promise.all([
		apiData(`erp/anyTenant/app/getPlankByOrderId/${source.orderId}`, "Panel lookup", signal),
		apiData(`cd/anyTenant/app/getByOrderId/${source.orderId}`, "Model lookup", signal),
	]);
	assert(Array.isArray(panels) && Object.keys(models).length === 1, "Expected panels and one model file");
	assert(panels.length, "LBY_NO_PANEL_DATA");
	const value = Object.values(models)[0];
	assert(typeof value === "string", "Unsupported model response");
	let raw;
	if (value.trimStart().startsWith("{")) raw = Buffer.from(value);
	else {
		const download = new URL(value);
		assert(download.protocol === "https:" && !download.username && !download.password &&
			["www.lbyerp.com", "ali-oss-lby.oss-cn-hangzhou.aliyuncs.com"].includes(download.hostname), "Unexpected model download host");
		raw = unzipModel(await readRemote(download.toString(), "Model download", signal), source.orderId);
	}
	onProgress("panels");
	const model = JSON.parse(raw);
	assert(String(model.value?.orderId) === source.orderId, "Model belongs to another order");
	assert(!model.value._V_, "Compressed CAD schema is not supported by this importer");
	assert(panels.every((panel) => String(panel.orderId) === source.orderId), "Panel belongs to another order");
	const { mapping, snapshot } = mapLbyPanels({ code: 0, data: panels }, model, true, () => onProgress("rooms"));
	const locations = `${JSON.stringify(snapshot)}\n`, mappingJson = `${JSON.stringify(mapping, null, 2)}\n`;
	const revision = sha(locations);
	const manifest = { projectKey: key, name: source.name, orderId: source.orderId, revision, version: snapshot.version,
		importedAt: new Date().toISOString(), panelCount: snapshot.panels.length, sourceModelSha256: sha(raw), mappingSha256: sha(mappingJson) };
	signal.throwIfAborted();
	return { manifest, locations, mappingJson };
}

async function importProject(link, key, root = ROOT) {
	const { manifest, locations, mappingJson } = await fetchProject(link, key);
	const { revision } = manifest;
	const parent = path.join(root, "imports", key), destination = path.join(parent, revision);
	fs.mkdirSync(parent, { recursive: true });
	if (fs.existsSync(destination)) {
		assert(sha(fs.readFileSync(path.join(destination, "locations.json"))) === revision, "Existing snapshot checksum mismatch");
		const previous = JSON.parse(fs.readFileSync(path.join(destination, "manifest.json")));
		assert(previous.orderId === manifest.orderId, "Existing version belongs to another order");
		return previous;
	}
	const pending = fs.mkdtempSync(path.join(parent, ".pending-"));
	try {
		fs.writeFileSync(path.join(pending, "locations.json"), locations, { flag: "wx" });
		fs.writeFileSync(path.join(pending, "mapping.json"), mappingJson, { flag: "wx" });
		fs.writeFileSync(path.join(pending, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
		fs.renameSync(pending, destination);
	} finally {
		assert(path.resolve(pending).startsWith(`${path.resolve(parent)}${path.sep}.pending-`), "Unsafe staging cleanup path");
		fs.rmSync(pending, { recursive: true, force: true });
	}
	return manifest;
}

function activateProject(key, revision, root = ROOT) {
	projectKey(key); assert(/^[a-f0-9]{64}$/.test(revision), "Invalid snapshot revision");
	const folder = path.join(root, "imports", key, revision);
	const manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json")));
	assert(manifest.projectKey === key && manifest.revision === revision, "Manifest mismatch");
	assert(sha(fs.readFileSync(path.join(folder, "locations.json"))) === revision &&
		sha(fs.readFileSync(path.join(folder, "mapping.json"))) === manifest.mappingSha256, "Snapshot checksum mismatch");
	const catalogPath = path.join(root, "catalog.json");
	const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath)) : {};
	assert(!catalog[key]?.orderId || catalog[key].orderId === manifest.orderId, "Project key already belongs to another order");
	catalog[key] = { name: manifest.name, orderId: manifest.orderId, version: manifest.version,
		snapshot: `imports/${key}/${revision}/locations.json`, mapping: `imports/${key}/${revision}/mapping.json` };
	// shortcut: activation is a single-operator CLI; add a file lock before concurrent writers are supported.
	const pending = `${catalogPath}.${process.pid}.tmp`;
	fs.writeFileSync(pending, `${JSON.stringify(catalog, null, 2)}\n`, { flag: "wx" });
	fs.renameSync(pending, catalogPath);
	return manifest;
}

module.exports = { parseShareLink, unzipModel, fetchProject, importProject, activateProject };
if (require.main === module) (async () => {
	const [command, key, revision] = process.argv.slice(2);
	assert(["import", "activate"].includes(command), "Usage: node scripts/import-lby-project.cjs import <project-key> | activate <project-key> <revision>");
	if (command === "activate") {
		const active = activateProject(key, revision);
		console.log(`Activated ${active.name}: /panel-location?project=${key}`);
		return;
	}
	let link;
	if (process.stdin.isTTY) {
		const prompt = require("node:readline/promises").createInterface({ input: process.stdin, output: process.stdout });
		try { link = await prompt.question("Paste LBY share link: "); } finally { prompt.close(); }
	} else { const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk); link = Buffer.concat(chunks).toString("utf8"); }
	const imported = await importProject(link, key);
	console.log(JSON.stringify(imported, null, 2));
	console.log(`Saved candidate; active viewer unchanged. Review it, then run:\nnode scripts/import-lby-project.cjs activate ${key} ${imported.revision}`);
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
