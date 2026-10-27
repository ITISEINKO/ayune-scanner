// Run after npm run build and starting postman/simulations/admin-dashboard.sim.yaml on port 4900:
// node tests/admin-home.cjs
const assert = require("node:assert/strict");
const { createHash, createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

if (process.env.ADMIN_HOME_SERVER === "1") {
	const nativeFetch = global.fetch;
	global.fetch = (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		if (url.hostname !== "api.clickup.com") throw new Error(`Unexpected server fetch: ${url.origin}`);
		assert.equal(init?.method ?? "GET", "GET", "home must not mutate ClickUp");
		process.stdout.write(`HOME_CLICKUP ${url.pathname}\n`);
		assert.ok(new Headers(init?.headers).get("Authorization")?.startsWith("home"), "tests use only synthetic ClickUp tokens");
		return nativeFetch(`http://127.0.0.1:4900/clickup${url.pathname}${url.search}`, { ...init, headers: { "x-test-mode": readFileSync(process.env.ADMIN_HOME_MODE_FILE, "utf8") } });
	};
} else {
	main().catch((error) => { console.error(error); process.exitCode = 1; });
}

async function main() {
	const { createClient } = require("@libsql/client");
	const { chromium, expect } = require("@playwright/test");
	const directory = mkdtempSync(join(tmpdir(), "trackerprod-home-"));
	const modeFile = join(directory, "mode.txt");
	const setMode = (mode) => writeFileSync(modeFile, mode);
	setMode("home");
	const databaseUrl = `file:${join(directory, "home.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	const secret = "local-home-secret";
	const baseURL = "http://127.0.0.1:3355";
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, role TEXT, allowed_status TEXT, active INTEGER, updated_by TEXT, updated_at TEXT)");
	for (const id of ["local-admin", "slow-admin", "budi", "rudi", "dewi", "agus", "sari"]) {
		await db.execute({ sql: "INSERT INTO ppic_permissions VALUES (?, ?, ?, ?, 'local-admin', datetime('now'))", args: [id, id.endsWith("admin") ? "SUPER_ADMIN" : "MEMBER", id === "sari" ? null : '["BARANG_DITERIMA"]', id === "sari" ? 0 : 1] });
	}
	await db.execute("CREATE TABLE ppic_scan_history (id INTEGER PRIMARY KEY, clickup_user_id TEXT, serial_number TEXT, status TEXT, task_name TEXT, scanned_at TEXT, project_task_id TEXT, component_task_id TEXT)");
	for (const [id, today, week] of [["budi", 7, 37], ["rudi", 3, 25], ["dewi", 4, 24], ["agus", 0, 16]]) {
		for (let index = 0; index < week; index++) await db.execute({ sql: "INSERT INTO ppic_scan_history (clickup_user_id, status, scanned_at) VALUES (?, ?, ?)", args: [id, ["BARANG_DITERIMA", "SEDANG_DIPACKING", "TERPASANG_DIGUNAKAN", "DALAM_PROSES_RETUR"][index % 4], new Date(Date.now() - (index < today ? 0 : (1 + (index - today) % 6) * 86_400_000)).toISOString()] });
	}
	const dashboard = {
		project: { task_id: "project", name: "Home test project", custom_id: null, startDate: null, dueDate: null },
		items: [{ id: "panels", name: "Panels", components: Array.from({ length: 36 }, (_, index) => ({ id: `p-${index}`, name: `Panel ${index}`, serialNumber: null, status: index >= 24 ? null : index < 4 ? "DALAM_PROSES_RETUR" : "BARANG_DITERIMA", history: [] })) },
			{ id: "support", name: "HARDWARE LIST", components: [{ id: "ignored", name: "Hardware", serialNumber: null, status: null, history: [] }] }],
		recentHistory: [], memberContribution: [], memberNames: {}, syncedAt: Date.now(), statusUpdatedAt: 1, currentStatusDurationMinutes: null, currentStatusStartedAt: null,
	};
	await db.execute("CREATE TABLE ppic_admin_project_snapshot (scope_key TEXT PRIMARY KEY, dashboard_json TEXT, refresh_id TEXT, refresh_until INTEGER NOT NULL DEFAULT 0)");
	const scope = createHash("sha256").update(JSON.stringify(["home", "1100830000000087", "project"])).digest("hex");
	await db.execute({ sql: "INSERT INTO ppic_admin_project_snapshot (scope_key, dashboard_json) VALUES (?, ?)", args: [scope, JSON.stringify(dashboard)] });
	const server = spawn(process.execPath, ["--require", __filename, "node_modules/next/dist/bin/next", "start", "-p", "3355"], {
		windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
		env: { ...process.env, ADMIN_HOME_SERVER: "1", ADMIN_HOME_MODE_FILE: modeFile, CLICKUP_TOKEN: "home", CRON_SECRET: "local-cron-secret", CLICKUP_CLIENT_SECRET: secret, TURSO_DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "local-only", CLICKUP_PPIC_PANEL_LIST_ID: "1100830000000087", ABLY_API_KEY: "" },
	});
	let logs = "";
	server.stdout.on("data", (chunk) => { logs += chunk; });
	server.stderr.on("data", (chunk) => { logs += chunk; });
	let browser;
	try {
		for (let attempt = 0; ; attempt++) {
			try { if ((await fetch(`${baseURL}/login`)).ok) break; } catch {}
			if (attempt > 60 || server.exitCode !== null) throw new Error(logs);
			await new Promise((done) => setTimeout(done, 250));
		}
		browser = await chromium.launch();
		const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
		await context.route("**/*", (route) => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
		async function session(role, token = "home", userId = "local-admin") {
			const payload = Buffer.from(JSON.stringify({ user_id: userId, role, allowed_status: role === "MEMBER" ? ["BARANG_DITERIMA"] : null, refreshed_at: Date.now() })).toString("base64url");
			await context.addCookies([{ name: "clickup_access_token", value: token, url: baseURL }, { name: "ppic_session", value: `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`, url: baseURL }]);
		}
		await session("SUPER_ADMIN");
		const page = await context.newPage();
		const errors = [];
		let dashboardRequests = 0;
		page.on("request", (request) => {
			if (new URL(request.url()).pathname === "/api/admin/dashboard") dashboardRequests++;
		});
		page.on("pageerror", (error) => errors.push(error.message));
		const cronUrl = `${baseURL}/api/cron/admin-dashboard`;
		assert.equal((await fetch(cronUrl)).status, 401, "cron rejects requests without its secret");
		assert.equal((await fetch(cronUrl, { headers: { authorization: "Bearer wrong-secret" } })).status, 401);
		const cronResponse = await fetch(cronUrl, { headers: { authorization: "Bearer local-cron-secret" } });
		assert.equal(cronResponse.status, 200, "cron calculates before any admin visits");
		const cronResult = await cronResponse.json();
		assert.deepEqual(Object.keys(cronResult).sort(), ["calculatedAt", "ok"], "cron does not return the dashboard payload");
		const startedAt = performance.now();
		await page.goto(`${baseURL}/admin`);
		await expect(page.getByRole("heading", { name: "Dashboard produksi" })).toBeVisible();
		await expect(page.getByText("67%", { exact: true })).toBeVisible();
		await expect(page.getByText("24 dari 36 barang · 1 project berjalan")).toBeVisible();
		await expect(page.getByRole("region", { name: "Aktivitas scan tim" }).getByText("14", { exact: true })).toBeVisible();
		await expect(page.getByText("102", { exact: true })).toBeVisible();
		await expect(page.getByText("3/4", { exact: true })).toBeVisible();
		await page.waitForLoadState("networkidle");
		assert.equal(dashboardRequests, 0, "prewarmed login makes no dashboard calculation request");
		const firstApi = await context.request.get(`${baseURL}/api/admin/dashboard`);
		const coldMs = Math.round(performance.now() - startedAt);
		assert.equal(firstApi.headers()["cache-control"], "private, no-store");
		let snapshot = await firstApi.json();
		assert.equal(snapshot.now, cronResult.calculatedAt);
		assert.equal((await db.execute("SELECT COUNT(*) AS count FROM ppic_admin_dashboard_snapshot")).rows[0].count, 1, "complete presentation payload is persisted");
		for (const path of ["/admin/profile", "/admin/settings", "/admin/projects", "/admin/ubah-manual"]) {
			const response = await context.request.get(`${baseURL}${path}`, { headers: { RSC: "1" } });
			assert.equal(response.status(), 200);
			assert.doesNotMatch(await response.text(), /Memuat dashboard admin|AdminDashboardSkeleton/, `${path} must not inherit the dashboard loading boundary`);
		}
		assert.equal(snapshot.members[0].summary.lifetimeTotal, undefined, "home does not fetch unused lifetime fields");
		assert.equal((await fetch(`${baseURL}/api/admin/dashboard`)).status, 401);
		await db.execute("UPDATE ppic_permissions SET role = 'MEMBER' WHERE clickup_user_id = 'local-admin'");
		assert.equal((await fetch(cronUrl, { headers: { authorization: "Bearer local-cron-secret" } })).status, 502, "a revoked service account cannot rebuild the shared snapshot");
		assert.equal((await context.request.get(`${baseURL}/api/admin/dashboard`)).status(), 403, "warm cache cannot bypass fresh local authorization");
		await page.reload();
		await expect(page).toHaveURL(`${baseURL}/unauthorized`);
		await db.execute("UPDATE ppic_permissions SET role = 'SUPER_ADMIN' WHERE clickup_user_id = 'local-admin'");
		await page.goto(`${baseURL}/admin`);
		const warmStartedAt = performance.now();
		const warmResponse = await context.request.get(`${baseURL}/api/admin/dashboard`);
		const warmMs = Math.round(performance.now() - warmStartedAt);
		assert.equal((await warmResponse.json()).now, snapshot.now, "warm endpoint reuses the aggregate snapshot");
		const savedRequests = dashboardRequests;
		const savedUpstreamCalls = logs.split("HOME_CLICKUP").length;
		await session("SUPER_ADMIN", "home", "slow-admin");
		await page.reload();
		await expect(page.getByText("67%", { exact: true })).toBeVisible();
		assert.equal((await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json()).now, snapshot.now, "another admin shares the precomputed result");
		await session("SUPER_ADMIN");
		await session("SUPER_ADMIN", "home-slow");
		await page.reload();
		await expect(page.getByText("67%", { exact: true })).toBeVisible();
		await expect(page.getByRole("status")).toContainText("Data terakhir:");
		await page.waitForLoadState("networkidle");
		assert.equal(dashboardRequests, savedRequests, "all admin logins and token rotations reuse the shared result without a dashboard request");
		assert.equal(logs.split("HOME_CLICKUP").length, savedUpstreamCalls, "saved page makes no ClickUp requests");
		const rotated = await context.request.get(`${baseURL}/api/admin/dashboard`);
		assert.equal((await rotated.json()).now, snapshot.now, "same signed admin reuses the calculation across token rotation");
		const nextCron = await (await fetch(cronUrl, { headers: { authorization: "Bearer local-cron-secret" } })).json();
		assert.ok(nextCron.calculatedAt > snapshot.now);
		await page.getByRole("navigation").getByRole("link", { name: "Projects", exact: true }).click();
		await expect(page).toHaveURL(`${baseURL}/admin/projects`);
		await page.getByRole("navigation").getByRole("link", { name: "Home", exact: true }).click();
		await expect(page.locator("time")).toHaveAttribute("datetime", new Date(nextCron.calculatedAt).toISOString());
		assert.equal(dashboardRequests, savedRequests, "returning to Home uses the newer shared snapshot without recalculating");
		snapshot = await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json();
		const previousDay = { ...snapshot, now: snapshot.now - 86_400_000 };
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_snapshot SET dashboard_json = ?", args: [JSON.stringify(previousDay)] });
		await db.execute("UPDATE ppic_admin_dashboard_refresh SET attempted_at = 0");
		setMode("home-slow");
		const staleRefresh = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/admin/dashboard");
		await page.reload();
		await expect(page.getByText("67%", { exact: true })).toBeVisible();
		await expect(page.getByRole("main")).not.toHaveAttribute("aria-label", "Memuat dashboard admin");
		await staleRefresh;
		await page.waitForLoadState("networkidle");
		assert.equal(dashboardRequests, savedRequests + 1, "an old snapshot triggers a background freshness check on mount");
		assert.ok((await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json()).now > previousDay.now, "stale data is rebuilt automatically");
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_snapshot SET dashboard_json = ?", args: [JSON.stringify(snapshot)] });
		const listRequests = () => logs.split("HOME_CLICKUP /api/v2/list/").length;
		const beforeSlow = listRequests();
		setMode("home-slow");
		const olderRefresh = context.request.get(`${baseURL}/api/admin/dashboard?refresh=1`);
		await expect.poll(listRequests).toBeGreaterThan(beforeSlow);
		assert.equal((await fetch(cronUrl, { headers: { authorization: "Bearer local-cron-secret" } })).status, 502, "a busy cron cannot report a project rebuild it did not perform");
		await session("SUPER_ADMIN", "home-empty");
		setMode("home-empty");
		const contenderResult = await (await context.request.get(`${baseURL}/api/admin/dashboard?refresh=1`)).json();
		const olderResult = await (await olderRefresh).json();
		assert.equal(contenderResult.now, snapshot.now, "another admin keeps the saved result while a rebuild holds the shared lease");
		assert.ok(olderResult.now > snapshot.now);
		assert.equal(listRequests(), beforeSlow + 1, "concurrent manual refreshes share one rebuild");
		assert.equal((await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json()).now, olderResult.now);
		await db.execute("UPDATE ppic_admin_dashboard_refresh SET attempted_at = 0");
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_snapshot SET dashboard_json = ?", args: [JSON.stringify(previousDay)] });
		setMode("home-slow");
		const beforeAuto = listRequests();
		const automatic = context.request.get(`${baseURL}/api/admin/dashboard`);
		await expect.poll(listRequests).toBeGreaterThan(beforeAuto);
		const otherAdmin = await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json();
		assert.equal(otherAdmin.now, previousDay.now);
		assert.equal((await automatic).status(), 200);
		await context.request.get(`${baseURL}/api/admin/dashboard`);
		assert.equal(listRequests(), beforeAuto + 1, "concurrent automatic checks and fresh reads trigger only one ClickUp list request");
		const beforeFenced = listRequests();
		const beforeLostLease = (await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json()).now;
		const expiredOwner = context.request.get(`${baseURL}/api/admin/dashboard?refresh=1`);
		await expect.poll(listRequests).toBeGreaterThan(beforeFenced);
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_refresh SET refresh_id = 'replacement', refresh_until = ?", args: [Date.now() + 60_000] });
		assert.equal((await expiredOwner).status(), 502, "an owner that lost its lease cannot publish");
		assert.equal((await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json()).now, beforeLostLease, "losing lease ownership preserves the saved result");
		assert.equal((await db.execute("SELECT refresh_id FROM ppic_admin_dashboard_refresh")).rows[0].refresh_id, "replacement", "an expired owner cannot release the replacement lease");
		await db.execute("UPDATE ppic_admin_dashboard_refresh SET refresh_until = 0, attempted_at = 0");
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_snapshot SET dashboard_json = ?", args: [JSON.stringify(snapshot)] });
		await session("SUPER_ADMIN");
		setMode("home");
		await page.clock.install();
		await page.reload();
		await page.waitForLoadState("networkidle");
		await db.execute({ sql: "INSERT INTO ppic_scan_history (clickup_user_id, status, scanned_at, serial_number) VALUES ('budi', 'BARANG_DITERIMA', ?, 'auto-check')", args: [new Date().toISOString()] });
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_snapshot SET dashboard_json = ?", args: [JSON.stringify(previousDay)] });
		await db.execute("UPDATE ppic_admin_dashboard_refresh SET attempted_at = 0");
		let releaseAuto;
		const autoGate = new Promise((done) => { releaseAuto = done; });
		const holdAuto = async (route) => { await autoGate; await route.continue(); };
		await page.route("**/api/admin/dashboard*", holdAuto);
		const beforeInterval = dashboardRequests;
		const intervalResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/admin/dashboard");
		await page.clock.fastForward(5 * 60_000 + 1);
		await expect.poll(() => dashboardRequests).toBe(beforeInterval + 1);
		await expect(page.getByRole("region", { name: "Aktivitas scan tim" }).getByText("14", { exact: true })).toBeVisible();
		await expect(page.getByRole("main")).not.toHaveAttribute("aria-label", "Memuat dashboard admin");
		releaseAuto();
		await intervalResponse;
		await page.unroute("**/api/admin/dashboard*", holdAuto);
		await expect(page.getByRole("region", { name: "Aktivitas scan tim" }).getByText("15", { exact: true })).toBeVisible();
		await page.evaluate(() => {
			Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
			window.dispatchEvent(new Event("visibilitychange"));
		});
		const beforeHidden = dashboardRequests;
		await page.clock.fastForward(10 * 60_000);
		assert.equal(dashboardRequests, beforeHidden, "hidden tabs do not poll");
		const focusResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/admin/dashboard");
		await page.evaluate(() => {
			delete document.visibilityState;
			window.dispatchEvent(new Event("visibilitychange"));
		});
		await focusResponse;
		assert.equal(dashboardRequests, beforeHidden + 1, "returning to a stale tab checks freshness");
		await page.clock.setSystemTime(Date.now());
		await db.execute("DELETE FROM ppic_scan_history WHERE serial_number = 'auto-check'");
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_snapshot SET dashboard_json = ?", args: [JSON.stringify(snapshot)] });
		await page.reload();
		console.log(`Local dashboard timings: first page + API ${coldMs}ms; warm API ${warmMs}ms (synthetic ClickUp/local database).`);
		const chart = page.getByRole("region", { name: "Scan per hari", exact: true });
		await expect(chart.locator("ol > li")).toHaveCount(7);
		await expect(chart.locator("ol > li").last()).toHaveAccessibleName(/: 14 scan;/);
		await expect(chart.locator("ol > li").last().locator("div > span")).toHaveCount(4);
		await chart.evaluate((element) => element.scrollIntoView({ block: "center" }));
		await chart.screenshot({ path: "test-results/admin-daily-scans-7.png" });
		await chart.getByRole("button", { name: "30 hari", exact: true }).click();
		await expect(chart.getByRole("button", { name: "30 hari", exact: true })).toHaveAttribute("aria-pressed", "true");
		await expect(chart.locator("ol > li")).toHaveCount(30);
		assert.equal(await chart.getByRole("region").evaluate((element) => element.scrollWidth > element.clientWidth), true, "30 days scroll within the chart");
		for (const width of [320, 390, 1440]) {
			await page.setViewportSize({ width, height: 1000 });
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `30-day chart stays inside the page at ${width}px`);
		}
		await chart.getByRole("button", { name: "7 hari", exact: true }).click();
		await expect(chart.locator("ol > li")).toHaveCount(7);
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByRole("navigation").getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
		await expect(page.getByRole("button", { name: /Budi Contoh/ })).toBeVisible();
		await expect(page.getByRole("button", { name: /Sari Contoh/ })).toHaveCount(0);
		await expect(page.getByRole("button", { name: /Agus Contoh/ })).toHaveCount(0);
		await expect(page.getByRole("region", { name: "Tim hari ini" }).getByRole("button")).toHaveCount(3);
		mkdirSync("test-results", { recursive: true });
		await page.screenshot({ path: "test-results/admin-home-mobile.png", fullPage: true });
		await page.getByRole("button", { name: /Budi Contoh/ }).click();
		await expect(page.getByRole("dialog")).toContainText("Budi Contoh");
		await expect(page.getByRole("dialog").getByRole("button", { name: "7 hari", exact: true })).toBeVisible();
		await expect(page.getByRole("dialog").getByText("Gagal memuat ringkasan scan.")).toHaveCount(0);
		await expect(page.getByRole("dialog").getByText("37", { exact: true }).first()).toBeVisible();
		await page.getByRole("button", { name: "Tutup", exact: true }).click();
		for (const width of [320, 1440]) {
			await page.setViewportSize({ width, height: 1000 });
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no horizontal overflow at ${width}px`);
		}
		await page.screenshot({ path: "test-results/admin-home-desktop.png", fullPage: true });
		await page.getByRole("navigation").getByRole("link", { name: "Projects", exact: true }).click();
		await expect(page).toHaveURL(`${baseURL}/admin/projects`);
		await expect(page.getByRole("heading", { name: "Pilih project" })).toBeVisible();
		await page.getByRole("link", { name: /Lihat detail project/ }).click();
		await expect(page.getByRole("navigation").getByRole("link", { name: "Projects", exact: true })).toHaveAttribute("aria-current", "page");
		await expect(page.getByRole("link", { name: "Kembali ke project" })).toHaveAttribute("href", "/admin/projects");
		await page.goto(`${baseURL}/admin/project`);
		await expect(page).toHaveURL(`${baseURL}/admin/projects`);
		await session("SUPER_ADMIN", "home-error");
		setMode("home-error");
		assert.equal((await fetch(cronUrl, { headers: { authorization: "Bearer local-cron-secret" } })).status, 502, "incomplete scheduled results report failure");
		assert.equal((await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json()).now, snapshot.now, "failed cron preserves the last complete snapshot");
		await page.goto(`${baseURL}/admin`);
		await expect(page.getByText("67%", { exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Perbarui dashboard" }).click();
		await expect(page.getByRole("main").getByRole("alert")).toContainText("Gagal memperbarui dashboard");
		await expect(page.getByText("67%", { exact: true })).toBeVisible();
		assert.equal((await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json()).now, snapshot.now, "incomplete refresh does not replace the complete saved result");
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_snapshot SET dashboard_json = ?", args: [JSON.stringify(previousDay)] });
		await db.execute("UPDATE ppic_admin_dashboard_refresh SET attempted_at = 0");
		const beforeFailure = listRequests();
		assert.equal((await context.request.get(`${baseURL}/api/admin/dashboard`)).status(), 502);
		assert.equal((await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json()).now, previousDay.now);
		assert.equal(listRequests(), beforeFailure + 1, "failed automatic rebuilds are cooled down for all admins");
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_snapshot SET dashboard_json = ?", args: [JSON.stringify(snapshot)] });
		await session("SUPER_ADMIN", "home-empty");
		setMode("home-empty");
		await page.goto(`${baseURL}/admin`);
		await page.getByRole("button", { name: "Perbarui dashboard" }).click();
		await expect(page.getByText("0%", { exact: true })).toBeVisible();
		await expect(page.getByText("0 dari 0 barang · 0 project berjalan")).toBeVisible();
		await db.execute("UPDATE ppic_scan_history SET scanned_at = datetime(scanned_at, '-1 day')");
		const cached = await context.request.get(`${baseURL}/api/admin/dashboard`);
		assert.equal((await cached.json()).totals.today, 14, "ordinary requests reuse the cached summary after data changes");
		await page.getByRole("button", { name: "Perbarui dashboard" }).click();
		await expect(page.getByText("Belum ada anggota yang scan hari ini.")).toBeVisible();
		await expect(page.getByRole("region", { name: "Tim hari ini" }).getByRole("button")).toHaveCount(0);
		await db.execute("DELETE FROM ppic_scan_history");
		await page.getByRole("button", { name: "Perbarui dashboard" }).click();
		await expect(chart.getByText("Belum ada scan pada periode ini.")).toBeVisible();
		await expect(chart.locator("ol > li")).toHaveCount(7);
		await db.execute("DROP TABLE ppic_scan_history");
		await page.getByRole("button", { name: "Perbarui dashboard" }).click();
		await expect(page.getByRole("main").getByRole("alert")).toContainText("Gagal memperbarui dashboard");
		await expect(page.getByRole("region", { name: "Tim hari ini" }).getByRole("button")).toHaveCount(0);
		await expect(chart.getByText("Belum ada scan pada periode ini.")).toBeVisible();
		await db.execute("CREATE TABLE ppic_scan_history (id INTEGER PRIMARY KEY, clickup_user_id TEXT, serial_number TEXT, status TEXT, task_name TEXT, scanned_at TEXT, project_task_id TEXT, component_task_id TEXT)");
		await session("SUPER_ADMIN", "home-slow", "slow-admin");
		setMode("home-slow");
		await db.execute("DELETE FROM ppic_admin_dashboard_snapshot");
		await db.execute("UPDATE ppic_admin_dashboard_refresh SET attempted_at = 0");
		let releaseDashboard;
		const dashboardGate = new Promise((done) => { releaseDashboard = done; });
		const holdDashboard = async (route) => { await dashboardGate; await route.continue(); };
		await page.route("**/api/admin/dashboard*", holdDashboard);
		const slowApi = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/admin/dashboard");
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`${baseURL}/admin`);
		await expect(page.getByRole("heading", { name: "Dashboard produksi" })).toBeVisible();
		await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "true");
		await expect(page.getByRole("button", { name: "Perbarui dashboard" })).toHaveCount(0);
		await expect(page.getByRole("main")).toHaveAttribute("aria-label", "Memuat dashboard admin");
		await expect(page.locator("main .grid-cols-3 > div")).toHaveCount(3);
		await expect(page.locator("main header")).toHaveCSS("padding-left", "24px");
		await page.screenshot({ path: "test-results/admin-home-skeleton.png", fullPage: true });
		releaseDashboard();
		await slowApi;
		await page.unroute("**/api/admin/dashboard*", holdDashboard);
		await expect(page.getByRole("button", { name: "Perbarui dashboard" })).toBeVisible();
		const previousInventory = await page.getByRole("link", { name: /Barang tercatat/ }).innerText();
		await db.execute("DROP TABLE ppic_permissions");
		assert.equal((await context.request.get(`${baseURL}/api/admin/dashboard`)).status(), 502, "database authorization failures fail closed even with a cached response");
		await page.getByRole("button", { name: "Perbarui dashboard" }).click();
		await expect(page.getByText("Gagal memperbarui dashboard. Data sebelumnya tetap ditampilkan.")).toBeVisible();
		assert.equal(await page.getByRole("link", { name: /Barang tercatat/ }).innerText(), previousInventory, "failed refresh keeps the existing snapshot visible");
		await session("MEMBER");
		await page.goto(`${baseURL}/admin`);
		await expect(page).toHaveURL(`${baseURL}/unauthorized`);
		assert.deepEqual(errors, []);
		console.log("Admin home passed: cron prewarm, shared five-minute freshness/cooldown, concurrent refresh lease and fencing, visible-tab polling, hidden-tab pause and focus refresh, data retained until ready/on failure, manual refresh, authorization, skeleton, charts, drawer and responsive layout. ClickUp calls used the local Postman simulation.");
	} catch (error) {
		console.error(logs);
		throw error;
	} finally {
		await browser?.close();
		server.kill();
		db.close();
	}
}
