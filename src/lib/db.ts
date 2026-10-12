import { createClient } from "@libsql/client";
import {
	isPpicRole,
	isPpicStatus,
	PPIC_STATUSES,
	ppicStatuses,
} from "@/types/ppic";
import type {
	PpicProjectScanHistory,
	PpicRole,
	PpicScanHistory,
	PpicStatus,
	PpicStatuses,
} from "@/types/ppic";
import type { PanelMember } from "@/types/clickup";
import type { ProjectStatusRow } from "@/types/project";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
	throw new Error("Turso environment variables are missing");
}

export const db = createClient({
	url,
	authToken,
});

let scanHistorySchema: Promise<void> | undefined;
let permissionNamesSchema: Promise<void> | undefined;
let projectStatusSchema: Promise<void> | undefined;

const ensureProjectStatusSchema = () =>
	(projectStatusSchema ??= db
		.execute(`
			CREATE TABLE IF NOT EXISTS ppic_component_status (
				component_task_id TEXT PRIMARY KEY,
				project_task_id TEXT NOT NULL,
				status TEXT,
				updated_at INTEGER NOT NULL
			)
		`)
		.then(() =>
			db.execute(
				"CREATE INDEX IF NOT EXISTS idx_ppic_component_status_project_updated ON ppic_component_status(project_task_id, updated_at)",
			),
		)
		.then(() => undefined));

export const seedPpicProjectStatuses = async (
	projectTaskId: string,
	rows: ProjectStatusRow[],
) => {
	if (!rows.length) return;
	await ensureProjectStatusSchema();
	await Promise.all(
		rows.map((row) =>
			db.execute({
				sql: `
					INSERT INTO ppic_component_status (
						component_task_id, project_task_id, status, updated_at
					)
					VALUES (?, ?, ?, ?)
					ON CONFLICT(component_task_id) DO UPDATE SET
						project_task_id = excluded.project_task_id,
						status = excluded.status
				`,
				args: [row.componentTaskId, projectTaskId, row.status, Date.now()],
			}),
		),
	);
};

export const getPpicProjectStatusUpdatedAt = async (projectTaskId: string) => {
	await ensureProjectStatusSchema();
	const result = await db.execute({
		sql: "SELECT COALESCE(MAX(updated_at), 0) AS updated_at FROM ppic_component_status WHERE project_task_id = ?",
		args: [projectTaskId],
	});
	return Number(result.rows[0]?.updated_at ?? 0);
};

export const updatePpicComponentStatus = async (
	componentTaskId: string,
	status: string | null,
) => {
	await ensureProjectStatusSchema();
	const result = await db.execute({
		sql: `
			UPDATE ppic_component_status
			SET status = ?, updated_at = ?
			WHERE component_task_id = ?
		`,
		args: [status, Date.now(), componentTaskId],
	});
	return result.rowsAffected > 0;
};

export const getPpicProjectStatusChanges = async (
	projectTaskId: string,
	since: number,
) => {
	await ensureProjectStatusSchema();
	const result = await db.execute({
		sql: `
			SELECT component_task_id, status, updated_at
			FROM ppic_component_status
			WHERE project_task_id = ? AND updated_at > ?
			ORDER BY updated_at ASC
		`,
		args: [projectTaskId, since],
	});
	return result.rows.map((row) => ({
		componentTaskId: String(row.component_task_id),
		status: row.status === null ? null : String(row.status),
		updatedAt: Number(row.updated_at),
	}));
};

const ensureScanHistorySchema = () =>
	(scanHistorySchema ??= db
		.execute("PRAGMA table_info(ppic_scan_history)")
		.then(async (result) => {
			const columns = new Set(result.rows.map((row) => String(row.name)));
			if (!columns.has("project_task_id"))
				await db.execute("ALTER TABLE ppic_scan_history ADD COLUMN project_task_id TEXT");
			if (!columns.has("component_task_id"))
				await db.execute("ALTER TABLE ppic_scan_history ADD COLUMN component_task_id TEXT");
		}));

