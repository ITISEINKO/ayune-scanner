// After npm run build, start postman/simulations/admin-dashboard.sim.yaml on port 4900.
// Run: node tests/admin-manual-location.cjs
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

if (process.env.MANUAL_LOCATION_SERVER === "1") {
	const nativeFetch = global.fetch;
	global.fetch = (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		assert.equal(url.origin, "https://api.clickup.com", "server must not contact LBY or another service");
		assert(!["/api/v2/task/manual-group", "/api/v2/task/z96buhry4p"].includes(url.pathname), "location must not fetch the project hierarchy");
		assert.equal(new Headers(init?.headers).get("Authorization"), "manual-local-only");
		return nativeFetch(`http://127.0.0.1:4900/clickup${url.pathname}${url.search}`, {
			...init, headers: { ...init?.headers, "x-test-mode": readFileSync(process.env.MANUAL_LOCATION_MODE_FILE, "utf8") },
		});
	};
} else {
	main().catch((error) => { console.error(error); process.exitCode = 1; });
}

async function main() {
	const { createClient } = require("@libsql/client");
	const { chromium, expect } = require("@playwright/test");
	const directory = mkdtempSync(join(tmpdir(), "trackerprod-manual-location-"));
	const modeFile = join(directory, "mode.txt");
	const setMode = (mode) => writeFileSync(modeFile, mode);
	setMode("manual-location");
	const control = async (path) => (await fetch(`http://127.0.0.1:4900/clickup/test/${path}`, { headers: { "x-test-mode": "manual-location" } })).json();
	await control("reset");
	const databaseUrl = `file:${join(directory, "manual.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, role TEXT, active INTEGER, allowed_status TEXT)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('manual-admin', 'ADMIN', 1, NULL)");
	await db.execute("CREATE TABLE ppic_component_status (component_task_id TEXT PRIMARY KEY, project_task_id TEXT, status TEXT, updated_at INTEGER)");
	await db.execute("INSERT INTO ppic_component_status VALUES ('manual-panel', 'z96buhry4p', 'BARANG_DITERIMA', 1)");
	const localStatus = async () => (await db.execute("SELECT status FROM ppic_component_status WHERE component_task_id='manual-panel'")).rows[0].status;
	const secret = "manual-location-local-secret", base = "http://127.0.0.1:3361";
	const server = spawn(process.execPath, ["--require", __filename, "node_modules/next/dist/bin/next", "start", "-p", "3361"], {
		windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
		env: { ...process.env, MANUAL_LOCATION_SERVER: "1", MANUAL_LOCATION_MODE_FILE: modeFile,
			TURSO_DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "local-only", CLICKUP_CLIENT_SECRET: secret,
			CLICKUP_PPIC_PANEL_LIST_ID: "1100830000000087", CLICKUP_FIELD_STATUS_BARANG_SCAN: "3d3a2535-9d01-4ca2-8a51-9b2f9182857c", ABLY_API_KEY: "" },
	});
	let logs = "", browser;
	server.stdout.on("data", (chunk) => { logs += chunk; });
	server.stderr.on("data", (chunk) => { logs += chunk; });
	try {
		for (let attempt = 0; ; attempt++) {
			try { if ((await fetch(`${base}/login`)).ok) break; } catch {}
			if (attempt > 60 || server.exitCode !== null) throw new Error(logs);
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		browser = await chromium.launch();
		const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const external = [], errors = [];
		await context.route("**/*", (route) => {
			if (new URL(route.request().url()).origin !== base) { external.push(route.request().url()); return route.abort(); }
			return route.continue();
		});
		const page = await context.newPage();
		page.on("pageerror", (error) => errors.push(error.message));
		await page.goto(`${base}/admin/ubah-manual/location?barcode=15370046376`);
		await expect(page).toHaveURL(/\/login/);
		const authenticate = async (role) => {
			const payload = Buffer.from(JSON.stringify({ user_id: "manual-admin", role,
				allowed_status: role === "MEMBER" ? ["BARANG_DITERIMA"] : null, refreshed_at: Date.now() })).toString("base64url");
			const signature = createHmac("sha256", secret).update(payload).digest("base64url");
			await context.addCookies([{ name: "clickup_access_token", value: "manual-local-only", url: base },
				{ name: "ppic_session", value: `${payload}.${signature}`, url: base }]);
		};
		await authenticate("ADMIN");
		const scan = async (serial) => {
			await page.goto(`${base}/admin/ubah-manual`);
			await page.getByRole("button", { name: "Keyboard", exact: true }).click();
			await page.getByRole("textbox", { name: "Input scan keyboard" }).fill(serial);
			await expect(page).toHaveURL(`${base}/admin/ubah-manual/location?barcode=${serial}`);
		};
		await scan("15370046376");
		const svg = page.locator("svg[data-selected-barcode]");
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370046376");
		await expect(svg).toHaveAttribute("data-panel-count", "15");
		assert.equal(await svg.locator('polygon[fill="#ef4444"]').count(), 6);
		const nav = page.getByRole("navigation", { name: "Main navigation" });
		await expect(nav).toBeVisible();
		await expect(nav.getByRole("link", { name: "Scan", exact: true })).toHaveAttribute("aria-current", "page");
		await expect(page.getByRole("dialog")).toHaveCount(0);
		assert.equal((await control("writes")).writes, 0, "scanning and viewing must not update status");
		const statusCard = page.locator('section[aria-label="Status barang"]');
		const editButton = statusCard.getByRole("button", { name: "Ubah status barang", exact: true });
		await editButton.scrollIntoViewIfNeeded();
		const buttonBounds = await editButton.boundingBox(), navBounds = await nav.boundingBox();
		assert(buttonBounds.y + buttonBounds.height <= navBounds.y, "status button must clear the fixed navigation");
		assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		const canvasBounds = await svg.boundingBox(), cardBounds = await statusCard.boundingBox();
		assert(canvasBounds.height > 300, "the model must fill the available portrait canvas");
		const viewerBounds = await page.getByRole("region", { name: "Lokasi panel", exact: true }).boundingBox();
		assert(Math.abs(canvasBounds.width - viewerBounds.width) <= 1 && Math.abs(canvasBounds.x - viewerBounds.x) <= 1, "canvas must extend under floating controls across the full viewer width");
		assert(cardBounds.y + cardBounds.height >= navBounds.y + navBounds.height - 1, "the status card background must extend behind navigation without a gap");
		assert(await statusCard.evaluate((element) => parseFloat(getComputedStyle(element).borderTopLeftRadius) >= 24));
		assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), "portrait location view must fit the screen");
		const initialPoints = await svg.locator("polygon").first().getAttribute("points");
		await page.getByRole("button", { name: "Putar kanan", exact: true }).click();
		await expect(svg.locator("polygon").first()).not.toHaveAttribute("points", initialPoints);
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		const initialBox = await svg.getAttribute("viewBox");
		await page.getByRole("button", { name: "Perbesar", exact: true }).click();
		await expect(svg).not.toHaveAttribute("viewBox", initialBox);
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await page.getByRole("button", { name: "Explode panel", exact: true }).click();
		await expect(svg).toHaveAttribute("data-explode", "100");
		await page.getByRole("button", { name: "Perkecil", exact: true }).click();
		await page.getByRole("button", { name: "Perkecil", exact: true }).click();
		await expect.poll(() => svg.evaluate((element) => element.getAnimations({ subtree: true }).some((animation) => animation.playState === "running"))).toBe(false);
		await expect.poll(() => svg.evaluate((element) => {
			const bounds = element.getBoundingClientRect();
			return [...element.querySelectorAll("path, polygon")].every((polygon) => {
				const panel = polygon.getBoundingClientRect();
				return panel.left >= bounds.left - 1 && panel.right <= bounds.right + 1 && panel.top >= bounds.top - 1 && panel.bottom <= bounds.bottom + 1;
			});
		})).toBe(true);
		await page.screenshot({ path: "test-results/admin-manual-location-exploded-mobile.png", fullPage: true });
		await page.getByRole("button", { name: "Reset tampilan", exact: true }).click();
		await expect.poll(() => svg.evaluate((element) => element.getAnimations({ subtree: true }).some((animation) => animation.playState === "running"))).toBe(false);
		mkdirSync("test-results", { recursive: true });
		await page.screenshot({ path: "test-results/admin-manual-location-frame-mobile.png", fullPage: true });
		await editButton.click();
		const dialog = page.getByRole("dialog");
		await expect(dialog).toContainText("Serial: 15370046376");
		await dialog.getByRole("button").filter({ hasText: "SEDANG DIPACKING" }).click();
		setMode("manual-location-save-fail");
		await dialog.getByRole("button", { name: "Ya, ubah status", exact: true }).click();
		await expect(page.getByText("Gagal memperbarui status", { exact: true })).toBeVisible();
		assert.equal(await localStatus(), "BARANG_DITERIMA", "failed upstream update must preserve local status");
		assert.equal((await control("writes")).writes, 0);
		setMode("manual-location");
		await dialog.getByRole("button", { name: "Ya, ubah status", exact: true }).click();
		await expect(page.getByText("Status berhasil diperbarui.", { exact: true })).toBeVisible();
		await expect.poll(localStatus).toBe("SEDANG_DIPACKING");
		assert.equal((await control("writes")).writes, 1);
		await page.keyboard.press("Escape");
		await expect(dialog).not.toBeVisible();
		await expect(statusCard).toContainText("SEDANG DIPACKING");
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370046376");
		mkdirSync("test-results", { recursive: true });
		await page.screenshot({ path: "test-results/admin-manual-location-mobile.png", fullPage: true });
		await page.goto(`${base}/admin/ubah-manual/location?barcode=15370046368`);
		await expect(page).toHaveURL(/\/admin\/ubah-manual\/location\?/);
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370046368");
		await expect(statusCard).toContainText("Serial: 15370046368");
		await page.getByRole("button", { name: "Scan panel lain" }).click();
		await expect(page.getByRole("heading", { name: "Ubah status barang", exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Keyboard", exact: true }).click();
		await page.getByRole("textbox", { name: "Input scan keyboard" }).fill("15370040711");
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370040711");
		await expect(page.getByRole("heading", { level: 1 })).toContainText("FIORDINI");
		await page.reload();
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370040711");
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.screenshot({ path: "test-results/admin-manual-location-desktop.png", fullPage: true });
		const lookup = (serial) => context.request.get(`${base}/api/panel/manual?${new URLSearchParams({ serial_number: serial })}`);
		setMode("manual-location-lby-only");
		let response = await lookup("15370046376");
		assert.equal(response.status(), 200, "LBY location must remain available when ClickUp has no task");
		let lbyOnly = (await response.json()).data;
		assert.equal(lbyOnly.task_id, null);
		assert.equal(lbyOnly.status, null, "missing ClickUp task must not invent a status");
		assert.equal(lbyOnly.location.barcode, "15370046376");
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`${base}/admin/ubah-manual/location?barcode=15370046376`);
		await expect(svg).toHaveAttribute("data-selected-barcode", "15370046376");
		await expect(editButton).toBeDisabled();
		await expect(statusCard).toContainText("Task ClickUp untuk serial ini belum ditemukan");
		await expect(statusCard).toContainText("STATUS TIDAK TERSEDIA");
		assert.equal((await control("writes")).writes, 1, "LBY-only lookup must not write to ClickUp");
		assert.equal((await context.request.post(`${base}/api/panel/manual`, { data: { task_id: null, status: "BARANG_DITERIMA" } })).status(), 400, "an LBY-only panel cannot be used as a status-write target");
		assert.equal((await lookup("unknown")).status(), 404, "absent from both sources remains not found");
		await page.screenshot({ path: "test-results/admin-manual-location-lby-only.png", fullPage: true });
		setMode("manual-location-parent");
		let result = await (await lookup("15370046376")).json();
		assert.equal(result.data.location.projectId, "z96buhry4p", "serial lookup must work without resolving nested parents");
		assert.equal(result.data.location.panels.length, 15);
		setMode("manual-location");
		await page.goto(`${base}/admin/ubah-manual/location?barcode=no-model`);
		await expect(page.getByRole("status")).toContainText("Lokasi panel belum tersedia");
		await expect(editButton).toBeEnabled();
		assert.equal(await svg.count(), 0);
		result = await (await lookup("missing-panel")).json();
		assert.equal(result.data.location, null, "unknown model serial must not return unrelated room geometry");
		assert.equal((await lookup("unknown")).status(), 404);
		assert.equal((await lookup("duplicate")).status(), 409);
		assert.equal((await lookup("a".repeat(101))).status(), 400);
		setMode("manual-location-cycle");
		result = await (await lookup("15370046376")).json();
		assert.equal(result.data.location.projectId, "z96buhry4p", "a cyclic ClickUp hierarchy cannot prevent serial lookup");
		assert.equal(result.data.location_error, undefined);
		assert.equal(result.data.task_id, "manual-panel", "serial lookup must retain status editing");
		setMode("manual-location-rate-limit");
		assert.equal((await lookup("15370046376")).status(), 429);
		setMode("manual-location");
		await db.execute("UPDATE ppic_permissions SET role='MEMBER', active=0 WHERE clickup_user_id='manual-admin'");
		const denied = await context.request.post(`${base}/api/panel/manual`, { data: { task_id: "manual-panel", status: "BARANG_DITERIMA" } });
		assert(denied.url().endsWith("/unauthorized"), "fresh authorization must reject a revoked admin before writing");
		assert.equal((await control("writes")).writes, 1);
		await authenticate("MEMBER");
		await page.goto(`${base}/admin/ubah-manual/location?barcode=15370046376`);
		await expect(page).toHaveURL(/\/unauthorized/);
		assert.deepEqual(errors, []);
		assert.deepEqual(external, []);
		console.log("PASS: scan-to-location page, LBY room filtering, active bottom nav, drawer confirmation, failed/successful status writes, serial lookup without hierarchy, missing models, refresh/search, mobile layout, errors and fresh revocation (local Postman HTTP, no live services).");
	} catch (error) { console.error(logs); throw error; }
	finally { await browser?.close(); server.kill(); db.close(); }
}
