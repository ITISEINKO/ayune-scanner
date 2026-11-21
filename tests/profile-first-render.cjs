const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { mkdtempSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { spawn } = require("node:child_process");
const { createClient } = require("@libsql/client");
const { chromium, expect } = require("@playwright/test");

(async () => {
	const url = `file:${join(mkdtempSync(join(tmpdir(), "profile-render-")), "test.db").replaceAll("\\", "/")}`;
	const db = createClient({ url });
	const statements = (path) => readFileSync(path, "utf8").split("--> statement-breakpoint").map((sql) => sql.trim()).filter(Boolean);
	await db.batch(statements("drizzle/0004_mean_carlie_cooper.sql"), "write");
	await db.batch(statements("drizzle/0006_absurd_redwing.sql").slice(0, 6), "write");
	const now = Date.now();
	await db.execute({ sql: 'INSERT INTO "user" (id,name,email,"emailVerified",role,allowed_status,active,can_import_lby,"createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?)', args: ["u", "Profile Test", "profile@example.test", 0, "MEMBER", "BARANG_DITERIMA", 1, 0, now, now] });
	await db.execute({ sql: 'INSERT INTO account (id,"userId","accountId","providerId","createdAt","updatedAt") VALUES (?,?,?,?,?,?)', args: ["a", "u", "123", "clickup", now, now] });
	await db.execute({ sql: 'INSERT INTO session (id,token,"userId","expiresAt","createdAt","updatedAt") VALUES (?,?,?,?,?,?)', args: ["s", "test-token", "u", now + 3600000, now, now] });
	const base = "http://127.0.0.1:3359", secret = "profile-render-secret-32-characters-long";
	const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3359"], { windowsHide: true, env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "local", BETTER_AUTH_URL: base, BETTER_AUTH_SECRET: secret, CLICKUP_CLIENT_SECRET: secret }, stdio: "ignore" });
	let browser;
	try {
		for (let i = 0; ; i++) {
			try { if ((await fetch(`${base}/login`)).ok) break; } catch {}
			if (i > 60 || server.exitCode !== null) throw new Error("Test server did not start");
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		browser = await chromium.launch();
		const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const signature = createHmac("sha256", secret).update("test-token").digest("base64");
		await context.addCookies([{ name: "better-auth.session_token", value: encodeURIComponent(`test-token.${signature}`), url: base }]);
		let profileRequests = 0;
		await context.route("**/*", async (route) => {
			const request = new URL(route.request().url());
			if (request.origin !== base) return route.abort();
			if (request.pathname === "/api/profile") profileRequests++;
			if (request.pathname === "/api/profile/scan-summary") return route.fulfill({ status: 503, json: {} });
			if (request.pathname === "/api/ably/token") return route.fulfill({ status: 401, json: {} });
			return route.continue();
		});
		const page = await context.newPage();
		await page.goto(`${base}/profile`);
		await expect(page.getByText("Profile Test", { exact: true })).toBeVisible();
		await expect(page.getByText("profile@example.test", { exact: true })).toBeVisible();
		assert.equal(profileRequests, 0, "profile data is already available on first render");
		await db.execute("UPDATE user SET active = 0 WHERE id = 'u'");
		await page.reload();
		await expect(page.getByText("Profile Test", { exact: true })).toBeVisible();
		await expect(page.getByText("No scan access", { exact: true })).toBeVisible();
		console.log("Mobile profile first render and revoked access passed.");
	} finally {
		if (browser) await browser.close();
		server.kill();
		db.close();
	}
})().catch((error) => { console.error(error); process.exitCode = 1; });
