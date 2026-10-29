// Run: node tests/lby-permission-migration.cjs
const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createClient } = require("@libsql/client");
const { consolidateLbyPermissions } = require("../scripts/consolidate-lby-permissions.cjs");

(async () => {
	const directory = mkdtempSync(join(tmpdir(), "trackerprod-lby-permission-"));
	const db = createClient({ url: "file::memory:" });
	try {
		await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, allowed_status TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)), updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, role TEXT NOT NULL DEFAULT 'MEMBER' CHECK(role IN ('MEMBER','SUPER_ADMIN','ADMIN')), display_name TEXT)");
		await db.execute("CREATE INDEX permission_role ON ppic_permissions(role)");
		await db.execute("INSERT INTO ppic_permissions VALUES ('member','SEDANG_DIPACKING',1,'original','2026-10-20','MEMBER','Member'), ('107554556','BARANG_DITERIMA',1,'original','2026-10-20','SUPER_ADMIN','Target'), ('admin','BARANG_DITERIMA',1,'original','2026-10-20','ADMIN','Admin')");
		await db.execute("CREATE TABLE ppic_lby_import_permission (clickup_user_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), updated_by TEXT NOT NULL, updated_at TEXT NOT NULL)");
		await db.execute("INSERT INTO ppic_lby_import_permission VALUES ('member',1,'old-admin','2026-10-21'), ('import-only',1,'old-admin','2026-10-22'), ('disabled',0,'old-admin','2026-10-22')");
		const original = (await db.execute("SELECT * FROM ppic_permissions ORDER BY clickup_user_id")).rows;
		const legacy = (await db.execute("SELECT * FROM ppic_lby_import_permission ORDER BY clickup_user_id")).rows;
		const migrated = await consolidateLbyPermissions(db, directory, "107554556");
		assert.equal(migrated.changed, true);
		assert.equal(migrated.rows, 5);
		assert.equal(migrated.migratedGrants, 3);
		const backup = JSON.parse(readFileSync(migrated.backup, "utf8"));
		assert.deepEqual(backup.rows, original.map((row) => ({ ...row })));
		assert.deepEqual(backup.legacy, legacy.map((row) => ({ ...row })));
		for (const old of original) {
			const current = (await db.execute({ sql: "SELECT * FROM ppic_permissions WHERE clickup_user_id=?", args: [old.clickup_user_id] })).rows[0];
			for (const key of ["role", "active", "allowed_status", "display_name"]) assert.equal(current[key], old[key], `${key} must survive consolidation`);
		}
		const flags = (await db.execute("SELECT clickup_user_id, can_import_lby FROM ppic_permissions")).rows;
		assert.deepEqual(Object.fromEntries(flags.map((row) => [row.clickup_user_id, row.can_import_lby])), { member: 1, "107554556": 1, admin: 0, "import-only": 1, disabled: 0 });
		const orphan = (await db.execute("SELECT role, active FROM ppic_permissions WHERE clickup_user_id='import-only'")).rows[0];
		assert.equal(orphan.role, "MEMBER");
		assert.equal(orphan.active, 0, "import-only grants must not turn on scan permissions");
		assert.equal((await db.execute("SELECT name FROM sqlite_master WHERE name='ppic_lby_import_permission'")).rows.length, 0);
		assert.equal((await db.execute("SELECT name FROM sqlite_master WHERE name='permission_role'")).rows.length, 1);
		await assert.rejects(db.execute("UPDATE ppic_permissions SET can_import_lby=2 WHERE clickup_user_id='member'"), /CHECK/);
		assert.deepEqual(await consolidateLbyPermissions(db, directory, "107554556"), { changed: false });
		assert.deepEqual(await consolidateLbyPermissions(db, directory), { changed: false });
		await assert.rejects(consolidateLbyPermissions(db, directory, "999"), /must already exist/);
		await assert.rejects(consolidateLbyPermissions(db, directory, "bad'id"), /Invalid grant user/);
		assert.equal((await db.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
	} finally { db.close(); }
	const failed = createClient({ url: "file::memory:" });
	try {
		// An unknown required column prevents copying an orphan; the transaction must restore both schemas.
		await failed.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, allowed_status TEXT NOT NULL, active INTEGER, role TEXT, updated_by TEXT, updated_at TEXT, required_extra TEXT NOT NULL)");
		await failed.execute("CREATE TABLE ppic_lby_import_permission (clickup_user_id TEXT PRIMARY KEY, enabled INTEGER, updated_by TEXT, updated_at TEXT)");
		await failed.execute("INSERT INTO ppic_lby_import_permission VALUES ('orphan',1,'test','2026-10-28')");
		await assert.rejects(consolidateLbyPermissions(failed, directory), /NOT NULL/);
		assert(!(await failed.execute("PRAGMA table_info(ppic_permissions)")).rows.some((column) => column.name === "can_import_lby"));
		assert.equal((await failed.execute("SELECT count(*) count FROM ppic_lby_import_permission")).rows[0].count, 1, "failed copies retain legacy grants");
		await failed.execute("CREATE VIEW legacy_reader AS SELECT * FROM ppic_lby_import_permission");
		await assert.rejects(consolidateLbyPermissions(failed, directory), /dependent views or triggers/);
		await failed.execute("DROP VIEW legacy_reader");
		await failed.execute("CREATE TABLE legacy_reference (user_id TEXT REFERENCES ppic_lby_import_permission(clickup_user_id))");
		await assert.rejects(consolidateLbyPermissions(failed, directory), /incoming foreign keys/);
		assert.equal((await failed.execute("SELECT count(*) count FROM ppic_lby_import_permission")).rows[0].count, 1);
	} finally { failed.close(); }
	console.log("PASS: LBY permission column migration, verified backup, target grant without role/scan changes, orphan grants, constraints, idempotence and rollback.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
