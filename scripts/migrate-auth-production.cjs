const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { loadEnvFile } = require("node:process");
const { createClient } = require("@libsql/client");
const { readMigrationFiles } = require("drizzle-orm/migrator");
const { migrate } = require("./migrate-auth-local.cjs");

async function main() {
	const args = process.argv.slice(2);
	if (args.includes("--help")) {
		console.log("Usage: node scripts/migrate-auth-production.cjs --members <members.json> [--backup <backup.db> --apply]\nPreview rolls back. Apply requires a verified local database backup and stopped application writes.");
		return;
	}
	const options = {};
	for (let i = 0; i < args.length; i++) {
		const key = args[i];
		assert(["--members", "--backup", "--apply"].includes(key) && !Object.hasOwn(options, key), `Invalid or duplicate argument: ${key}`);
		if (key === "--apply") options[key] = true;
		else { assert(args[i + 1] && !args[i + 1].startsWith("--"), `Missing value for ${key}`); options[key] = args[++i]; }
	}
	assert(options["--members"], "Provide --members with a trusted ClickUp workspace members JSON file");
	assert(!options["--apply"] || options["--backup"], "Apply requires --backup with a complete local database backup");
	const members = JSON.parse(readFileSync(resolve(options["--members"]), "utf8"));
	assert(Array.isArray(members), "Members file must contain a JSON array");
	if (existsSync(".env")) loadEnvFile(".env");
	assert(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN, "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required");
	const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
	try {
		const expected = readMigrationFiles({ migrationsFolder: resolve(__dirname, "../drizzle") });
		const journal = JSON.parse(readFileSync(resolve(__dirname, "../drizzle/meta/_journal.json"), "utf8"));
		const rows = (await db.execute('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at')).rows;
		assert.equal(rows.length, expected.length, "Drizzle migration history is incomplete or unexpected; review it and run pnpm db:migrate first");
		for (let i = 0; i < expected.length; i++) {
			const sql = readFileSync(resolve(__dirname, `../drizzle/${journal.entries[i].tag}.sql`), "utf8").replace(/\r\n/g, "\n");
			const hashes = [sql, sql.replace(/\n/g, "\r\n")].map((text) => createHash("sha256").update(text).digest("hex"));
			assert(Number(rows[i].created_at) === expected[i].folderMillis && hashes.includes(rows[i].hash), "Drizzle migration history does not match repository files");
		}
		let backupPermissions = null;
		if (options["--backup"]) {
			const path = resolve(options["--backup"]);
			assert(existsSync(path), "Backup file does not exist");
			const backup = createClient({ url: `file:${path.replaceAll("\\", "/")}` });
			try {
				assert.equal((await backup.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok", "Backup integrity check failed");
				backupPermissions = (await backup.execute("SELECT * FROM ppic_permissions")).rows;
			} finally { backup.close(); }
		}
		console.log(JSON.stringify(await migrate(db, members, !!options["--apply"], backupPermissions)));
	} finally { db.close(); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
