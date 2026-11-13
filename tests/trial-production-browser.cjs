// Run after production build with admin-dashboard simulation on port 4900.
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdtempSync, writeFileSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { gzipSync } = require("node:zlib");
const { createClient } = require("@libsql/client");
const { chromium, expect } = require("@playwright/test");
const ts = require("typescript");

(async () => {
	const dir = mkdtempSync(join(tmpdir(), "trial-browser-"));
	const mode = join(dir, "mode.txt");
	writeFileSync(mode, "manual-location");
	const dbUrl = `file:${join(dir, "test.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: dbUrl });
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, role TEXT, active INTEGER, allowed_status TEXT, can_import_lby INTEGER NOT NULL DEFAULT 0)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('manual-admin', 'ADMIN', 1, NULL, 0)");
	const moduleResult = { exports: {} };
	runInNewContext(ts.transpileModule(readFileSync("src/lib/trialPublicModels.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module: moduleResult, exports: moduleResult.exports, Buffer, Date, JSON, Map, require: (id) => id === "server-only" ? {} : id === "@/lib/db" ? { db } : require(id) });
	const store = moduleResult.exports;
	const geometry = [{ id: "panel", position: [0, 0, 0, 100, 0, 0, 0, 100, 0], index: [0, 1, 2], number: "8", doorOpenType: null, isDoor: false, hinges: [] }];
	const candidate = await store.saveTrialModel("123", "Sample project", [{ id: "room", name: "Bedroom", data: gzipSync(JSON.stringify(geometry)), matches: [{ id: "panel", serial: "15370046376", number: "8" }] }], [], true);
	assert.equal(await store.activateTrialModel("123", candidate.revision, null), true);
	const base = "http://127.0.0.1:3363", secret = "local-only-secret";
	const server = spawn(process.execPath, ["--require", "./tests/admin-manual-location.cjs", "node_modules/next/dist/bin/next", "start", "-p", "3363"], { windowsHide: true, stdio: "ignore", env: { ...process.env, MANUAL_LOCATION_SERVER: "1", MANUAL_LOCATION_MODE_FILE: mode, TURSO_DATABASE_URL: dbUrl, TURSO_AUTH_TOKEN: "local-only", CLICKUP_CLIENT_SECRET: secret } });
	let browser;
	try {
		for (let i = 0; ; i++) {
			try { if ((await fetch(`${base}/login`)).ok) break; } catch {}
			if (i > 60 || server.exitCode !== null) throw Error("Local server did not start");
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		browser = await chromium.launch();
		const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const payload = Buffer.from(JSON.stringify({ user_id: "manual-admin", role: "ADMIN", allowed_status: null, refreshed_at: Date.now() })).toString("base64url");
		const signature = createHmac("sha256", secret).update(payload).digest("base64url");
		await context.addCookies([{ name: "clickup_access_token", value: "manual-local-only", url: base }, { name: "ppic_session", value: `${payload}.${signature}`, url: base }]);
		const page = await context.newPage();
		await page.goto(`${base}/cari-lokasi?barcode=15370046376`);
		await expect(page.getByRole("heading", { name: /Sample project.*Bedroom/ })).toBeVisible();
		await expect(page.getByRole("region", { name: "Informasi panel" })).toContainText("Serial: 15370046376");
		await expect(page.getByRole("combobox", { name: "Ruangan" })).toHaveCount(0);
		await expect(page.getByRole("region", { name: "Viewer model 3D" })).toBeVisible();
		await page.goto(`${base}/admin/import-3d`);
		await expect(page.getByRole("heading", { name: "Model LBY 3D Ver2" })).toBeVisible();
		await page.getByRole("button", { name: "Menu model" }).click();
		await expect(page.getByRole("menuitem", { name: "Buka pencarian lokasi" })).toHaveAttribute("href", "/cari-lokasi");
		await expect(page.getByRole("menuitem", { name: "Kelola model LBY old" })).toHaveAttribute("href", "/admin/import-3d/old");
		await page.keyboard.press("Escape");
		await page.getByText("Sample project", { exact: true }).click();
		page.once("dialog", (dialog) => dialog.accept());
		await page.getByRole("button", { name: "Nonaktifkan model 3D (gunakan old)" }).click();
		await expect(page.getByText(/Model 3D dinonaktifkan/)).toBeVisible();
		assert.equal((await store.listTrialModels())[0].activeRevision, null);
		await page.goto(`${base}/cari-lokasi?barcode=15370046376`);
		await expect(page.getByRole("main").getByRole("alert")).toContainText("Serial tidak ditemukan pada model 3D aktif");
		await page.getByRole("link", { name: "Cari di viewer old" }).click();
		await expect(page.getByText("Viewer old", { exact: true })).toBeVisible();
		await expect(page.locator("svg[data-selected-barcode]")).toHaveAttribute("data-selected-barcode", "15370046376");
		console.log("Mobile browser: active serial viewer, locked room, deactivation and explicit old fallback passed");
	} finally { if (browser) await browser.close(); server.kill(); db.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
