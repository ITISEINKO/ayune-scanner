const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const revision = 'a'.repeat(64);
let authorized = false, allowed = false, active = true, fail = false, calls = 0, snapshotReads = 0, saved = [];
const modules = {
	'node:crypto': require('node:crypto'),
	'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
	'@/lib/clickup': { clickUpHeaders: () => ({}) },
	'@/lib/db': { canImportLby: async () => allowed },
	'@/lib/hplStorage': { readHpl: async () => saved, saveHpl: async (_id, _revision, panels) => { saved = panels.map((panel) => ({ ...panel, syncedAt: '2026-01-01' })); } },
	'@/lib/panelHpl': { panelHpl: (_tasks, serial) => ({ serial, status: 'matched', side1: 'A', side2: null, source: null }) },
	'@/lib/projects': { panelListId: () => 'list' },
	'@/lib/produksiPanel': { CF_PANEL: { SERIAL_NUMBER: 'serial' } },
	'@/lib/projectDashboard': { loadDescendantTasks: async () => [] },
	'@/lib/session': { clickUpToken: async () => authorized ? 'token' : null, getAppSession: async () => authorized ? { user_id: 'user' } : null },
	'@/lib/trialPublicModels': { listTrialModels: async () => [{ id: '123', activeRevision: active ? revision : null, versions: [{ revision }] }], readTrialModel: async () => { snapshotReads++; return { rooms: [{ id: 'room', matches: [{ id: 'panel', serial: '001' }] }] }; } },
};
const moduleResult = { exports: {} };
const source = ts.transpileModule(readFileSync('src/app/api/panel/hpl/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
runInNewContext(source, { module: moduleResult, exports: moduleResult.exports, require: (id) => modules[id], Response, URL, URLSearchParams, AbortSignal, Date, Set, Map, Promise, console, fetch: async (url) => { calls++; if (process.env.HPL_SIMULATION_URL) { const parsed = new URL(url); return fetch(`${process.env.HPL_SIMULATION_URL}${parsed.pathname}${parsed.search}`, { headers: fail ? { 'x-test-fail': '1' } : {} }); } if (fail) return new Response(null, { status: 500 }); return url.includes('/api/v2/task/') ? Response.json({ id: 'group', parent: null, list: { id: 'list' } }) : Response.json({ tasks: [{ id: 'leaf', parent: 'group', custom_fields: [{ id: 'serial', value: '001' }] }], last_page: true }); } });
(async () => {
	const url = `http://localhost/api/panel/hpl?id=123&revision=${revision}`;
	const read = () => moduleResult.exports.GET(new Request(url));
	const sync = (origin = 'http://localhost') => moduleResult.exports.POST(new Request(url, { method: 'POST', headers: { origin } }));
	assert.equal((await (await read()).json()).panels.length, 0);
	assert.equal(calls, 0);
	assert.equal(snapshotReads, 0);
	assert.equal((await sync()).status, 401);
	authorized = true; assert.equal((await sync()).status, 403);
	allowed = true; assert.equal((await sync('http://other')).status, 403);
	active = false; assert.equal((await sync()).status, 404);
	active = true; assert.equal((await sync()).status, 200); assert.equal(calls, 2);
	authorized = false; assert.equal((await (await read()).json()).panels[0].side1, 'A'); assert.equal(calls, 2); assert.equal(snapshotReads, 1);
	authorized = true; fail = true; assert.equal((await sync()).status, 502);
	assert.equal((await (await read()).json()).panels[0].side1, 'A');
	console.log('HPL public read, authorized sync, active revision, and failed sync preservation passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
