// Run with the existing Postman admin-dashboard simulation on port 4900:
// node tests/admin-role.cjs
const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind } = require("typescript");
const { createClient } = require("@libsql/client");
const { addAdminRole } = require("../scripts/add-admin-role.cjs");
const { consolidateLbyPermissions } = require("../scripts/consolidate-lby-permissions.cjs");

const directory = mkdtempSync(join(tmpdir(), "trackerprod-admin-role-"));
const db = createClient({ url: `file:${join(directory, "roles.db").replaceAll("\\", "/")}` });
const cookies = new Map([["clickup_access_token", "local-role-test"]]);
const modules = new Map();
let upstreamCalls = 0;
let published = 0;
let tokenRequest;
let sessionUser = "local-admin";
let sessionValid = true;
const env = { ...process.env, TURSO_DATABASE_URL: "file:unused", TURSO_AUTH_TOKEN: "local-only", CLICKUP_CLIENT_SECRET: "local-role-test-secret" };
const load = (file) => {
	if (modules.has(file)) return modules.get(file);
	const module = { exports: {} };
	runInNewContext(transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, {
		module, exports: module.exports, process: { env }, Buffer, console, URL, Response,
		fetch: async (input, init) => {
			const url = new URL(String(input));
			assert.equal(url.origin, "https://api.clickup.com");
			upstreamCalls++;
			return fetch(`${process.env.ADMIN_DASHBOARD_SIM_URL || "http://127.0.0.1:4900/clickup"}${url.pathname}${url.search}`, {
				...init, headers: { ...init?.headers, "x-test-mode": "home" },
			});
		},
		require(id) {
			if (id === "@libsql/client") return { createClient: () => db };
			if (id === "next/headers") return { headers: async () => ({}), cookies: async () => ({ get: (key) => cookies.has(key) ? { value: cookies.get(key) } : undefined }) };
			if (id === "@/lib/auth") return { auth: { api: { getSession: async () => sessionValid ? { user: { id: sessionUser }, session: { updatedAt: new Date() } } : null, getAccessToken: async () => ({ accessToken: "local-role-test" }) } } };
			if (id === "next/cache") return { unstable_cache: (fn) => fn, revalidateTag() {} };
			if (id === "next/navigation") return { redirect: (path) => { throw new Error(`redirect:${path}`); } };
			if (id === "react") return { cache: (fn) => fn };
			if (id === "next/server") return require("next/server.js");
			if (id === "@/lib/ably") return { getAbly: () => ({
				channels: { get: () => ({ publish: async () => { published++; } }) },
				auth: { createTokenRequest: async (options) => { tokenRequest = options; return options; } },
			}) };
			if (id.startsWith("@/")) return load(`src/${id.slice(2)}.ts`);
			return require(id);
		},
	});
	modules.set(file, module.exports);
	return module.exports;
};
const json = (value) => JSON.parse(JSON.stringify(value));