const ensurePermissionNamesSchema = () =>
	(permissionNamesSchema ??= db
		.execute("PRAGMA table_info(ppic_permissions)")
		.then(async (result) => {
			const columns = new Set(result.rows.map((row) => String(row.name)));
			if (!columns.has("display_name"))
				await db.execute("ALTER TABLE ppic_permissions ADD COLUMN display_name TEXT");
		}));

export { isPpicRole, isPpicStatus } from "@/types/ppic";

export const savePpicMemberNames = async (members: PanelMember[]) => {
	await ensurePermissionNamesSchema();
	await Promise.all(
		members.map((member) =>
			db.execute({
				sql: `
					UPDATE ppic_permissions
					SET display_name = ?
					WHERE clickup_user_id = ?
				`,
				args: [member.name, member.id],
			}),
		),
	);
};

export const getPpicMemberNames = async (userIds: string[]) => {
	if (!userIds.length) return {};
	await ensurePermissionNamesSchema();
	const result = await db.execute({
		sql: `
			SELECT clickup_user_id, display_name
			FROM ppic_permissions
			WHERE clickup_user_id IN (${userIds.map(() => "?").join(", ")})
				AND display_name IS NOT NULL
		`,
		args: userIds,
	});
	return Object.fromEntries(
		result.rows.map((row) => [String(row.clickup_user_id), String(row.display_name)]),
	);
};

export const getPpicAccess = async (clickupUserId: string): Promise<{
	role?: unknown;
	allowed_status: PpicStatuses | null;
	active?: unknown;
} | null> => {
	const result = await db.execute({
		sql: `
			SELECT role, allowed_status, active
			FROM ppic_permissions
			WHERE clickup_user_id = ?
			LIMIT 1
		`,
		args: [clickupUserId],
	});

	const row = result.rows[0] as Record<string, unknown> | undefined;
	return row ? { ...row, allowed_status: ppicStatuses(row.allowed_status) } : null;
};

export const isPpicSuperAdmin = async (clickupUserId: string) => {
	const result = await db.execute({
		sql: `
			SELECT 1
			FROM ppic_permissions
			WHERE clickup_user_id = ?
			  AND role = 'SUPER_ADMIN'
			LIMIT 1
		`,
		args: [clickupUserId],
	});

	return result.rows.length > 0;
};

export const getPpicRole = async (clickupUserId: string): Promise<PpicRole> => {
	const result = await db.execute({
		sql: `
			SELECT role
			FROM ppic_permissions
			WHERE clickup_user_id = ?
			LIMIT 1
		`,
		args: [clickupUserId],
	});

	return isPpicRole(result.rows[0]?.role) ? result.rows[0].role : "MEMBER";
};

export const getPpicPermission = async (clickupUserId: string): Promise<{
	clickup_user_id?: unknown;
	allowed_status: PpicStatuses | null;
	active?: unknown;
} | null> => {
	const result = await db.execute({
		sql: `
			SELECT clickup_user_id, allowed_status, active
			FROM ppic_permissions
			WHERE clickup_user_id = ?
			  AND role = 'MEMBER'
			  AND active = 1
		`,
		args: [clickupUserId],
	});

	const row = result.rows[0] as Record<string, unknown> | undefined;
	return row ? { ...row, allowed_status: ppicStatuses(row.allowed_status) } : null;
};

