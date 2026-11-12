const assert = require('node:assert/strict');
const { createClient } = require('@libsql/client');
const { createPublicModelTables } = require('../scripts/create-public-model-tables.cjs');
const { uploadPublicModels } = require('../scripts/upload-public-models.cjs');
const { DatabaseSync } = require('node:sqlite');

(async () => {
	const db = createClient({ url: 'file::memory:' });
	try {
		await createPublicModelTables(db);
		await db.batch([
			{ sql: 'INSERT INTO ppic_public_model VALUES (?, ?)', args: ['model', 'Model'] },
			{ sql: 'INSERT INTO ppic_public_room VALUES (?, ?, ?, ?)', args: ['model', 'room', 'Room', Buffer.from([1, 2])] },
			{ sql: 'INSERT INTO ppic_public_texture VALUES (?, ?, ?)', args: ['texture', 'image/png', Buffer.from([3, 4])] },
			{ sql: 'INSERT INTO ppic_public_panel_search VALUES (?, ?, ?, ?, ?)', args: ['model', 'room', 'panel', 'serial', '1'] },
		], 'write');
		const result = await db.execute("SELECT m.name, r.geometry, p.panel_id FROM ppic_public_panel_search p JOIN ppic_public_model m ON m.id = p.model_id JOIN ppic_public_room r ON r.model_id = p.model_id AND r.id = p.room_id WHERE p.serial = 'serial'");
		assert.equal(result.rows[0].name, 'Model');
		assert.equal(result.rows[0].panel_id, 'panel');
		assert.deepEqual(Buffer.from(result.rows[0].geometry), Buffer.from([1, 2]));
		await assert.rejects(createPublicModelTables(db));
		assert.equal((await db.execute('SELECT count(*) AS n FROM ppic_public_model')).rows[0].n, 1);
		const source = new DatabaseSync(':memory:');
		source.exec("CREATE TABLE models(id TEXT, name TEXT); CREATE TABLE rooms(model_id TEXT, id TEXT, name TEXT, geometry BLOB); CREATE TABLE textures(id TEXT, mime TEXT, image BLOB); CREATE TABLE panel_search(model_id TEXT, room_id TEXT, panel_id TEXT, serial TEXT, number TEXT); INSERT INTO models VALUES('new', 'New'); INSERT INTO rooms VALUES('new', 'r', 'Room', X'0102'); INSERT INTO panel_search VALUES('new', 'r', 'p', 'barcode', '2'); INSERT INTO textures VALUES('t', 'image/png', X'0304')");
		try {
			await uploadPublicModels(source, db);
			assert.equal((await db.execute("SELECT count(*) AS n FROM ppic_public_panel_search WHERE serial = 'barcode'")).rows[0].n, 1);
			await assert.rejects(uploadPublicModels(source, db));
			assert.equal((await db.execute("SELECT count(*) AS n FROM ppic_public_room WHERE model_id = 'new'")).rows[0].n, 1);
		} finally { source.close(); }
		console.log('Public model schema passed');
	} finally { db.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
