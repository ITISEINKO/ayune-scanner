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
	await db.execute("ALTER TABLE ppic_permissions ADD COLUMN can_import_lby INTEGER NOT NULL DEFAULT 0 CHECK(can_import_lby IN (0,1))");
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
			await db.execute("UPDATE ppic_permissions SET can_import_lby=0 WHERE clickup_user_id='test-user'");
			const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
			const writes = [];
			let importer = false;
			let superImporter = false;
			await context.route("**/*", (route) => {
				const url = new URL(route.request().url());
				if (url.origin !== base) return route.abort();
				if (url.pathname === "/api/panel/members" && route.request().method() === "POST") {
					const body = route.request().postDataJSON(); writes.push(body);
					if (typeof body.can_import_lby === "boolean") {
						if (body.user_id === "super") superImporter = body.can_import_lby;
						else importer = body.can_import_lby;
					}
					return route.fulfill({ json: { ok: true } });
				}
				if (url.pathname === "/api/panel/members") return route.fulfill({ json: {
					members: [{ id: "member", name: "Member Example" }, { id: "owner", name: "Highest Role" }, { id: "super", name: "Super Admin Example" }],
					roles: { member: "MEMBER", owner: "ADMIN", super: "SUPER_ADMIN" }, permissions: { member: ["BARANG_DITERIMA"], owner: null, super: null },
					lbyImporters: { member: importer, super: superImporter },
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
				await db.execute("UPDATE ppic_permissions SET can_import_lby=1 WHERE clickup_user_id='test-user'");
				await page.goto(`${base}/admin/import-3d`);
				await expect(page).toHaveURL(`${base}/unauthorized`);
				await page.goto(`${base}/drafter`);
				await expect(page.getByRole("heading", { name: "Model LBY", exact: true })).toBeVisible();
				assert.deepEqual(await page.getByRole("navigation").getByRole("link").allTextContents(), ["Models", "Cari", "Profile"]);
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
				await page.getByRole("checkbox", { name: "Drafter", exact: true }).click();
				await page.getByRole("button", { name: "Simpan", exact: true }).click();
				await expect(page.getByRole("dialog")).toHaveCount(0);
				assert.deepEqual(writes, [{ user_id: "member", can_import_lby: true }], "changing LBY access must not resave unrelated status permissions");
				await page.reload();
				await expect(page.getByText("Drafter", { exact: true })).toBeVisible();
				await page.getByRole("button", { name: "Lihat detail Super Admin Example", exact: true }).click();
				await page.getByRole("tab", { name: "Akses halaman", exact: true }).click();
				await expect(page.getByRole("checkbox", { name: "Drafter", exact: true })).toBeEnabled();
				await page.getByRole("checkbox", { name: "Drafter", exact: true }).click();
				await page.getByRole("button", { name: "Simpan", exact: true }).click();
				await expect(page.getByRole("dialog")).toHaveCount(0);
				assert.deepEqual(writes.at(-1), { user_id: "super", can_import_lby: true }, "granting LBY to SUPER_ADMIN does not rewrite its role or scan access");
				await db.execute("UPDATE ppic_permissions SET can_import_lby=1 WHERE clickup_user_id='test-user'");
				await page.goto(`${base}/admin/profile`);
				await expect(page.getByRole("link", { name: "Kelola model LBY", exact: true })).toBeVisible();
				await page.getByRole("link", { name: "Kelola model LBY", exact: true }).click();
				await expect(page).toHaveURL(`${base}/admin/import-3d`);
				await expect(page.getByRole("heading", { name: "Model LBY", exact: true })).toBeVisible();
				await expect(page.locator("header").getByText("Admin", { exact: true })).toBeVisible();
				assert.deepEqual(await page.getByRole("navigation").getByRole("link").allTextContents(), ["Home", "Projects", "Scan", "Member", "Profile"]);
				await page.goto(`${base}/panel-location?project=z96buhry4p&barcode=15370046376`);
				await page.getByRole("link", { name: "Kembali ke model", exact: true }).click();
				await expect(page).toHaveURL(`${base}/admin/import-3d`);
				if (role === "SUPER_ADMIN") {
					await db.execute("UPDATE ppic_permissions SET can_import_lby=0 WHERE clickup_user_id='test-user'");
					await page.reload();
					await expect(page).toHaveURL(`${base}/unauthorized`);
				}
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