(async () => {
	await db.execute("CREATE TABLE ppic_permissions (clickup_user_id TEXT PRIMARY KEY, allowed_status TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)), updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER', 'SUPER_ADMIN')), display_name TEXT)");
	await db.execute("CREATE INDEX permission_role_test ON ppic_permissions(role)");
	await db.execute("INSERT INTO ppic_permissions VALUES ('local-admin', '[\"BARANG_DITERIMA\",\"SEDANG_DIPACKING\"]', 1, 'original', '2026-10-20', 'SUPER_ADMIN', 'Original Admin'), ('budi', 'BARANG_DITERIMA', 0, 'original', '2026-10-21', 'MEMBER', 'Budi')");
	const before = (await db.execute("SELECT * FROM ppic_permissions ORDER BY clickup_user_id")).rows;
	await assert.rejects(db.execute("UPDATE ppic_permissions SET role='ADMIN' WHERE clickup_user_id='local-admin'"), /CHECK/);
	const migration = await addAdminRole(db, directory);
	assert.equal(migration.changed, true);
	assert.deepEqual((await db.execute("SELECT * FROM ppic_permissions ORDER BY clickup_user_id")).rows, before);
	assert.deepEqual(JSON.parse(readFileSync(migration.backup)).rows, before.map((row) => ({ ...row })));
	assert.equal((await db.execute("SELECT name FROM sqlite_master WHERE name='permission_role_test'")).rows.length, 1);
	assert.equal((await addAdminRole(db, directory)).changed, false, "migration is idempotent");
	await assert.rejects(db.execute("UPDATE ppic_permissions SET role='OWNER' WHERE clickup_user_id='local-admin'"), /CHECK/);
	await assert.rejects(db.execute("UPDATE ppic_permissions SET active=2 WHERE clickup_user_id='local-admin'"), /CHECK/);
	await consolidateLbyPermissions(db, directory);
	await db.execute('CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT, role TEXT, active INTEGER, allowed_status TEXT, can_import_lby INTEGER, permission_updated_by TEXT, permission_updated_at TEXT)');
	await db.execute('CREATE TABLE account (id TEXT, "userId" TEXT, "accountId" TEXT, "providerId" TEXT)');
	await db.execute('INSERT INTO "user" SELECT clickup_user_id, display_name, role, active, allowed_status, can_import_lby, updated_by, updated_at FROM ppic_permissions');
	await db.execute("INSERT INTO account SELECT clickup_user_id, clickup_user_id, clickup_user_id, 'clickup' FROM ppic_permissions");
	const types = load("src/types/ppic.ts"), access = load("src/lib/db.ts"), session = load("src/lib/session.ts");
	sessionValid = false;
	assert.equal(await session.getAppSession(), null, "missing Better Auth session is rejected");
	sessionValid = true;
	assert.equal(await session.isPpicChannelMember("local-role-test", "budi"), true, "PPIC channel members pass the channel check");
	assert.equal(await session.isPpicChannelMember("local-role-test", "outside-channel"), false, "users outside the PPIC channel fail the channel check");
	assert.equal(types.isPpicRole("ADMIN"), true);
	assert.equal(types.hasPpicAdminAccess("MEMBER"), false);
	for (const role of ["SUPER_ADMIN", "ADMIN"]) {
		await db.execute({ sql: "UPDATE user SET role=? WHERE id='local-admin'", args: [role] });
		assert.equal(await access.isPpicSuperAdmin("local-admin"), true);
		assert.deepEqual(json(await session.getAuthorizationState("local-admin")), { role, allowed_status: null, path: "/admin", can_import_lby: false });
		assert.equal((await session.getAppSession()).role, role, "signed session preserves the exact role");
		assert.equal(await session.postLoginPath(), "/admin");
		await session.requireSuperAdmin();
		assert.equal(await session.requireFreshSuperAdmin(), "local-admin");
		assert.equal(await session.requireFreshPpicStatusAccess("TERPASANG_DIGUNAKAN"), "local-admin");
		assert.equal((await session.panelChannelMembers()).ok, true);
		const refresh = await load("src/app/api/auth/refresh/route.ts").GET();
		assert.equal(refresh.status, 200);
		assert.equal((await refresh.json()).path, "/admin");
		assert.equal((await load("src/app/api/ably/token/route.ts").GET()).status, 200);
		assert.deepEqual(json(tokenRequest.capability["ppic:settings"]), ["subscribe"]);
	}
	const route = load("src/app/api/panel/members/route.ts");
	const update = (target, role) => route.POST(new Request("http://localhost/api/panel/members", { method: "POST", body: JSON.stringify({ user_id: target, role }) }));
	await db.execute("UPDATE user SET role='SUPER_ADMIN' WHERE id='local-admin'");
	assert.equal((await update("budi", "ADMIN")).status, 403, "SUPER_ADMIN cannot grant ADMIN");
	await db.execute("UPDATE user SET role='ADMIN' WHERE id='budi'");
	assert.equal((await update("budi", "MEMBER")).status, 403, "SUPER_ADMIN cannot demote ADMIN");
	await db.execute("UPDATE user SET role='ADMIN' WHERE id='local-admin'");
	assert.equal((await update("budi", "SUPER_ADMIN")).status, 200);
	assert.equal((await update("budi", "ADMIN")).status, 200);
	assert.equal((await access.getPpicAccess("budi")).role, "ADMIN");
	assert.equal((await update("budi", "OWNER")).status, 400);
	assert.equal(published, 4, "successful updates retain both realtime notifications");
	assert.equal((await update("budi", "MEMBER")).status, 200);
	const scanPermissionBefore = (await db.execute("SELECT role, active, allowed_status FROM user WHERE id='budi'")).rows;
	assert.equal((await session.getAuthorizationState("budi")).path, "/unauthorized", "inactive members without LBY access are denied");
	const setImporter = (enabled, extra = {}) => route.POST(new Request("http://localhost/api/panel/members", {
		method: "POST", body: JSON.stringify({ user_id: "budi", can_import_lby: enabled, ...extra }),
	}));
	assert.equal((await setImporter("true")).status, 400);
	assert.equal((await setImporter(true, { allowed_status: ["BARANG_DITERIMA"] })).status, 400);
	assert.equal((await setImporter(true)).status, 200);
	assert.deepEqual((await db.execute("SELECT role, active, allowed_status FROM user WHERE id='budi'")).rows, scanPermissionBefore, "LBY access must not change scan statuses, active flag or role");
	assert.equal((await db.execute("SELECT can_import_lby FROM user WHERE id='budi'")).rows[0].can_import_lby, 1);
	assert.equal(await access.canImportLby("budi"), true);
	const drafterLogin = await session.getAuthorizationState("budi");
	assert.equal(drafterLogin.path, "/drafter");
	assert.equal(drafterLogin.allowed_status, null, "import-only users have no scan access");
	sessionUser = "budi";
	assert.equal((await session.getAppSession()).can_import_lby, true);
	assert.equal(await session.postLoginPath(), "/drafter");
	await assert.rejects(session.requireSuperAdmin(), /redirect:\/unauthorized/);
	await assert.rejects(session.requireFreshPpicStatusAccess("BARANG_DITERIMA"), /redirect:\/unauthorized/);
	assert.equal((await load("src/app/api/ably/token/route.ts").GET()).status, 200);
	assert.equal(tokenRequest.capability["ppic:settings"], undefined, "drafter must not subscribe to settings");
	sessionUser = "local-admin";
	assert.equal((await setImporter(false)).status, 200);
	assert.equal(await access.canImportLby("budi"), false, "revocation must beat an older signed grant");
	assert.equal((await session.getAuthorizationState("budi")).path, "/unauthorized");
	await update("budi", "SUPER_ADMIN");
	assert.equal(await access.canImportLby("budi"), false, "SUPER_ADMIN has no automatic LBY grant");
	assert.equal((await setImporter(true)).status, 200);
	assert.equal(await access.canImportLby("budi"), true, "explicit column grants apply without changing SUPER_ADMIN role");
	assert.equal((await access.getPpicAccess("budi")).role, "SUPER_ADMIN");
	await access.savePpicRole("budi", "MEMBER", "test-admin");
	assert.equal(await access.canImportLby("budi"), true, "changing role must not wipe a separately granted LBY flag");
	await access.savePpicPermission("budi", ["BARANG_DITERIMA"], "test-admin");
	await access.deactivatePpicPermission("budi", "test-admin");
	assert.equal(await access.canImportLby("budi"), true, "turning off scan access must preserve LBY access");
	await setImporter(false);
	await assert.rejects(access.saveLbyImportPermission("new-member", true, "local-admin"), /not provisioned/);
	sessionUser = "local-admin";
	await db.execute("UPDATE user SET role='MEMBER', active=0 WHERE id='local-admin'");
	await assert.rejects(session.requireFreshSuperAdmin(), /redirect:\/profile/);
	await assert.rejects(session.requireFreshPpicStatusAccess("BARANG_DITERIMA"), /redirect:\/profile/, "revoked session cannot bypass fresh checks");
	await assert.rejects(session.requireSuperAdmin(), /redirect:\/profile/);
	assert.equal((await update("budi", "MEMBER")).status, 401);
	assert.equal((await setImporter(true)).status, 401, "revoked members cannot grant their own LBY access");
	assert.ok(upstreamCalls > 0, "ClickUp identity and membership use real HTTP through the Postman simulation");
	console.log(`PASS: additive migration, row preservation, constraints, both admin roles, login/refresh, fresh revocation and highest-role protection (${upstreamCalls} simulated HTTP calls).`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
