// postman simulation run postman/simulations/admin-dashboard.sim.yaml --port 4900
// node --experimental-strip-types tests/project-complete.cjs
const assert = require("node:assert/strict");
const { registerHooks } = require("node:module");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
registerHooks({ resolve(specifier, context, next) {
	if (specifier === "next/server") return next("next/server.js", context);
	if (specifier === "@/lib/session") return { url: "data:text/javascript," + encodeURIComponent(`
		export const clickUpToken = async () => globalThis.noToken ? null : 'test-token';
		export const requireFreshSuperAdmin = async () => { if (!globalThis.testAdmin) throw Error('UNAUTHORIZED'); };
		export const requireFreshPpicStatusAccess = async () => 'member';
		export const ppicSession = async () => ({role: 'MEMBER'});
		export const selectedProjectTaskId = async () => 'complete-project';
	`), shortCircuit: true };
	return next(specifier.startsWith("@/") ? pathToFileURL(resolve(__dirname, "../src", `${specifier.slice(2)}.ts`)).href : specifier, context);
} });
process.env.TURSO_DATABASE_URL = "file::memory:";
process.env.TURSO_AUTH_TOKEN = "local-only";
process.env.CLICKUP_PPIC_PANEL_LIST_ID = "1100830000000087";
const nativeFetch = global.fetch;
const base = "http://127.0.0.1:4900/clickup";
let mode = "project-complete";
global.fetch = (input, init) => {
	const url = new URL(String(input));
	assert.equal(url.origin, "https://api.clickup.com");
	return nativeFetch(`${base}${url.pathname}${url.search}`, { ...init, headers: { ...init?.headers, "x-test-mode": mode } });
};
const request = (body) => new Request("http://localhost/api/project/complete", { method: "POST", body: JSON.stringify(body) });
(async () => {
	await nativeFetch(`${base}/test/reset`, { headers: { "x-test-mode": mode } });
	const { POST } = require("../src/app/api/project/complete/route.ts");
	const { POST: scan } = require("../src/app/api/panel/scan/route.ts");
	const { inProgressProjects } = require("../src/lib/projects.ts");
	const { db, claimAdminProjectRefresh, finishAdminProjectRefresh, getAdminProjectSnapshot } = require("../src/lib/db.ts");
	global.testAdmin = false;
	await assert.rejects(POST(request({ task_id: "complete-project" })), /UNAUTHORIZED/);
	global.testAdmin = true;
	global.noToken = true;
	assert.equal((await POST(request({ task_id: "complete-project" }))).status, 401);
	global.noToken = false;
	for (const body of [null, {}, { task_id: " " }, { task_id: 1 }]) assert.equal((await POST(request(body))).status, 400);
	assert.equal((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status, 400);
	for (const task_id of ["child", "foreign", "todo"]) assert.equal((await POST(request({ task_id }))).status, task_id === "todo" ? 409 : 404);
	assert.equal((await inProgressProjects("test-token")).length, 1);
	const { rememberSerial } = require("../src/lib/projectSerialCache.ts");
	await rememberSerial("complete-project", "one", { task_id: "one", name: "One", status_id: "22619cd5-078e-4b12-a6d2-96d723eed52b" });
	const activeScan = await scan(request({ serial_number: "one", status: "BARANG_DITERIMA" }));
	assert.equal(activeScan.status, 200, "active project retains cached duplicate-scan behavior");
	assert.equal((await activeScan.json()).skipped, true);
	for (const [scenario, status, error] of [
		["unscanned", 409, "PROJECT_HAS_UNSCANNED_SERIALS"],
		["unknown", 409, "PROJECT_HAS_UNSCANNED_SERIALS"],
		["rate-limit", 429, "RATE_LIMITED"],
		["malformed", 502, "CLICKUP_ERROR"],
		["update-fail", 502, "CLICKUP_ERROR"],
	]) {
		mode = `project-complete-${scenario}`;
		const response = await POST(request({ task_id: "complete-project" }));
		assert.equal(response.status, status, scenario);
		assert.equal((await response.json()).error, error);
	}
	mode = "project-complete";
	assert.equal((await nativeFetch(`${base}/test/writes`, { headers: { "x-test-mode": mode } }).then(r => r.json())).writes, 0);
	await claimAdminProjectRefresh("complete-snapshot", "test");
	await finishAdminProjectRefresh("complete-snapshot", "test", { project: { task_id: "complete-project" } });
	assert.equal((await POST(request({ task_id: "complete-project" }))).status, 200, "retur warns but does not block");
	assert.equal(await getAdminProjectSnapshot("complete-snapshot"), null, "completed snapshot cannot show stale action on reopen");
	assert.deepEqual(await inProgressProjects("test-token"), [], "project list cache invalidated");
	assert.equal((await POST(request({ task_id: "complete-project" }))).status, 200, "retry is idempotent");
	const blocked = await scan(request({ serial_number: "one", status: "BARANG_DITERIMA" }));
	assert.equal(blocked.status, 409);
	assert.equal((await blocked.json()).error, "PROJECT_NOT_AVAILABLE", "old selection cannot scan completed project");
	assert.equal((await nativeFetch(`${base}/test/writes`, { headers: { "x-test-mode": mode } }).then(r => r.json())).writes, 1);
	db.close();
	console.log("Completion: auth, validation, page-two missing status, unknown status, upstream failures, retur, cache invalidation, retry and old-selection scan guard passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
