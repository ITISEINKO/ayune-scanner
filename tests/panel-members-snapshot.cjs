// Run: node tests/panel-members-snapshot.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind } = require("typescript");

let upstream = 0, allowed = true, session = true, fail = false;
const db = {
	savePpicMemberNames: async () => {},
	isPpicSuperAdmin: async () => allowed,
	getPpicMemberAccess: async () => ({ roles: {}, permissions: {} }),
	getLbyImportPermissions: async () => ({}),
};
const mod = { exports: {} };
runInNewContext(transpileModule(readFileSync("src/app/api/panel/members/route.ts", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, {
	module: mod, exports: mod.exports, URL,
	require(id) {
		if (id === "next/server") return require("next/server.js");
		if (id === "next/cache") return { revalidateTag() {} };
		if (id === "@/lib/db") return db;
		if (id === "@/lib/session") return {
			getAppSession: async () => session ? { user_id: "admin" } : null,
			panelChannelMembers: async () => { upstream++; return fail ? { ok: false, status: 502 } : { ok: true, members: [{ id: "1", name: `Name ${upstream}` }] }; },
		};
		if (id === "@/types/ppic" || id === "@/lib/ably") return {};
		throw Error(id);
	},
});
const get = (query = "") => mod.exports.GET(new Request(`http://localhost/api/panel/members${query}`));
(async () => {
	assert.equal((await get()).status, 200);
	assert.equal(upstream, 1, "first visit reads channel members");
	assert.equal((await (await get()).json()).members[0].name, "Name 2");
	assert.equal(upstream, 2, "normal reads use channel members");
	assert.equal((await (await get("?refresh=1")).json()).members[0].name, "Name 3");
	fail = true;
	assert.equal((await get("?refresh=1")).status, 502);
	assert.equal((await get()).status, 502, "workspace members are not used as fallback");
	allowed = false;
	assert.equal((await get()).status, 403);
	session = false;
	assert.equal((await get()).status, 401);
	console.log("PASS: channel member reads, refresh, failure and authorization.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
