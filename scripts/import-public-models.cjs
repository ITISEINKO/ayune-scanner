const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { parseShareLink } = require('./import-lby-project.cjs');
const { prepare, doorMotion, fetchPublicModel } = require('./public-model-import.cjs');

const folder = path.resolve('.local-backups');

async function run() {
	fs.mkdirSync(folder, { recursive: true });
	const db = new DatabaseSync(path.join(folder, 'public-models.sqlite'));
	db.exec('CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE IF NOT EXISTS rooms (model_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, geometry BLOB NOT NULL, PRIMARY KEY(model_id,id)); CREATE TABLE IF NOT EXISTS textures (id TEXT PRIMARY KEY, mime TEXT NOT NULL, image BLOB NOT NULL); CREATE TABLE IF NOT EXISTS panel_search (model_id TEXT NOT NULL, room_id TEXT NOT NULL, panel_id TEXT NOT NULL, serial TEXT NOT NULL, number TEXT NOT NULL, PRIMARY KEY(model_id,room_id,panel_id)); CREATE INDEX IF NOT EXISTS panel_search_serial ON panel_search(serial); CREATE INDEX IF NOT EXISTS panel_search_number ON panel_search(number);');
	const links = fs.readFileSync(process.argv[2] || 'docs/lbyerp-cadvisitor-docs/list-link.md', 'utf8').split(/\r?\n/).filter(Boolean);
	const orders = new Map();
	for (const link of links) { try { const source = parseShareLink(link); orders.set(source.orderId, source); } catch (error) { console.error(`Skipped link: ${error.message}`); } }
	let failed = 0;
	for (const [id, source] of orders) {
		try {
			const { rooms, textures } = await fetchPublicModel(source, AbortSignal.timeout(240000), (texture) => Boolean(db.prepare('SELECT 1 FROM textures WHERE id = ?').get(texture)));
			db.exec('BEGIN');
			try {
				const saveTexture = db.prepare('INSERT OR IGNORE INTO textures(id,mime,image) VALUES(?,?,?)');
				for (const texture of textures) saveTexture.run(texture.id, texture.mime, texture.image);
				db.prepare('INSERT INTO models(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').run(id, source.name);
				db.prepare('DELETE FROM rooms WHERE model_id=?').run(id);
				db.prepare('DELETE FROM panel_search WHERE model_id=?').run(id);
				const insert = db.prepare('INSERT INTO rooms(model_id,id,name,geometry) VALUES(?,?,?,?)');
				const insertPanel = db.prepare('INSERT INTO panel_search(model_id,room_id,panel_id,serial,number) VALUES(?,?,?,?,?)');
				for (const room of rooms) { insert.run(id, room.id, room.name, room.data); for (const panel of room.matches) insertPanel.run(id, room.id, panel.id, panel.serial, panel.number); }
				db.exec('COMMIT');
			} catch (error) { db.exec('ROLLBACK'); throw error; }
			console.log(`Imported ${source.name}: ${rooms.length} rooms`);
		} catch (error) { failed++; console.error(`Failed ${source.name}: ${error.message}`); }
	}
	db.close(); if (failed) process.exitCode = 1;
}
if (require.main === module) run().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { prepare, doorMotion, fetchPublicModel };
