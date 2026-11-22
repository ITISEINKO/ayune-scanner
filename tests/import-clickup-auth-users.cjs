const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const { createClient } = require("@libsql/client");

(async () => {
	const db = createClient({ url: ":memory:" });
	await db.execute('CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT, email TEXT, "emailVerified" INTEGER, role TEXT, allowed_status TEXT, active INTEGER, can_import_lby INTEGER, permission_updated_by TEXT, permission_updated_at TEXT, "createdAt" INTEGER, "updatedAt" INTEGER)');
	await db.execute('CREATE TABLE account (id TEXT, "accountId" TEXT, "providerId" TEXT, "userId" TEXT, "createdAt" INTEGER, "updatedAt" INTEGER)');
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT, display_name TEXT, role TEXT, allowed_status TEXT, active INTEGER, can_import_lby INTEGER, updated_by TEXT, updated_at TEXT)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('123', 'Name', 'ADMIN', 'BARANG_DITERIMA', 1, 1, 'editor', '2026-01-01'), ('missing', 'Missing', 'MEMBER', 'BARANG_DITERIMA', 0, 0, 'editor', '2026-01-01')");
	let finish;
	const done = new Promise((resolve) => { finish = resolve; });
	const context = { require(id) {
		if (id === "@libsql/client") return { createClient: () => ({ transaction: (...args) => db.transaction(...args), close: finish }) };
		if (id === "node:process") return { loadEnvFile() {} };
		return require(id);
	}, process: { env: { CLICKUP_TEAM_ID: "team" } }, fetch: async () => ({ ok: true, json: async () => ({ teams: [{ id: "team", members: [{ user: { id: "123", email: "ADMIN@EXAMPLE.COM", username: "Admin" } }] }] }) }), console };
	vm.runInNewContext(readFileSync("scripts/import-clickup-auth-users.cjs", "utf8"), context);
	await done;
	const row = (await db.execute('SELECT * FROM "user"')).rows[0];
	assert.deepEqual([row.email, row.role, row.allowed_status, row.active, row.can_import_lby, row.permission_updated_by, row.permission_updated_at], ["admin@example.com", "ADMIN", "BARANG_DITERIMA", 1, 1, "editor", "2026-01-01"]);
	assert.equal((await db.execute("SELECT count(*) AS n FROM account")).rows[0].n, 1);
	assert.equal((await db.execute("SELECT count(*) AS n FROM ppic_permissions")).rows[0].n, 2);
	db.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
