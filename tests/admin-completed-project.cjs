// Run after npm run build and starting the local Postman simulation on port 4900.
const assert = require("node:assert/strict");
const { createHash, createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdtempSync, mkdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

if (process.env.COMPLETED_REVIEW_SERVER === "1") {
	const nativeFetch = global.fetch;
	global.fetch = (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		assert.equal(url.origin, "https://api.clickup.com");
		assert.equal(init?.method ?? "GET", "GET", "review never mutates ClickUp");
		return nativeFetch(`http://127.0.0.1:4900/clickup${url.pathname}${url.search}`, { ...init, headers: { "x-test-mode": "project-complete" } });
	};
} else {
	main().catch(error => { console.error(error); process.exitCode = 1; });
}

async function main() {
	const { createClient } = require("@libsql/client");
	const { chromium, expect } = require("@playwright/test");
	await fetch("http://127.0.0.1:4900/clickup/api/v2/task/complete-project", { method: "PUT", headers: { "x-test-mode": "project-complete", "Content-Type": "application/json" }, body: JSON.stringify({ status: "complete" }) });
	const directory = mkdtempSync(join(tmpdir(), "trackerprod-review-"));
	const databaseUrl = `file:${join(directory, "review.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	const secret = "local-completed-review-secret";
	const baseURL = "http://127.0.0.1:3358";
	const dashboard = {
		project: { task_id: "complete-project", name: "AY-19880 APARTEMEN KEMANG - DAPUR", custom_id: "AY-19880", startDate: null, dueDate: null, status: "complete" },
		completion: { completedAt: "2026-10-22T10:00:00Z", capturedAt: "2026-10-22T10:00:00Z", completedBy: { userId: "admin", name: "Admin Contoh" }, source: "completion" },
		items: [{ id: "panels", name: "Panels", components: Array.from({ length: 540 }, (_, index) => {
			const day = index === 0 ? "12" : index < 269 ? "14" : index === 269 ? "17" : index < 539 ? "20" : "22";
			return { id: `panel-${index}`, serialNumber: `SERIAL-${index}`, name: `Panel ${index}`, status: index < 120 ? "BARANG_DITERIMA" : "TERPASANG_DIGUNAKAN", history: [{ componentTaskId: `panel-${index}`, projectTaskId: "complete-project", serialNumber: `SERIAL-${index}`, taskName: `Panel ${index}`, status: "BARANG_DITERIMA", scannedAt: `2026-10-${day} 02:00:00`, userId: index < 410 ? "kris" : "other" }] };
		}) }],
		memberNames: { kris: "Krisdianto", other: "Member lain" }, memberContribution: [], recentHistory: [], statusUpdatedAt: 1,
		currentStatusDurationMinutes: null, currentStatusStartedAt: null,
	};
	const key = `completed:${createHash("sha256").update(JSON.stringify(["local-review-token", "1100830000000087", "complete-project"])).digest("hex")}`;
	await db.execute("CREATE TABLE ppic_admin_project_snapshot (scope_key TEXT PRIMARY KEY, dashboard_json TEXT, refresh_id TEXT, refresh_until INTEGER NOT NULL DEFAULT 0)");
	const save = () => db.execute({ sql: "INSERT OR REPLACE INTO ppic_admin_project_snapshot (scope_key, dashboard_json) VALUES (?, ?)", args: [key, JSON.stringify(dashboard)] });
	await save();
	const server = spawn(process.execPath, ["--require", __filename, "node_modules/next/dist/bin/next", "start", "-p", "3358"], {
		windowsHide: true, stdio: "pipe", env: { ...process.env, COMPLETED_REVIEW_SERVER: "1", TURSO_DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "local-only", CLICKUP_CLIENT_SECRET: secret, CLICKUP_PPIC_PANEL_LIST_ID: "1100830000000087", ABLY_API_KEY: "" },
	});
	let logs = "";
	server.stdout.on("data", chunk => { logs += chunk; });
	server.stderr.on("data", chunk => { logs += chunk; });
	let browser;
	try {
		for (let attempt = 0; ; attempt++) {
			try { if ((await fetch(`${baseURL}/login`)).ok) break; } catch {}
			if (attempt >= 60 || server.exitCode !== null) throw Error(logs);
			await new Promise(done => setTimeout(done, 100));
		}
		browser = await chromium.launch({ headless: true });
		const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const payload = Buffer.from(JSON.stringify({ user_id: "admin", role: "SUPER_ADMIN", allowed_status: null, refreshed_at: Date.now() })).toString("base64url");
		await context.addCookies([
			{ name: "ppic_session", value: `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`, url: baseURL },
			{ name: "clickup_access_token", value: "local-review-token", url: baseURL },
		]);
		const clientCalls = [];
		await context.route("**/*", route => {
			const url = new URL(route.request().url());
			if (url.origin !== baseURL) return route.abort();
			if (url.pathname.startsWith("/api/")) { clientCalls.push(url.pathname); return route.fulfill({ status: 401, json: {} }); }
			return route.continue();
		});
		await context.addInitScript(() => { window.print = () => { window.printCalls = (window.printCalls ?? 0) + 1; }; });
		const page = await context.newPage();
		await page.goto(`${baseURL}/admin/project?task_id=complete-project&review=completed`);
		await expect(page.getByRole("heading", { name: dashboard.project.name, exact: true })).toBeVisible();
		await expect(page.getByText("Selesai 22 Okt 2026", { exact: true })).toBeVisible();
		await expect(page.getByRole("definition").filter({ hasText: /^540\/540/ })).toBeVisible();
		await expect(page.getByRole("definition").filter({ hasText: /^10 hari/ })).toBeVisible();
		await expect(page.getByText("17 Okt · 50% terscan", { exact: true })).toBeVisible();
		await expect(page.getByRole("row", { name: "Krisdianto 410 scan" })).toBeVisible();
		await expect(page.getByRole("row", { name: "Member lain 130 scan" })).toBeVisible();
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		mkdirSync("test-results", { recursive: true });
		await page.screenshot({ path: "test-results/completed-project-review-mobile.png", fullPage: true });
		await page.getByRole("button", { name: "Unduh laporan", exact: true }).click();
		assert.equal(await page.evaluate(() => window.printCalls), 1);
		await page.waitForTimeout(10_500);
		assert.deepEqual(clientCalls.filter(path => path.startsWith("/api/project/")), [], "completed review never polls mutable status APIs");
		await page.setViewportSize({ width: 794, height: 1123 });
		await page.emulateMedia({ media: "print" });
		await expect(page.getByRole("navigation", { name: "Main navigation" })).not.toBeVisible();
		await expect(page.getByRole("button", { name: "Unduh laporan", exact: true })).not.toBeVisible();
		await page.screenshot({ path: "test-results/completed-project-review-print.png", fullPage: true });
		const pdf = await page.pdf({ path: "test-results/completed-project-review.pdf", preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
		const pages = pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
		assert.equal(pages, 1, "the example review fits neatly on one A4 page");
		for (const [index, component] of dashboard.items[0].components.entries()) {
			const id = `member-${index % 60}`;
			component.history[0].userId = id;
			dashboard.memberNames[id] = `Member ${index % 60} dengan nama lengkap untuk laporan`;
		}
		await save();
		await page.reload();
		await expect(page.locator("tbody tr")).toHaveCount(60);
		const longPdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
		assert.ok((longPdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0) > 1, "long contribution tables paginate rather than clip");
		dashboard.completion.source = "first-view";
		dashboard.completion.completedBy = null;
		dashboard.completion.completedAt = null;
		dashboard.items = [];
		await save();
		await page.emulateMedia({ media: "screen" });
		await page.reload();
		await expect(page.getByText(/kondisi item saat project selesai tidak tersedia/)).toBeVisible();
		await expect(page.getByText("Selesai · tanggal tidak tercatat", { exact: true })).toBeVisible();
		await expect(page.getByRole("definition").filter({ hasText: /^0\/0/ })).toBeVisible();
		await expect(page.getByText("Belum ada riwayat scan yang tercatat.")).toBeVisible();
		console.log("Completed review page: saved snapshot, 540 items, milestones, member contributions, mobile layout, no polling, print button, one-page A4 PDF and legacy empty state passed.");
	} finally { await browser?.close(); server.kill(); db.close(); }
}
