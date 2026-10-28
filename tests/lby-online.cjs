// Build, start tests/lby-online.sim.yaml on 4914, then: node tests/lby-online.cjs
const assert = require("node:assert/strict");
const { createHash, createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

if (process.env.LBY_ONLINE_SERVER === "1") {
	const nativeFetch = global.fetch;
	global.fetch = (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		const member = url.origin === "https://api.clickup.com" ? "clickup" :
			["https://www.lbyerp.com", "https://ali-oss-lby.oss-cn-hangzhou.aliyuncs.com"].includes(url.origin) ? "lby" : null;
		assert(member, `Unexpected outbound origin: ${url.origin}`);
		return nativeFetch(`http://127.0.0.1:4914/${member}${url.pathname}${url.search}`, {
			...init, headers: { "x-test-mode": member === "clickup" ? "lby-online" : readFileSync(process.env.LBY_ONLINE_MODE_FILE, "utf8") },
		});
	};
} else main().catch((cause) => { console.error(cause); process.exitCode = 1; });

function shareLink(expireTime = Date.now() + 3600000, orderId = "123456789012345678") {
	const secret = "lby-temp-token-key-2024";
	const raw = JSON.stringify({ orderId, endCustomerAddress: "Online LBY model", expireTime });
	const encoded = raw.split("").map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ secret.charCodeAt(i % secret.length))).join("");
	return `https://www.lbyerp.com/#/cadVisitor?token=${encodeURIComponent(Buffer.from(encoded).toString("base64"))}`;
}

