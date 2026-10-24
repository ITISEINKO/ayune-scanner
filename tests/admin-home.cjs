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
	for (const id of ["local-admin", "budi", "rudi", "dewi", "agus", "sari"]) {
		await db.execute({ sql: "INSERT INTO ppic_permissions VALUES (?, ?, ?, ?, 'local-admin', datetime('now'))", args: [id, id === "local-admin" ? "SUPER_ADMIN" : "MEMBER", id === "sari" ? null : '["BARANG_DITERIMA"]', id === "sari" ? 0 : 1] });
	}
	await db.execute("CREATE TABLE ppic_scan_history (id INTEGER PRIMARY KEY, clickup_user_id TEXT, serial_number TEXT, status TEXT, task_name TEXT, scanned_at TEXT, project_task_id TEXT, component_task_id TEXT)");
	for (const [id, today, week] of [["budi", 7, 37], ["rudi", 3, 25], ["dewi", 4, 24], ["agus", 0, 16]]) {
		for (let index = 0; index < week; index++) await db.execute({ sql: "INSERT INTO ppic_scan_history (clickup_user_id, status, scanned_at) VALUES (?, 'BARANG_DITERIMA', ?)", args: [id, new Date(Date.now() - (index < today ? 0 : 86_400_000)).toISOString()] });
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
		async function session(role, token = "home") {
			const payload = Buffer.from(JSON.stringify({ user_id: "local-admin", role, allowed_status: role === "MEMBER" ? ["BARANG_DITERIMA"] : null, refreshed_at: Date.now() })).toString("base64url");
			await context.addCookies([{ name: "clickup_access_token", value: token, url: baseURL }, { name: "ppic_session", value: `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`, url: baseURL }]);
		}
		await session("SUPER_ADMIN");
		const page = await context.newPage();
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.goto(`${baseURL}/admin`);
		await expect(page.getByRole("heading", { name: "Dashboard produksi" })).toBeVisible();
		await expect(page.getByText("67%", { exact: true })).toBeVisible();
		await expect(page.getByText("24 dari 36 barang · 1 project berjalan")).toBeVisible();
		await expect(page.getByRole("region", { name: "Aktivitas scan tim" }).getByText("14", { exact: true })).toBeVisible();
		await expect(page.getByText("102", { exact: true })).toBeVisible();
		await expect(page.getByText("3/4", { exact: true })).toBeVisible();
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
		await page.getByRole("button", { name: "Bantuan", exact: true }).click();
		await expect(page.getByRole("dialog")).toContainText("termasuk scan berulang");
		await page.keyboard.press("Escape");
		await page.getByRole("button", { name: "Menu", exact: true }).click();
		await expect(page.getByRole("menuitem", { name: "Projects", exact: true })).toBeVisible();
		await page.keyboard.press("Escape");
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
		await expect(page.getByRole("main").getByRole("alert")).toContainText("Ringkasan barang belum tersedia lengkap");
		await expect(page.getByText("Data barang belum lengkap", { exact: false })).toBeVisible();
		await session("SUPER_ADMIN", "home-empty");
		await page.goto(`${baseURL}/admin`);
		await expect(page.getByText("0%", { exact: true })).toBeVisible();
		await expect(page.getByText("0 dari 0 barang · 0 project berjalan")).toBeVisible();
		await db.execute("UPDATE ppic_scan_history SET scanned_at = datetime(scanned_at, '-1 day')");
		await page.reload();
		await expect(page.getByText("Belum ada anggota yang scan hari ini.")).toBeVisible();
		await expect(page.getByRole("region", { name: "Tim hari ini" }).getByRole("button")).toHaveCount(0);
		await db.execute("DROP TABLE ppic_scan_history");
		await page.reload();
		await expect(page.getByRole("main").getByRole("alert")).toContainText("Sebagian data tim belum dapat dimuat");
		await expect(page.getByRole("region", { name: "Tim hari ini" }).getByRole("button")).toHaveCount(0);
		await expect(page.getByText("Aktivitas tim belum dapat dimuat lengkap.")).toBeVisible();
		await session("MEMBER");
		await page.goto(`${baseURL}/admin`);
		await expect(page).toHaveURL(`${baseURL}/unauthorized`);
		assert.deepEqual(errors, []);
		console.log("Admin home passed: counts, responsive layout, member detail, help/menu, project routes, active nav, empty/error states and member denial. ClickUp calls used the local Postman simulation.");
	} catch (error) {
		console.error(logs);
		throw error;
	} finally {
		await browser?.close();
		server.kill();
		db.close();
	}
}
