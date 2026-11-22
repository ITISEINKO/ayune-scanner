const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createClient } = require("@libsql/client");

(async () => {
	const db = createClient({ url: ":memory:" });
	await db.execute('CREATE TABLE "user" (id TEXT PRIMARY KEY)');
	await db.execute('CREATE TABLE account ("userId" TEXT, "accountId" TEXT, "providerId" TEXT)');
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT, role TEXT, allowed_status TEXT, active INTEGER, can_import_lby INTEGER, updated_by TEXT, updated_at TEXT)");
	await db.execute("CREATE VIEW ppic_auth_permissions AS SELECT 1");
	await db.execute("INSERT INTO user VALUES ('matched'), ('unmatched')");
	await db.execute("INSERT INTO account VALUES ('matched', '123', 'clickup'), ('unmatched', '123', 'other')");
	await db.execute("INSERT INTO ppic_permissions VALUES ('123', 'ADMIN', 'BARANG_DITERIMA', 1, 1, 'editor', '2026-01-01')");
	await db.batch(readFileSync("drizzle/0006_absurd_redwing.sql", "utf8").split("--> statement-breakpoint").map((sql) => sql.trim()).filter(Boolean), "write");
	const rows = (await db.execute("SELECT * FROM user ORDER BY id")).rows;
	assert.deepEqual([rows[0].role, rows[0].allowed_status, rows[0].active, rows[0].can_import_lby, rows[0].permission_updated_by, rows[0].permission_updated_at], ["ADMIN", "BARANG_DITERIMA", 1, 1, "editor", "2026-01-01"]);
	assert.equal(rows[1].role, "MEMBER");
	assert.equal(rows[1].active, 0);
	assert.equal((await db.execute("SELECT name FROM sqlite_master WHERE type = 'view' AND name = 'ppic_auth_permissions'")).rows.length, 0);
	db.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
