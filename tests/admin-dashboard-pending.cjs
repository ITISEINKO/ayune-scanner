// Run: node tests/admin-dashboard-pending.cjs (no network or production database).
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind, JsxEmit } = require("typescript");

function load(file, dependencies, globals = {}) {
	const module = { exports: {} };
	runInNewContext(transpileModule(readFileSync(file, "utf8"), {
		compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
	}).outputText, {
		module, exports: module.exports, URL, Error, console, ...globals,
		require: (id) => dependencies[id] ?? (id.startsWith("react") ? require(id) : {}),
	});
	return module.exports;
}

(async () => {
	let failure, authorized = true, logs = 0;
	const dashboard = { now: 123 };
	const route = load("src/app/api/admin/dashboard/route.ts", {
		"next/server": { NextResponse: Response },
		"@/lib/session": { ppicSession: async () => ({ user_id: "admin" }), clickUpToken: async () => "test" },
		"@/lib/db": { isPpicSuperAdmin: async () => authorized },
		"@/lib/adminDashboard": { getAdminDashboard: async () => { if (failure) throw failure; return dashboard; } },
	}, { console: { error: () => logs++ } });
	const request = new Request("http://localhost/api/admin/dashboard");
	failure = new Error("DASHBOARD_REFRESH_IN_PROGRESS");
	let response = await route.GET(request);
	assert.equal(response.status, 202);
	assert.equal(response.headers.get("Retry-After"), "5");
	assert.equal(response.headers.get("Cache-Control"), "private, no-store");
	assert.deepEqual(await response.json(), { status: "refreshing" });
	assert.equal(logs, 0, "lock contention is not logged as a failure");
	failure = new Error("DASHBOARD_INCOMPLETE");
	assert.equal((await route.GET(request)).status, 502);
	assert.equal(logs, 1, "real build failures remain logged");
	failure = undefined;
	assert.deepEqual(await (await route.GET(request)).json(), dashboard);
	authorized = false;
	assert.equal((await route.GET(request)).status, 403);

	let options, nextResponse = new Response(null, { status: 202 });
	const skeleton = () => null;
	const client = load("src/features/admin/AdminDashboard.tsx", {
		"next/dynamic": { default: () => () => null },
		"@tanstack/react-query": {
			useQueryClient: () => ({}),
			useQuery: (value) => { options = value; return { data: null, isError: false }; },
		},
		"@/features/admin/AdminDashboardSkeleton": { AdminDashboardSkeleton: skeleton },
	}, { fetch: async () => nextResponse });
	assert.equal(client.AdminDashboard({ userId: "admin" }).type, skeleton);
	assert.equal(await options.queryFn({}), null, "pending is not treated as dashboard data");
	assert.equal(options.refetchInterval({ state: { data: null } }), 5_000);
	assert.equal(options.refetchInterval({ state: { data: dashboard } }), 300_000);
	nextResponse = Response.json(dashboard);
	assert.deepEqual(await options.queryFn({}), dashboard, "polling can recover to complete data");
	nextResponse = new Response(null, { status: 502 });
	await assert.rejects(options.queryFn({}), /DASHBOARD_UNAVAILABLE/);
	console.log("Dashboard pending response, loading, polling, recovery and failure checks passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
