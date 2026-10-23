// Run after npm run build: node tests/admin-project-groups.cjs
const assert = require("node:assert/strict");
const { createHash, createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdtempSync, mkdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createClient } = require("@libsql/client");
const { chromium, expect } = require("@playwright/test");
const { STATUS_COLOR_CONFIG } = require("../src/lib/colorStatusConfig.ts");

const cssRgb = (hex) => `rgb(${[1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(", ")})`;

async function expectStatusBadge(badge, status) {
	const color = STATUS_COLOR_CONFIG[status].color;
	await expect(badge).toHaveCSS("--status-color", color);
	const textColor = STATUS_COLOR_CONFIG[status].textColor;
	await expect(badge).toHaveCSS("--status-text-color", textColor);
	const expectedTextColor = await badge.evaluate((element, textColor) => {
		const sample = document.createElement("span");
		sample.style.color = document.documentElement.classList.contains("dark")
			? `color-mix(in srgb, ${textColor} 45%, white)` : textColor;
		document.body.append(sample);
		const value = getComputedStyle(sample).color;
		sample.remove();
		return value;
	}, textColor);
	await expect(badge).toHaveCSS("color", expectedTextColor);
	const expected = await badge.evaluate((element, color) => {
		const sample = document.createElement("span");
		const opacity = document.documentElement.classList.contains("dark") ? 22 : 18;
		sample.style.backgroundColor = `color-mix(in srgb, ${color} ${opacity}%, transparent)`;
		document.body.append(sample);
		const value = getComputedStyle(sample).backgroundColor;
		sample.remove();
		return value;
	}, color);
	await expect(badge).toHaveCSS("background-color", expected);
}

