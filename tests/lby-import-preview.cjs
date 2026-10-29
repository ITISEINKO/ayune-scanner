// Build first, then: node tests/lby-import-preview.cjs
const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createHash, createHmac } = require("node:crypto");
const { gzipSync } = require("node:zlib");
const { spawn } = require("node:child_process");

// This check reads local seeded snapshots only; no vendor or ClickUp requests are allowed.
if (process.env.LBY_PREVIEW_SERVER === "1") {
	global.fetch = async () => { throw new Error("Unexpected upstream request in preview check"); };
} else main().catch((error) => { console.error(error); process.exitCode = 1; });

async function main() {
	const { createClient } = require("@libsql/client");
	const { chromium, expect } = require("@playwright/test");
	const directory = mkdtempSync(join(tmpdir(), "lby-inline-preview-"));
	const databaseUrl = `file:${join(directory, "preview.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, role TEXT, active INTEGER, allowed_status TEXT, can_import_lby INTEGER DEFAULT 0)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('preview-drafter', 'MEMBER', 0, NULL, 1)");
	const base = "http://127.0.0.1:3368", secret = "local-preview-check";
	const server = spawn(process.execPath, ["--require", __filename, "node_modules/next/dist/bin/next", "start", "-p", "3368"], {
		windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
			LBY_PREVIEW_SERVER: "1", TURSO_DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "local-only",
			CLICKUP_CLIENT_SECRET: secret, CLICKUP_TOKEN: "local-only", ABLY_API_KEY: "" },
	});
	let logs = "", browser;
	server.stdout.on("data", (data) => { logs += data; });
	server.stderr.on("data", (data) => { logs += data; });
	try {
		for (let i = 0; ; i++) {
			try { if ((await fetch(`${base}/login`)).ok) break; } catch {}
			if (i > 80 || server.exitCode !== null) throw new Error(logs);
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		browser = await chromium.launch();
		const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const payload = Buffer.from(JSON.stringify({ user_id: "preview-drafter", role: "MEMBER", allowed_status: [], can_import_lby: true, refreshed_at: Date.now() })).toString("base64url");
		const sig = createHmac("sha256", secret).update(payload).digest("base64url");
		await context.addCookies([{ name: "clickup_access_token", value: "local-only", url: base }, { name: "ppic_session", value: `${payload}.${sig}`, url: base }]);
		const api = `${base}/api/admin/panel-locations`;
		assert.equal((await context.request.get(api)).status(), 200);
		const project = "lby-inline-test";
		await db.execute({ sql: "INSERT INTO ppic_panel_location_project (project_id) VALUES (?)", args: [project] });
		const sha = (value) => createHash("sha256").update(value).digest("hex");
		const revisions = [];
		for (const n of [1, 2]) {
			const snapshot = JSON.stringify({ version: `inline-v${n}`, panels: [{ barcode: "000123", roomName: "Kitchen", panelNumber: "1", corners: [[0,0,0],[100,0,0],[100,30,0],[0,30,0],[0,0,200],[100,0,200],[100,30,200],[0,30,200]] }] });
			const mapping = JSON.stringify({ panels: [{ barcode: "000123", panelName: "Side panel" }] });
			const revision = sha(snapshot); revisions.push(revision);
			const metadata = { projectKey: project, name: "FIORDINI FIB No.66 LT.2 (MASTER BEDROOM)", orderId: "inline-test", revision,
				version: `inline-v${n}`, importedAt: `2026-10-29T0${n}:00:00Z`, panelCount: 1, roomCount: 1, sampleBarcode: "000123", mappingSha256: sha(mapping) };
			await db.execute({ sql: "INSERT INTO ppic_panel_location_revision VALUES (?, ?, ?, ?, ?, ?, ?)", args: [project, revision, JSON.stringify(metadata), gzipSync(snapshot), gzipSync(mapping), "preview-drafter", n] });
		}
		const page = await context.newPage(), errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.goto(`${base}/drafter`);
		const card = page.getByRole("article", { name: "FIORDINI FIB No.66 LT.2 (MASTER BEDROOM)" });
		const preview = page.getByRole("region", { name: "Preview model LBY", exact: true });
		const check = page.getByRole("checkbox", { name: "Sudah saya periksa dan sesuai dengan LBY" });
		const getActive = async () => (await (await context.request.get(`${api}?project=${project}`)).json()).state.activeRevision;
		await expect(card).toBeVisible();
		await expect(card.getByRole("button", { name: "Preview 3D" })).toBeHidden();
		assert((await card.boundingBox()).height < 100, "collapsed card is compact on mobile");
		await card.locator("summary").click();
		await expect(card.getByRole("region", { name: "Riwayat versi" })).toBeVisible();
		await card.getByRole("button", { name: "Preview 3D" }).click();
		await expect(preview.locator("svg[data-selected-barcode='000123']")).toBeVisible();
		await expect(preview.getByRole("button", { name: "Aktifkan model", exact: true })).toBeDisabled();
		assert.equal(await getActive(), null);
		await check.check();
		await preview.getByRole("button", { name: "Aktifkan model", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Gunakan model ini?", exact: true });
		await dialog.getByRole("button", { name: "Periksa nanti" }).click();
		assert.equal(await getActive(), null, "cancelling retains active revision");
		await preview.getByRole("button", { name: "Aktifkan model", exact: true }).click();
		await dialog.getByRole("button", { name: "Gunakan model ini", exact: true }).click();
		await expect(preview).toHaveCount(0);
		assert.equal(await getActive(), revisions[1]);
		await expect(card.getByText("AKTIF", { exact: true })).toBeVisible();
		await card.getByRole("button", { name: "Aktifkan V1", exact: true }).click();
		await expect(preview.getByText("Preview versi V1", { exact: true })).toBeVisible();
		await expect(check).not.toBeChecked();
		await expect(preview.getByRole("button", { name: "Muat versi aktif" })).toHaveCount(0);
		await expect(preview.getByRole("button", { name: "Gunakan versi V1" })).toBeDisabled();
		mkdirSync("test-results", { recursive: true });
		await page.screenshot({ path: "test-results/lby-inline-mobile.png", fullPage: true });
		const mobileWidth = (await preview.locator("svg[data-selected-barcode]").boundingBox()).width;
		await page.setViewportSize({ width: 1440, height: 1000 });
		await expect(preview.locator("svg[data-selected-barcode]")).toBeVisible();
		assert((await preview.locator("svg[data-selected-barcode]").boundingBox()).width > mobileWidth * 2, "desktop preview expands");
		await page.screenshot({ path: "test-results/lby-inline-desktop.png", fullPage: true });
		await preview.getByRole("button", { name: "Kembali ke daftar" }).click();
		await expect(card.getByRole("button", { name: "Preview 3D" })).toBeVisible();
		await page.screenshot({ path: "test-results/lby-compact-desktop.png", fullPage: true });
		const catalog = require("../src/data/panel-locations/catalog.json");
		const bundledProject = Object.keys(catalog)[0];
		const imported = (await db.execute({ sql: "SELECT * FROM ppic_panel_location_revision WHERE project_id=? AND revision=?", args: [project, revisions[0]] })).rows[0];
		const bundledMetadata = { ...JSON.parse(imported.metadata_json), projectKey: bundledProject, name: "Bundled regression" };
		await db.execute({ sql: "INSERT INTO ppic_panel_location_project (project_id, active_revision) VALUES (?, ?)", args: [bundledProject, revisions[0]] });
		await db.execute({ sql: "INSERT INTO ppic_panel_location_revision VALUES (?, ?, ?, ?, ?, ?, ?)", args: [bundledProject, revisions[0], JSON.stringify(bundledMetadata), imported.snapshot_gzip, imported.mapping_gzip, "preview-drafter", 2] });
		await page.reload();
		const bundledCard = page.getByRole("article", { name: "Bundled regression", exact: true });
		await bundledCard.locator("summary").click();
		await bundledCard.getByRole("button", { name: "Aktifkan model bawaan", exact: true }).click();
		await expect(preview.getByText("Preview versi V1", { exact: true })).toBeVisible();
		await expect(preview.locator("svg[data-selected-barcode]")).toBeVisible();
		await check.check();
		await preview.getByRole("button", { name: "Gunakan model bawaan", exact: true }).click();
		await dialog.getByRole("button", { name: "Gunakan model ini", exact: true }).click();
		await expect(preview).toHaveCount(0);
		assert.equal((await db.execute({ sql: "SELECT active_revision FROM ppic_panel_location_project WHERE project_id=?", args: [bundledProject] })).rows[0].active_revision, null, "bundled rollback previews the bundled snapshot before activation");
		await card.locator("summary").click();
		await db.execute("UPDATE ppic_permissions SET can_import_lby=0 WHERE clickup_user_id='preview-drafter'");
		await card.getByRole("button", { name: "Aktifkan V1", exact: true }).click();
		await expect(preview.getByRole("alert")).toContainText("Preview gagal dimuat");
		await expect(check).toBeDisabled();
		assert.equal(await getActive().catch(() => null), null, "revoked access cannot read import state");
		assert.equal((await db.execute({ sql: "SELECT active_revision FROM ppic_panel_location_project WHERE project_id=?", args: [project] })).rows[0].active_revision, revisions[1]);
		assert.equal(context.pages().length, 1, "flow never opens a new tab");
		assert.equal(page.url(), `${base}/drafter`, "flow stays on the import page");
		assert.deepEqual(errors, []);
		console.log("PASS: compact cards, inline mobile/desktop preview, required review, activation/cancel/history, permission revocation, no popup or navigation (local snapshots).");
	} finally {
		await browser?.close(); server.kill(); db.close();
	}
}
