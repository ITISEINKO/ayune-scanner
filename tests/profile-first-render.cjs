const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { spawn } = require("node:child_process");
const { createClient } = require("@libsql/client");
const { chromium, expect } = require("@playwright/test");

(async () => {
	const url = `file:${join(mkdtempSync(join(tmpdir(), "profile-render-")), "test.db").replaceAll("\\", "/")}`;
	const db = createClient({ url });
	await db.execute('CREATE TABLE "user" (id TEXT, name TEXT, email TEXT, role TEXT, allowed_status TEXT, active INTEGER, can_import_lby INTEGER)');
	await db.execute('CREATE TABLE account ("userId" TEXT, "accountId" TEXT, "providerId" TEXT)');
	await db.execute("INSERT INTO user VALUES ('u', 'Profile Test', 'profile@example.test', 'MEMBER', 'BARANG_DITERIMA', 1, 0)");
	await db.execute("INSERT INTO account VALUES ('u', '123', 'clickup')");
	const base = "http://127.0.0.1:3359", secret = "profile-render-secret";
	const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3359"], { windowsHide: true, env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "local", CLICKUP_CLIENT_SECRET: secret }, stdio: "ignore" });
	let browser;
	try {
		for (let i = 0; ; i++) {
			try { if ((await fetch(`${base}/login`)).ok) break; } catch {}
			if (i > 60 || server.exitCode !== null) throw new Error("Test server did not start");
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		browser = await chromium.launch();
		const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const payload = Buffer.from(JSON.stringify({ user_id: "123", role: "MEMBER", allowed_status: ["BARANG_DITERIMA"], refreshed_at: Date.now() })).toString("base64url");
		await context.addCookies([{ name: "ppic_session", value: `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`, url: base }]);
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
