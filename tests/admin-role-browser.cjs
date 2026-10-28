// Run after npm run build: node tests/admin-role-browser.cjs
const assert = require("node:assert/strict");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { createClient } = require("@libsql/client");
const { chromium, expect } = require("@playwright/test");

(async () => {
	const directory = mkdtempSync(join(tmpdir(), "trackerprod-admin-browser-"));
	const databaseUrl = `file:${join(directory, "roles.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, role TEXT, allowed_status TEXT, active INTEGER)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('test-user', 'ADMIN', 'BARANG_DITERIMA', 0)");
	const secret = "local-role-browser-secret", base = "http://127.0.0.1:3358";
	const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3358"], {
		windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
		env: { ...process.env, TURSO_DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "local-only", CLICKUP_CLIENT_SECRET: secret, ABLY_API_KEY: "" },
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
		for (const role of ["ADMIN", "SUPER_ADMIN", "MEMBER"]) {
			await db.execute({ sql: "UPDATE ppic_permissions SET role=? WHERE clickup_user_id='test-user'", args: [role] });
			const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
			await context.route("**/*", (route) => {
				const url = new URL(route.request().url());
				if (url.origin !== base) return route.abort();
				if (url.pathname === "/api/panel/members") return route.fulfill({ json: {
					members: [{ id: "member", name: "Member Example" }, { id: "owner", name: "Highest Role" }],
					roles: { member: "MEMBER", owner: "ADMIN" }, permissions: { member: ["BARANG_DITERIMA"], owner: null },
				} });
				if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 401, json: {} });
				return route.continue();
			});
			const payload = Buffer.from(JSON.stringify({ user_id: "test-user", role, allowed_status: role === "MEMBER" ? ["BARANG_DITERIMA"] : null, refreshed_at: Date.now() })).toString("base64url");
			const signature = createHmac("sha256", secret).update(payload).digest("base64url");
			await context.addCookies([
				{ name: "clickup_access_token", value: "local-only", url: base },
				{ name: "ppic_session", value: `${payload}.${signature}`, url: base },
			]);
			const page = await context.newPage();
			const errors = [];
			page.on("pageerror", (error) => errors.push(error.message));
			await page.goto(`${base}/admin/settings`);
			if (role === "MEMBER") {
				await expect(page).toHaveURL(`${base}/unauthorized`);
			} else {
				await expect(page.getByRole("heading", { name: "Pengguna & aktivitas" })).toBeVisible();
				await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(5);
				const highest = page.getByRole("button", { name: "Lihat detail Highest Role", exact: true });
				if (role === "SUPER_ADMIN") await expect(highest).toBeDisabled();
				else await expect(highest).toBeEnabled();
				await page.getByRole("button", { name: "Lihat detail Member Example", exact: true }).click();
				await page.getByRole("tab", { name: "Akses halaman", exact: true }).click();
				await expect(page.getByRole("button", { name: "Admin", exact: true })).toHaveCount(role === "ADMIN" ? 1 : 0);
				await expect(page.getByRole("button", { name: "Super Admin", exact: true })).toBeVisible();
			}
			assert.deepEqual(errors, []);
			await context.close();
		}
		console.log("PASS: ADMIN and SUPER_ADMIN navigation/settings access, highest-role editor protection, MEMBER denial and zero hydration errors (local DB, no external requests).");
	} finally {
		await browser?.close();
		server.kill();
		db.close();
	}
})().catch((error) => { console.error(error); process.exitCode = 1; });
