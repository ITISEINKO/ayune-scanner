const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind, ScriptTarget } = require("typescript");
const { createClient } = require("@libsql/client");

const db = createClient({ url: ":memory:" });
function load(file) {
	const mod = { exports: {} };
	runInNewContext(transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText, {
		module: mod, exports: mod.exports, process: { env: { TURSO_DATABASE_URL: "file:test", TURSO_AUTH_TOKEN: "test" } },
		require(id) {
			if (id === "@libsql/client") return { createClient: () => db };
			if (id === "@/types/ppic") return load("src/types/ppic.ts");
			return require(id);
		},
	});
	return mod.exports;
}

(async () => {
	await db.execute('CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL, allowed_status TEXT, active INTEGER, can_import_lby INTEGER, permission_updated_by TEXT, permission_updated_at TEXT)');
	await db.execute('CREATE TABLE account ("userId" TEXT, "accountId" TEXT, "providerId" TEXT)');
	await db.execute("INSERT INTO user VALUES ('u', 'Name', 'member@example.test', 'MEMBER', 'BARANG_DITERIMA', 1, 0, 'original', '2026-01-01')");
	await db.execute("INSERT INTO account VALUES ('u', '123', 'clickup')");
	const access = load("src/lib/db.ts");
	assert.equal((await access.getPpicProfile("123")).email, "member@example.test");
	await db.execute("UPDATE user SET email = 'placeholder@example.invalid'");
	assert.equal((await access.getPpicProfile("123")).email, null);
	assert.equal((await access.getPpicAccess("123")).role, "MEMBER");
	await access.savePpicRole("123", "ADMIN", "actor");
	assert.equal(await access.isPpicSuperAdmin("123"), true);
	await access.savePpicRole("123", "MEMBER", "actor");
	assert.equal(Number((await access.getPpicAccess("123")).active), 0);
	await access.savePpicPermission("123", ["SEDANG_DIPACKING"], "actor");
	assert.deepEqual(Array.from((await access.getPpicAccess("123")).allowed_status), ["SEDANG_DIPACKING"]);
	await access.saveLbyImportPermission("123", true, "actor");
	assert.equal(await access.canImportLby("123"), true);
	await access.deactivatePpicPermission("123", "actor");
	assert.equal(Number((await access.getPpicAccess("123")).active), 0);
	assert.equal((await db.execute('SELECT permission_updated_by FROM "user"')).rows[0].permission_updated_by, "actor");
	await assert.rejects(access.savePpicRole("missing", "ADMIN", "actor"), /not provisioned/);
	await db.execute("INSERT INTO account VALUES ('u', '123', 'clickup')");
	await assert.rejects(access.savePpicRole("123", "ADMIN", "actor"), /not provisioned/);
	assert.equal((await db.execute('SELECT role FROM "user"')).rows[0].role, "MEMBER");
	db.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
