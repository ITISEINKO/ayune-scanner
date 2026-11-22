const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind } = require("typescript");

let identity = { user_id: "123" };
let session = { role: "MEMBER", allowed_status: ["BARANG_DITERIMA"] };
let lookups = 0;
const mod = { exports: {} };
runInNewContext(transpileModule(readFileSync("src/features/profile/getProfile.ts", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, {
	module: mod, exports: mod.exports,
	require(id) {
		if (id === "@/lib/session") return { getClickUpIdentity: async () => identity, getAppSession: async () => session };
		if (id === "@/lib/db") return { getPpicProfile: async (id) => { lookups++; assert.equal(id, "123"); return { displayName: "Member", email: "member@example.test" }; } };
		return require(id);
	},
});

(async () => {
	let profile = await mod.exports.getProfile();
	assert.equal(profile.displayName, "Member");
	assert.equal(profile.email, "member@example.test");
	assert.equal(profile.role, "MEMBER");
	session = null;
	profile = await mod.exports.getProfile();
	assert.equal(profile.displayName, "Member", "revoked user retains profile access");
	assert.equal(profile.role, null);
	identity = null;
	const before = lookups;
	profile = await mod.exports.getProfile();
	assert.equal(profile.email, null);
	assert.equal(lookups, before, "anonymous requests do not look up user records");
})().catch((error) => { console.error(error); process.exitCode = 1; });
