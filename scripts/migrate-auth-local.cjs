const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, mkdirSync, readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { createClient } = require("@libsql/client");

const authSql = readFileSync(
	resolve(__dirname, "../drizzle/0004_mean_carlie_cooper.sql"),
	"utf8",
)
	.split("--> statement-breakpoint")
	.map((sql) => sql.trim())
	.filter(Boolean)
	.map((sql) =>
		sql.replace(
			/^CREATE (UNIQUE )?(TABLE|INDEX) /,
			"CREATE $1$2 IF NOT EXISTS ",
		),
	);
const columns = {
	role: "TEXT NOT NULL DEFAULT 'MEMBER'",
	allowed_status: "TEXT",
	active: "INTEGER NOT NULL DEFAULT 0",
	can_import_lby: "INTEGER NOT NULL DEFAULT 0",
	permission_updated_by: "TEXT",
	permission_updated_at: "TEXT",
};
const required = {
	user: [
		"id",
		"name",
		"email",
		"emailVerified",
		"image",
		"role",
		"allowed_status",
		"active",
		"can_import_lby",
		"permission_updated_by",
		"permission_updated_at",
		"createdAt",
		"updatedAt",
	],
	account: [
		"id",
		"accountId",
		"providerId",
		"userId",
		"accessToken",
		"refreshToken",
		"idToken",
		"accessTokenExpiresAt",
		"refreshTokenExpiresAt",
		"scope",
		"password",
		"createdAt",
		"updatedAt",
	],
	session: [
		"id",
		"expiresAt",
		"token",
		"createdAt",
		"updatedAt",
		"ipAddress",
		"userAgent",
		"userId",
	],
	verification: [
		"id",
		"identifier",
		"value",
		"expiresAt",
		"createdAt",
		"updatedAt",
	],
};

async function migrate(db, members, apply = false, expectedPermissions = null) {
	const byId = new Map();
	for (const member of members) {
		assert(
			member &&
				(typeof member.id === "string" || typeof member.id === "number"),
			"Invalid member ID",
		);
		const id = String(member.id).trim();
		assert(id && !byId.has(id), "Empty or duplicate member ID");
		byId.set(id, member);
	}
	const tx = await db.transaction("write");
	try {
		const oldExists =
			(
				await tx.execute(
					"SELECT 1 FROM sqlite_master WHERE type='table' AND name='ppic_permissions'",
				)
			).rows.length > 0;
		if (!oldExists) {
			for (const name of ["user", "account", "session", "verification"]) {
				assert(
					(
						await tx.execute({
							sql: "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
							args: [name],
						})
					).rows.length,
					`Missing ${name}; no legacy permissions to migrate`,
				);
				const names = new Set(
					(await tx.execute(`PRAGMA table_info("${name}")`)).rows.map((row) =>
						String(row.name),
					),
				);
				for (const column of required[name])
					assert(names.has(column), `Missing ${name}.${column}`);
			}
			await tx.rollback();
			return { alreadyMigrated: true };
		}
		for (const sql of authSql) await tx.execute(sql);
		const existing = new Set(
			(await tx.execute('PRAGMA table_info("user")')).rows.map((row) =>
				String(row.name),
			),
		);
		for (const [name, definition] of Object.entries(columns))
			if (!existing.has(name))
				await tx.execute(
					`ALTER TABLE "user" ADD COLUMN "${name}" ${definition}`,
				);
		for (const [name, expected] of Object.entries(required)) {
			const names = new Set(
				(await tx.execute(`PRAGMA table_info("${name}")`)).rows.map((row) =>
					String(row.name),
				),
			);
			for (const column of expected)
				assert(names.has(column), `Missing ${name}.${column}`);
		}
		await tx.execute("DROP VIEW IF EXISTS ppic_auth_permissions");
		const dependencies = await tx.execute(
			"SELECT name FROM sqlite_master WHERE name <> 'ppic_permissions' AND sql LIKE '%ppic_permissions%'",
		);
		assert.equal(
			dependencies.rows.length,
			0,
			"Database objects still reference ppic_permissions",
		);
		const sourceColumns = (
			await tx.execute("PRAGMA table_info(ppic_permissions)")
		).rows.map((row) => String(row.name));
		const expectedColumns = [
			"clickup_user_id",
			"display_name",
			"role",
			"allowed_status",
			"active",
			"can_import_lby",
			"updated_by",
			"updated_at",
		];
		assert(
			sourceColumns.length === expectedColumns.length &&
				expectedColumns.every((name) => sourceColumns.includes(name)),
			"Unexpected legacy permission schema",
		);
		const permissions = (await tx.execute("SELECT * FROM ppic_permissions"))
			.rows;
		if (expectedPermissions) {
			const normalize = (rows) =>
				rows
					.map((p) => expectedColumns.map((key) => p[key]))
					.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
			assert.deepEqual(
				normalize(permissions),
				normalize(expectedPermissions),
				"Legacy permissions differ from backup; create a fresh backup before applying",
			);
		}
		let created = 0,
			placeholders = 0;
		for (const p of permissions) {
			assert(
				p.clickup_user_id != null && String(p.clickup_user_id).trim(),
				"Permission has no ClickUp ID",
			);
			assert(
				["MEMBER", "ADMIN", "SUPER_ADMIN"].includes(p.role),
				"Invalid permission role",
			);
			assert(
				p.active != null &&
					p.can_import_lby != null &&
					[0, 1].includes(Number(p.active)) &&
					[0, 1].includes(Number(p.can_import_lby)),
				"Invalid permission flags",
			);
			assert(
				typeof p.allowed_status === "string" &&
					typeof p.updated_by === "string" &&
					typeof p.updated_at === "string",
				"Incomplete permission record",
			);
			const clickupId = String(p.clickup_user_id);
			const matches = (
				await tx.execute({
					sql: 'SELECT u.* FROM "user" u JOIN account a ON a."userId" = u.id WHERE a."providerId" = ? AND a."accountId" = ?',
					args: ["clickup", clickupId],
				})
			).rows;
			assert(matches.length <= 1, "Duplicate ClickUp account");
			if (matches.length) {
				if (typeof p.display_name === "string" && p.display_name.trim())
					assert.equal(
						matches[0].name,
						p.display_name,
						"Permission display name differs from user name",
					);
				for (const [before, after] of [
					["role", "role"],
					["allowed_status", "allowed_status"],
					["active", "active"],
					["can_import_lby", "can_import_lby"],
					["updated_by", "permission_updated_by"],
					["updated_at", "permission_updated_at"],
				])
					assert.equal(
						matches[0][after],
						p[before],
						`Permission mismatch: ${before}`,
					);
				continue;
			}
			const member = byId.get(clickupId);
			const email =
				typeof member?.email === "string"
					? member.email.trim().toLowerCase()
					: "";
			assert(
				!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
				"Invalid member email",
			);
			if (!email) {
				assert.equal(
					Number(p.active),
					0,
					"Unmatched active user needs a real email",
				);
				assert.equal(
					Number(p.can_import_lby),
					0,
					"Unmatched importer needs a real email",
				);
				assert.equal(p.role, "MEMBER", "Unmatched admin needs a real email");
				placeholders++;
			}
			const id = randomUUID(),
				now = Date.now();
			const name = [member?.name, p.display_name, clickupId]
				.find((value) => typeof value === "string" && value.trim())
				.trim();
			await tx.execute({
				sql: 'INSERT INTO "user" (id,name,email,"emailVerified",role,allowed_status,active,can_import_lby,permission_updated_by,permission_updated_at,"createdAt","updatedAt") VALUES (?,?,?,0,?,?,?,?,?,?,?,?)',
				args: [
					id,
					name,
					email || `${id}@example.invalid`,
					p.role,
					p.allowed_status,
					p.active,
					p.can_import_lby,
					p.updated_by,
					p.updated_at,
					now,
					now,
				],
			});
			await tx.execute({
				sql: 'INSERT INTO account (id,"accountId","providerId","userId","createdAt","updatedAt") VALUES (?,?,?,?,?,?)',
				args: [randomUUID(), clickupId, "clickup", id, now, now],
			});
			created++;
		}
		assert.equal(
			(await tx.execute("PRAGMA integrity_check")).rows[0].integrity_check,
			"ok",
		);
		await tx.execute("DROP TABLE ppic_permissions");
		if (apply) await tx.commit();
		else await tx.rollback();
		return {
			alreadyMigrated: false,
			permissions: permissions.length,
			created,
			placeholders,
			applied: apply,
		};
	} catch (error) {
		await tx.rollback();
		throw error;
	}
}

