import 'server-only';
import { db } from '@/lib/db';
import { gunzipSync } from 'node:zlib';

export async function searchPublicPanels(code: string) {
	if (!code || code.length > 100) return [];
	const result = await db.execute({ sql: 'SELECT p.model_id, p.room_id, p.panel_id, p.serial, p.number, m.name AS model_name, r.name AS room_name FROM ppic_public_panel_search p JOIN ppic_public_model m ON m.id = p.model_id JOIN ppic_public_room r ON r.model_id = p.model_id AND r.id = p.room_id WHERE p.serial = ? OR p.number = ? ORDER BY m.name, r.name LIMIT 100', args: [code, code] });
	return result.rows.map((r) => ({ modelId: String(r.model_id), roomId: String(r.room_id), panelId: String(r.panel_id), serial: String(r.serial), number: String(r.number), modelName: String(r.model_name), roomName: String(r.room_name) }));
}
export async function publicModels() {
	return (await db.execute('SELECT id, name FROM ppic_public_model ORDER BY name')).rows.map((r) => ({ id: String(r.id), name: String(r.name) }));
}
export async function publicRooms(id: string) {
	const model = await db.execute({ sql: 'SELECT name FROM ppic_public_model WHERE id = ?', args: [id] });
	if (!model.rows.length) return null;
	const rooms = await db.execute({ sql: 'SELECT id, name FROM ppic_public_room WHERE model_id = ? ORDER BY name', args: [id] });
	return { name: String(model.rows[0].name), rooms: rooms.rows.map((r) => ({ id: String(r.id), name: String(r.name) })) };
}
export async function publicRoom(id: string, room: string) {
	const result = await db.execute({ sql: 'SELECT geometry FROM ppic_public_room WHERE model_id = ? AND id = ?', args: [id, room] });
	if (!result.rows.length) return null;
	return gunzipSync(Buffer.from(result.rows[0].geometry as ArrayBuffer), { maxOutputLength: 64 * 1024 * 1024 }).toString('utf8');
}

export async function publicTexture(id: string) {
	if (!/^\d{1,30}$/.test(id)) return null;
	const result = await db.execute({ sql: "SELECT mime, image FROM ppic_public_texture WHERE id = ?", args: [id] });
	const row = result.rows[0];
	return row ? { mime: String(row.mime), image: Buffer.from(row.image as ArrayBuffer) } : null;
}