async function main() {
	const directory = mkdtempSync(join(tmpdir(), "trackerprod-groups-"));
	const databaseUrl = `file:${join(directory, "dashboard.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	const token = "local-drawer-test";
	const secret = "local-drawer-test-secret";
	const baseURL = "http://127.0.0.1:3347";
	const groupName = "HPL-SOLID-DOUBLE+Plywood+19";
	const groupLabel = "HPL Solid Double · Plywood · 19 mm";
	const dashboard = {
		project: { task_id: "drawer-project", name: "Drawer test", custom_id: null, startDate: null, dueDate: null },
		items: [
			{ id: "a", name: groupName, components: Array.from({ length: 35 }, (_, index) => ({
				id: `panel-${index}`, name: `Panel ${index}`, serialNumber: `SERIAL-${index}`,
				status: index === 1 ? "DALAM_PROSES_RETUR" : index === 2 ? "BARANG_DITERIMA" : null,
				history: index === 1 ? [{ userId: "local-admin", serialNumber: "SERIAL-1", status: "DALAM_PROSES_RETUR", taskName: "Panel 1", projectTaskId: "drawer-project", componentTaskId: "panel-1", scannedAt: "2026-10-20 04:03:00" }] : [],
			})) },
			{ id: "b", name: "Other subtask", components: [{ id: "other", name: "Other group panel", serialNumber: null, status: "TERPASANG_DIGUNAKAN", history: [] }] },
			{ id: "empty", name: "Empty subtask", components: [] },
			{ id: "other-status", name: "Custom status subtask", components: [{ id: "custom", name: "Custom panel", serialNumber: null, status: "DRY_FIT", history: [] }] },
			{ id: "hardware", name: "HARDWARE LIST", components: Array.from({ length: 40 }, (_, index) => ({ id: `hardware-${index}`, name: `Hardware ${index}`, serialNumber: null, status: null, history: [] })) },
			{ id: "requisition", name: " material   requisition form ", components: Array.from({ length: 80 }, (_, index) => ({ id: `document-${index}`, name: `Document ${index}`, serialNumber: null, status: null, history: [] })) },
		].reverse(),
		recentHistory: [], memberContribution: [], memberNames: {},
		statusUpdatedAt: 1, syncedAt: Date.now(), currentStatusDurationMinutes: null, currentStatusStartedAt: null,
	};
	const scopeKey = createHash("sha256")
		.update(JSON.stringify([token, "1100830000000087", "drawer-project"])).digest("hex");
	await db.execute("CREATE TABLE ppic_admin_project_snapshot (scope_key TEXT PRIMARY KEY, dashboard_json TEXT, refresh_id TEXT, refresh_until INTEGER NOT NULL DEFAULT 0)");
	await db.execute({ sql: "INSERT INTO ppic_admin_project_snapshot (scope_key, dashboard_json) VALUES (?, ?)", args: [scopeKey, JSON.stringify(dashboard)] });
	const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3347"], {
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
		// Prevent link prefetch and unrelated session traffic from reaching any external service.
		await context.route("**/*", (route) => {
			const url = new URL(route.request().url());
			if (url.origin !== baseURL) return route.abort();
			if (url.pathname === "/api/panel/members") {
				assert.equal(route.request().method(), "GET", "color checks must not change permissions");
				return route.fulfill({ contentType: "application/json", body: JSON.stringify({
					members: [{ id: "color-test", name: "Color Test" }], roles: { "color-test": "MEMBER" },
					permissions: { "color-test": ["BARANG_DITERIMA", "SEDANG_DIPACKING", "TERPASANG_DIGUNAKAN", "DALAM_PROSES_RETUR"] },
				}) });
			}
			if (url.pathname.startsWith("/_next/") || url.pathname === "/admin/project" || url.pathname === "/admin/settings" || url.pathname === "/api/project/changes") return route.continue();
			return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
		});
		const payload = Buffer.from(JSON.stringify({ user_id: "local-admin", role: "SUPER_ADMIN", allowed_status: null, refreshed_at: Date.now() })).toString("base64url");
		const signature = createHmac("sha256", secret).update(payload).digest("base64url");
		await context.addCookies([
			{ name: "clickup_access_token", value: token, url: baseURL },
			{ name: "ppic_session", value: `${payload}.${signature}`, url: baseURL },
		]);
		const page = await context.newPage();
		await page.goto(`${baseURL}/admin/project?task_id=drawer-project`);
		const trigger = page.getByRole("button", { name: `Lihat detail ${groupLabel}`, exact: true });
		const groupList = page.locator('[aria-label="Daftar subtask"]');
		await expect(groupList.getByRole("button")).toHaveCount(6);
		await expect(groupList.getByRole("button").first()).toHaveAccessibleName(`Lihat detail ${groupLabel}`);
		await expect(groupList.getByRole("button").nth(4)).toHaveAccessibleName("Lihat detail material requisition form");
		await expect(groupList.getByRole("button").nth(5)).toHaveAccessibleName("Lihat detail HARDWARE LIST");
		await expect(trigger).toContainText("2/35");
		await expect(trigger).toContainText("sisa 33");
		await expect(trigger).toContainText("HPL Solid Double");
		const barColors = await trigger.locator('[role="img"] > span').evaluateAll((segments) => segments.map((segment) => getComputedStyle(segment).backgroundColor));
		for (const status of ["BARANG_DITERIMA", "DALAM_PROSES_RETUR"])
			assert.ok(barColors.includes(cssRgb(STATUS_COLOR_CONFIG[status].color)));
		assert.equal(await trigger.locator('[role="img"] > span').last().evaluate((segment) => segment.style.backgroundColor), cssRgb(STATUS_COLOR_CONFIG.UNSCANNED.progressColor));
		mkdirSync("test-results", { recursive: true });
		await groupList.scrollIntoViewIfNeeded();
		await page.screenshot({ path: "test-results/admin-project-groups-mobile.png", animations: "disabled" });
		await trigger.click();
		const drawer = page.getByRole("dialog", { name: groupLabel });
		await expect(drawer).toBeVisible();
		await expect(drawer.getByRole("textbox")).toHaveCount(0);
		await expect(drawer.getByRole("tab")).toHaveCount(0);
		await expect(drawer).toContainText("2/35 sudah di-scan · sisa 33");
		await expect(drawer.getByText("Panel 0", { exact: true })).toBeVisible();
		await expect(drawer.getByText("SERIAL-0", { exact: true })).toBeVisible();
		await expect(drawer.locator('[data-slot="badge"]').filter({ hasText: /^Retur$/ })).toBeVisible();
		await expectStatusBadge(drawer.locator('[data-slot="badge"]').filter({ hasText: /^Retur$/ }), "DALAM_PROSES_RETUR");
		await expectStatusBadge(drawer.locator('[data-slot="badge"]').filter({ hasText: /^Diterima$/ }), "BARANG_DITERIMA");
		await expectStatusBadge(drawer.locator('[data-slot="badge"]').filter({ hasText: /^Belum scan$/ }).first(), "UNSCANNED");
		await expect(drawer.getByText("Other group panel")).toHaveCount(0);
		assert.ok(await drawer.locator("ul").evaluate((list) => list.scrollHeight > list.clientHeight), "long component lists must scroll");
		const unscannedFilter = drawer.getByRole("button", { name: "Belum discan (33)" });
		await expect(unscannedFilter).toBeEnabled();
		await unscannedFilter.click();
		await expect(drawer.getByRole("listitem")).toHaveCount(33);
		await expect(drawer.getByText("SERIAL-0", { exact: true })).toBeVisible();
		await expect(drawer.getByText("SERIAL-1", { exact: true })).toHaveCount(0);
		await drawer.getByRole("button", { name: "Tampilkan semua item" }).click();
		await expect(drawer.getByRole("listitem")).toHaveCount(35);
		await db.execute({ sql: "INSERT INTO ppic_component_status (component_task_id, project_task_id, status, updated_at) VALUES (?, ?, ?, ?)", args: ["panel-0", "drawer-project", "SEDANG_DIPACKING", Date.now()] });
		await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
		await expect(drawer.locator('[data-slot="badge"]').filter({ hasText: /^Dipacking$/ })).toBeVisible();
		await expectStatusBadge(drawer.locator('[data-slot="badge"]').filter({ hasText: /^Dipacking$/ }), "SEDANG_DIPACKING");
		await expect(drawer.getByText("SERIAL-0", { exact: true })).toBeVisible();
		await expect(drawer.getByRole("button", { name: "Belum discan (32)" })).toBeEnabled();
		await drawer.getByRole("button", { name: "Belum discan (32)" }).click();
		await expect(drawer.getByRole("listitem")).toHaveCount(32);
		await page.screenshot({ path: "test-results/admin-project-group-drawer-mobile.png", animations: "disabled" });
		await drawer.getByRole("button", { name: "Tutup", exact: true }).click();
		await expect(drawer).not.toBeVisible();
		await expect(trigger).toBeFocused();
		await trigger.press("Enter");
		await expect(drawer).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(drawer).not.toBeVisible();
		await page.getByRole("button", { name: "Lihat detail Other subtask", exact: true }).click();
		const other = page.getByRole("dialog", { name: "Other subtask" });
		await expect(other.getByText("Other group panel", { exact: true })).toBeVisible();
		await expect(other.locator('[data-slot="badge"]').filter({ hasText: /^Terpasang$/ })).toBeVisible();
		await expectStatusBadge(other.locator('[data-slot="badge"]').filter({ hasText: /^Terpasang$/ }), "TERPASANG_DIGUNAKAN");
		await page.evaluate(() => document.documentElement.classList.add("dark"));
		await expectStatusBadge(other.locator('[data-slot="badge"]').filter({ hasText: /^Terpasang$/ }), "TERPASANG_DIGUNAKAN");
		await page.evaluate(() => document.documentElement.classList.remove("dark"));
		await expect(other.getByText("Panel 0", { exact: true })).toHaveCount(0);
		await other.getByRole("button", { name: "Tutup", exact: true }).click();
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.getByRole("button", { name: "Lihat detail Empty subtask", exact: true }).click();
		const empty = page.getByRole("dialog", { name: "Empty subtask" });
		await expect(empty.getByText("Belum ada item pada subtask ini.")).toBeVisible();
		await expect(empty).toContainText("0/0 sudah di-scan · sisa 0");
		await empty.getByRole("button", { name: "Tutup", exact: true }).click();
		await page.getByRole("button", { name: "Lihat detail Custom status subtask", exact: true }).click();
		await expect(page.getByRole("dialog", { name: "Custom status subtask" }).locator('[data-slot="badge"]').filter({ hasText: /^Lainnya$/ })).toBeVisible();
		await page.getByRole("dialog", { name: "Custom status subtask" }).getByRole("button", { name: "Tutup", exact: true }).click();
		const hardware = page.getByRole("button", { name: "Lihat detail HARDWARE LIST", exact: true });
		await expect(hardware).toContainText("Grup pendukung");
		await expect(hardware.getByRole("img")).toHaveCount(0);
		await hardware.click();
		const hardwareDrawer = page.getByRole("dialog", { name: "HARDWARE LIST" });
		await expect(hardwareDrawer.getByRole("button", { name: /Belum discan/ })).toHaveCount(0);
		await expect(hardwareDrawer).toContainText("tidak termasuk progres scan");
		await expect(hardwareDrawer.getByText("Hardware 0", { exact: true })).toBeVisible();
		await expect(hardwareDrawer.locator('[data-slot="badge"]').filter({ hasText: /^Belum scan$/ })).toHaveCount(0);
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
		for (const status of ["BARANG_DITERIMA", "SEDANG_DIPACKING", "TERPASANG_DIGUNAKAN", "DALAM_PROSES_RETUR"])
			await expectStatusBadge(memberCard.getByText(STATUS_COLOR_CONFIG[status].shortLabel, { exact: true }), status);
		await memberCard.getByRole("button", { name: "Atur", exact: true }).click();
		const settingsDrawer = page.getByRole("dialog", { name: "Color Test" });
		await settingsDrawer.getByRole("tab", { name: "Akses halaman", exact: true }).click();
		for (const status of ["BARANG_DITERIMA", "SEDANG_DIPACKING", "TERPASANG_DIGUNAKAN", "DALAM_PROSES_RETUR"]) {
			const dot = settingsDrawer.locator("label").filter({ hasText: STATUS_COLOR_CONFIG[status].label }).locator("span").first();
			await expect(dot).toHaveCSS("background-color", cssRgb(STATUS_COLOR_CONFIG[status].color));
		}
		await settingsDrawer.getByRole("button", { name: "Batal", exact: true }).click();
		await page.screenshot({ path: "test-results/status-colors-settings.png", animations: "disabled" });
		console.log("Group and shared color checks passed: central palette on project bars/badges and Settings badges/dots, dark mode, sorting, scope, polling, keyboard and empty states.");
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
