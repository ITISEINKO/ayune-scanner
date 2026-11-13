const { DatabaseSync } = require("node:sqlite");
const { createClient } = require("@libsql/client");

async function uploadPublicModels(source, db) {
	for (const texture of source
		.prepare("SELECT id, mime, image FROM textures")
		.all()) {
		await db.execute({
			sql: "INSERT OR IGNORE INTO ppic_public_texture (id, mime, image) VALUES (?, ?, ?)",
			args: [texture.id, texture.mime, texture.image],
		});
	}
	for (const model of source.prepare("SELECT id, name FROM models").all()) {
		const rooms = source
			.prepare("SELECT id, name, geometry FROM rooms WHERE model_id = ?")
			.all(model.id);
		const panels = source
			.prepare(
				"SELECT room_id, panel_id, serial, number FROM panel_search WHERE model_id = ?",
			)
			.all(model.id);
		await db.batch(
			[
				{
					sql: "INSERT INTO ppic_public_model (id, name) VALUES (?, ?)",
					args: [model.id, model.name],
				},
				...rooms.map((room) => ({
					sql: "INSERT INTO ppic_public_room (model_id, id, name, geometry) VALUES (?, ?, ?, ?)",
					args: [model.id, room.id, room.name, room.geometry],
				})),
				...panels.map((panel) => ({
					sql: "INSERT INTO ppic_public_panel_search (model_id, room_id, panel_id, serial, number) VALUES (?, ?, ?, ?, ?)",
					args: [
						model.id,
						panel.room_id,
						panel.panel_id,
						panel.serial,
						panel.number,
					],
				})),
			],
			"write",
		);
		console.log(
			`Uploaded model: ${model.id} (${rooms.length} rooms, ${panels.length} panels)`,
		);
	}
}

module.exports = { uploadPublicModels };
if (require.main === module) {
	process.loadEnvFile(".env");
	const source = new DatabaseSync(".local-backups/public-models.sqlite", {
		readOnly: true,
	});
	const db = createClient({
		url: process.env.TURSO_DATABASE_URL,
		authToken: process.env.TURSO_AUTH_TOKEN,
	});
	uploadPublicModels(source, db)
		.catch((error) => {
			console.error(error.message);
			process.exitCode = 1;
		})
		.finally(() => {
			source.close();
			db.close();
		});
}
