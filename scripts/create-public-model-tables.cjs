const { createClient } = require('@libsql/client');

const statements = [
	'CREATE TABLE ppic_public_model (id TEXT PRIMARY KEY, name TEXT NOT NULL)',
	'CREATE TABLE ppic_public_room (model_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, geometry BLOB NOT NULL, PRIMARY KEY(model_id, id))',
	'CREATE TABLE ppic_public_texture (id TEXT PRIMARY KEY, mime TEXT NOT NULL, image BLOB NOT NULL)',
	'CREATE TABLE ppic_public_panel_search (model_id TEXT NOT NULL, room_id TEXT NOT NULL, panel_id TEXT NOT NULL, serial TEXT NOT NULL, number TEXT NOT NULL, PRIMARY KEY(model_id, room_id, panel_id))',
	'CREATE INDEX ppic_public_panel_search_serial ON ppic_public_panel_search(serial)',
	'CREATE INDEX ppic_public_panel_search_number ON ppic_public_panel_search(number)',
];

async function createPublicModelTables(db) {
	await db.batch(statements, 'write');
}

module.exports = { createPublicModelTables };
if (require.main === module) {
	process.loadEnvFile('.env');
	const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
	createPublicModelTables(db)
		.then(() => console.log('Created public model tables and indexes.'))
		.catch((error) => { console.error(error.message); process.exitCode = 1; })
		.finally(() => db.close());
}
