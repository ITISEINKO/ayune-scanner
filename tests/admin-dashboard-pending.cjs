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
	failure = new Error("DASHBOARD_REFRESH_COOLDOWN");
	assert.equal((await route.GET(request)).status, 502, "an idle cooldown must not tell the browser to keep waiting");
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
	assert.equal(options.refetchInterval({ state: { data: null, error: new Error("failed") } }), false,
		"a failed rebuild stops the five-second pending loop");
	assert.equal(options.refetchInterval({ state: { data: dashboard } }), 300_000);
	nextResponse = Response.json(dashboard);
	assert.deepEqual(await options.queryFn({}), dashboard, "polling can recover to complete data");
	nextResponse = new Response(null, { status: 502 });
	await assert.rejects(options.queryFn({}), /DASHBOARD_UNAVAILABLE/);

	const { createClient } = require("@libsql/client");
	const { createHash } = require("node:crypto");
	const db = createClient({ url: "file::memory:" });
	try {
		const env = { CLICKUP_TOKEN: "test" };
		const backend = load("src/lib/adminDashboard.ts", {
			"node:crypto": require("node:crypto"),
			"@/lib/db": { db },
			"@/lib/projects": { panelListId: () => "test-list" },
		}, { process: { env } });
		await backend.getLastAdminDashboard();
		delete env.CLICKUP_TOKEN;
		await assert.rejects(backend.getAdminDashboard(), /DASHBOARD_TOKEN_MISSING/);
		assert.equal((await db.execute("SELECT * FROM ppic_admin_dashboard_refresh")).rows.length, 0,
			"missing server configuration must not acquire a lease or start cooldown");
		env.CLICKUP_TOKEN = "test";
		const scope = "shared:" + createHash("sha256")
			.update(JSON.stringify(["test", "test-list", undefined, undefined, undefined])).digest("hex");
		await db.execute({
			sql: "INSERT INTO ppic_admin_dashboard_refresh VALUES (?, 'owner', ?, ?)",
			args: [scope, Date.now() + 60_000, Date.now()],
		});
		await assert.rejects(backend.getAdminDashboard(), /DASHBOARD_REFRESH_IN_PROGRESS/,
			"an active lease without a snapshot is pending");
		await db.execute("UPDATE ppic_admin_dashboard_refresh SET refresh_until = 0");
		await assert.rejects(backend.getAdminDashboard(), /DASHBOARD_REFRESH_COOLDOWN/,
			"a failed/released attempt without a snapshot is not pending");
		const previous = { now: Date.now() - 600_000 };
		await db.execute({ sql: "INSERT INTO ppic_admin_dashboard_snapshot VALUES (?, ?)", args: [scope, JSON.stringify(previous)] });
		assert.equal((await backend.getAdminDashboard()).now, previous.now,
			"an existing saved dashboard remains available during cooldown");
	} finally { db.close(); }
	console.log("Dashboard pending response, loading, polling, recovery and failure checks passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
