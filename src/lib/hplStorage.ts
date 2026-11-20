import "server-only";
import { db } from "@/lib/db";
import type { PanelHpl } from "@/types/publicModel";
import type { ClickUpTask } from "@/types/clickup";
import { CF_PANEL } from "@/lib/produksiPanel";

let schema: Promise<unknown> | undefined;
function ensureHplSchema() {
	return schema ??= db.batch([
		"CREATE TABLE IF NOT EXISTS ppic_hpl_group (task_id TEXT PRIMARY KEY NOT NULL, name TEXT, side_1 TEXT, side_2 TEXT, synced_at TEXT NOT NULL)",
		"CREATE TABLE IF NOT EXISTS ppic_hpl_panel (task_id TEXT PRIMARY KEY NOT NULL, parent_task_id TEXT NOT NULL REFERENCES ppic_hpl_group(task_id), serial TEXT NOT NULL)",
		"CREATE INDEX IF NOT EXISTS ppic_hpl_panel_serial ON ppic_hpl_panel (serial)",
		"CREATE TABLE IF NOT EXISTS ppic_hpl_result (model_id TEXT NOT NULL, revision TEXT NOT NULL, room_id TEXT NOT NULL, panel_id TEXT NOT NULL, serial TEXT NOT NULL, status TEXT NOT NULL, leaf_task_id TEXT, synced_at TEXT NOT NULL, PRIMARY KEY (model_id, revision, room_id, panel_id))",
		"CREATE TABLE IF NOT EXISTS ppic_hpl_snapshot (model_id TEXT NOT NULL, revision TEXT NOT NULL, room_id TEXT NOT NULL, panel_id TEXT NOT NULL, serial TEXT NOT NULL, status TEXT NOT NULL, side_1 TEXT, side_2 TEXT, parent_id TEXT, synced_at TEXT NOT NULL, PRIMARY KEY (model_id, revision, room_id, panel_id))",
		`INSERT OR IGNORE INTO ppic_hpl_snapshot (model_id, revision, room_id, panel_id, serial, status, side_1, side_2, parent_id, synced_at)
		 SELECT r.model_id, r.revision, r.room_id, r.panel_id, r.serial, r.status, g.side_1, g.side_2, g.task_id, r.synced_at
		 FROM ppic_hpl_result r LEFT JOIN ppic_hpl_panel p ON p.task_id = r.leaf_task_id
		 LEFT JOIN ppic_hpl_group g ON g.task_id = p.parent_task_id
		 WHERE (r.leaf_task_id IS NULL AND r.status NOT IN ('matched', 'partial', 'missing_hpl')) OR g.synced_at = r.synced_at`,
	], "write").catch((error) => { schema = undefined; throw error; });
}

export async function readHpl(id: string, revision: string) {
	await ensureHplSchema();
	const result = await db.execute({ sql: "SELECT room_id, panel_id, serial, status, synced_at, parent_id, side_1, side_2 FROM ppic_hpl_snapshot WHERE model_id = ? AND revision = ?", args: [id, revision] });
	return result.rows.map((row) => ({ room: String(row.room_id), id: String(row.panel_id), serial: String(row.serial), status: String(row.status) as PanelHpl["status"], side1: row.side_1 == null ? null : String(row.side_1), side2: row.side_2 == null ? null : String(row.side_2), source: row.parent_id == null ? null : `https://app.clickup.com/t/${encodeURIComponent(String(row.parent_id))}`, syncedAt: String(row.synced_at) }));
}

export async function saveHpl(id: string, revision: string, panels: (PanelHpl & { room: string; id: string })[], tasks: ClickUpTask[], startedAt: string) {
	await ensureHplSchema();
	const statements: { sql: string; args: (string | null)[] }[] = [];
	for (const panel of panels) {
		const leaf = ["matched", "partial", "missing_hpl"].includes(panel.status) ? tasks.find((task) => task.custom_fields?.some((field) => field.id === CF_PANEL.SERIAL_NUMBER && typeof field.value === "string" && field.value.trim() === panel.serial)) : undefined;
		const parent = leaf?.parent ? tasks.find((task) => task.id === leaf.parent) : undefined;
		if (leaf && parent) {
			statements.push({ sql: "INSERT INTO ppic_hpl_group (task_id, name, side_1, side_2, synced_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(task_id) DO UPDATE SET name=excluded.name, side_1=excluded.side_1, side_2=excluded.side_2, synced_at=excluded.synced_at WHERE excluded.synced_at >= ppic_hpl_group.synced_at", args: [parent.id, parent.name ?? null, panel.side1, panel.side2, startedAt] });
			statements.push({ sql: "INSERT INTO ppic_hpl_panel (task_id, parent_task_id, serial) VALUES (?, ?, ?) ON CONFLICT(task_id) DO UPDATE SET parent_task_id=excluded.parent_task_id, serial=excluded.serial WHERE NOT EXISTS (SELECT 1 FROM ppic_hpl_result WHERE leaf_task_id=excluded.task_id AND synced_at > ?)", args: [leaf.id, parent.id, panel.serial, startedAt] });
		}
		statements.push({ sql: "INSERT INTO ppic_hpl_result (model_id, revision, room_id, panel_id, serial, status, leaf_task_id, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(model_id, revision, room_id, panel_id) DO UPDATE SET serial=excluded.serial, status=excluded.status, leaf_task_id=excluded.leaf_task_id, synced_at=excluded.synced_at WHERE excluded.synced_at >= ppic_hpl_result.synced_at", args: [id, revision, panel.room, panel.id, panel.serial, panel.status, leaf && parent ? leaf.id : null, startedAt] });
		statements.push({ sql: "INSERT INTO ppic_hpl_snapshot (model_id, revision, room_id, panel_id, serial, status, side_1, side_2, parent_id, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(model_id, revision, room_id, panel_id) DO UPDATE SET serial=excluded.serial, status=excluded.status, side_1=excluded.side_1, side_2=excluded.side_2, parent_id=excluded.parent_id, synced_at=excluded.synced_at WHERE excluded.synced_at >= ppic_hpl_snapshot.synced_at", args: [id, revision, panel.room, panel.id, panel.serial, panel.status, panel.side1, panel.side2, parent?.id ?? null, startedAt] });
	}
	if (statements.length) await db.batch(statements, "write");
}
