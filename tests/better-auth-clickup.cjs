const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind } = require("typescript");

(async () => {
	let role = "ADMIN";
	let active = 0;
	let allowedStatus = null;
	let memberId = 7;
	const module = { exports: {} };
	runInNewContext(transpileModule(readFileSync("src/lib/auth.ts", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, {
		module, exports: module.exports, process: { env: { CLICKUP_TEAM_ID: "team", CLICKUP_CLIENT_ID: "client", CLICKUP_CLIENT_SECRET: "secret" } },
		fetch: async (url) => ({ ok: true, json: async () => String(url).endsWith("/user") ? { user: { id: 7, email: "a@example.com", username: "A" } } : String(url).endsWith("/team") ? { teams: [{ id: "team" }] } : { members: [{ id: memberId }] } }),
		require(id) {
			if (id === "better-auth") return { betterAuth: (config) => config };
			if (id === "better-auth/adapters/drizzle") return { drizzleAdapter: () => ({}) };
			if (id === "better-auth/plugins") return { genericOAuth: (config) => config };
			if (id === "drizzle-orm/libsql") return { drizzle: () => ({}) };
			if (id === "@/db/schema") return {};
			if (id === "@/lib/db") return { db: { execute: async () => ({ rows: role ? [{ role, active, allowed_status: allowedStatus, can_import_lby: 0 }] : [] }) } };
			if (id === "@/lib/clickup") return { clickUpHeaders: (token) => ({ Authorization: token }) };
			if (id === "@/lib/produksiPanel") return { CLICKUP_TEAM_ID: "team", CLICKUP_PPIC_CHANNEL_ID: "channel" };
			if (id === "@/types/ppic") return { ppicStatuses: (value) => value === "BARANG_DITERIMA" ? [value] : null };
			return require(id);
		},
	});
	const provider = module.exports.auth.plugins[0].config[0];
	assert.equal((await provider.getUserInfo({ accessToken: "token" })).id, "7");
	role = "MEMBER";
	assert.equal(await provider.getUserInfo({ accessToken: "token" }), null);
	active = 1;
	assert.equal(await provider.getUserInfo({ accessToken: "token" }), null);
	allowedStatus = "BARANG_DITERIMA";
	assert.equal((await provider.getUserInfo({ accessToken: "token" })).id, "7");
	role = "ADMIN";
	memberId = 8;
	assert.equal(await provider.getUserInfo({ accessToken: "token" }), null);
	assert.equal(module.exports.auth.user.additionalFields.role.input, false);
})().catch((error) => { console.error(error); process.exitCode = 1; });
