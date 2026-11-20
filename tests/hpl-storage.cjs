const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { createClient } = require('@libsql/client');
const ts = require('typescript');
const db = createClient({ url: 'file::memory:' });
const modules = { 'server-only': {}, '@/lib/db': { db }, '@/lib/produksiPanel': { CF_PANEL: { SERIAL_NUMBER: 'serial' } } };
const moduleResult = { exports: {} };
const source = ts.transpileModule(readFileSync('src/lib/hplStorage.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
runInNewContext(source, { module: moduleResult, exports: moduleResult.exports, require: (id) => modules[id], encodeURIComponent, String, Promise });
(async () => {
	const { readHpl, saveHpl } = moduleResult.exports;
	await db.batch([
		"CREATE TABLE ppic_hpl_group (task_id TEXT PRIMARY KEY, name TEXT, side_1 TEXT, side_2 TEXT, synced_at TEXT NOT NULL)",
		"CREATE TABLE ppic_hpl_panel (task_id TEXT PRIMARY KEY, parent_task_id TEXT NOT NULL, serial TEXT NOT NULL)",
		"CREATE TABLE ppic_hpl_result (model_id TEXT NOT NULL, revision TEXT NOT NULL, room_id TEXT NOT NULL, panel_id TEXT NOT NULL, serial TEXT NOT NULL, status TEXT NOT NULL, leaf_task_id TEXT, synced_at TEXT NOT NULL, PRIMARY KEY (model_id, revision, room_id, panel_id))",
		"INSERT INTO ppic_hpl_group VALUES ('legacy-group', NULL, 'Oak', 'White', '2026-01-02')",
		"INSERT INTO ppic_hpl_panel VALUES ('legacy-leaf', 'legacy-group', 'legacy')",
		"INSERT INTO ppic_hpl_result VALUES ('legacy', 'rev', 'room', 'safe', 'legacy', 'matched', 'legacy-leaf', '2026-01-02')",
		"INSERT INTO ppic_hpl_result VALUES ('legacy', 'rev', 'room', 'stale', 'legacy', 'matched', 'legacy-leaf', '2026-01-01')",
	], 'write');
	const legacy = await readHpl('legacy', 'rev');
	assert.equal(legacy.length, 1, 'only legacy results with matching parent timestamps can be trusted');
	assert.equal(legacy[0].side1, 'Oak');
	const panels = [{ room: 'room', id: 'panel', serial: '001', status: 'matched', side1: 'A', side2: 'B', source: 'unused' }, { room: 'room', id: 'bad', serial: '002', status: 'ambiguous', side1: null, side2: null, source: null }];
	const tasks = [{ id: 'leaf', parent: 'group', custom_fields: [{ id: 'serial', value: '001' }] }, { id: 'group', name: 'Group' }];
	assert.equal((await readHpl('model', 'revision')).length, 0);
	await saveHpl('model', 'revision', panels, tasks, '2026-01-02');
	let rows = await readHpl('model', 'revision');
	assert.equal(rows.length, 2);
	assert.equal(rows.find((row) => row.id === 'panel').side1, 'A');
	assert.equal(rows.find((row) => row.id === 'bad').status, 'ambiguous');
	assert.equal((await readHpl('other', 'revision')).length, 0);
	const sibling = { room: 'room', id: 'sibling', serial: '003', status: 'matched', side1: 'A', side2: 'B', source: 'unused' };
	const siblings = [...tasks, { id: 'leaf-2', parent: 'group', custom_fields: [{ id: 'serial', value: '003' }] }];
	await saveHpl('model', 'revision', [sibling], siblings, '2026-01-02');
	await saveHpl('model', 'revision', [{ ...panels[0], status: 'partial', side1: 'White', side2: null }], siblings, '2026-01-03');
	rows = await readHpl('model', 'revision');
	assert.equal(rows.find((row) => row.id === 'sibling').side1, 'A', 'refreshing one panel preserves its sibling values');
	assert.equal(rows.find((row) => row.id === 'sibling').side2, 'B');
	assert.equal(rows.find((row) => row.id === 'sibling').status, 'matched');
	assert.equal(rows.find((row) => row.id === 'sibling').syncedAt, '2026-01-02');
	await saveHpl('model', 'revision', [{ ...panels[0], side1: 'old' }], tasks, '2026-01-01');
	rows = await readHpl('model', 'revision');
	assert.equal(rows.find((row) => row.id === 'panel').side1, 'White');
	await saveHpl('model', 'revision', [{ ...panels[0], side1: 'new' }], [{ ...tasks[0], parent: 'new-group' }, { id: 'new-group' }], '2026-01-04');
	await saveHpl('model', 'revision', panels, tasks, '2026-01-02');
	rows = await readHpl('model', 'revision');
	assert.equal(rows.find((row) => row.id === 'panel').side1, 'new');
	assert.equal(rows.find((row) => row.id === 'panel').source, 'https://app.clickup.com/t/new-group');
	await assert.rejects(saveHpl('model', 'revision', [{ ...panels[0], side1: 'bad' }, { ...panels[1], id: null }], [{ ...tasks[0], parent: 'new-group' }, { id: 'new-group' }], '2026-01-05'));
	assert.equal((await readHpl('model', 'revision')).find((row) => row.id === 'panel').side1, 'new');
	assert.equal((await db.execute('SELECT count(*) AS count FROM ppic_hpl_panel')).rows[0].count, 3);
	console.log('HPL storage mapping, status, scope, and older update checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
