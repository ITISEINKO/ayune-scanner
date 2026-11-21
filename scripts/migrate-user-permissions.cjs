const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createClient } = require("@libsql/client");

async function migrateUserPermissions(db) {
	const tx = await db.transaction("write");
	try {
		const dependencies = await tx.execute("SELECT name FROM sqlite_master WHERE name <> 'ppic_permissions' AND sql LIKE '%ppic_permissions%'");
		assert.equal(dependencies.rows.length, 0, "Database objects still reference ppic_permissions");
		const permissions = (await tx.execute("SELECT * FROM ppic_permissions")).rows;
		let placeholders = 0;
		for (const p of permissions) {
			const matches = (await tx.execute({ sql: 'SELECT u.* FROM "user" u JOIN account a ON a."userId" = u.id WHERE a."providerId" = ? AND a."accountId" = ?', args: ["clickup", p.clickup_user_id] })).rows;
			assert(matches.length <= 1, "Duplicate ClickUp account");
			if (!matches.length) {
				assert.equal(Number(p.active), 0, "Unmatched active user requires verified identity");
				assert.equal(Number(p.can_import_lby), 0, "Unmatched importer requires verified identity");
				assert.equal(p.role, "MEMBER", "Unmatched admin requires verified identity");
				const id = randomUUID(), now = Date.now();
				await tx.execute({ sql: 'INSERT INTO "user" (id, name, email, "emailVerified", role, allowed_status, active, can_import_lby, permission_updated_by, permission_updated_at, "createdAt", "updatedAt") VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)', args: [id, p.display_name || String(p.clickup_user_id), `${id}@example.invalid`, p.role, p.allowed_status, p.active, p.can_import_lby, p.updated_by, p.updated_at, now, now] });
				await tx.execute({ sql: 'INSERT INTO account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)', args: [randomUUID(), p.clickup_user_id, "clickup", id, now, now] });
				placeholders++;
				continue;
			}
			const u = matches[0];
			for (const [before, after] of [["role", "role"], ["allowed_status", "allowed_status"], ["active", "active"], ["can_import_lby", "can_import_lby"], ["updated_by", "permission_updated_by"], ["updated_at", "permission_updated_at"]])
				assert.equal(u[after], p[before], `Permission mismatch: ${before}`);
		}
		assert.equal((await tx.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
		await tx.execute("DROP TABLE ppic_permissions");
		await tx.commit();
		return { users: permissions.length, placeholders };
	} catch (error) {
		await tx.rollback();
		throw error;
	}
}

module.exports = { migrateUserPermissions };
