const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { spawnSync } = require("node:child_process");
const { createClient } = require("@libsql/client");
const { readMigrationFiles } = require("drizzle-orm/migrator");

(async () => {
	const dir = mkdtempSync(join(tmpdir(), "prod-auth-migrate-"));
	const file = join(dir, "db.sqlite"), backup = join(dir, "backup.sqlite"), members = join(dir, "members.json");
	const url = `file:${file.replaceAll("\\", "/")}`;
	const db = createClient({ url });
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, display_name TEXT, role TEXT, allowed_status TEXT, active INTEGER, can_import_lby INTEGER, updated_by TEXT, updated_at TEXT)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('123','Admin','ADMIN','BARANG_DITERIMA',1,0,'actor','now'),('456','Inactive','MEMBER','',0,0,'actor','now')");
	await db.execute({ sql: "VACUUM INTO ?", args: [backup] });
	writeFileSync(members, JSON.stringify([{ id: "123", name: "Admin", email: "admin@example.test" }]));
	await db.execute('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)');
	const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
	for (const [i, migration] of migrations.entries()) {
		if (i >= 3) for (const sql of migration.sql) if (sql.trim()) await db.execute(sql);
		await db.execute({ sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)', args: [migration.hash, migration.folderMillis] });
	}
	const run = (...args) => spawnSync(process.execPath, ["scripts/migrate-auth-production.cjs", "--members", members, ...args], { encoding: "utf8", env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "local" } });
	await db.execute("UPDATE __drizzle_migrations SET hash='incorrect' WHERE id=1");
	assert.match(run().stderr, /history does not match/);
	await db.execute({ sql: 'UPDATE __drizzle_migrations SET hash=? WHERE id=1', args: [migrations[0].hash] });
	let result = run();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(JSON.parse(result.stdout).created, 2);
	assert.equal((await db.execute('SELECT count(*) n FROM "user"')).rows[0].n, 0);
	result = run("--apply");
	assert.notEqual(result.status, 0);
	await db.execute("UPDATE ppic_permissions SET active=0 WHERE clickup_user_id='123'");
	result = run("--backup", backup, "--apply");
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /differ from backup/);
	assert.equal((await db.execute("SELECT count(*) n FROM ppic_permissions")).rows[0].n, 2);
	await db.execute("UPDATE ppic_permissions SET active=1 WHERE clickup_user_id='123'");
	result = run("--backup", backup, "--apply");
	assert.equal(result.status, 0, result.stderr);
	assert.equal(JSON.parse(result.stdout).created, 2);
	assert.equal((await db.execute('SELECT count(*) n FROM "user"')).rows[0].n, 2);
	assert.equal((await db.execute('SELECT role FROM "user" WHERE role=\'ADMIN\'')).rows[0].role, "ADMIN");
	assert.equal((await db.execute("SELECT count(*) n FROM account WHERE providerId='clickup'")).rows[0].n, 2);
	assert.equal((await db.execute("SELECT count(*) n FROM sqlite_master WHERE name='ppic_permissions'")).rows[0].n, 0);
	assert.equal(JSON.parse(run().stdout).alreadyMigrated, true);
	db.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
