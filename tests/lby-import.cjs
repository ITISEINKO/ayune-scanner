// Start tests/lby-import.sim.yaml on port 4913, then: node tests/lby-import.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { parseShareLink, fetchProject, importProject, activateProject } = require("../scripts/import-lby-project.cjs");

function fixtureLink(expireTime = Date.now() + 3600000) {
	const key = "lby-temp-token-key-2024";
	const data = JSON.stringify({ orderId: "123456789012345678", endCustomerAddress: "Room test", expireTime });
	const encoded = data.split("").map((c,i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join("");
	return `https://www.lbyerp.com/#/cadVisitor?token=${encodeURIComponent(Buffer.from(encoded).toString("base64"))}&endCustomerAddress=ignored`;
}

(async () => {
	assert.equal(parseShareLink(fixtureLink()).name, "Room test", "display query cannot replace token project identity");
	assert.throws(() => parseShareLink(fixtureLink(1)), /expired/);
	assert.throws(() => parseShareLink(fixtureLink().replace("www.lbyerp.com", "example.com")), /share link/);
	assert.throws(() => parseShareLink("https://www.lbyerp.com/#/cadVisitor?token=invalid"), /Invalid share token/);
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "lby-import-test-"));
	const catalogPath = path.join(root, "catalog.json"), initial = '{"existing":{"name":"Existing","snapshot":"saved.json"}}';
	fs.writeFileSync(catalogPath, initial);
	const nativeFetch = global.fetch;
	let mode = "normal", requests = 0;
	global.fetch = (url, options) => {
		const target = new URL(url);
		assert(["https://www.lbyerp.com", "https://ali-oss-lby.oss-cn-hangzhou.aliyuncs.com"].includes(target.origin), "unexpected remote origin");
		requests++;
		return nativeFetch(`http://127.0.0.1:4913/lby${target.pathname}${target.search}`, {
			...options, headers: { ...options?.headers, "x-test-mode": mode },
		});
	};
	try {
		const first = await importProject(fixtureLink(), "fixture", root);
		assert.equal(first.panelCount, 1);
		assert.equal(fs.readFileSync(catalogPath, "utf8"), initial, "import must not change active versions");
		const folder = path.join(root, "imports", "fixture", first.revision);
		const firstBytes = fs.readFileSync(path.join(folder, "locations.json"), "utf8");
		assert.equal(JSON.parse(firstBytes).panels[0].barcode, "000123");
		assert.equal(JSON.parse(firstBytes).panels[0].doorOpenType, "right", "import persists vendor opening metadata");
		assert(!/token|Signature|https?:|offer|price/i.test(fs.readFileSync(path.join(folder, "manifest.json"), "utf8")));
		activateProject("fixture", first.revision, root);
		const active = fs.readFileSync(catalogPath, "utf8");
		assert.equal(JSON.parse(active).fixture.mapping, `imports/fixture/${first.revision}/mapping.json`, "activation must retain the panel-name mapping path");
		const again = await importProject(fixtureLink(), "fixture", root);
		assert.equal(again.importedAt, first.importedAt, "identical import reuses the immutable version");
		mode = "renamed";
		const renamed = await importProject(fixtureLink(), "fixture", root);
		assert.notEqual(renamed.revision, first.revision, "a panel-name-only change must create a new revision");
		const renamedFolder = path.join(root, "imports", "fixture", renamed.revision);
		const renamedSnapshot = JSON.parse(fs.readFileSync(path.join(renamedFolder, "locations.json"), "utf8"));
		assert.equal(renamedSnapshot.panels[0].panelName, "Renamed panel");
		assert.deepEqual(renamedSnapshot.panels[0].corners, JSON.parse(firstBytes).panels[0].corners, "renaming must not change geometry");
		assert.equal(JSON.parse(fs.readFileSync(path.join(renamedFolder, "mapping.json"), "utf8")).panels[0].panelName, "Renamed panel");
		assert.equal((await importProject(fixtureLink(), "fixture", root)).importedAt, renamed.importedAt, "identical renamed panels must reuse their revision");
		assert.equal(fs.readFileSync(catalogPath, "utf8"), active, "a rename must remain a candidate until activation");
		assert.equal(fs.readFileSync(path.join(folder, "locations.json"), "utf8"), firstBytes, "renaming must preserve the old revision");
		mode = "changed";
		const changed = await importProject(fixtureLink(), "fixture", root);
		assert.notEqual(changed.revision, first.revision);
		assert.equal(fs.readFileSync(catalogPath, "utf8"), active, "upstream changes cannot silently replace the active viewer");
		assert.equal(fs.readFileSync(path.join(folder, "locations.json"), "utf8"), firstBytes, "old version is immutable");
		activateProject("fixture", changed.revision, root);
		assert(JSON.parse(fs.readFileSync(catalogPath)).fixture.snapshot.includes(changed.revision));
		activateProject("fixture", first.revision, root);
		assert.equal(fs.readFileSync(catalogPath, "utf8"), active, "explicit rollback restores the earlier pointer");
		mode = "curved";
		const curved = await fetchProject(fixtureLink(), "fixture");
		const mesh = JSON.parse(curved.locations).panels[0].geometry;
		assert(mesh.vertices.length > 8, "downloaded bent panels must retain curved geometry");
		assert.equal(Math.max(...mesh.vertices.map((point) => point[1])), 574, "bent depth follows formed dimensions");
		assert.equal(fs.readFileSync(catalogPath, "utf8"), active, "geometry upgrades stage a separate immutable revision");
		for (const [failure, message] of [["rate-limit", /HTTP 429/], ["missing-match", /No model/],
			["no-panel-data", /LBY_NO_PANEL_DATA/],
			["wrong-order", /another order/], ["bad-crc", /checksum/], ["bad-host", /download host/],
			["invalid-world", /Invalid world position/]]) {
			mode = failure;
			await assert.rejects(importProject(fixtureLink(), "fixture", root), message);
			assert.equal(fs.readFileSync(catalogPath, "utf8"), active, `${failure} must preserve the active pointer`);
		}
		await assert.rejects(importProject(fixtureLink(), "../unsafe", root), /project key/);
		fs.appendFileSync(path.join(folder, "locations.json"), " ");
		assert.throws(() => activateProject("fixture", first.revision, root), /checksum/);
		assert.equal(fs.readFileSync(catalogPath, "utf8"), active);
		mode = "slow";
		await assert.rejects(fetchProject(fixtureLink(), "fixture", AbortSignal.timeout(50)), /timeout|abort/i);
		assert.equal(fs.readFileSync(catalogPath, "utf8"), active, "a total download deadline must preserve the active pointer");
		console.log(`LBY HTTP simulation passed: ${requests} requests; ZIP/CRC, mapping, panel-name revision identity, immutable import, explicit activation/rollback, failure retention and tamper rejection.`);
	} finally { global.fetch = nativeFetch; }
})().catch((error) => { console.error(error); process.exitCode = 1; });
