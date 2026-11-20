const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
let effect, calls = 0, nextId = 0;
const timers = new Map();
const channel = { subscribe: async () => {}, unsubscribe() {} };
const modules = {
	'react': { useEffect: fn => { effect = fn; } },
	'next/navigation': { usePathname: () => '/projects', useRouter: () => ({ replace() {}, refresh() {} }) },
	'ably': { Realtime: class { channels = { get: () => channel }; close() {} } },
};
const mod = { exports: {} };
const source = ts.transpileModule(readFileSync('src/components/sessionRefresh.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
runInNewContext(source, { module: mod, exports: mod.exports, require: id => modules[id], console, window: { setTimeout: (fn, delay) => { const id = ++nextId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id) }, fetch: async () => { calls++; return { ok: true }; } });
(async () => {
	mod.exports.SessionRefresh({ refreshAfter: 10, refreshedAt: 1, userId: 'user' });
	const cleanup = effect();
	assert.equal(timers.get(1).delay, 10);
	timers.get(1).fn();
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(calls, 1);
	assert.equal(timers.get(2).delay, 15 * 60 * 1000);
	timers.get(2).fn();
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(calls, 2);
	cleanup();
	assert.equal(timers.size, 0);
	console.log('Session refresh repeats and cleans up its timer');
})().catch(error => { console.error(error); process.exitCode = 1; });
