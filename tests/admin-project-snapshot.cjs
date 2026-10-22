// Run: postman simulation run postman/simulations/admin-dashboard.sim.yaml --port 4900
// Then: npm run test:admin-dashboard
const assert = require("node:assert/strict");
const { registerHooks } = require("node:module");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

// Resolve the app's aliases without adding a test runner or loading real credentials.
registerHooks({
	resolve(specifier, context, nextResolve) {
		return nextResolve(specifier.startsWith("@/")
			? pathToFileURL(resolve(__dirname, "../src", `${specifier.slice(2)}.ts`)).href
			: specifier, context);
	},
});
process.env.TURSO_DATABASE_URL = "file::memory:";
process.env.TURSO_AUTH_TOKEN = "local-test-only";
process.env.CLICKUP_PPIC_PANEL_LIST_ID = "1100830000000087";

const nativeFetch = global.fetch;
const simulationUrl = process.env.ADMIN_DASHBOARD_SIM_URL || "http://127.0.0.1:4900/clickup";
let mode = "normal";
let calls = 0;
let concurrentScan;
global.fetch = async (input, init) => {
	const url = new URL(String(input));
	assert.equal(url.origin, "https://api.clickup.com");
	assert.equal(init.method || "GET", "GET");
	calls += 1;
	const response = await nativeFetch(`${simulationUrl}${url.pathname}${url.search}`, {
		...init,
		headers: { "x-test-mode": mode },
	});
	if (concurrentScan && url.searchParams.get("page") === "1") {
		await concurrentScan();
		concurrentScan = undefined;
	}
	return response;
};

const { getProjectDashboard } = require("../src/lib/projectDashboard.ts");
const {
	db, claimAdminProjectRefresh, finishAdminProjectRefresh, getAdminProjectSnapshot,
} = require("../src/lib/db.ts");
const project = { task_id: "project", name: null, custom_id: null };

async function main() {
	await db.execute(`CREATE TABLE ppic_scan_history (
		id INTEGER PRIMARY KEY, clickup_user_id TEXT, serial_number TEXT, status TEXT,
		task_name TEXT, scanned_at TEXT, project_task_id TEXT, component_task_id TEXT
	)`);
	const first = await getProjectDashboard("test-token", project);
	assert.equal(first.items[0].components.length, 2, "all descendant pages included");
	assert.equal(first.items[0].components[1].status, "DALAM_PROSES_RETUR");
	assert.ok(first.syncedAt);
	assert.equal(calls, 4);

	const cached = await getProjectDashboard("test-token", project);
	assert.deepEqual(cached, first);
	assert.equal(calls, 4, "snapshot hit must not call ClickUp");
	await new Promise((done) => setTimeout(done, 5));
	await db.execute({ sql: "UPDATE ppic_component_status SET status = ?, updated_at = ? WHERE component_task_id = ?", args: ["SEDANG_DIPACKING", Date.now(), "one"] });
	const live = await getProjectDashboard("test-token", project);
	assert.equal(live.items[0].components[0].status, "SEDANG_DIPACKING");
	assert.equal(calls, 4, "local status overlay does not fetch ClickUp");

	mode = "renamed";
	const refreshed = await getProjectDashboard("test-token", project, true);
	assert.equal(refreshed.project.name, "Updated project");
	assert.equal(refreshed.items[0].components[0].status, "BARANG_DITERIMA", "resync replaces older local status with ClickUp state");
	assert.equal(calls, 8);

	mode = "rate-limit";
	await assert.rejects(getProjectDashboard("test-token", project, true), /RATE_LIMITED/);
	const afterFailure = await getProjectDashboard("test-token", project);
	assert.equal(afterFailure.syncedAt, refreshed.syncedAt, "failed pagination retains last snapshot");
	assert.equal(afterFailure.project.name, "Updated project");

	mode = "normal";
	concurrentScan = async () => {
		await new Promise((done) => setTimeout(done, 5));
		await db.execute({ sql: "UPDATE ppic_component_status SET status = ?, updated_at = ? WHERE component_task_id = ?", args: ["TERPASANG_DIGUNAKAN", Date.now(), "one"] });
	};
	const raced = await getProjectDashboard("test-token", project, true);
	assert.equal(raced.items[0].components[0].status, "TERPASANG_DIGUNAKAN", "scan during refresh wins over fetched status");
	const beforeNewScope = calls;
	await getProjectDashboard("another-token", project);
	assert.equal(calls, beforeNewScope + 4, "different ClickUp credentials cannot reuse a snapshot");

	assert.equal(await claimAdminProjectRefresh("lease-test", "owner"), true);
	assert.equal(await claimAdminProjectRefresh("lease-test", "other"), false);
	assert.equal(await finishAdminProjectRefresh("lease-test", "other", first), false);
	assert.equal(await getAdminProjectSnapshot("lease-test"), null);
	await db.execute("UPDATE ppic_admin_project_snapshot SET refresh_until = 0 WHERE scope_key = 'lease-test'");
	assert.equal(await claimAdminProjectRefresh("lease-test", "replacement"), true);
	assert.equal(await finishAdminProjectRefresh("lease-test", "owner", first), false, "expired owner cannot publish");
	assert.equal(await finishAdminProjectRefresh("lease-test", "replacement", first), true);
	console.log("Admin snapshot checks passed: pagination, cache hit, overlay, resync, failure retention, race, isolation, lease fencing.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
	.finally(() => { db.close(); global.fetch = nativeFetch; });