async function main() {
	const { createClient } = require("@libsql/client");
	const { chromium, expect } = require("@playwright/test");
	const directory = mkdtempSync(join(tmpdir(), "trackerprod-lby-online-")), modeFile = join(directory, "mode.txt");
	const setMode = (mode) => writeFileSync(modeFile, mode);
	setMode("normal");
	const databaseUrl = `file:${join(directory, "online.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: databaseUrl });
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, role TEXT, active INTEGER, allowed_status TEXT)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('online-admin', 'ADMIN', 1, NULL)");
	await db.execute("CREATE TABLE ppic_admin_project_snapshot (scope_key TEXT PRIMARY KEY, dashboard_json TEXT, refresh_id TEXT, refresh_until INTEGER DEFAULT 0)");
	const serviceToken = "online-service";
	const dashboard = { project: { task_id: "online-project", custom_id: "AY-ONLINE", name: "Online import project", status: "in progress", startDate: null, dueDate: null },
		items: [], recentHistory: [], memberContribution: [], memberNames: {}, syncedAt: Date.now(), statusUpdatedAt: 1,
		currentStatusDurationMinutes: null, currentStatusStartedAt: null };
	const scope = createHash("sha256").update(JSON.stringify([serviceToken, "1100830000000087", "online-project"])).digest("hex");
	await db.execute({ sql: "INSERT INTO ppic_admin_project_snapshot (scope_key, dashboard_json) VALUES (?, ?)", args: [scope, JSON.stringify(dashboard)] });
	const base = "http://127.0.0.1:3362", secret = "local-online-lby-secret";
	const server = spawn(process.execPath, ["--require", __filename, "node_modules/next/dist/bin/next", "start", "-p", "3362"], {
		windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
			LBY_ONLINE_SERVER: "1", LBY_ONLINE_MODE_FILE: modeFile, TURSO_DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "local-only",
			CLICKUP_CLIENT_SECRET: secret, CLICKUP_TOKEN: serviceToken, CLICKUP_PPIC_PANEL_LIST_ID: "1100830000000087", ABLY_API_KEY: "" },
	});
	let logs = "", browser;
	server.stdout.on("data", (chunk) => { logs += chunk; }); server.stderr.on("data", (chunk) => { logs += chunk; });
	try {
		for (let attempt = 0; ; attempt++) {
			try { if ((await fetch(`${base}/login`)).ok) break; } catch {}
			if (attempt > 60 || server.exitCode !== null) throw new Error(logs);
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		browser = await chromium.launch();
		const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const external = [], errors = [];
		await context.route("**/*", (route) => {
			const url = new URL(route.request().url());
			if (url.origin !== base) { external.push(url.origin); return route.abort(); }
			if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/admin/panel-locations")) return route.fulfill({ status: 401, json: {} });
			return route.continue();
		});
		const authenticate = async (role, update = true) => {
			if (update) await db.execute({ sql: "UPDATE ppic_permissions SET role=? WHERE clickup_user_id='online-admin'", args: [role] });
			const payload = Buffer.from(JSON.stringify({ user_id: "online-admin", role, allowed_status: role === "MEMBER" ? ["BARANG_DITERIMA"] : null, refreshed_at: Date.now() })).toString("base64url");
			const sig = createHmac("sha256", secret).update(payload).digest("base64url");
			await context.addCookies([{ name: "clickup_access_token", value: "online-local-only", url: base }, { name: "ppic_session", value: `${payload}.${sig}`, url: base }]);
		};
		const page = await context.newPage();
		page.on("pageerror", (cause) => errors.push(cause.message));
		const api = `${base}/api/admin/panel-locations`;
		const projectKey = "lby-123456789012345678";
		const post = (url = shareLink(), project) => context.request.post(api, { data: { ...(project ? { project } : {}), url }, timeout: 280000 });
		const activate = (revision, expectedActiveRevision, project = projectKey) => context.request.patch(api, { data: { project, revision, expectedActiveRevision } });
		const state = async () => (await (await context.request.get(`${api}?project=${projectKey}`)).json()).state;
		assert.equal((await post()).status(), 401);
		for (const role of ["SUPER_ADMIN", "MEMBER"]) {
			await authenticate(role);
			assert.equal((await post()).status(), 403);
			assert.equal((await activate("a".repeat(64), null)).status(), 403);
			await page.goto(`${base}/admin/profile`);
			await expect(page.getByRole("button", { name: "Import model LBY", exact: true })).toHaveCount(0);
		}
		await authenticate("ADMIN");
		await page.goto(`${base}/admin/project?task_id=online-project`);
		await expect(page.getByRole("button", { name: /Import model LBY/ })).toHaveCount(0);
		await page.goto(`${base}/admin/profile`);
		await page.getByRole("button", { name: "Import model LBY", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Import lokasi panel LBY" });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText("Belum ada model yang diimpor.")).toBeVisible();
		assert.equal((await post(shareLink(1))).status(), 400);
		assert.equal((await post("https://example.com/#/cadVisitor?token=bad")).status(), 400);
		assert.equal((await post(shareLink(), "z96buhry4p")).status(), 409, "bundled order identity must remain locked");
		setMode("slow");
		await dialog.getByLabel("Link share LBY", { exact: true }).fill(shareLink());
		const started = Date.now();
		await dialog.getByRole("button", { name: "Import model", exact: true }).click();
		await expect(dialog.getByRole("button", { name: "Mengimpor…", exact: true })).toBeDisabled();
		await expect(dialog.getByText("Mengambil dan memvalidasi data LBY. Tetap tunggu, proses masih berjalan…")).toBeVisible();
		assert.equal((await post()).status(), 409, "concurrent imports must share a database lease");
		await expect(dialog.getByText("Import berhasil disimpan.", { exact: false })).toBeVisible({ timeout: 40000 });
		assert(Date.now() - started >= 20000, "test must really wait past a 20-second vendor response");
		setMode("normal");
		let saved = await state();
		const first = saved.versions[0];
		assert.equal(saved.projectKey, projectKey, "URL-only imports derive their identity from LBY order ID");
		const listed = await (await context.request.get(api)).json();
		assert(listed.states.some((entry) => entry.projectKey === projectKey));
		assert.equal(saved.activeRevision, null, "import alone must not activate");
		assert.equal(first.panelCount, 1); assert.equal(first.roomCount, 1);
		const preview = await browser.newPage();
		await preview.context().addCookies(await context.cookies());
		await preview.goto(`${base}/panel-location?${new URLSearchParams({ project: projectKey, barcode: "000123", revision: first.revision })}`);
		await expect(preview.locator("svg[data-selected-barcode]")).toHaveAttribute("data-selected-barcode", "000123");
		await preview.close();
		assert.equal((await context.request.get(`${base}/panel-location?barcode=000123`)).status(), 404);
		await dialog.getByRole("button", { name: "Aktifkan", exact: true }).click();
		await expect(dialog.getByText("Model berhasil diaktifkan.", { exact: false })).toBeVisible();
		assert.equal((await state()).activeRevision, first.revision);
		await page.goto(`${base}/panel-location?project=unrelated-clickup-project&barcode=000123`);
		await expect(page.locator("svg[data-selected-barcode]")).toHaveAttribute("data-selected-barcode", "000123");
		await page.goto(`${base}/panel-location?barcode=123`);
		assert.equal((await context.request.get(`${base}/panel-location?barcode=123`)).status(), 404, "leading zeroes must be preserved");
		await post();
		assert.equal((await state()).versions.length, 1, "same content must reuse its saved revision");
		setMode("changed");
		const changed = await (await post()).json();
		const second = changed.candidate;
		assert.notEqual(second.revision, first.revision);
		assert.equal((await state()).activeRevision, first.revision);
		assert.equal((await activate(second.revision, null)).status(), 409, "stale activation must not overwrite another admin");
		assert.equal((await activate(second.revision, first.revision)).status(), 200);
		assert.equal((await activate(first.revision, second.revision)).status(), 200, "rollback must restore the first version");
		assert.equal((await activate(first.revision, null, "online-other")).status(), 404, "a candidate belongs to exactly one project");
		assert.equal((await activate(null, first.revision)).status(), 404, "unbundled projects cannot reset to an invented fallback");
		for (const mode of ["rate-limit", "missing-match", "bad-crc", "bad-host", "invalid-world", "wrong-order"]) {
			setMode(mode);
			assert((await post()).status() >= 400, mode);
			assert.equal((await state()).activeRevision, first.revision, `${mode} must preserve active data`);
		}
		setMode("normal");
		assert.equal((await post(shareLink(undefined, "999"), projectKey)).status(), 409);
		await db.execute({ sql: "UPDATE ppic_panel_location_project SET import_id='stale', import_until=1 WHERE project_id=?", args: [projectKey] });
		assert.equal((await post()).status(), 200, "an expired worker lease must be recoverable");
		await page.goto(`${base}/admin/profile`);
		await page.getByRole("button", { name: "Import model LBY", exact: true }).click();
		await expect(dialog.getByRole("button", { name: "Aktif", exact: true })).toHaveCount(1);
		setMode("bad-crc");
		await dialog.getByLabel("Link share LBY", { exact: true }).fill(shareLink());
		await dialog.getByRole("button", { name: "Import model", exact: true }).click();
		await expect(dialog.getByRole("alert")).toContainText("Import gagal");
		setMode("normal");
		const duplicate = await (await post(shareLink(), "legacy-duplicate")).json();
		assert.equal((await activate(duplicate.candidate.revision, null, "legacy-duplicate")).status(), 200);
		const duplicatePage = await context.newPage();
		await duplicatePage.goto(`${base}/panel-location?barcode=000123`);
		await expect(duplicatePage.locator("main").getByRole("alert")).toContainText("beberapa model aktif");
		await duplicatePage.goto(`${base}/panel-location?project=${projectKey}&barcode=000123&revision=${first.revision}`);
		await expect(duplicatePage.locator("svg[data-selected-barcode]")).toHaveAttribute("data-selected-barcode", "000123");
		await duplicatePage.close();
		await db.execute("UPDATE ppic_panel_location_project SET active_revision=NULL WHERE project_id='legacy-duplicate'");
		mkdirSync("test-results", { recursive: true });
		await page.screenshot({ path: "test-results/lby-import-dialog-mobile.png", fullPage: true });
		await db.execute("UPDATE ppic_permissions SET role='SUPER_ADMIN' WHERE clickup_user_id='online-admin'");
		assert.equal((await post()).status(), 403, "a stale ADMIN session cannot bypass current database role");
		await authenticate("SUPER_ADMIN", false);
		const denied = await context.request.get(`${base}/panel-location?project=${projectKey}&barcode=000123&revision=${first.revision}`);
		assert(denied.url().endsWith("/unauthorized"), "draft previews require exact ADMIN role");
		await authenticate("MEMBER");
		await page.goto(`${base}/panel-location?barcode=000123`);
		await expect(page.locator("svg[data-selected-barcode]")).toHaveAttribute("data-selected-barcode", "000123");
		const rows = (await db.execute("SELECT metadata_json, snapshot_gzip, mapping_gzip FROM ppic_panel_location_revision")).rows;
		const { gunzipSync } = require("node:zlib");
		for (const row of rows) {
			const persisted = String(row.metadata_json) + gunzipSync(Buffer.from(row.snapshot_gzip)).toString() + gunzipSync(Buffer.from(row.mapping_gzip)).toString();
			assert(!/token|Signature|https?:|price|offer/i.test(persisted), "saved data must exclude secrets, source URLs and financial data");
		}
		assert.deepEqual(errors, []); assert.deepEqual(external, []);
		console.log("PASS: ADMIN profile URL-only import, serial-only lookup, leading zeroes, real 21-second wait, candidates/preview/activation/rollback, idempotency, conflict/lease handling, vendor failures, member reads and secret exclusion (local HTTP simulation).");
	} catch (cause) { console.error(logs); throw cause; }
	finally { await browser?.close(); server.kill(); db.close(); }
}
