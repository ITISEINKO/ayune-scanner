// Run after npm run build: node tests/admin-project-complete.cjs
const assert = require("node:assert/strict");
const { createHash, createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdtempSync, mkdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createClient } = require("@libsql/client");
const { chromium, expect } = require("@playwright/test");

(async () => {
	const directory = mkdtempSync(join(tmpdir(), "trackerprod-complete-"));
	const databaseUrl = `file:${join(directory, "dashboard.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	const token = "local-complete-test";
	const secret = "local-complete-secret";
	const baseURL = "http://127.0.0.1:3349";
	const dashboard = {
		project: { task_id: "complete-project", name: "Rak Buku · Kantor Contoh", custom_id: "DEMO-001", startDate: null, dueDate: null, status: "in progress" },
		items: [{ id: "group", name: "Plywood", components: [null, null, null, "DALAM_PROSES_RETUR"].map((status, i) => ({ id: `panel-${i}`, name: `Panel ${i}`, serialNumber: `SERIAL-${i}`, status, history: [] })) },
			{ id: "docs", name: "HARDWARE LIST", components: [{ id: "doc", name: "Document", serialNumber: null, status: null, history: [] }] }],
		recentHistory: [], memberContribution: [], memberNames: {}, statusUpdatedAt: 1, syncedAt: Date.now(), currentStatusDurationMinutes: null, currentStatusStartedAt: null,
	};
	const scopeKey = createHash("sha256").update(JSON.stringify([token, "1100830000000087", "complete-project"])).digest("hex");
	await db.execute("CREATE TABLE ppic_admin_project_snapshot (scope_key TEXT PRIMARY KEY, dashboard_json TEXT, refresh_id TEXT, refresh_until INTEGER NOT NULL DEFAULT 0)");
	await db.execute({ sql: "INSERT INTO ppic_admin_project_snapshot (scope_key, dashboard_json) VALUES (?, ?)", args: [scopeKey, JSON.stringify(dashboard)] });
	const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3349"], {
		windowsHide: true, stdio: "pipe", env: { ...process.env, TURSO_DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "local-only", CLICKUP_CLIENT_SECRET: secret, CLICKUP_PPIC_PANEL_LIST_ID: "1100830000000087", ABLY_API_KEY: "" },
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
		const context = await browser.newContext({ viewport: { width: 350, height: 750 } });
		const payload = Buffer.from(JSON.stringify({ user_id: "local-admin", role: "SUPER_ADMIN", allowed_status: null, refreshed_at: Date.now() })).toString("base64url");
		await context.addCookies([
			{ name: "clickup_access_token", value: token, url: baseURL },
			{ name: "ppic_session", value: `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`, url: baseURL },
		]);
		let writes = 0;
		let completedReads = 0;
		let projectCompleted = false;
		let responseMode = "conflict";
		let finish;
		await context.route("**/*", async route => {
			const url = new URL(route.request().url());
			if (url.origin !== baseURL) return route.abort();
			if (url.pathname === "/api/project/changes") return route.fulfill({ json: { changes: [] } });
			if (url.pathname === "/api/project/sync") return route.fulfill({ json: { dashboard } });
			if (url.pathname === "/api/projects") {
				const completed = url.searchParams.get("status") === "complete";
				if (completed) completedReads++;
				return route.fulfill({ json: { tasks: !completed || projectCompleted ? [{ id: "complete-project", name: dashboard.project.name }] : [] } });
			}
			if (url.pathname === "/api/project/complete") {
				writes++;
				assert.deepEqual(route.request().postDataJSON(), { task_id: "complete-project" });
				if (responseMode === "conflict") return route.fulfill({ status: 409, json: { error: "PROJECT_HAS_UNSCANNED_SERIALS" } });
				if (responseMode === "failure") return route.fulfill({ status: 502, json: { error: "CLICKUP_ERROR" } });
				await new Promise(done => { finish = done; });
				projectCompleted = true;
				return route.fulfill({ json: { task: { id: "complete-project" }, dashboard: {
					...dashboard, project: { ...dashboard.project, status: "complete" },
					completion: { completedAt: "2026-10-22T10:00:00Z", capturedAt: "2026-10-22T10:00:00Z", completedBy: { userId: "admin", name: "Admin Contoh" }, source: "completion" },
				} } });
			}
			if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 401, json: {} });
			return route.continue();
		});
		const page = await context.newPage();
		await page.goto(`${baseURL}/admin/projects`);
		await page.getByRole("combobox", { name: "Status project" }).click();
		await page.getByRole("option", { name: "Completed", exact: true }).click();
		await expect(page.getByRole("heading", { name: "Belum ada project selesai", exact: true })).toBeVisible();
		assert.equal(completedReads, 1);
		await page.getByRole("combobox", { name: "Status project" }).click();
		await page.getByRole("option", { name: "In progress", exact: true }).click();
		await page.getByRole("link", { name: /Rak Buku/ }).click();
		await expect(page.getByText("Masih ada 3 barang belum discan.")).toBeVisible();
		await page.getByRole("button", { name: "Tandai selesai", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Tandai Rak Buku · Kantor Contoh selesai?" });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText("3 barang belum memiliki Status Barang Scan. 1 barang masih dalam proses retur.")).toBeVisible();
		await expect(dialog.getByRole("button", { name: "Ya, tandai selesai" })).toBeDisabled();
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		mkdirSync("test-results", { recursive: true });
		await page.screenshot({ path: "test-results/admin-project-complete-blocked.png" });
		await dialog.getByRole("button", { name: "Batal", exact: true }).click();
		assert.equal(writes, 0);
		for (const component of dashboard.items[0].components) component.status ??= "BARANG_DITERIMA";
		await page.getByRole("button", { name: "Sinkronkan dashboard" }).click();
		await expect(page.getByText("Semua serial sudah memiliki status scan.")).toBeVisible();
		await page.getByRole("button", { name: "Tandai selesai", exact: true }).click();
		await expect(dialog.getByRole("button", { name: "Ya, tandai selesai" })).toBeEnabled();
		await dialog.getByRole("button", { name: "Ya, tandai selesai" }).click();
		await expect(dialog.getByRole("alert")).toContainText("Gunakan Resync");
		responseMode = "failure";
		await dialog.getByRole("button", { name: "Ya, tandai selesai" }).click();
		await expect(dialog.getByRole("alert")).toContainText("Project belum dapat ditandai selesai");
		await dialog.getByRole("button", { name: "Batal", exact: true }).click();
		await page.getByRole("button", { name: "Tandai selesai", exact: true }).click();
		await page.screenshot({ path: "test-results/admin-project-complete-ready.png" });
		await page.setViewportSize({ width: 1024, height: 800 });
		await expect.poll(async () => { const b = await dialog.boundingBox(); return Math.abs(b.y + b.height / 2 - 400); }).toBeLessThan(2);
		await page.screenshot({ path: "test-results/admin-project-complete-desktop.png" });
		responseMode = "success";
		await dialog.getByRole("button", { name: "Ya, tandai selesai" }).click();
		await expect(dialog.getByRole("button", { name: "Menyimpan..." })).toBeDisabled();
		await expect(dialog.getByRole("button", { name: "Batal", exact: true })).toBeDisabled();
		await expect.poll(() => typeof finish).toBe("function");
		finish();
		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: "Ringkasan waktu" })).toBeVisible();
		await expect(page.getByText("Ditandai selesai oleh Admin Contoh.")).toBeVisible();
		await expect(page.getByRole("button", { name: "Tandai selesai", exact: true })).toHaveCount(0);
		assert.equal(writes, 3);
		await page.locator("main").getByRole("link", { name: "Projects", exact: true }).click();
		await page.getByRole("combobox", { name: "Status project" }).click();
		await page.getByRole("option", { name: "Completed", exact: true }).click();
		await expect(page.getByRole("link", { name: /Rak Buku/ })).toHaveAttribute("href", "/admin/project?task_id=complete-project&review=completed");
		assert.equal(completedReads, 2, "completion clears the previously loaded Completed list");
		console.log("Completion UI: mobile/desktop, missing serial blocker, non-serial exclusion, retur warning, cancel, stale conflict, upstream failure, pending state and success passed.");
	} finally { await browser?.close(); server.kill(); db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
