const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { loadEnvFile } = require("node:process");
const { createClient } = require("@libsql/client");

(async () => {
	loadEnvFile(".env");
	const response = await fetch("https://api.clickup.com/api/v2/team", {
		headers: { Authorization: process.env.CLICKUP_TOKEN },
	});
	assert(response.ok, `ClickUp returned HTTP ${response.status}`);
	const workspace = (await response.json()).teams?.find(
		(team) => String(team.id) === process.env.CLICKUP_TEAM_ID,
	);
	assert(Array.isArray(workspace?.members), "Workspace members unavailable");
	const members = new Map(
		workspace.members
			.filter((entry) => entry.user?.id != null)
			.map((entry) => [String(entry.user.id), entry.user]),
	);
	const db = createClient({ url: "file:trackerprod-panel.db" });
	const tx = await db.transaction("write");
	try {
		assert.equal(
			Number((await tx.execute('SELECT count(*) AS n FROM "user"')).rows[0].n),
			0,
			"User table must be empty",
		);
		assert.equal(
			Number((await tx.execute("SELECT count(*) AS n FROM account")).rows[0].n),
			0,
			"Account table must be empty",
		);
		const permissions = (
			await tx.execute(
				"SELECT clickup_user_id, display_name, role, allowed_status, active, can_import_lby, updated_by, updated_at FROM ppic_permissions",
			)
		).rows;
		const users = permissions.flatMap((permission) => {
			const member = members.get(String(permission.clickup_user_id));
			const email =
				typeof member?.email === "string"
					? member.email.trim().toLowerCase()
					: "";
			if (!email) return [];
			const name = [member.username, member.name, permission.display_name].find(
				(value) => typeof value === "string" && value.trim(),
			);
			assert(name, "Matched user has no name");
			return [
				{
					clickupId: String(permission.clickup_user_id),
					email,
					name: name.trim(),
					permission,
				},
			];
		});
		assert.equal(
			new Set(users.map((user) => user.email)).size,
			users.length,
			"Duplicate emails require manual review",
		);
		const now = Date.now();
		for (const user of users) {
			const userId = randomUUID();
			await tx.execute({
				sql: 'INSERT INTO "user" (id, name, email, "emailVerified", role, allowed_status, active, can_import_lby, permission_updated_by, permission_updated_at, "createdAt", "updatedAt") VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)',
				args: [
					userId,
					user.name,
					user.email,
					user.permission.role,
					user.permission.allowed_status,
					user.permission.active,
					user.permission.can_import_lby,
					user.permission.updated_by,
					user.permission.updated_at,
					now,
					now,
				],
			});
			await tx.execute({
				sql: 'INSERT INTO account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
				args: [randomUUID(), user.clickupId, "clickup", userId, now, now],
			});
		}
		assert.equal(
			Number(
				(
					await tx.execute(
						'SELECT count(*) AS n FROM account a JOIN ppic_permissions p ON p.clickup_user_id = a."accountId" WHERE a."providerId" = \'clickup\'',
					)
				).rows[0].n,
			),
			users.length,
		);
		assert.equal(
			Number(
				(
					await tx.execute(
						'SELECT count(*) AS n FROM "user" u JOIN account a ON a."userId" = u.id JOIN ppic_permissions p ON p.clickup_user_id = a."accountId" WHERE a."providerId" = \'clickup\' AND (u.role IS NOT p.role OR u.allowed_status IS NOT p.allowed_status OR u.active IS NOT p.active OR u.can_import_lby IS NOT p.can_import_lby OR u.permission_updated_by IS NOT p.updated_by OR u.permission_updated_at IS NOT p.updated_at)',
					)
				).rows[0].n,
			),
			0,
			"Permissions must match",
		);
		assert.equal(
			(await tx.execute("PRAGMA integrity_check")).rows[0].integrity_check,
			"ok",
		);
		await tx.commit();
		console.log(
			`Imported ${users.length} users; ${permissions.length - users.length} permissions unmatched or missing email.`,
		);
	} catch (error) {
		await tx.rollback();
		throw error;
	} finally {
		db.close();
	}
})().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
