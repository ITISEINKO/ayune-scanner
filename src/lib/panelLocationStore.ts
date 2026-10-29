import { createHash, randomUUID } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import catalog from "@/data/panel-locations/catalog.json";
import { withPanelLocationDetails } from "@/lib/panelLocation";
import type { LbyImportManifest, LbyImportState, LbyImportVersion, PanelLocationSnapshot, PanelLocationView } from "@/types/panelLocation";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const bundled = (project: string) => Object.hasOwn(catalog, project) ? catalog[project as keyof typeof catalog] : null;
let schema: Promise<unknown> | undefined;
const ensureSchema = () => schema ??= db.batch([
	`CREATE TABLE IF NOT EXISTS ppic_panel_location_project (
		project_id TEXT PRIMARY KEY, order_id TEXT, active_revision TEXT,
		import_id TEXT, import_until INTEGER NOT NULL DEFAULT 0
	)`,
	`CREATE TABLE IF NOT EXISTS ppic_panel_location_revision (
		project_id TEXT NOT NULL, revision TEXT NOT NULL, metadata_json TEXT NOT NULL,
		snapshot_gzip BLOB NOT NULL, mapping_gzip BLOB NOT NULL, imported_by TEXT NOT NULL,
		version_number INTEGER,
		PRIMARY KEY (project_id, revision)
	)`,
	`CREATE TABLE IF NOT EXISTS ppic_panel_location_barcode (
		barcode TEXT NOT NULL, project_id TEXT NOT NULL, revision TEXT NOT NULL,
		PRIMARY KEY (barcode, project_id, revision)
	)`,
	`CREATE TABLE IF NOT EXISTS ppic_lby_source_link (
		project_id TEXT PRIMARY KEY, url TEXT NOT NULL
	)`,
], "write").then(async () => {
	if (!(await db.execute("PRAGMA table_info(ppic_panel_location_revision)")).rows.some((row) => row.name === "version_number")) {
		try { await db.execute("ALTER TABLE ppic_panel_location_revision ADD COLUMN version_number INTEGER"); }
		catch (error) {
			if (!(await db.execute("PRAGMA table_info(ppic_panel_location_revision)")).rows.some((row) => row.name === "version_number")) throw error;
		}
	}
	const unnumbered = await db.execute("SELECT DISTINCT project_id FROM ppic_panel_location_revision WHERE version_number IS NULL");
	for (const row of unnumbered.rows) {
		const project = String(row.project_id);
		await db.execute({ sql: `UPDATE ppic_panel_location_revision AS r SET version_number =
			(SELECT count(*) FROM ppic_panel_location_revision older WHERE older.project_id = r.project_id AND older.rowid <= r.rowid) + ?
			WHERE project_id = ? AND version_number IS NULL`, args: [Number(Boolean(bundled(project))), project] });
	}
	await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS ppic_panel_location_version_number ON ppic_panel_location_revision(project_id, version_number)");
	// Backfill active imports created before the serial index existed.
	const active = await db.execute(`SELECT r.project_id, r.revision, r.snapshot_gzip
		FROM ppic_panel_location_revision r JOIN ppic_panel_location_project p
		ON p.project_id = r.project_id AND p.active_revision = r.revision
		WHERE NOT EXISTS (SELECT 1 FROM ppic_panel_location_barcode b WHERE b.project_id = r.project_id AND b.revision = r.revision)`);
	for (const row of active.rows) {
		const locations = gunzipSync(Buffer.from(row.snapshot_gzip as ArrayBuffer), { maxOutputLength: 1024 * 1024 }).toString("utf8");
		if (sha(locations) !== row.revision) throw new Error("CHECKSUM_MISMATCH");
		await db.execute({ sql: `INSERT OR IGNORE INTO ppic_panel_location_barcode (barcode, project_id, revision)
			SELECT json_extract(value, '$.barcode'), ?, ? FROM json_each(?, '$.panels')`,
			args: [String(row.project_id), String(row.revision), locations] });
	}
}).catch((error) => { schema = undefined; throw error; });

export const getLbyImportState = async (project: string): Promise<LbyImportState> => {
	await ensureSchema();
	const [active, versions, source] = await db.batch([
		{ sql: "SELECT active_revision FROM ppic_panel_location_project WHERE project_id = ?", args: [project] },
		{ sql: "SELECT metadata_json, version_number FROM ppic_panel_location_revision WHERE project_id = ? ORDER BY version_number DESC", args: [project] },
		{ sql: "SELECT url FROM ppic_lby_source_link WHERE project_id = ?", args: [project] },
	], "read");
	return {
		projectKey: project,
		...(source.rows[0] ? { sourceUrl: String(source.rows[0].url) } : {}),
		activeRevision: active.rows[0]?.active_revision ? String(active.rows[0].active_revision) : null,
		bundledVersion: bundled(project)?.version ?? null,
		versions: versions.rows.map((row) => ({ ...JSON.parse(String(row.metadata_json)), versionNumber: Number(row.version_number) }) as LbyImportVersion),
	};
};

