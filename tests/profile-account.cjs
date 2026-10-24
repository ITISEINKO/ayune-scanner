// Run: node tests/profile-account.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind } = require("typescript");

let token = "local-account-test";
let payload;
let calls = 0;
let failure = false;
let status = 200;
const sessionModule = { exports: {} };
runInNewContext(transpileModule(readFileSync("src/lib/session.ts", "utf8"), {
	compilerOptions: { module: ModuleKind.CommonJS },
}).outputText, {
	module: sessionModule, exports: sessionModule.exports,
	fetch: async (url) => {
		calls++;
		assert.equal(url, "https://api.clickup.com/api/v2/user");
		if (failure) throw new Error("local network failure");
		return Response.json(payload, { status });
	},
	require(id) {
		if (id === "next/headers") return { cookies: async () => ({ get: () => token ? { value: token } : undefined }) };
		if (id === "next/cache") return { unstable_cache: (fn) => fn };
		if (id === "react") return { cache: (fn) => fn };
		if (id === "@/lib/clickup") return { clickUpHeaders: () => ({}) };
		if (id.startsWith("@/") || id === "next/navigation") return {};
		return require(id);
	},
});
const routeModule = { exports: {} };
runInNewContext(transpileModule(readFileSync("src/app/api/profile/route.ts", "utf8"), {
	compilerOptions: { module: ModuleKind.CommonJS },
}).outputText, {
	module: routeModule, exports: routeModule.exports,
	require: (id) => id === "@/lib/session"
		? { ...sessionModule.exports, ppicSession: async () => ({ role: "MEMBER", allowed_status: ["BARANG_DITERIMA"] }) }
		: require("next/server.js"),
});

(async () => {
	for (const [body, expected] of [
		[{ user: { username: "  nickia habibi  ", email: "member@example.test" } }, { displayName: "nickia habibi", email: "member@example.test" }],
		[{ username: "Member Name", email: "member@example.test" }, { displayName: "Member Name", email: "member@example.test" }],
		[{ user: { username: "  ", name: "Fallback Name" } }, { displayName: "Fallback Name", email: null }],
		[{ user: { username: 42, email: false } }, { displayName: null, email: null }],
		[{}, { displayName: null, email: null }],
	]) {
		payload = body;
		const before = calls;
		const response = await routeModule.exports.GET();
		assert.deepEqual(await response.json(), { ...expected, role: "MEMBER", allowedStatuses: ["BARANG_DITERIMA"] });
		assert.equal(calls, before + 1, "name and email share one request");
	}
	status = 401;
	assert.equal(await sessionModule.exports.clickUpProfile(), null);
	status = 200;
	failure = true;
	assert.equal(await sessionModule.exports.clickUpProfile(), null);
	token = null;
	const before = calls;
	assert.equal(await sessionModule.exports.clickUpProfile(), null);
	assert.equal(calls, before, "missing token skips the upstream request");
	console.log("Profile account passed: display name/email mapping, one upstream request, field validation and failure fallbacks.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
