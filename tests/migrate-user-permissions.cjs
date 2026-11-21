const assert = require("node:assert/strict");
const { createClient } = require("@libsql/client");
const { migrateUserPermissions } = require("../scripts/migrate-user-permissions.cjs");

(async () => {
	const db = createClient({ url: ":memory:" });
	await db.execute('CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, "emailVerified" INTEGER, role TEXT, allowed_status TEXT, active INTEGER, can_import_lby INTEGER, permission_updated_by TEXT, permission_updated_at TEXT, "createdAt" INTEGER, "updatedAt" INTEGER)');
	await db.execute('CREATE TABLE account (id TEXT, "accountId" TEXT, "providerId" TEXT, "userId" TEXT, "createdAt" INTEGER, "updatedAt" INTEGER)');
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT, display_name TEXT, role TEXT, allowed_status TEXT, active INTEGER, can_import_lby INTEGER, updated_by TEXT, updated_at TEXT)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('123', 'Admin', 'ADMIN', 'BARANG_DITERIMA', 1, 0, 'actor', '2026-01-01'), ('456', 'Inactive', 'MEMBER', 'BARANG_DITERIMA', 0, 0, 'actor', '2026-01-01')");
	await db.execute("INSERT INTO user VALUES ('u', 'Admin', 'a@example.com', 0, 'MEMBER', 'BARANG_DITERIMA', 1, 0, 'actor', '2026-01-01', 1, 1)");
	await db.execute("INSERT INTO account VALUES ('a', '123', 'clickup', 'u', 1, 1)");
	await assert.rejects(migrateUserPermissions(db), /Permission mismatch/);
	assert.equal((await db.execute("SELECT count(*) n FROM ppic_permissions")).rows[0].n, 2);
	await db.execute("UPDATE user SET role = 'ADMIN' WHERE id = 'u'");
	const result = await migrateUserPermissions(db);
	assert.equal(result.users, 2);
	assert.equal(result.placeholders, 1);
	const missing = (await db.execute("SELECT u.email, u.active, u.permission_updated_by FROM user u JOIN account a ON a.userId=u.id WHERE a.accountId='456'")).rows[0];
	assert(missing.email.endsWith("@example.invalid"));
	assert.equal(missing.active, 0);
	assert.equal(missing.permission_updated_by, "actor");
	assert.equal((await db.execute("SELECT count(*) n FROM sqlite_master WHERE name='ppic_permissions'")).rows[0].n, 0);
	db.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