export const listLbyImports = async () => {
	await ensureSchema();
	const projects = await db.execute("SELECT project_id FROM ppic_panel_location_project ORDER BY project_id");
	return Promise.all(projects.rows.map((row) => getLbyImportState(String(row.project_id))));
};

export const lbyProjectForOrder = async (orderId: string) => {
	await ensureSchema();
	const existing = await db.execute({ sql: `SELECT project_id FROM ppic_panel_location_revision
		WHERE json_extract(metadata_json, '$.orderId') = ? LIMIT 1`, args: [orderId] });
	return existing.rows[0]?.project_id ? String(existing.rows[0].project_id)
		: Object.entries(catalog).find(([, entry]) => entry.orderId === orderId)?.[0] ?? `lby-${orderId}`;
};

export const claimLbyImport = async (project: string, orderId: string) => {
	await ensureSchema();
	const entry = bundled(project);
	if (entry && "orderId" in entry && entry.orderId !== orderId) throw new Error("ORDER_MISMATCH");
	const id = randomUUID(), now = Date.now();
	const result = await db.execute({
		sql: `INSERT INTO ppic_panel_location_project (project_id, order_id, import_id, import_until)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(project_id) DO UPDATE SET import_id = excluded.import_id, import_until = excluded.import_until
			WHERE ppic_panel_location_project.import_until < ?
			AND (ppic_panel_location_project.order_id IS NULL OR ppic_panel_location_project.order_id = ?)`,
		args: [project, entry && "orderId" in entry ? entry.orderId : null, id, now + 330_000, now, orderId],
	});
	if (!result.rowsAffected) {
		const current = await db.execute({ sql: "SELECT order_id FROM ppic_panel_location_project WHERE project_id = ?", args: [project] });
		throw new Error(current.rows[0]?.order_id && current.rows[0].order_id !== orderId ? "ORDER_MISMATCH" : "IMPORT_BUSY");
	}
	return id;
};

export const releaseLbyImport = (project: string, id: string) => db.execute({
	sql: "UPDATE ppic_panel_location_project SET import_id = NULL, import_until = 0 WHERE project_id = ? AND import_id = ?",
	args: [project, id],
});

export const saveLbyImport = async (project: string, id: string, actor: string, data: {
	manifest: LbyImportManifest; locations: string; mappingJson: string; sourceUrl: string;
}) => {
	const { manifest, locations, mappingJson } = data;
	if (manifest.projectKey !== project || sha(locations) !== manifest.revision || sha(mappingJson) !== manifest.mappingSha256) throw new Error("CHECKSUM_MISMATCH");
	if (Buffer.byteLength(locations) > 1024 * 1024 || Buffer.byteLength(mappingJson) > 8 * 1024 * 1024) throw new Error("MODEL_TOO_LARGE");
	const snapshot = JSON.parse(locations) as PanelLocationSnapshot;
	const snapshotGzip = gzipSync(locations), mappingGzip = gzipSync(mappingJson);
	if (snapshotGzip.length + mappingGzip.length > 1024 * 1024) throw new Error("MODEL_TOO_LARGE");
	const metadata: Omit<LbyImportVersion, "versionNumber"> = { ...manifest,
		roomCount: new Set(snapshot.panels.map((panel) => panel.roomName)).size,
		sampleBarcode: snapshot.panels[0].barcode,
	};
	// shortcut: revisions have no deletion flow; use a project counter before supporting revision deletion.
	const [result] = await db.batch([{
		sql: `INSERT OR IGNORE INTO ppic_panel_location_revision
			(project_id, revision, metadata_json, snapshot_gzip, mapping_gzip, imported_by, version_number)
			SELECT project_id, ?, ?, ?, ?, ?,
			COALESCE((SELECT max(version_number) FROM ppic_panel_location_revision WHERE project_id = ?), ?) + 1 FROM ppic_panel_location_project
			WHERE project_id = ? AND import_id = ? AND import_until > ? AND (order_id IS NULL OR order_id = ?)`,
		args: [manifest.revision, JSON.stringify(metadata), snapshotGzip, mappingGzip, actor, project, Number(Boolean(bundled(project))), project, id, Date.now(), manifest.orderId],
	}, {
		sql: `INSERT OR IGNORE INTO ppic_panel_location_barcode (barcode, project_id, revision)
			SELECT json_extract(value, '$.barcode'), ?, ? FROM json_each(?, '$.panels')
			WHERE EXISTS (SELECT 1 FROM ppic_panel_location_revision WHERE project_id = ? AND revision = ?)`,
		args: [project, manifest.revision, locations, project, manifest.revision],
	}, {
		sql: `INSERT INTO ppic_lby_source_link (project_id, url)
			SELECT project_id, ? FROM ppic_panel_location_project
			WHERE project_id = ? AND import_id = ? AND import_until > ?
			AND EXISTS (SELECT 1 FROM ppic_panel_location_revision WHERE project_id = ? AND revision = ?)
			ON CONFLICT(project_id) DO UPDATE SET url = excluded.url`,
		args: [data.sourceUrl, project, id, Date.now(), project, manifest.revision],
	}], "write");
	if (!result.rowsAffected) {
		const state = await getLbyImportState(project);
		const existing = state.versions.find((version) => version.revision === manifest.revision);
		if (!existing || existing.orderId !== manifest.orderId) throw new Error("IMPORT_CONFLICT");
		return existing;
	}
	return (await readRevision(project, manifest.revision)).metadata;
};

