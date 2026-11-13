const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { gzipSync } = require("node:zlib");
const ts = require("typescript");

(async () => {
	const revision = "a".repeat(64);
	const snapshot = { rooms: [{ id: "room", data: gzipSync('[{"id":"panel"}]').toString("base64") }], textures: [{ id: "texture", mime: "image/png", image: Buffer.from("image").toString("base64") }] };
	const modules = {
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
	assert.equal((await get(`${query}&room=missing`)).status, 404);
	console.log("Public trial location, active revision, room and texture checks passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
