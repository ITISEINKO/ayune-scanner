import 'server-only';
import { createClient } from '@libsql/client';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const path = join(process.cwd(), '.local-backups', 'public-models.sqlite');
const open = () => existsSync(path) ? createClient({ url: `file:${path}` }) : null;
export async function publicModels() {
	const db = open(); if (!db) return [];
	try { return (await db.execute('SELECT id, name FROM models ORDER BY name')).rows.map((r) => ({ id: String(r.id), name: String(r.name) })); } finally { db.close(); }
}
export async function publicRooms(id: string) {
	const db = open(); if (!db) return null;
	try {
		const model = await db.execute({ sql: 'SELECT name FROM models WHERE id = ?', args: [id] });
		if (!model.rows.length) return null;
		const rooms = await db.execute({ sql: 'SELECT id, name FROM rooms WHERE model_id = ? ORDER BY name', args: [id] });
		return { name: String(model.rows[0].name), rooms: rooms.rows.map((r) => ({ id: String(r.id), name: String(r.name) })) };
	} finally { db.close(); }
}
export async function publicRoom(id: string, room: string) {
	const db = open(); if (!db) return null;
	try {
		const result = await db.execute({ sql: 'SELECT geometry FROM rooms WHERE model_id = ? AND id = ?', args: [id, room] });
		if (!result.rows.length) return null;
		return gunzipSync(Buffer.from(result.rows[0].geometry as ArrayBuffer), { maxOutputLength: 64 * 1024 * 1024 }).toString('utf8');
	} finally { db.close(); }
}

export async function publicTexture(id: string) {
	if (!/^\d{1,30}$/.test(id)) return null;
	const db = open(); if (!db) return null;
	try {
		const result = await db.execute({ sql: "SELECT mime, image FROM textures WHERE id = ?", args: [id] });
		const row = result.rows[0];
		return row ? { mime: String(row.mime), image: Buffer.from(row.image as ArrayBuffer) } : null;
	} finally { db.close(); }
}
