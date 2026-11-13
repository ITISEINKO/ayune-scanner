const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

(async () => {
	const revision = "a".repeat(64);
	let active = revision, allowed = true, verified = true;
	const modules = {
		"next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
		"@/lib/db": { canImportLby: async () => allowed },
		"@/lib/session": { ppicSession: async () => ({ user_id: "user" }), clickUpToken: async () => "token" },
		"../../../../../scripts/import-lby-project.cjs": {},
		"../../../../../scripts/public-model-import.cjs": {},
		"@/lib/trialPublicModels": {
			readTrialModel: async () => ({}),
			activateTrialModel: async (_id, next, expected) => {
				if (next && !verified) throw new Error("SERIAL_COVERAGE_UNVERIFIED");
				if (expected !== active) return false;
				active = next;
				return true;
			},
		},
	};
	const moduleResult = { exports: {} };
	runInNewContext(ts.transpileModule(readFileSync("src/app/api/admin/trial-3d-import/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module: moduleResult, exports: moduleResult.exports, Buffer, Error, Response, URL, AbortSignal, require: (id) => modules[id] || require(id) });
	const patch = (body) => moduleResult.exports.PATCH(new Request("http://localhost/api/admin/trial-3d-import", { method: "PATCH", body: JSON.stringify(body) }));
	assert.equal((await patch({ id: "123", revision: null, expected: "b".repeat(64) })).status, 409);
	assert.equal(active, revision);
	assert.equal((await patch({ id: "123", revision: null, expected: revision })).status, 200);
	assert.equal(active, null);
	verified = false;
	assert.equal((await patch({ id: "123", revision, expected: null })).status, 422);
	assert.equal(active, null);
	verified = true;
	assert.equal((await patch({ id: "123", revision, expected: null })).status, 200);
	allowed = false;
	assert.equal((await patch({ id: "123", revision: null, expected: revision })).status, 403);
	assert.equal(active, revision);
	console.log("Trial activation API: deactivation, conflict, unverified revision and authorization passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
