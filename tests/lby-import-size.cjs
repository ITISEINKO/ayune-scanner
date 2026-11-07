// Run: node tests/lby-import-size.cjs
const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createHash, randomBytes } = require("node:crypto");
const { gzipSync } = require("node:zlib");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const { createClient } = require("@libsql/client");

const sha = (value) => createHash("sha256").update(value).digest("hex");
const limit = 2 * 1024 * 1024;
const base = { version: "size-test", panels: [{ barcode: "001", roomName: "Room", panelNumber: "1", corners: [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]] }] };
const json = JSON.stringify(base);
const mappingJson = '{"panels":[]}';
function candidate(project, locations) {
	return { locations, mappingJson, sourceUrl: "https://example.test/share", manifest: {
		projectKey: project, name: "Size regression", orderId: "123", revision: sha(locations),
		version: base.version, importedAt: new Date().toISOString(), panelCount: 1,
		sourceModelSha256: sha("source"), mappingSha256: sha(mappingJson),
	} };
}

async function main() {
	const db = createClient({ url: `file:${join(mkdtempSync(join(tmpdir(), "lby-size-")), "size.db").replaceAll("\\", "/")}` });
	const source = ts.transpileModule(readFileSync("src/lib/panelLocationStore.ts", "utf8"), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true },
	}).outputText;
	const load = () => {
		const module = { exports: {} };
		runInNewContext(source, { module, exports: module.exports, Buffer, process,
			require: (id) => {
				if (id === "@/lib/db") return { db };
				if (id === "next/server") return { after: (callback) => callback() };
				if (id === "next/cache") return { unstable_cache: (fn) => fn, revalidateTag() {} };
				if (id.endsWith("catalog.json")) return {};
				if (id === "@/lib/panelLocation") return { withPanelLocationDetails: (snapshot) => snapshot };
				return require(id);
			},
		});
		return module.exports;
	};
	try {
		const store = load(), project = "size-test";
		const lease = await store.claimLbyImport(project, "123");
		// JSON whitespace isolates byte limits without a large CAD fixture.
		for (const size of [1574477, limit]) {
			const data = candidate(project, json + " ".repeat(size - Buffer.byteLength(json)));
			await store.saveLbyImport(project, lease, "test", data);
			assert.equal((await store.getStoredPanelLocation(project, data.manifest.revision)).snapshot.panels[0].barcode, "001");
		}
		const active = candidate(project, json + " ".repeat(limit - Buffer.byteLength(json)));
		await store.activateLbyImport(project, active.manifest.revision, null);
		for (const locations of [json + " ".repeat(limit + 1 - Buffer.byteLength(json)),
			JSON.stringify({ ...base, padding: randomBytes(1100000).toString("base64") })]) {
			assert(Buffer.byteLength(locations) > limit || gzipSync(locations).length > 1024 * 1024);
			await assert.rejects(store.saveLbyImport(project, lease, "test", candidate(project, locations)), /MODEL_TOO_LARGE/);
			assert.equal((await store.getLbyImportState(project)).activeRevision, active.manifest.revision);
		}
		await db.execute("DELETE FROM ppic_panel_location_barcode");
		const fresh = load();
		assert.equal((await fresh.getStoredPanelLocationByBarcode("001")).metadata.revision, active.manifest.revision,
			"startup serial-index backfill must read the same 2 MiB snapshots accepted by save/preview");
		console.log("PASS: >1 MiB and exact 2 MiB save/read/backfill; oversized raw/compressed payloads rejected with active revision preserved.");
	} finally { db.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
