import "server-only";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { db } from "@/lib/db";

// Trial tables are deliberately separate from the live ppic_public_* tables.
let schema: Promise<unknown> | undefined;
export function ensureTrialSchema() {
	return schema ??= db.batch([
		"CREATE TABLE IF NOT EXISTS ppic_trial_model (id TEXT PRIMARY KEY, name TEXT NOT NULL, active_revision TEXT)",
		"CREATE TABLE IF NOT EXISTS ppic_trial_revision (model_id TEXT NOT NULL, revision TEXT NOT NULL, version_number INTEGER NOT NULL, imported_at TEXT NOT NULL, snapshot BLOB NOT NULL, PRIMARY KEY (model_id, revision), UNIQUE (model_id, version_number))",
		"CREATE TABLE IF NOT EXISTS ppic_trial_revision_chunk (model_id TEXT NOT NULL, revision TEXT NOT NULL, chunk_number INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (model_id, revision, chunk_number))",
		"CREATE TABLE IF NOT EXISTS ppic_trial_panel_search (model_id TEXT NOT NULL, revision TEXT NOT NULL, room_id TEXT NOT NULL, panel_id TEXT NOT NULL, serial TEXT NOT NULL, number TEXT NOT NULL, PRIMARY KEY (model_id, revision, room_id, panel_id))",
		"CREATE INDEX IF NOT EXISTS ppic_trial_serial ON ppic_trial_panel_search (serial)",
		"CREATE INDEX IF NOT EXISTS ppic_trial_number ON ppic_trial_panel_search (number)",
	], "write").catch((error) => { schema = undefined; throw error; });
}

export async function listTrialModels() {
	await ensureTrialSchema();
	const result = await db.execute("SELECT m.id, m.name, m.active_revision, r.revision, r.version_number, r.imported_at FROM ppic_trial_model m LEFT JOIN ppic_trial_revision r ON r.model_id = m.id ORDER BY m.name, r.version_number DESC");
	const models = new Map<string, { id: string; name: string; activeRevision: string | null; versions: { revision: string; number: number; importedAt: string }[] }>();
	for (const row of result.rows) {
		const id = String(row.id);
		if (!models.has(id)) models.set(id, { id, name: String(row.name), activeRevision: row.active_revision ? String(row.active_revision) : null, versions: [] });
		if (row.revision) models.get(id)!.versions.push({ revision: String(row.revision), number: Number(row.version_number), importedAt: String(row.imported_at) });
	}
	return [...models.values()];
}

export async function saveTrialModel(id: string, name: string, rooms: { id: string; name: string; data: Buffer; matches: { id: string; serial: string; number: string }[] }[], textures: { id: string; mime: string; image: Buffer }[]) {
	await ensureTrialSchema();
	if (new Set(rooms.map((room) => room.id)).size !== rooms.length || rooms.some((room) => new Set(room.matches.map((panel) => panel.id)).size !== room.matches.length)) throw new Error("DUPLICATE_MODEL_ID");
	const payload = JSON.stringify({ name, rooms: rooms.map((room) => ({ ...room, data: room.data.toString("base64"), matches: [...room.matches].sort((a, b) => a.id.localeCompare(b.id)) })).sort((a, b) => a.id.localeCompare(b.id)), textures: textures.map((texture) => ({ ...texture, image: texture.image.toString("base64") })).sort((a, b) => a.id.localeCompare(b.id)) });
	const revision = createHash("sha256").update(payload).digest("hex");
	if (Buffer.byteLength(payload) > 64 * 1024 * 1024) throw new Error("MODEL_TOO_LARGE");
	const compressed = gzipSync(payload);
	const chunks: Buffer[] = [];
	if (compressed.length > 1024 * 1024) for (let offset = 0; offset < compressed.length; offset += 512 * 1024) chunks.push(compressed.subarray(offset, offset + 512 * 1024));
	const result = await db.batch([
		{ sql: "INSERT OR IGNORE INTO ppic_trial_model (id, name) VALUES (?, ?)", args: [id, name] },
		{ sql: "INSERT OR IGNORE INTO ppic_trial_revision (model_id, revision, version_number, imported_at, snapshot) SELECT ?, ?, COALESCE(MAX(version_number), 0) + 1, ?, ? FROM ppic_trial_revision WHERE model_id = ?", args: [id, revision, new Date().toISOString(), chunks.length ? Buffer.alloc(0) : compressed, id] },
		...chunks.map((chunk, index) => ({ sql: "INSERT OR IGNORE INTO ppic_trial_revision_chunk (model_id, revision, chunk_number, data) VALUES (?, ?, ?, ?)", args: [id, revision, index, chunk] })),
		...rooms.flatMap((room) => room.matches.map((panel) => ({ sql: "INSERT OR IGNORE INTO ppic_trial_panel_search (model_id, revision, room_id, panel_id, serial, number) VALUES (?, ?, ?, ?, ?, ?)", args: [id, revision, room.id, panel.id, panel.serial, panel.number] }))),
	], "write");
	return { revision, created: result[1].rowsAffected > 0 };
}

export async function searchTrialPanels(code: string) {
	await ensureTrialSchema();
	if (!code || code.length > 100) return [];
	const result = await db.execute({ sql: "SELECT p.model_id, p.room_id, p.panel_id, p.serial, p.number, m.name FROM ppic_trial_panel_search p JOIN ppic_trial_model m ON m.id = p.model_id AND m.active_revision = p.revision WHERE p.serial = ? OR p.number = ? ORDER BY m.name LIMIT 100", args: [code, code] });
	return result.rows.map((row) => ({ modelId: String(row.model_id), roomId: String(row.room_id), panelId: String(row.panel_id), serial: String(row.serial), number: String(row.number), name: String(row.name) }));
}

export async function readTrialModel(id: string, revision: string) {
	await ensureTrialSchema();
	const result = await db.execute({ sql: "SELECT snapshot FROM ppic_trial_revision WHERE model_id = ? AND revision = ?", args: [id, revision] });
	if (!result.rows.length) return null;
	let compressed = Buffer.from(result.rows[0].snapshot as ArrayBuffer);
	if (!compressed.length) {
		const chunks = await db.execute({ sql: "SELECT chunk_number, data FROM ppic_trial_revision_chunk WHERE model_id = ? AND revision = ? ORDER BY chunk_number", args: [id, revision] });
		if (!chunks.rows.length || chunks.rows.some((chunk, index) => Number(chunk.chunk_number) !== index)) throw new Error("MISSING_CHUNK");
		compressed = Buffer.concat(chunks.rows.map((chunk) => Buffer.from(chunk.data as ArrayBuffer)));
	}
	const payload = gunzipSync(compressed, { maxOutputLength: 64 * 1024 * 1024 }).toString("utf8");
	if (createHash("sha256").update(payload).digest("hex") !== revision) throw new Error("CHECKSUM_MISMATCH");
	return JSON.parse(payload) as { name: string; rooms: { id: string; name: string; data: string; matches: { id: string; serial: string; number: string }[] }[]; textures: { id: string; mime: string; image: string }[] };
}

export async function activateTrialModel(id: string, revision: string, expected: string | null) {
	await ensureTrialSchema();
	const snapshot = await readTrialModel(id, revision);
	if (!snapshot) return false;
	const result = await db.execute({ sql: "UPDATE ppic_trial_model SET active_revision = ?, name = ? WHERE id = ? AND active_revision IS ? AND EXISTS (SELECT 1 FROM ppic_trial_revision WHERE model_id = ? AND revision = ?)", args: [revision, snapshot.name, id, expected, id, revision] });
	return result.rowsAffected === 1;
}
