// Run after production build with postman/simulations/admin-dashboard.sim.yaml on port 4900.
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createClient } = require("@libsql/client");

(async () => {
	const dir = mkdtempSync(join(tmpdir(), "manual-serial-"));
	const mode = join(dir, "mode.txt");
	writeFileSync(mode, "manual-location");
	const dbUrl = `file:${join(dir, "test.db").replaceAll("\\", "/")}`;
	const db = createClient({ url: dbUrl });
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, role TEXT, active INTEGER, allowed_status TEXT, can_import_lby INTEGER NOT NULL DEFAULT 0)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('manual-admin', 'ADMIN', 1, NULL, 0)");
	await db.execute("CREATE TABLE ppic_component_status (component_task_id TEXT PRIMARY KEY, project_task_id TEXT, status TEXT, updated_at INTEGER)");
	await db.execute("INSERT INTO ppic_component_status VALUES ('manual-panel', 'project', 'BARANG_DITERIMA', 1)");
	const base = "http://127.0.0.1:3362", secret = "local-only-secret";
	const server = spawn(process.execPath, ["--require", "./tests/admin-manual-location.cjs", "node_modules/next/dist/bin/next", "start", "-p", "3362"], { windowsHide: true, stdio: "ignore", env: { ...process.env, MANUAL_LOCATION_SERVER: "1", MANUAL_LOCATION_MODE_FILE: mode, TURSO_DATABASE_URL: dbUrl, TURSO_AUTH_TOKEN: "local-only", CLICKUP_CLIENT_SECRET: secret, CLICKUP_PPIC_PANEL_LIST_ID: "1100830000000087", CLICKUP_FIELD_STATUS_BARANG_SCAN: "3d3a2535-9d01-4ca2-8a51-9b2f9182857c" } });
	try {
		for (let i = 0; ; i++) {
			try { if ((await fetch(`${base}/login`)).ok) break; } catch {}
			if (i > 60 || server.exitCode !== null) throw Error("Local server did not start");
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		const control = (path) => fetch(`http://127.0.0.1:4900/clickup/test/${path}`, { headers: { "x-test-mode": "manual-location" } }).then((r) => r.json());
		await control("reset");
		const payload = Buffer.from(JSON.stringify({ user_id: "manual-admin", role: "ADMIN", allowed_status: null, refreshed_at: Date.now() })).toString("base64url");
		const signature = createHmac("sha256", secret).update(payload).digest("base64url");
		const headers = { "Content-Type": "application/json", Cookie: `clickup_access_token=manual-local-only; ppic_session=${payload}.${signature}` };
		const save = (serial) => fetch(`${base}/api/panel/manual`, { method: "POST", headers, body: JSON.stringify({ task_id: "manual-panel", serial_number: serial, status: "SEDANG_DIPACKING" }) });
		assert.equal((await save("wrong")).status, 409);
		assert.equal((await control("writes")).writes, 0);
		assert.equal((await save("15370046376")).status, 200);
		assert.equal((await control("writes")).writes, 1);
		assert.equal((await db.execute("SELECT status FROM ppic_component_status WHERE component_task_id='manual-panel'")).rows[0].status, "SEDANG_DIPACKING");
		writeFileSync(mode, "manual-location-save-fail");
		assert.equal((await save("15370046376")).status, 502);
		assert.equal((await control("writes")).writes, 1);
		console.log("Manual serial mismatch, successful update and upstream failure checks passed");
	} finally { server.kill(); db.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
