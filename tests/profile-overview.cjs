// Run after npm run build: node --experimental-strip-types tests/profile-overview.cjs
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdirSync } = require("node:fs");
const { chromium, expect } = require("@playwright/test");
const { STATUS_COLOR_CONFIG } = require("../src/lib/colorStatusConfig.ts");

(async () => {
	const baseURL = "http://127.0.0.1:3352";
	const secret = "local-profile-check";
	const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3352"], {
		windowsHide: true,
		env: { ...process.env, CLICKUP_CLIENT_SECRET: secret, TURSO_DATABASE_URL: "file::memory:", TURSO_AUTH_TOKEN: "local-only", ABLY_API_KEY: "" },
		stdio: ["ignore", "pipe", "pipe"],
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
		let role = "MEMBER";
		let mode = "normal";
		let profileMode = "normal";
		let requests = 0;
		let releaseProfile, releaseSummary;
		let profileGate = new Promise((done) => { releaseProfile = done; });
		const summaryGate = new Promise((done) => { releaseSummary = done; });
		await context.route("**/*", async (route) => {
			const url = new URL(route.request().url());
			if (url.origin !== baseURL) return route.abort();
			if (url.pathname === "/api/profile") {
				await profileGate;
				if (profileMode === "error") return route.fulfill({ status: 502, json: {} });
				return route.fulfill({ json: {
					email: "member@example.test", displayName: "nickia habibi", role, allowedStatuses: ["TERPASANG_DIGUNAKAN", "DALAM_PROSES_RETUR"],
				} });
			}
			if (url.pathname === "/api/profile/scan-summary") {
				requests++;
				assert.equal(url.search, "");
				assert.equal(route.request().method(), "GET");
				await summaryGate;
				if (mode === "error") return route.fulfill({ status: 502, json: { error: "DATABASE_ERROR" } });
				const counts = mode === "empty" ? [0, 0, 0, 0, 0, 0, 0] : [6, 0, 14, 16, 12, 18, 12];
				const statuses = mode === "mixed"
					? ["BARANG_DITERIMA", "SEDANG_DIPACKING", "TERPASANG_DIGUNAKAN", "DALAM_PROSES_RETUR", "OTHER"].map((status, index) => ({ status, count: [10, 10, 20, 30, 8][index] }))
					: [{ status: "TERPASANG_DIGUNAKAN", count: mode === "empty" ? 0 : mode === "single" ? 78 : 52 }, { status: "DALAM_PROSES_RETUR", count: ["empty", "single"].includes(mode) ? 0 : 26 }, { status: "BARANG_DITERIMA", count: 0 }];
				return route.fulfill({ json: {
					lifetimeTotal: mode === "empty" ? 0 : 1248,
					total: counts.reduce((sum, count) => sum + count, 0), today: counts[6], previousTotal: 0,
					lastScannedAt: mode === "empty" ? null : "2026-10-23T02:00:00.000Z",
					days: counts.map((count, index) => ({ date: `2026-10-${17 + index}`, count })),
					statuses,
				} });
			}
			if (url.pathname.startsWith("/_next/") || ["/profile", "/admin/profile"].includes(url.pathname)) return route.continue();
			return route.fulfill({ status: 401, json: {} });
		});
		const setSession = async () => {
			const payload = Buffer.from(JSON.stringify({ user_id: "local-member", role, allowed_status: ["TERPASANG_DIGUNAKAN"], refreshed_at: Date.now() })).toString("base64url");
			await context.addCookies([
				{ name: "clickup_access_token", value: "local-profile-check", url: baseURL },
				{ name: "ppic_session", value: `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`, url: baseURL },
			]);
		};
		await setSession();
		const page = await context.newPage();
		await page.goto(`${baseURL}/profile`);
		const overview = page.getByRole("region", { name: "Overview kamu", exact: true });
		await expect(page.getByRole("status", { name: "Memuat detail akun" })).toBeVisible();
		await expect(page.getByRole("status", { name: "Memuat nama profil" })).toBeVisible();
		await expect(overview.getByRole("status", { name: "Memuat ringkasan scan" })).toBeVisible();
		assert.equal(requests, 1, "summary starts while profile request is still blocked");
		await expect(page.getByText("Email unavailable", { exact: true })).toHaveCount(0);
		await expect(page.getByText("No scan access", { exact: true })).toHaveCount(0);
		mkdirSync("test-results", { recursive: true });
		await page.screenshot({ path: "test-results/profile-overview-loading.png", fullPage: true });
		releaseSummary();
		await expect(overview.getByText("1.248", { exact: true })).toBeVisible();
		await expect(page.getByRole("status", { name: "Memuat detail akun" })).toBeVisible();
		releaseProfile();
		await expect(page.getByText("member@example.test", { exact: true })).toBeVisible();
		await expect(page.locator("main > header").getByText("nickia habibi", { exact: true })).toHaveCSS("text-transform", "capitalize");
		await expect(page.getByText("Akun Kamu", { exact: true })).toHaveCount(0);
		await expect(overview.getByText("78", { exact: true }).first()).toBeVisible();
		await expect(overview.getByRole("heading", { name: "Total scan per status" })).toBeVisible();
		const statusSummary = overview.getByRole("region", { name: "Ringkasan scan per status" });
		await expect(statusSummary.locator('[aria-label="Total 78 scan pada periode ini"]')).toHaveText("78");
		await expect(statusSummary.getByRole("listitem")).toHaveCount(2);
		await expect(statusSummary.getByRole("listitem").filter({ hasText: "Terpasang" })).toContainText("52 · 67%");
		await expect(statusSummary.getByRole("listitem").filter({ hasText: "Retur" })).toContainText("26 · 33%");
		for (const status of ["TERPASANG_DIGUNAKAN", "DALAM_PROSES_RETUR"]) {
			await expect(statusSummary.locator(`path.recharts-sector[fill="${STATUS_COLOR_CONFIG[status].color}"]`)).toHaveCount(1);
		}
		await expect(overview.locator('[aria-label$="scan"]')).toHaveCount(7);
		await expect(overview.locator('[aria-label="Periode ringkasan"]')).toHaveCount(0);
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		const header = await page.locator("main > header").boundingBox();
		assert.ok(header.height < 120, "profile header stays compact");
		await page.screenshot({ path: "test-results/profile-overview-mobile.png", fullPage: true });
		await page.setViewportSize({ width: 1280, height: 900 });
		await expect(overview.getByText("1.248", { exact: true })).toBeVisible();
		mode = "single";
		await page.reload();
		await expect(statusSummary.getByRole("listitem")).toHaveCount(1);
		await expect(statusSummary.getByRole("listitem")).toContainText("78 · 100%");
		mode = "mixed";
		await page.reload();
		await expect(statusSummary.getByRole("listitem")).toHaveCount(5);
		for (const status of ["BARANG_DITERIMA", "SEDANG_DIPACKING", "TERPASANG_DIGUNAKAN", "DALAM_PROSES_RETUR", "OTHER"]) {
			const config = STATUS_COLOR_CONFIG[status];
			await expect(statusSummary.locator(`path.recharts-sector[fill="${config.color}"]`)).toHaveCount(1);
			const rgb = `rgb(${[1, 3, 5].map((index) => parseInt(config.color.slice(index, index + 2), 16)).join(", ")})`;
			await expect(statusSummary.getByRole("listitem").filter({ hasText: config.shortLabel }).locator("span").first()).toHaveCSS("background-color", rgb);
		}
		await page.setViewportSize({ width: 320, height: 844 });
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		await statusSummary.screenshot({ path: "test-results/profile-status-doughnut-mixed.png" });
		mode = "empty";
		await page.reload();
		await expect(overview.getByText("Belum ada riwayat scan.", { exact: true })).toBeVisible();
		await expect(statusSummary.locator('[aria-label="Total 0 scan pada periode ini"]')).toHaveText("0");
		await expect(statusSummary.getByText("Belum ada scan.", { exact: true })).toBeVisible();
		await expect(statusSummary.locator("path.recharts-sector")).toHaveCount(1);
		assert.doesNotMatch(await statusSummary.innerText(), /NaN|Infinity/);
		mode = "error";
		await page.reload();
		await expect(overview.getByRole("alert")).toBeVisible({ timeout: 15000 });
		mode = "normal";
		await overview.getByRole("button", { name: "Coba lagi" }).click();
		await expect(overview.getByText("1.248", { exact: true })).toBeVisible();
		profileMode = "error";
		await page.reload();
		const account = page.getByRole("region", { name: "Account details" });
		await expect(account.getByRole("alert")).toContainText("Gagal memuat detail akun.");
		await expect(overview.getByText("1.248", { exact: true })).toBeVisible();
		profileMode = "normal";
		await account.getByRole("button", { name: "Coba lagi" }).click();
		await expect(account.getByText("member@example.test", { exact: true })).toBeVisible();
		role = "SUPER_ADMIN";
		await setSession();
		const before = requests;
		profileGate = new Promise((done) => { releaseProfile = done; });
		await page.goto(`${baseURL}/admin/profile`);
		await expect(page.getByRole("status", { name: "Memuat detail akun" })).toBeVisible();
		await expect(page.getByRole("status", { name: "Memuat ringkasan scan" })).toHaveCount(0);
		releaseProfile();
		await expect(page.getByText("member@example.test", { exact: true })).toBeVisible();
		await expect(page.getByText("SUPER ADMIN", { exact: true })).toHaveCount(1);
		await expect(page.getByText("Allowed status", { exact: true })).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "Overview kamu" })).toHaveCount(0);
		assert.equal(requests, before, "admin profile must not fetch member scan history");
		await page.goto(`${baseURL}/profile`);
		await expect(page).toHaveURL(`${baseURL}/admin/profile`);
		assert.equal(requests, before, "admin entering the member URL must not fetch member scan history");
		console.log("Profile overview passed: compact mobile/desktop layout, independent requests, account/summary skeletons, empty/error/retry and separate member/admin routes.");
	} finally {
		await browser?.close();
		server.kill();
		server.stdout.destroy();
		server.stderr.destroy();
		server.unref();
	}
})().catch((error) => { console.error(error); process.exitCode = 1; });
