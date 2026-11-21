const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind } = require("typescript");

const values = new Map();
let access = { role: "ADMIN", active: 1, allowed_status: ["BARANG_DITERIMA"] };
let importer = false;
let clickupCalls = 0;
const modules = new Map();
function load(file) {
	if (modules.has(file)) return modules.get(file);
	const mod = { exports: {} };
	runInNewContext(transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, {
		module: mod, exports: mod.exports, Buffer, Date, Response, process: { env: { CLICKUP_CLIENT_SECRET: "test-secret" } },
		fetch: async () => { clickupCalls++; throw new Error("unexpected ClickUp request"); },
		require(id) {
			if (id === "next/headers") return { cookies: async () => ({ get: (key) => values.has(key) ? { value: values.get(key) } : undefined }) };
			if (id === "next/cache") return { unstable_cache: (fn) => fn };
			if (id === "next/navigation") return { redirect: (path) => { throw new Error(`redirect:${path}`); } };
			if (id === "next/server") return require("next/server.js");
			if (id === "react") return { cache: (fn) => fn };
			if (id === "@/lib/clickup") return { clickUpHeaders: () => ({}) };
			if (id === "@/lib/db") return { getPpicAccess: async () => access, canImportLby: async () => importer, isPpicSuperAdmin: async () => access?.role === "ADMIN", isPpicStatus: (value) => value === "BARANG_DITERIMA" };
			if (id === "@/lib/produksiPanel") return {};
			if (id === "@/types/ppic") return { hasPpicAdminAccess: (value) => value === "ADMIN" || value === "SUPER_ADMIN" };
			if (id === "@/lib/session") return load("src/lib/session.ts");
			return require(id);
		},
	});
	modules.set(file, mod.exports);
	return mod.exports;
}

(async () => {
	const session = load("src/lib/session.ts");
	const refresh = load("src/app/api/auth/refresh/route.ts");
	values.set("ppic_session", session.encodePpicSession("user", "ADMIN", null));
	assert.equal((await session.getAppSession()).role, "ADMIN");
	access = { role: "MEMBER", active: 1, allowed_status: ["BARANG_DITERIMA"] };
	assert.equal((await session.getAppSession()).role, "MEMBER");
	await assert.rejects(session.requireSuperAdmin(), /redirect:\/unauthorized/);
	let response = await refresh.GET();
	assert.equal((await response.json()).path, "/projects");
	assert.equal(response.headers.get("set-cookie"), null);
	access = { role: "MEMBER", active: 0, allowed_status: null };
	assert.equal(await session.getAppSession(), null);
	response = await refresh.GET();
	assert.equal((await response.json()).path, "/profile");
	await assert.rejects(session.requireSuperAdmin(), /redirect:\/profile/);
	await assert.rejects(session.requireFreshSuperAdmin(), /redirect:\/profile/);
	await assert.rejects(session.requireFreshPpicStatusAccess("BARANG_DITERIMA"), /redirect:\/profile/);
	await assert.rejects(session.requireSelectedMemberProject(), /redirect:\/profile/);
	values.set("ppic_session", "invalid");
	assert.equal((await refresh.GET()).status, 401);
	assert.equal(clickupCalls, 0);
})().catch((error) => { console.error(error); process.exitCode = 1; });