if (require.main === module)
	(async () => {
		const args = process.argv.slice(2);
		if (args.length === 1 && args[0] === "--help") {
			console.log(
				'Usage: node scripts/migrate-auth-local.cjs --database <sqlite-file> [--members <members.json>] [--apply]\nMembers JSON: [{"id":"clickup-id","name":"Name","email":"name@example.com"}]. Without --apply, changes are rolled back.',
			);
			return;
		}
		const value = (name) => {
			const i = args.indexOf(name);
			return i < 0 ? null : args[i + 1];
		};
		assert(
			args.every(
				(arg, i) =>
					["--database", "--members", "--apply"].includes(arg) ||
					(i > 0 && ["--database", "--members"].includes(args[i - 1])),
			),
			"Unknown argument",
		);
		const file = value("--database");
		assert(
			file && !file.startsWith("--"),
			"Provide --database with a local SQLite file path",
		);
		const databasePath = resolve(file);
		assert(existsSync(databasePath), "Database file does not exist");
		const membersPath = value("--members");
		assert(
			!membersPath || !membersPath.startsWith("--"),
			"Missing members file path",
		);
		const members = membersPath
			? JSON.parse(readFileSync(resolve(membersPath), "utf8"))
			: [];
		assert(Array.isArray(members), "Members file must contain a JSON array");
		const db = createClient({
			url: `file:${databasePath.replaceAll("\\", "/")}`,
		});
		try {
			const preview = await migrate(db, members);
			if (!args.includes("--apply") || preview.alreadyMigrated)
				return console.log(JSON.stringify(preview));
			const backup = `${databasePath}.before-auth-migration-${Date.now()}.db`;
			mkdirSync(dirname(backup), { recursive: true });
			await db.execute({ sql: "VACUUM INTO ?", args: [backup] });
			const backupDb = createClient({
				url: `file:${backup.replaceAll("\\", "/")}`,
			});
			try {
				assert.equal(
					(await backupDb.execute("PRAGMA integrity_check")).rows[0]
						.integrity_check,
					"ok",
					"Backup integrity check failed",
				);
				assert(
					(
						await backupDb.execute(
							"SELECT 1 FROM sqlite_master WHERE type='table' AND name='ppic_permissions'",
						)
					).rows.length,
					"Backup is missing legacy permissions",
				);
			} finally {
				backupDb.close();
			}
			console.log(
				JSON.stringify({ ...(await migrate(db, members, true)), backup }),
			);
		} finally {
			db.close();
		}
	})().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});

module.exports = { migrate };
