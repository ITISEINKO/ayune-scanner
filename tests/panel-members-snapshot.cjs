// Run: node tests/panel-members-snapshot.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind } = require("typescript");

let snapshot = null, upstream = 0, allowed = true, session = true, fail = false;
const db = {
	getPanelMembersSnapshot: async () => snapshot,
	savePanelMembersSnapshot: async (members) => { snapshot = members; },
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
			ppicSession: async () => session ? { user_id: "admin" } : null,
			panelChannelMembers: async () => { upstream++; return fail ? { ok: false, status: 502 } : { ok: true, members: [{ id: "1", name: `Name ${upstream}` }] }; },
		};
		if (id === "@/types/ppic" || id === "@/lib/ably") return {};
		throw Error(id);
	},
});
const get = (query = "") => mod.exports.GET(new Request(`http://localhost/api/panel/members${query}`));
(async () => {
	assert.equal((await get()).status, 200);
	assert.equal(upstream, 1, "first visit initializes snapshot");
	assert.equal((await (await get()).json()).members[0].name, "Name 1");
	assert.equal(upstream, 1, "normal reads avoid ClickUp");
	assert.equal((await (await get("?refresh=1")).json()).members[0].name, "Name 2");
	fail = true;
	assert.equal((await get("?refresh=1")).status, 502);
	assert.equal((await (await get()).json()).members[0].name, "Name 2", "failed refresh preserves snapshot");
	allowed = false;
	assert.equal((await get()).status, 403);
	session = false;
	assert.equal((await get()).status, 401);
	console.log("PASS: member snapshot bootstrap, reads, refresh, failure and authorization.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
