const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { gzipSync } = require("node:zlib");
const ts = require("typescript");

(async () => {
	const revision = "a".repeat(64);
	let session = { user_id: "user" }, access = { role: "MEMBER", active: 1 }, importer = false, token = "token";
	const snapshot = { rooms: [{ id: "room", data: gzipSync('[{"id":"panel"}]').toString("base64") }], textures: [{ id: "texture", mime: "image/png", image: Buffer.from("image").toString("base64") }] };
	const modules = {
		"@/lib/db": { getPpicAccess: async () => access, canImportLby: async () => importer },
		"@/lib/session": { ppicSession: async () => session, clickUpToken: async () => token },
		"@/types/ppic": { hasPpicAdminAccess: (role) => role === "ADMIN" },
		"@/lib/trialPublicModels": { listTrialModels: async () => [{ id: "123", activeRevision: revision }], readTrialModel: async () => snapshot },
	};
	const module = { exports: {} };
	runInNewContext(ts.transpileModule(readFileSync("src/app/api/panel/trial-model/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module, exports: module.exports, Buffer, Uint8Array, Response, URL, require: (id) => modules[id] || require(id) });
	const get = (query) => module.exports.GET(new Request(`http://localhost/api/panel/trial-model?${query}`));
	const query = `id=123&revision=${revision}`;
	let response = await get(`${query}&room=room`);
	assert.equal(response.status, 200);
	assert.equal(await response.text(), '[{"id":"panel"}]');
	response = await get(`${query}&texture=texture`);
	assert.equal(response.status, 200);
	assert.equal(await response.text(), "image");
	assert.equal((await get(`id=123&revision=${"b".repeat(64)}&room=room`)).status, 404);
	assert.equal((await get(`${query}&room=room&texture=texture`)).status, 400);
	access = { role: "MEMBER", active: 0 };
	assert.equal((await get(`${query}&room=room`)).status, 403);
	importer = true;
	assert.equal((await get(`${query}&room=room`)).status, 200);
	importer = false; access = { role: "ADMIN", active: 1 };
	assert.equal((await get(`${query}&room=room`)).status, 200);
	token = null;
	assert.equal((await get(`${query}&room=room`)).status, 401);
	session = null;
	assert.equal((await get(`${query}&room=room`)).status, 401);
	console.log("Trial location access, active revision, room and texture checks passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
