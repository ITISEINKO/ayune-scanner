// Run: node scripts/add-admin-role.cjs (loads .env; preserves every existing role).
const assert = require("node:assert/strict");
const { mkdirSync, writeFileSync } = require("node:fs");
const { resolve, join } = require("node:path");
const { randomUUID } = require("node:crypto");
const { createClient } = require("@libsql/client");

async function addAdminRole(db, backupDirectory) {
	const tx = await db.transaction("write");
	try {
		const objects = (await tx.execute("SELECT type, name, sql FROM sqlite_master WHERE tbl_name = 'ppic_permissions' ORDER BY type, name")).rows;
		const schema = objects.find((object) => object.type === "table")?.sql;
		assert.equal(typeof schema, "string", "ppic_permissions must already exist");
		if (/CHECK\s*\(role IN \('MEMBER', 'SUPER_ADMIN', 'ADMIN'\)\)/.test(schema)) {
			await tx.rollback();
			return { changed: false };
		}
		const oldCheck = "CHECK (role IN ('MEMBER', 'SUPER_ADMIN'))";
		assert.ok(schema.includes(oldCheck), "Unexpected role constraint; inspect the schema before migrating");
		for (const table of (await tx.execute("SELECT name FROM sqlite_master WHERE type = 'table'")).rows) {
			const foreignKeys = (await tx.execute(`PRAGMA foreign_key_list("${String(table.name).replaceAll('"', '""')}")`)).rows;
			assert.ok(!foreignKeys.some((key) => key.table === "ppic_permissions"), "Incoming foreign keys need a dedicated migration");
		}
		const rows = (await tx.execute("SELECT * FROM ppic_permissions ORDER BY clickup_user_id")).rows;
		const backup = join(resolve(backupDirectory), `ppic-permissions-${Date.now()}-${randomUUID()}.json`);
		mkdirSync(resolve(backupDirectory), { recursive: true });
		writeFileSync(backup, JSON.stringify({ objects, rows }, null, 2), { flag: "wx", mode: 0o600 });
		const expanded = schema.replace(oldCheck, "CHECK (role IN ('MEMBER', 'SUPER_ADMIN', 'ADMIN'))");
		const create = expanded.replace(/^CREATE TABLE\s+(?:"ppic_permissions"|ppic_permissions)/i, 'CREATE TABLE "ppic_permissions_admin_migration"');
		assert.notEqual(create, expanded, "Unexpected table declaration");
		await tx.execute(create);
		await tx.execute("INSERT INTO ppic_permissions_admin_migration SELECT * FROM ppic_permissions");
		await tx.execute("DROP TABLE ppic_permissions");
		await tx.execute('ALTER TABLE ppic_permissions_admin_migration RENAME TO "ppic_permissions"');
		for (const object of objects) {
			if (object.type !== "table" && object.sql) await tx.execute(object.sql);
		}
		assert.deepEqual((await tx.execute("SELECT * FROM ppic_permissions ORDER BY clickup_user_id")).rows, rows, "Migration must preserve every stored value");
		assert.equal((await tx.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
		await tx.commit();
		return { changed: true, rows: rows.length, backup };
	} catch (error) {
		await tx.rollback();
		throw error;
	} finally {
		tx.close();
	}
}

module.exports = { addAdminRole };
if (require.main === module) {
	process.loadEnvFile(".env");
	const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
	addAdminRole(db, resolve(".local-backups"))
		.then((result) => console.log(JSON.stringify(result)))
		.catch((error) => { console.error(error.message); process.exitCode = 1; })
		.finally(() => db.close());
}
