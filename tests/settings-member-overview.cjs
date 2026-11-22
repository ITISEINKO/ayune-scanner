const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { once } = require("node:events");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createClient } = require("@libsql/client");
const { chromium, expect } = require("@playwright/test");

async function main() {
	const directory = mkdtempSync(join(tmpdir(), "trackerprod-user-navigation-"));
	const databaseUrl = `file:${join(directory, "navigation.db").replaceAll("\\", "/")}`;
	const secret = "local-user-navigation-secret-at-least-32-characters";
	const baseURL = "http://127.0.0.1:3364";
	const db = createClient({ url: databaseUrl });
	const statements = (path) =>
		readFileSync(path, "utf8")
			.split("--> statement-breakpoint")
			.map((sql) => sql.trim())
			.filter(Boolean);
	await db.batch(statements("drizzle/0004_mean_carlie_cooper.sql"), "write");
	await db.batch(
		statements("drizzle/0006_absurd_redwing.sql").slice(0, 6),
		"write",
	);
	await db.execute(
		"CREATE TABLE ppic_scan_history (id INTEGER PRIMARY KEY, clickup_user_id TEXT, serial_number TEXT, status TEXT, task_name TEXT, scanned_at TEXT, project_task_id TEXT, component_task_id TEXT)",
	);
	const now = Date.now();
	await db.execute({
		sql: 'INSERT INTO "user" (id,name,email,"emailVerified",role,allowed_status,active,can_import_lby,"createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?)',
		args: ["local-admin", "Local Admin", "local-admin@example.test", 0, "SUPER_ADMIN", null, 0, 0, now, now],
	});
	await db.execute({
		sql: 'INSERT INTO account (id,"accountId","providerId","userId","createdAt","updatedAt") VALUES (?,?,?,?,?,?)',
		args: ["local-account", "local-admin", "clickup", "local-admin", now, now],
	});
	const sessionToken = "local-user-navigation-session";
	await db.execute({
		sql: 'INSERT INTO session (id,token,"userId","expiresAt","createdAt","updatedAt") VALUES (?,?,?,?,?,?)',
		args: ["local-session", sessionToken, "local-admin", now + 60 * 60 * 1000, now, now],
	});
	const memberSessionToken = "local-member-activity-session";
	await db.execute({
		sql: 'INSERT INTO "user" (id,name,email,"emailVerified",role,allowed_status,active,can_import_lby,"createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?)',
		args: ["local-member", "Local Member", "local-member@example.test", 0, "MEMBER", JSON.stringify(["BARANG_DITERIMA"]), 1, 0, now, now],
	});
	await db.execute({
		sql: 'INSERT INTO account (id,"accountId","providerId","userId","createdAt","updatedAt") VALUES (?,?,?,?,?,?)',
		args: ["local-member-account", "local-member", "clickup", "local-member", now, now],
	});
	await db.execute({
		sql: 'INSERT INTO session (id,token,"userId","expiresAt","createdAt","updatedAt") VALUES (?,?,?,?,?,?)',
		args: ["local-member-session", memberSessionToken, "local-member", now + 60 * 60 * 1000, now, now],
	});
	const server = spawn(
		process.execPath,
		["node_modules/next/dist/bin/next", "start", "-p", "3364"],
		{
			cwd: join(__dirname, ".."),
			windowsHide: true,
			env: {
				...process.env,
				TURSO_DATABASE_URL: databaseUrl,
				TURSO_AUTH_TOKEN: "local-only",
				CLICKUP_CLIENT_SECRET: secret,
				BETTER_AUTH_SECRET: secret,
				BETTER_AUTH_URL: baseURL,
				ABLY_API_KEY: "",
			},
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	let logs = "";
	server.stdout.on("data", (chunk) => {
		logs += chunk;
	});
	server.stderr.on("data", (chunk) => {
		logs += chunk;
	});
	let browser;
	try {
		for (let attempt = 0; ; attempt += 1) {
			try {
				if ((await fetch(`${baseURL}/login`)).ok) break;
			} catch {}
			if (attempt >= 60 || server.exitCode !== null)
				throw new Error(`Test server failed: ${logs}`);
			await new Promise((done) => setTimeout(done, 250));
		}
		browser = await chromium.launch();
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
		});
		await context.route("**/*", (route) => {
			const url = new URL(route.request().url());
			if (url.origin !== baseURL) return route.abort();
			if (url.pathname === "/api/panel/members") {
				assert.equal(route.request().method(), "GET", "the list must not mutate permissions");
				return route.fulfill({
					contentType: "application/json",
					body: JSON.stringify({
						members: [{ id: "member-navigation-test", name: "Member Navigation Test" }],
						roles: { "member-navigation-test": "MEMBER" },
						permissions: { "member-navigation-test": ["BARANG_DITERIMA"] },
					}),
				});
			}
			if (url.pathname === "/api/panel/members/summary") {
				assert.equal(route.request().method(), "GET");
				assert.equal(url.searchParams.get("user_id"), "member-navigation-test");
				const days = Array.from({ length: 7 }, (_, index) => ({
					date: `2026-11-${String(index + 16).padStart(2, "0")}`,
					count: 0,
				}));
				return route.fulfill({
					json: {
						total: 0,
						today: 0,
						previousTotal: 0,
						lastScannedAt: null,
						days,
						statuses: [],
					},
				});
			}
			if (
				url.pathname.startsWith("/_next/") ||
				url.pathname === "/admin/users" ||
				url.pathname.startsWith("/admin/users/") ||
				url.pathname === "/activity"
			)
				return route.continue();
			return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
		});

		const signature = createHmac("sha256", secret)
			.update(sessionToken)
			.digest("base64");
		await context.addCookies([
			{
				name: "better-auth.session_token",
				value: encodeURIComponent(`${sessionToken}.${signature}`),
				url: baseURL,
			},
		]);

		const page = await context.newPage();
		await page.goto(`${baseURL}/admin/users`);
		await expect(
			page.getByRole("heading", { name: "Pengguna & aktivitas", exact: true }),
		).toBeVisible();
		await page
			.getByRole("link", { name: "Lihat detail Member Navigation Test" })
			.click();
		await expect(page).toHaveURL(
			`${baseURL}/admin/users/member-navigation-test`,
		);
		await expect(
			page.getByRole("heading", { name: "Member Navigation Test", exact: true }),
		).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await page.getByRole("tab", { name: "Akses", exact: true }).click();
		await expect(
			page.getByRole("checkbox", { name: /Akses Diterima/ }),
		).toBeVisible();
		await context.clearCookies();
		const memberSignature = createHmac("sha256", secret)
			.update(memberSessionToken)
			.digest("base64");
		await context.addCookies([
			{
				name: "better-auth.session_token",
				value: encodeURIComponent(`${memberSessionToken}.${memberSignature}`),
				url: baseURL,
			},
		]);
		await page.goto(`${baseURL}/activity?tab=activity`);
		await expect(
			page.getByRole("heading", { name: "Aktivitas Scan", exact: true }),
		).toBeVisible();
		await expect(page.getByText("Belum ada riwayat scan.", { exact: true })).toBeVisible();
		console.log("Settings navigation and local member activity passed without a ClickUp token.");
	} finally {
		try {
			await browser?.close();
		} finally {
			if (server.exitCode === null && server.signalCode === null) {
				const exited = once(server, "exit");
				server.kill();
				let timeout;
				await Promise.race([
					exited,
					new Promise((resolve) => {
						timeout = setTimeout(resolve, 5000);
					}),
				]);
				if (timeout) clearTimeout(timeout);
			}
			server.stdout.destroy();
			server.stderr.destroy();
			await db.close();
			rmSync(directory, { recursive: true, force: true });
		}
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
