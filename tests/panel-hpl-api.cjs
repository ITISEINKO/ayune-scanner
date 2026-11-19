const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const revision = "a".repeat(64);
let authorized = true, active = true, calls = 0, fail = false, descendantParents = [];
const modules = {
	"node:crypto": require("node:crypto"),
	"next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
	"@/lib/clickup": { clickUpHeaders: () => ({}) },
	"@/lib/panelHpl": { panelHpl: (tasks, serial) => ({ serial, count: tasks.length }) },
	"@/lib/projects": { panelListId: () => "list" },
	"@/lib/produksiPanel": { CF_PANEL: { SERIAL_NUMBER: "serial" } },
	"@/lib/projectDashboard": { loadDescendantTasks: async (_token, parent) => { descendantParents.push(parent); return parent === 'parent' ? [{ id: "leaf", parent: "parent", custom_fields: [{ id: "serial", value: "001" }] }] : []; } },
	"@/lib/session": { clickUpToken: async () => authorized ? "token" : null, ppicSession: async () => ({}) },
	"@/lib/trialPublicModels": { listTrialModels: async () => active ? [{ id: "123", activeRevision: revision }] : [], readTrialModel: async () => ({ rooms: [{ id: "room", matches: [{ id: "panel", serial: "001" }, { id: "other", serial: "002" }] }] }) },
};
const moduleResult = { exports: {} };
const source = ts.transpileModule(readFileSync("src/app/api/panel/hpl/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
runInNewContext(source, { module: moduleResult, exports: moduleResult.exports, require: (id) => modules[id], Response, URL, URLSearchParams, AbortSignal, Date, Set, Map, Promise, console, fetch: async (url) => { calls++; if (fail) return new Response(null, { status: 500 }); if (url.includes('/api/v2/task/')) return Response.json({ id: 'parent', parent: null, list: { id: 'list' } }); const query = new URL(url).searchParams; const values = JSON.parse(query.get('custom_fields'))[0].value; assert.deepEqual(values, values.length === 1 ? ['001'] : ['001', '002']); return Response.json(query.get('page') === '0' ? { tasks: [{ id: 'unrelated', parent: null, custom_fields: [{ id: 'serial', value: '0012' }] }], last_page: false } : { tasks: [{ id: 'leaf', parent: 'parent', custom_fields: [{ id: 'serial', value: '001' }] }], last_page: true }); } });
(async () => {
	const request = (extra = '') => new Request(`http://localhost/api/panel/hpl?id=123&revision=${revision}&roomId=room&panelId=panel${extra}`);
	authorized = false; assert.equal((await moduleResult.exports.GET(request())).status, 401);
	authorized = true; active = false; assert.equal((await moduleResult.exports.GET(request())).status, 404);
	active = true; const [first, duplicate] = await Promise.all([moduleResult.exports.GET(request()), moduleResult.exports.GET(request())]); let response = first;
	assert.equal(response.status, 200); assert.equal(calls, 3); assert.equal((await response.json()).panels[0].count, 2);
	assert.deepEqual(descendantParents, ['leaf']);
	assert.equal(duplicate.status, 200); await moduleResult.exports.GET(request()); assert.equal(calls, 3);
	assert.equal((await moduleResult.exports.GET(new Request(`http://localhost/api/panel/hpl?id=123&revision=${revision}&roomId=room&panelId=bad`))).status, 404);
	fail = true; response = await moduleResult.exports.GET(request('&refresh=1')); assert.equal(response.status, 502);
	fail = false;
	response = await moduleResult.exports.GET(new Request(`http://localhost/api/panel/hpl?id=123&revision=${revision}&roomId=room`));
	assert.equal(response.status, 200); assert.equal((await response.json()).panels.length, 2);
	assert.deepEqual(descendantParents, ['leaf', 'parent']);
	const callsAfterRoom = calls;
	response = await moduleResult.exports.GET(new Request(`http://localhost/api/panel/hpl?id=123&revision=${revision}&roomId=room&panelId=other`));
	assert.equal(response.status, 200); assert.equal((await response.json()).panels[0].serial, '002'); assert.equal(calls, callsAfterRoom);
	console.log("HPL API authorization, pagination, revision and failure checks passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
