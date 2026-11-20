const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const values = [];
let cursor = 0, calls = [], success = '';
const component = { exports: {} };
const jsx = (type, props, key) => ({ type, props, key });
runInNewContext(ts.transpileModule(readFileSync('src/features/trial-import/Trial3DImportPage.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
	module: component, exports: component.exports, URLSearchParams, Date, AbortController,
	fetch: async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ models: [], syncedAt: '2026-11-20T03:00:00.000Z', panels: [{ syncedAt: '2026-11-20T03:00:00.000Z' }] }) }; },
	require: (id) => {
		if (id === 'react') return { useState: (initial) => { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], (value) => { values[index] = typeof value === 'function' ? value(values[index]) : value; }]; }, useRef: () => ({ current: null }), useEffect: () => {} };
		if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
		if (id === 'sonner') return { toast: { success: (message) => { success = message; } } };
		if (id === '@/lib/colorStatusConfig') return { STATUS_COLOR_CONFIG: { TERPASANG_DIGUNAKAN: {}, SEDANG_DIPACKING: {} } };
		return new Proxy({}, { get: (_, name) => name });
	},
});
const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
const render = () => { cursor = 0; return component.exports.Trial3DImportPage({}); };
render();
values[2] = [
	{ id: '123', name: 'Active', activeRevision: 'active', versions: [{ revision: 'candidate', number: 2, importedAt: '2026-01-01', panelCount: 5, groupCount: 2 }, { revision: 'active', number: 1, importedAt: '2026-01-01' }] },
	{ id: '456', name: 'Candidate', activeRevision: null, versions: [{ revision: 'candidate', number: 1, importedAt: '2026-01-01' }] },
];
values[6] = false;
const cards = nodes(render()).filter((node) => node.type === 'article');
assert.doesNotMatch(JSON.stringify(nodes(cards[0]).find((node) => node.type === 'summary')), /panel terpetakan/);
assert.match(JSON.stringify(cards[0]), /panel terpetakan.*grup/);
assert.equal(nodes(cards[0]).find((node) => node.props?.role === 'switch').props.checked, true);
assert.equal(nodes(cards[1]).find((node) => node.props?.role === 'switch').props.checked, false);
nodes(cards[0]).find((node) => node.props?.role === 'switch').props.onCheckedChange(false);
let dialog = nodes(render()).find((node) => node.type === 'Dialog');
assert.equal(dialog.props.open, true);
assert.equal(calls.length, 0, 'opening confirmation does not deactivate the model');
nodes(dialog).find((node) => node.props?.children === 'Batal').props.onClick();
dialog = nodes(render()).find((node) => node.type === 'Dialog');
assert.equal(dialog.props.open, false);
assert.equal(calls.length, 0, 'cancel does not deactivate the model');
const button = nodes(cards[0]).find((node) => node.props?.['aria-label'] === 'Refresh HPL model aktif');
assert.ok(button);
assert.ok(!nodes(cards[1]).some((node) => node.props?.['aria-label'] === 'Refresh HPL model aktif'));
button.props.onClick();
assert.equal(calls.length, 1);
assert.equal(calls[0].init.method, 'POST');
assert.match(calls[0].url, /id=123&revision=active/);
assert.ok(nodes(render()).some((node) => node.type === 'Progress' && node.props?.value === null && node.props?.['aria-label'] === 'Memperbarui HPL'));
setImmediate(() => {
	assert.equal(success, 'Kode HPL model aktif berhasil diperbarui.');
	assert.match(JSON.stringify(render()), /Terakhir sinkron: 20\/11\/2026, 10\.00/);
	nodes(render()).find((node) => node.props?.['aria-label'] === 'Dipakai untuk pencarian: Active').props.onCheckedChange(false);
	const confirmDialog = nodes(render()).find((node) => node.type === 'Dialog');
	nodes(confirmDialog).find((node) => node.props?.children === 'Nonaktifkan').props.onClick();
	const request = calls.find((call) => call.init?.method === 'PATCH');
	assert.deepEqual(JSON.parse(request.init.body), { id: '123', revision: null, expected: 'active' });
	console.log('Trial HPL button uses active revision and shows loading and success');
});
