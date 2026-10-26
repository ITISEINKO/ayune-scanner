// Run after npm run build: node --experimental-strip-types tests/settings-member-overview.cjs
// Check only the member list and drawer entry: append --layout-only.
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdtempSync, mkdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createClient } = require("@libsql/client");
const { chromium, expect } = require("@playwright/test");
const { STATUS_COLOR_CONFIG } = require("../src/lib/colorStatusConfig.ts");

const cssRgb = (hex) => `rgb(${[1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(", ")})`;

async function main() {
	const directory = mkdtempSync(join(tmpdir(), "trackerprod-groups-"));
	const databaseUrl = `file:${join(directory, "dashboard.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	const token = "local-drawer-test";
	const secret = "local-drawer-test-secret";
	const baseURL = "http://127.0.0.1:3348";
	const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3348"], {
		cwd: join(__dirname, ".."), windowsHide: true,
		env: { ...process.env, TURSO_DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "local-only", CLICKUP_CLIENT_SECRET: secret, CLICKUP_PPIC_PANEL_LIST_ID: "1100830000000087", ABLY_API_KEY: "" },
		stdio: ["ignore", "pipe", "pipe"],
	});
	let logs = "";
	server.stdout.on("data", (chunk) => { logs += chunk; });
	server.stderr.on("data", (chunk) => { logs += chunk; });
	let browser;
	try {
		for (let attempt = 0; ; attempt += 1) {
			try { if ((await fetch(`${baseURL}/login`)).ok) break; } catch {}
			if (attempt >= 60 || server.exitCode !== null) throw new Error(`Test server failed: ${logs}`);
			await new Promise((done) => setTimeout(done, 250));
		}
		browser = await chromium.launch();
		const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
		let summaryMode = "normal";
		const summaryPeriods = [];
		// Prevent link prefetch and unrelated session traffic from reaching any external service.
		await context.route("**/*", (route) => {
			const url = new URL(route.request().url());
			if (url.origin !== baseURL) return route.abort();
			if (url.pathname === "/api/panel/members/summary") {
				assert.equal(route.request().method(), "GET");
				assert.ok(["color-test", "inactive-test"].includes(url.searchParams.get("user_id")));
				const period = url.searchParams.get("period");
				summaryPeriods.push(period);
				if (summaryMode === "error") return route.fulfill({ status: 502, json: { error: "DATABASE_ERROR" } });
				const days = period === "month" ? 23 : Number(period);
				const counts = summaryMode === "empty" ? Array(days).fill(0) : Array.from({ length: days }, (_, index) => index + 1);
				const total = counts.reduce((sum, count) => sum + count, 0);
				return route.fulfill({ json: {
					total, today: counts.at(-1), previousTotal: 10,
					lastScannedAt: "2026-10-23T02:00:00.000Z",
					days: counts.map((count, index) => ({ date: new Date(Date.UTC(2026, 9, 23 - days + 1 + index)).toISOString().slice(0, 10), count })),
					statuses: Object.keys(STATUS_COLOR_CONFIG).filter((status) => !["UNSCANNED", "OTHER"].includes(status)).map((status, index) => ({ status, count: index === 0 ? total : 0 })),
				} });
			}
			if (url.pathname === "/api/panel/members") {
				assert.equal(route.request().method(), "GET", "color checks must not change permissions");
				return route.fulfill({ contentType: "application/json", body: JSON.stringify({
					members: [
						{ id: "color-test", name: "Color Test" },
						{ id: "receiving-test", name: "Receiving Test" },
						{ id: "admin-test", name: "Admin Test" },
						{ id: "inactive-test", name: "Inactive Test" },
						{ id: "unassigned-test", name: "Unassigned Test" },
					],
					roles: { "color-test": "MEMBER", "receiving-test": "MEMBER", "admin-test": "SUPER_ADMIN", "inactive-test": "MEMBER" },
					permissions: {
						"color-test": ["BARANG_DITERIMA", "SEDANG_DIPACKING", "TERPASANG_DIGUNAKAN", "DALAM_PROSES_RETUR"],
						"receiving-test": ["BARANG_DITERIMA"], "admin-test": null, "inactive-test": null,
					},
				}) });
			}
			if (url.pathname.startsWith("/_next/") || url.pathname === "/admin/settings") return route.continue();
			return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
		});
		const payload = Buffer.from(JSON.stringify({ user_id: "local-admin", role: "SUPER_ADMIN", allowed_status: null, refreshed_at: Date.now() })).toString("base64url");
		const signature = createHmac("sha256", secret).update(payload).digest("base64url");
		await context.addCookies([
			{ name: "clickup_access_token", value: token, url: baseURL },
			{ name: "ppic_session", value: `${payload}.${signature}`, url: baseURL },
		]);
		const page = await context.newPage();
		mkdirSync("test-results", { recursive: true });
		await page.goto(`${baseURL}/admin/settings`);
		const statusFilter = page.locator(".no-scrollbar");
		await expect(statusFilter).toHaveCSS("scrollbar-width", "none");
		assert.equal(
			await statusFilter.evaluate((element) =>
				getComputedStyle(element, "::-webkit-scrollbar").display,
			),
			"none",
		);
		const memberCard = page.locator("article").filter({ hasText: "Color Test" });
		await expect(page.getByRole("heading", { name: "Pengguna & aktivitas", exact: true })).toBeVisible();
		await expect(page.locator("article")).toHaveCount(3);
		await expect(page.getByRole("button", { name: "Lihat detail Admin Test", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Atur", exact: true })).toHaveCount(0);
		await statusFilter.getByRole("button", { name: STATUS_COLOR_CONFIG.SEDANG_DIPACKING.shortLabel, exact: true }).click();
		await expect(page.locator("article")).toHaveCount(1);
		await expect(memberCard).toBeVisible();
		await statusFilter.getByRole("button", { name: "Nonaktif", exact: true }).click();
		await expect(page.locator("article")).toHaveCount(2);
		await expect(page.getByRole("button", { name: "Lihat detail Admin Test", exact: true })).toHaveCount(0);
		await page.getByRole("textbox", { name: "Search by name" }).fill("Inactive");
		await expect(page.locator("article")).toHaveCount(1);
		await page.locator("article").filter({ hasText: "Inactive Test" }).click();
		const inactiveDrawer = page.getByRole("dialog", { name: "Inactive Test", exact: true });
		await expect(inactiveDrawer).toBeVisible();
		await inactiveDrawer.getByRole("tab", { name: "Akses halaman", exact: true }).click();
		await inactiveDrawer.getByRole("button", { name: "Batal", exact: true }).click();
		await page.getByRole("textbox", { name: "Search by name" }).fill("");
		await statusFilter.getByRole("button", { name: "Semua", exact: true }).click();
		await expect(page.locator("article")).toHaveCount(3);
		await page.screenshot({ path: "test-results/settings-members-mobile.png", animations: "disabled" });
		await page.setViewportSize({ width: 1280, height: 900 });
		await expect(page.locator("article")).toHaveCount(3);
		await page.screenshot({ path: "test-results/settings-members-desktop.png", animations: "disabled" });
		await memberCard.getByRole("button", { name: "Lihat detail Color Test", exact: true }).focus();
		await page.keyboard.press("Space");
		const keyboardDrawer = page.getByRole("dialog", { name: "Color Test", exact: true });
		await expect(keyboardDrawer).toBeVisible();
		await keyboardDrawer.getByRole("tab", { name: "Akses halaman", exact: true }).click();
		await keyboardDrawer.getByRole("button", { name: "Batal", exact: true }).click();
		await page.setViewportSize({ width: 390, height: 844 });
		console.log("Settings layout passed: active/admin list, inactive and status filters, search, card click, keyboard drawer entry, mobile and desktop.");
		if (process.argv.includes("--layout-only")) return;
		summaryPeriods.length = 0;
		await memberCard.click();
		const settingsDrawer = page.getByRole("dialog", { name: "Color Test" });
		await expect(settingsDrawer.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
		await expect(settingsDrawer.getByRole("heading", { name: "Scan per status", exact: true })).toBeVisible();
		await expect(settingsDrawer.getByRole("heading", { name: "Total scan", exact: true }).locator("..")).toContainText("28");
		await expect(settingsDrawer.getByRole("button", { name: "Simpan", exact: true })).toHaveCount(0);
		await page.screenshot({ path: "test-results/settings-member-overview-mobile.png", animations: "disabled" });
		await expect(settingsDrawer.getByRole("heading", { name: "Hari ini (sementara)", exact: true })).toBeVisible();
		await expect(settingsDrawer.getByText("+180% vs 7 hari sebelumnya", { exact: true })).toBeVisible();
		await expect(settingsDrawer.getByText(/periode ini mencakup hari ini yang belum selesai, dibandingkan dengan 7 hari penuh sebelumnya/)).toBeVisible();
		await expect(settingsDrawer.locator('[aria-label="Periode ringkasan"]').getByRole("button")).toHaveCount(3);
		await settingsDrawer.getByRole("button", { name: "30 hari", exact: true }).click();
		await expect(settingsDrawer.getByRole("heading", { name: "Total scan", exact: true }).locator("..")).toContainText("465");
		await expect(settingsDrawer.getByRole("region", { name: /Grafik scan harian/ }).locator("[aria-label$='scan']")).toHaveCount(30);
		await settingsDrawer.getByRole("button", { name: "Bulan ini", exact: true }).click();
		await expect(settingsDrawer.getByRole("heading", { name: "Total scan", exact: true }).locator("..")).toContainText("276");
		await expect(settingsDrawer.getByRole("region", { name: /Grafik scan harian/ }).locator("[aria-label$='scan']")).toHaveCount(23);
		assert.ok(await settingsDrawer.getByRole("region", { name: /Grafik scan harian/ }).evaluate((element) => element.scrollWidth > element.clientWidth));
		await expect(settingsDrawer.getByText(/dibandingkan dengan 23 hari penuh sebelumnya/)).toBeVisible();
		assert.deepEqual(summaryPeriods.slice(0, 3), ["7", "30", "month"]);
		await settingsDrawer.getByRole("tab", { name: "Akses halaman", exact: true }).click();
		for (const status of ["BARANG_DITERIMA", "SEDANG_DIPACKING", "TERPASANG_DIGUNAKAN", "DALAM_PROSES_RETUR"]) {
			const dot = settingsDrawer.locator("label").filter({ hasText: STATUS_COLOR_CONFIG[status].label }).locator("span").first();
			await expect(dot).toHaveCSS("background-color", cssRgb(STATUS_COLOR_CONFIG[status].color));
		}
		await settingsDrawer.getByRole("button", { name: "Batal", exact: true }).click();
		const cardTrigger = memberCard.getByRole("button", { name: "Lihat detail Color Test", exact: true });
		await cardTrigger.focus();
		await cardTrigger.press("Enter");
		await expect(settingsDrawer.getByRole("button", { name: "7 hari", exact: true })).toHaveAttribute("aria-pressed", "true");
		summaryMode = "empty";
		await settingsDrawer.getByRole("button", { name: "Bulan ini", exact: true }).click();
		await expect(settingsDrawer.getByText("Belum ada scan pada periode ini.", { exact: true })).toBeVisible();
		summaryMode = "error";
		await settingsDrawer.getByRole("button", { name: "7 hari", exact: true }).click();
		await expect(settingsDrawer.getByRole("alert")).toContainText("Gagal memuat ringkasan scan.", { timeout: 15000 });
		summaryMode = "normal";
		await settingsDrawer.getByRole("button", { name: "Coba lagi", exact: true }).click();
		await expect(settingsDrawer.getByRole("heading", { name: "Scan per status", exact: true })).toBeVisible();
		await settingsDrawer.getByRole("tab", { name: "Akses halaman", exact: true }).click();
		await expect(settingsDrawer.getByRole("button", { name: "Simpan", exact: true })).toBeVisible();
		await settingsDrawer.getByRole("button", { name: "Batal", exact: true }).click();
		await page.screenshot({ path: "test-results/status-colors-settings.png", animations: "disabled" });
		console.log("Settings overview passed: period filters, daily chart, status summary, empty/error/retry states and access tab.");
	} finally {
		await browser?.close();
		server.kill();
		server.stdout.destroy();
		server.stderr.destroy();
		server.unref();
		db.close();
	}
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