export const savePpicPermission = async (
	userId: string,
	allowedStatus: PpicStatuses,
	updatedBy: string,
) => {
	if (
		!userId.trim() ||
		!updatedBy.trim() ||
		!allowedStatus.length || allowedStatus.some((status) => !isPpicStatus(status))
	)
		throw new Error("Invalid PPIC permission");

	return db.execute({
		sql: `
			INSERT INTO ppic_permissions (
				clickup_user_id,
				allowed_status,
				active,
				updated_by
			)
			VALUES (?, ?, 1, ?)
			ON CONFLICT(clickup_user_id) DO UPDATE SET
				allowed_status = excluded.allowed_status,
				active = excluded.active,
				updated_by = excluded.updated_by,
				updated_at = CURRENT_TIMESTAMP
		`,
		args: [userId, allowedStatus.length === 1 ? allowedStatus[0] : JSON.stringify(allowedStatus), updatedBy],
	});
};

export const deactivatePpicPermission = async (
	userId: string,
	updatedBy: string,
) => {
	if (!userId.trim() || !updatedBy.trim())
		throw new Error("Invalid PPIC permission");

	return db.execute({
		sql: `
			UPDATE ppic_permissions
			SET active = 0,
				updated_by = ?,
				updated_at = CURRENT_TIMESTAMP
			WHERE clickup_user_id = ?
		`,
		args: [updatedBy, userId],
	});
};

export const savePpicRole = async (
	userId: string,
	role: PpicRole,
	updatedBy: string,
) => {
	if (!userId.trim() || !updatedBy.trim() || !isPpicRole(role))
		throw new Error("Invalid PPIC role");

	return db.execute({
		sql: `
			INSERT INTO ppic_permissions (
				clickup_user_id,
				allowed_status,
				active,
				updated_by,
				role
			)
			VALUES (?, ?, 0, ?, ?)
			ON CONFLICT(clickup_user_id) DO UPDATE SET
				role = excluded.role,
				active = CASE WHEN excluded.role = 'MEMBER' THEN 0 ELSE active END,
				updated_by = excluded.updated_by,
				updated_at = CURRENT_TIMESTAMP
		`,
		args: [userId, PPIC_STATUSES[0], updatedBy, role],
	});
};

export const savePpicScanHistory = async (
	userId: string,
	serialNumber: string,
	status: PpicStatus,
	taskName: string,
	projectTaskId: string,
	componentTaskId: string,
) => {
	await ensureScanHistorySchema();
	return db.execute({
		sql: `
			INSERT INTO ppic_scan_history (
				clickup_user_id,
				serial_number,
				status,
				task_name,
				project_task_id,
				component_task_id
			)
			VALUES (?, ?, ?, ?, ?, ?)
		`,
		args: [userId, serialNumber, status, taskName, projectTaskId, componentTaskId],
	});
};

export const getPpicScanHistory = async (
	userId: string,
): Promise<PpicScanHistory[]> => {
	const result = await db.execute({
		sql: `
			SELECT serial_number, status, task_name, scanned_at
			FROM ppic_scan_history
			WHERE clickup_user_id = ?
			ORDER BY scanned_at DESC, id DESC
		`,
		args: [userId],
	});

	return result.rows.map((row) => ({
		serialNumber: String(row.serial_number),
		status: String(row.status) as PpicStatus,
		taskName: String(row.task_name),
		scannedAt: String(row.scanned_at),
	}));
};

export const getPpicProjectScanHistory = async (
	projectTaskId: string,
): Promise<PpicProjectScanHistory[]> => {
	await ensureScanHistorySchema();
	const result = await db.execute({
		sql: `
			SELECT clickup_user_id, serial_number, status, task_name, scanned_at,
				project_task_id, component_task_id
			FROM ppic_scan_history
			WHERE project_task_id = ?
				AND component_task_id IS NOT NULL
			ORDER BY scanned_at DESC, id DESC
		`,
		args: [projectTaskId],
	});
	return result.rows.map((row) => ({
		userId: String(row.clickup_user_id),
		serialNumber: String(row.serial_number),
		status: String(row.status) as PpicStatus,
		taskName: String(row.task_name),
		scannedAt: String(row.scanned_at),
		projectTaskId: String(row.project_task_id),
		componentTaskId: String(row.component_task_id),
	}));
};