const readRevision = unstable_cache(async (project: string, revision: string) => {
	const result = await db.execute({
		sql: "SELECT metadata_json, snapshot_gzip, mapping_gzip, version_number FROM ppic_panel_location_revision WHERE project_id = ? AND revision = ?",
		args: [project, revision],
	});
	const row = result.rows[0];
	if (!row) throw new Error("REVISION_NOT_FOUND");
	const metadata = { ...JSON.parse(String(row.metadata_json)), versionNumber: Number(row.version_number) } as LbyImportVersion;
	const locations = gunzipSync(Buffer.from(row.snapshot_gzip as ArrayBuffer), { maxOutputLength: 2 * 1024 * 1024 }).toString("utf8");
	const mapping = gunzipSync(Buffer.from(row.mapping_gzip as ArrayBuffer), { maxOutputLength: 8 * 1024 * 1024 }).toString("utf8");
	if (metadata.projectKey !== project || metadata.revision !== revision || sha(locations) !== revision || sha(mapping) !== metadata.mappingSha256) throw new Error("CHECKSUM_MISMATCH");
	return { metadata, snapshot: withPanelLocationDetails(JSON.parse(locations), JSON.parse(mapping)) };
}, ["panel-location-revision-number"], { revalidate: false });

export const getStoredPanelLocationByBarcode = async (barcode: string) => {
	await ensureSchema();
	const result = await db.execute({ sql: `SELECT b.project_id, b.revision FROM ppic_panel_location_barcode b
		JOIN ppic_panel_location_project p ON p.project_id = b.project_id AND p.active_revision = b.revision
		WHERE b.barcode = ? LIMIT 2`, args: [barcode] });
	if (result.rows.length > 1) throw new Error("LOCATION_AMBIGUOUS");
	const row = result.rows[0];
	return row ? readRevision(String(row.project_id), String(row.revision)) : null;
};

export const getStoredPanelLocation = async (project: string, revision?: string) => {
	await ensureSchema();
	if (!revision) {
		const result = await db.execute({ sql: "SELECT active_revision FROM ppic_panel_location_project WHERE project_id = ?", args: [project] });
		revision = result.rows[0]?.active_revision ? String(result.rows[0].active_revision) : undefined;
	}
	return revision ? readRevision(project, revision) : null;
};

export const getActivePanelLocationVersion = async (project: string): Promise<Pick<PanelLocationView, "version" | "versionNumber"> | null> => {
	await ensureSchema();
	const result = await db.execute({
		sql: `SELECT p.active_revision, json_extract(r.metadata_json, '$.version') AS version, r.version_number
			FROM ppic_panel_location_project p LEFT JOIN ppic_panel_location_revision r
			ON r.project_id = p.project_id AND r.revision = p.active_revision WHERE p.project_id = ?`,
		args: [project],
	});
	const row = result.rows[0];
	if (row?.active_revision) {
		if (typeof row.version !== "string") throw new Error("REVISION_NOT_FOUND");
		return { version: row.version, versionNumber: Number(row.version_number) };
	}
	const entry = bundled(project);
	return entry ? { version: entry.version, versionNumber: 1 } : null;
};

export const activateLbyImport = async (project: string, revision: string | null, expected: string | null) => {
	await ensureSchema();
	if (revision === null) {
		if (!bundled(project)) throw new Error("REVISION_NOT_FOUND");
		const result = await db.execute({ sql: "UPDATE ppic_panel_location_project SET active_revision = NULL WHERE project_id = ? AND active_revision IS ?", args: [project, expected] });
		if (!result.rowsAffected) throw new Error("IMPORT_CONFLICT");
		return;
	}
	const candidate = await readRevision(project, revision);
	const [result] = await db.batch([{
		sql: `UPDATE ppic_panel_location_project SET active_revision = ?, order_id = ?
			WHERE project_id = ? AND active_revision IS ? AND (order_id IS NULL OR order_id = ?)`,
		args: [revision, candidate.metadata.orderId, project, expected, candidate.metadata.orderId],
	}, {
		sql: `INSERT OR IGNORE INTO ppic_panel_location_barcode (barcode, project_id, revision)
			SELECT json_extract(value, '$.barcode'), ?, ? FROM json_each(?, '$.panels')`,
		args: [project, revision, JSON.stringify(candidate.snapshot)],
	}], "write");
	if (!result.rowsAffected) throw new Error("IMPORT_CONFLICT");
};
