// Run after testing: node scripts/consolidate-lby-permissions.cjs [--grant-user CLICKUP_USER_ID]
const assert = require("node:assert/strict");
const { mkdirSync, writeFileSync, readFileSync } = require("node:fs");
const { resolve, join } = require("node:path");
const { randomUUID } = require("node:crypto");
const { createClient } = require("@libsql/client");

async function consolidateLbyPermissions(db, backupDirectory, grantUserId) {
	assert(grantUserId === undefined || /^\d{1,30}$/.test(grantUserId), "Invalid grant user ID");
	const tx = await db.transaction("write");
	try {
		const objects = (await tx.execute("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name IN ('ppic_permissions', 'ppic_lby_import_permission') ORDER BY type, name")).rows;
		assert(objects.some((entry) => entry.type === "table" && entry.name === "ppic_permissions"), "ppic_permissions must already exist");
		const columns = (await tx.execute("PRAGMA table_info(ppic_permissions)")).rows;
		const hasColumn = columns.some((column) => column.name === "can_import_lby");
		const legacyExists = objects.some((entry) => entry.type === "table" && entry.name === "ppic_lby_import_permission");
		const rows = (await tx.execute("SELECT * FROM ppic_permissions ORDER BY clickup_user_id")).rows;
		if (grantUserId !== undefined) assert(rows.some((row) => row.clickup_user_id === grantUserId), "Grant user must already exist; roles will not be inferred");
		if (hasColumn && !legacyExists && (!grantUserId || Number(rows.find((row) => row.clickup_user_id === grantUserId).can_import_lby) === 1)) {
			await tx.rollback();
			return { changed: false };
		}
		const legacy = legacyExists ? (await tx.execute("SELECT * FROM ppic_lby_import_permission ORDER BY clickup_user_id")).rows : [];
		for (const row of legacy) assert([0, 1].includes(Number(row.enabled)), "Invalid legacy permission");
		if (legacyExists) {
			for (const table of (await tx.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows) {
				const keys = (await tx.execute(`PRAGMA foreign_key_list("${String(table.name).replaceAll('"', '""')}")`)).rows;
				assert(!keys.some((key) => key.table === "ppic_lby_import_permission"), "Legacy table has incoming foreign keys; inspect before migrating");
			}
			assert(!(await tx.execute("SELECT name FROM sqlite_master WHERE type IN ('view','trigger') AND tbl_name != 'ppic_lby_import_permission' AND instr(lower(sql), 'ppic_lby_import_permission') > 0")).rows.length, "Legacy table has dependent views or triggers; inspect before migrating");
		}
		const backup = join(resolve(backupDirectory), `lby-permissions-${Date.now()}-${randomUUID()}.json`);
		mkdirSync(resolve(backupDirectory), { recursive: true });
		const before = { objects, rows, legacy };
		writeFileSync(backup, JSON.stringify(before, null, 2), { flag: "wx", mode: 0o600 });
		assert.deepEqual(JSON.parse(readFileSync(backup, "utf8")), JSON.parse(JSON.stringify(before)), "Backup verification failed");
		if (!hasColumn) await tx.execute("ALTER TABLE ppic_permissions ADD COLUMN can_import_lby INTEGER NOT NULL DEFAULT 0 CHECK (can_import_lby IN (0, 1))");
		if (legacyExists) await tx.execute(`INSERT INTO ppic_permissions (clickup_user_id, allowed_status, active, role, updated_by, updated_at, can_import_lby)
			SELECT clickup_user_id, 'BARANG_DITERIMA', 0, 'MEMBER', updated_by, updated_at, enabled FROM ppic_lby_import_permission WHERE 1
			ON CONFLICT(clickup_user_id) DO UPDATE SET can_import_lby = excluded.can_import_lby`);
		if (grantUserId !== undefined) await tx.execute({
			sql: "UPDATE ppic_permissions SET can_import_lby=1, updated_by='migration:lby-permission', updated_at=CURRENT_TIMESTAMP WHERE clickup_user_id=?",
			args: [grantUserId],
		});
		const after = (await tx.execute("SELECT * FROM ppic_permissions ORDER BY clickup_user_id")).rows;
		for (const old of rows) {
			const current = after.find((row) => row.clickup_user_id === old.clickup_user_id);
			assert(current, "Existing user lost during migration");
			for (const [key, value] of Object.entries(old)) {
				if (key === "can_import_lby" || (old.clickup_user_id === grantUserId && ["updated_by", "updated_at"].includes(key))) continue;
				assert.deepEqual(current[key], value, `Existing ${key} changed during migration`);
			}
			const expected = old.clickup_user_id === grantUserId ? 1 : legacy.find((row) => row.clickup_user_id === old.clickup_user_id)?.enabled ?? old.can_import_lby ?? 0;
			assert.equal(Number(current.can_import_lby), Number(expected), "Permission copy mismatch");
		}
		for (const old of legacy) {
			const current = after.find((row) => row.clickup_user_id === old.clickup_user_id);
			assert.equal(Number(current?.can_import_lby), old.clickup_user_id === grantUserId ? 1 : Number(old.enabled), "Legacy grant lost");
			if (!rows.some((row) => row.clickup_user_id === old.clickup_user_id)) {
				assert.equal(current.role, "MEMBER");
				assert.equal(Number(current.active), 0, "Migrated import-only user must not gain scan access");
			}
		}
		assert.equal(after.length, new Set([...rows, ...legacy].map((row) => row.clickup_user_id)).size, "Unexpected user count after migration");
		assert.equal((await tx.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
		if (legacyExists) await tx.execute("DROP TABLE ppic_lby_import_permission");
		assert.equal((await tx.execute("SELECT name FROM sqlite_master WHERE name='ppic_lby_import_permission'")).rows.length, 0);
		assert.equal((await tx.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
		await tx.commit();
		return { changed: true, rows: after.length, migratedGrants: legacy.length, grantedUser: grantUserId ?? null, backup };
	} catch (error) {
		await tx.rollback();
		throw error;
	} finally { tx.close(); }
}

module.exports = { consolidateLbyPermissions };
if (require.main === module) {
	const args = process.argv.slice(2);
	assert(args.length === 0 || (args.length === 2 && args[0] === "--grant-user"), "Usage: node scripts/consolidate-lby-permissions.cjs [--grant-user CLICKUP_USER_ID]");
	process.loadEnvFile(".env");
	const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
	consolidateLbyPermissions(db, resolve(".local-backups"), args[1])
		.then((result) => console.log(JSON.stringify(result)))
		.catch((error) => { console.error(error.message); process.exitCode = 1; })
		.finally(() => db.close());
}
