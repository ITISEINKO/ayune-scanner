// Run: node tests/panel-location-cache.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

async function main() {
	const module = { exports: {} }, reads = [], activeChecks = [];
	const catalog = { bundled: { name: "Bundled", snapshot: "bundled.json", mapping: "mapping.json", version: "bundle-v1" } };
	const snapshot = { version: "bundle-v1", panels: [{ barcode: "001", roomName: "Room" }] };
	let stored = { metadata: { projectKey: "online", name: "Online", versionNumber: 2 }, snapshot: { version: "online-v2", panels: [{ barcode: "002", roomName: "Room" }] } };
	let override = null, failRead = true;
	runInNewContext(ts.transpileModule(readFileSync("src/lib/panelLocationSnapshot.ts", "utf8"), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
	}).outputText, {
		module, exports: module.exports, process,
		require: (id) => {
			if (id === "node:path") return require(id);
			if (id === "node:fs/promises") return { readFile: async (file) => {
				reads.push(file);
				if (failRead) throw new Error("Temporary read failure");
				return JSON.stringify(file.endsWith("mapping.json") ? { panels: [] } : snapshot);
			} };
			if (id.endsWith("catalog.json")) return catalog;
			if (id === "@/lib/panelLocation") return { withPanelLocationDetails: (snapshot) => snapshot };
			if (id === "@/lib/panelLocationStore") return {
				getStoredPanelLocationByBarcode: async () => stored,
				getStoredPanelLocation: async (project, revision) => {
					activeChecks.push([project, revision]);
					return revision ? stored : override;
				},
			};
			throw new Error(id);
		},
	});
	const lookup = module.exports.getPanelLocation;
	await assert.rejects(lookup("", "002"), /Temporary read failure/);
	failRead = false;
	assert.equal((await lookup("", "002")).version, "online-v2");
	assert.equal(activeChecks.length, 0, "unrelated bundled projects must not cause database queries");
	const warmedReads = reads.length;
	await lookup("", "002");
	assert.equal(reads.length, warmedReads, "warm lookup reuses immutable bundled JSON");
	stored = { ...stored, snapshot: { ...stored.snapshot, version: "online-v3" } };
	assert.equal((await lookup("", "002")).version, "online-v3", "active lookup is never cached across changes");
	stored = null;
	assert.equal((await lookup("", "001")).projectId, "bundled");
	assert.equal(activeChecks.length, 1, "only matching bundled serial needs an active-override check");
	override = { snapshot: {} };
	assert.equal(await lookup("", "001"), null, "newly activated online model suppresses old bundled data");
	stored = { metadata: { projectKey: "online", name: "Online", versionNumber: 2 }, snapshot };
	override = null;
	await assert.rejects(lookup("", "001"), /LOCATION_AMBIGUOUS/, "cross-source duplicates remain errors");
	const checksBeforePreview = activeChecks.length;
	assert.equal((await lookup("bundled", "", undefined, true)).barcode, "001");
	assert.equal(activeChecks.length, checksBeforePreview, "explicit bundled preview needs no online lookup");
	console.log("PASS: bundled JSON cached, read failures retry, unrelated database queries removed, active changes/override/ambiguity preserved.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
