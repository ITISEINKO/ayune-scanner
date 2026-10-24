// Run after npm run build and starting postman/simulations/admin-dashboard.sim.yaml on port 4900:
// node tests/admin-home.cjs
const assert = require("node:assert/strict");
const { createHash, createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdirSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

if (process.env.ADMIN_HOME_SERVER === "1") {
	const nativeFetch = global.fetch;
	global.fetch = (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		if (url.hostname !== "api.clickup.com") throw new Error(`Unexpected server fetch: ${url.origin}`);
		assert.equal(init?.method ?? "GET", "GET", "home must not mutate ClickUp");
		process.stdout.write(`HOME_CLICKUP ${url.pathname}\n`);
		const token = new Headers(init?.headers).get("Authorization");
		return nativeFetch(`http://127.0.0.1:4900/clickup${url.pathname}${url.search}`, { ...init, headers: { "x-test-mode": token?.startsWith("home-") ? token : "home" } });
	};
} else {
	main().catch((error) => { console.error(error); process.exitCode = 1; });
}

async function main() {
	const { createClient } = require("@libsql/client");
	const { chromium, expect } = require("@playwright/test");
	const directory = mkdtempSync(join(tmpdir(), "trackerprod-home-"));
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
		env: { ...process.env, ADMIN_HOME_SERVER: "1", CLICKUP_CLIENT_SECRET: secret, TURSO_DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "local-only", CLICKUP_PPIC_PANEL_LIST_ID: "1100830000000087", ABLY_API_KEY: "" },
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
		const firstApiResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/admin/dashboard");
		const startedAt = performance.now();
		await page.goto(`${baseURL}/admin`);
		await expect(page.getByRole("heading", { name: "Dashboard produksi" })).toBeVisible();
		await expect(page.getByText("67%", { exact: true })).toBeVisible();
		await expect(page.getByText("24 dari 36 barang · 1 project berjalan")).toBeVisible();
		await expect(page.getByRole("region", { name: "Aktivitas scan tim" }).getByText("14", { exact: true })).toBeVisible();
		await expect(page.getByText("102", { exact: true })).toBeVisible();
		await expect(page.getByText("3/4", { exact: true })).toBeVisible();
		const firstApi = await firstApiResponse;
		const coldMs = Math.round(performance.now() - startedAt);
		assert.equal(firstApi.headers()["cache-control"], "private, no-store");
		const snapshot = await firstApi.json();
		assert.equal((await db.execute("SELECT COUNT(*) AS count FROM ppic_admin_dashboard_snapshot")).rows[0].count, 1, "complete presentation payload is persisted");
		for (const path of ["/admin/profile", "/admin/settings", "/admin/projects", "/admin/ubah-manual"]) {
			const response = await context.request.get(`${baseURL}${path}`, { headers: { RSC: "1" } });
			assert.equal(response.status(), 200);
			assert.doesNotMatch(await response.text(), /Memuat dashboard admin|AdminDashboardSkeleton/, `${path} must not inherit the dashboard loading boundary`);
		}
		assert.equal(snapshot.members[0].summary.lifetimeTotal, undefined, "home does not fetch unused lifetime fields");
		assert.equal((await fetch(`${baseURL}/api/admin/dashboard`)).status, 401);
		await db.execute("UPDATE ppic_permissions SET role = 'MEMBER' WHERE clickup_user_id = 'local-admin'");
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
		await session("SUPER_ADMIN", "home-slow");
		await page.reload();
		await expect(page.getByText("67%", { exact: true })).toBeVisible();
		await expect(page.getByRole("status")).toContainText("Data terakhir:");
		await page.waitForLoadState("networkidle");
		assert.equal(dashboardRequests, savedRequests, "new login token reuses the saved result without a dashboard request");
		assert.equal(logs.split("HOME_CLICKUP").length, savedUpstreamCalls, "saved page makes no ClickUp requests");
		const rotated = await context.request.get(`${baseURL}/api/admin/dashboard`);
		assert.equal((await rotated.json()).now, snapshot.now, "same signed admin reuses the calculation across token rotation");
		const previousDay = { ...snapshot, now: snapshot.now - 86_400_000 };
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_snapshot SET dashboard_json = ?", args: [JSON.stringify(previousDay)] });
		await page.reload();
		await page.waitForLoadState("networkidle");
		assert.equal(dashboardRequests, savedRequests, "crossing a day does not trigger an automatic dashboard request");
		assert.equal((await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json()).now, previousDay.now, "old calculation is returned without time-based invalidation");
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_snapshot SET dashboard_json = ?", args: [JSON.stringify(snapshot)] });
		const timeRequests = () => logs.split("HOME_CLICKUP /api/v2/task/project/time_in_status").length;
		const beforeSlow = timeRequests();
		const olderRefresh = context.request.get(`${baseURL}/api/admin/dashboard?refresh=1`);
		await expect.poll(timeRequests).toBeGreaterThan(beforeSlow);
		await session("SUPER_ADMIN", "home-empty");
		const newerResult = await (await context.request.get(`${baseURL}/api/admin/dashboard?refresh=1`)).json();
		const olderResult = await (await olderRefresh).json();
		assert.ok(olderResult.now < newerResult.now, "the slow calculation started first");
		assert.equal((await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json()).now, newerResult.now, "a slow older refresh cannot overwrite the newer saved result");
		await db.execute({ sql: "UPDATE ppic_admin_dashboard_snapshot SET dashboard_json = ?", args: [JSON.stringify(snapshot)] });
		await session("SUPER_ADMIN");
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
		await page.goto(`${baseURL}/admin`);
		await expect(page.getByText("67%", { exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Perbarui dashboard" }).click();
		await expect(page.getByRole("main").getByRole("alert")).toContainText("Ringkasan barang belum tersedia lengkap");
		await expect(page.getByText("Data barang belum lengkap", { exact: false })).toBeVisible();
		assert.equal((await (await context.request.get(`${baseURL}/api/admin/dashboard`)).json()).now, snapshot.now, "incomplete refresh does not replace the complete saved result");
		await session("SUPER_ADMIN", "home-empty");
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
		await expect(page.getByRole("main").getByRole("alert")).toContainText("Sebagian data tim belum dapat dimuat");
		await expect(page.getByRole("region", { name: "Tim hari ini" }).getByRole("button")).toHaveCount(0);
		await expect(page.getByText("Aktivitas tim belum dapat dimuat lengkap.")).toBeVisible();
		await expect(chart.getByText("Grafik scan belum tersedia.")).toBeVisible();
		await session("SUPER_ADMIN", "home-slow", "slow-admin");
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
		console.log("Admin home passed: saved results without automatic requests, token rotation, account isolation, fresh authorization, explicit refresh/failure retention, matching skeleton, counts, charts, drawer and responsive layout. ClickUp calls used the local Postman simulation.");
	} catch (error) {
		console.error(logs);
		throw error;
	} finally {
		await browser?.close();
		server.kill();
		db.close();
	}
}
