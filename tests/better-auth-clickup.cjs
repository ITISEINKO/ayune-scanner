const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { transpileModule, ModuleKind } = require("typescript");

(async () => {
	let teamId = "team";
	const module = { exports: {} };
	runInNewContext(
		transpileModule(readFileSync("src/lib/auth.ts", "utf8"), {
			compilerOptions: { module: ModuleKind.CommonJS },
		}).outputText,
		{
			module,
			exports: module.exports,
			process: {
				env: {
					CLICKUP_TEAM_ID: "team",
					CLICKUP_CLIENT_ID: "client",
					CLICKUP_CLIENT_SECRET: "secret",
				},
			},
			fetch: async (url) => ({
				ok: true,
				json: async () =>
					String(url).endsWith("/user")
						? { user: { id: 7, email: "a@example.com", username: "A" } }
						: String(url).endsWith("/team")
							? { teams: [{ id: teamId }] }
							: {},
			}),
			require(id) {
				if (id === "better-auth") return { betterAuth: (config) => config };
				if (id === "better-auth/adapters/drizzle")
					return { drizzleAdapter: () => ({}) };
				if (id === "better-auth/plugins")
					return { genericOAuth: (config) => config };
				if (id === "drizzle-orm/libsql") return { drizzle: () => ({}) };
				if (id === "@/db/schema") return {};
				if (id === "@/lib/clickup")
					return { clickUpHeaders: (token) => ({ Authorization: token }) };
				if (id === "@/lib/produksiPanel")
					return {
						CLICKUP_TEAM_ID: "team",
					};
				return require(id);
			},
		},
	);
	const provider = module.exports.auth.plugins[0].config[0];
	assert.equal(provider.disableSignUp, false, "verified ClickUp workspace members can sign up");
	assert.equal(
		(await provider.getUserInfo({ accessToken: "token" })).email,
		"a@example.com",
		"ClickUp identity is returned for Better Auth to create the local account",
	);
	teamId = "other-team";
	assert.equal(await provider.getUserInfo({ accessToken: "token" }), null);
	assert.equal(module.exports.auth.user.additionalFields.role.input, false);
	assert.equal(module.exports.auth.user.additionalFields.role.defaultValue, "MEMBER");
	assert.equal(module.exports.auth.user.additionalFields.active.defaultValue, false);
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
