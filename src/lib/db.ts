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
	MemberScanPeriod,
	MemberScanSummary,
	TeamDailyScanDay,
} from "@/types/ppic";
import type { PanelMember } from "@/types/clickup";
import type { ProjectDashboard, ProjectStatusChange, ProjectStatusRow } from "@/types/project";

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
let dashboardSnapshotSchema: Promise<void> | undefined;

const ensureDashboardSnapshotSchema = () =>
	(dashboardSnapshotSchema ??= db.execute(`
		CREATE TABLE IF NOT EXISTS ppic_admin_project_snapshot (
			scope_key TEXT PRIMARY KEY,
			dashboard_json TEXT,
			refresh_id TEXT,
			refresh_until INTEGER NOT NULL DEFAULT 0
		)
	`).then(() => undefined));

export const getAdminProjectSnapshot = async (scopeKey: string) => {
	await ensureDashboardSnapshotSchema();
	const result = await db.execute({
		sql: "SELECT dashboard_json FROM ppic_admin_project_snapshot WHERE scope_key = ?",
		args: [scopeKey],
	});
	const json = result.rows[0]?.dashboard_json;
	return json ? JSON.parse(String(json)) as ProjectDashboard : null;
};

export const invalidateAdminProjectSnapshots = async (taskId: string) => {
	await ensureDashboardSnapshotSchema();
	await db.execute({
		sql: "DELETE FROM ppic_admin_project_snapshot WHERE json_extract(dashboard_json, '$.project.task_id') = ? AND scope_key NOT LIKE 'completed:%'",
		args: [taskId],
	});
};

export const claimAdminProjectRefresh = async (scopeKey: string, refreshId: string) => {
	await ensureDashboardSnapshotSchema();
	const result = await db.execute({
		sql: `INSERT INTO ppic_admin_project_snapshot (scope_key, refresh_id, refresh_until)
			VALUES (?, ?, ?)
			ON CONFLICT(scope_key) DO UPDATE SET
				refresh_id = excluded.refresh_id, refresh_until = excluded.refresh_until
			WHERE ppic_admin_project_snapshot.refresh_until < ?`,
		args: [scopeKey, refreshId, Date.now() + 60_000, Date.now()],
	});
	return result.rowsAffected > 0;
};

export const finishAdminProjectRefresh = async (
	scopeKey: string,
	refreshId: string,
	dashboard?: ProjectDashboard,
) => {
	await ensureDashboardSnapshotSchema();
	const result = await db.execute({
		sql: `UPDATE ppic_admin_project_snapshot
			SET dashboard_json = COALESCE(?, dashboard_json), refresh_id = NULL, refresh_until = 0
			WHERE scope_key = ? AND refresh_id = ?`,
		args: [dashboard ? JSON.stringify(dashboard) : null, scopeKey, refreshId],
	});
	return result.rowsAffected > 0;
};

export const stageAdminProjectSnapshot = async (
	scopeKey: string,
	refreshId: string,
	dashboard: ProjectDashboard,
) => {
	await ensureDashboardSnapshotSchema();
	const result = await db.execute({
		sql: "UPDATE ppic_admin_project_snapshot SET dashboard_json = ? WHERE scope_key = ? AND refresh_id = ?",
		args: [JSON.stringify(dashboard), scopeKey, refreshId],
	});
	if (!result.rowsAffected) throw new Error("PROJECT_SYNC_SUPERSEDED");
};

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
	updatedAt = Date.now(),
) => {
	if (!rows.length) return;
	await ensureProjectStatusSchema();
	await db.batch(
		rows.map((row) => ({
			sql: `
					INSERT INTO ppic_component_status (
						component_task_id, project_task_id, status, updated_at
					)
					VALUES (?, ?, ?, ?)
					ON CONFLICT(component_task_id) DO UPDATE SET
						project_task_id = excluded.project_task_id,
						status = excluded.status,
						updated_at = excluded.updated_at
					WHERE ppic_component_status.updated_at < excluded.updated_at
				`,
			args: [row.componentTaskId, projectTaskId, row.status, updatedAt],
		})),
		"write",
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

export const getPpicProjectStatuses = async (
	projectTaskId: string,
): Promise<ProjectStatusChange[]> => {
	await ensureProjectStatusSchema();
	const result = await db.execute({
		sql: `
			SELECT component_task_id, status, updated_at
			FROM ppic_component_status
			WHERE project_task_id = ?
		`,
		args: [projectTaskId],
	});
	return result.rows.map((row) => ({
		componentTaskId: String(row.component_task_id),
		status: row.status === null ? null : String(row.status),
		updatedAt: Number(row.updated_at),
	}));
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
	if (!members.length) return;
	await ensurePermissionNamesSchema();
	await db.batch(
		members.map((member) => ({
			sql: `
					UPDATE ppic_permissions
					SET display_name = ?
					WHERE clickup_user_id = ?
				`,
				args: [member.name, member.id],
		})),
		"write",
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

// ADMIN inherits every existing SUPER_ADMIN permission.
export const isPpicSuperAdmin = async (clickupUserId: string) => {
	const result = await db.execute({
		sql: `
			SELECT 1
			FROM ppic_permissions
			WHERE clickup_user_id = ?
			  AND role IN ('SUPER_ADMIN', 'ADMIN')
			LIMIT 1
		`,
		args: [clickupUserId],
	});

	return result.rows.length > 0;
};

export const getPpicMemberAccess = async (userIds: string[]) => {
	const roles = Object.fromEntries(
		userIds.map((userId) => [userId, "MEMBER" as PpicRole]),
	) as Record<string, PpicRole>;
	const permissions = Object.fromEntries(
		userIds.map((userId) => [userId, null as PpicStatuses | null]),
	) as Record<string, PpicStatuses | null>;
	if (!userIds.length) return { roles, permissions };

	const result = await db.execute({
		sql: `
			SELECT clickup_user_id, role, allowed_status, active
			FROM ppic_permissions
			WHERE clickup_user_id IN (${userIds.map(() => "?").join(", ")})
		`,
		args: userIds,
	});
	for (const row of result.rows) {
		const userId = String(row.clickup_user_id);
		if (isPpicRole(row.role)) roles[userId] = row.role;
		if (row.role === "MEMBER" && Number(row.active) === 1)
			permissions[userId] = ppicStatuses(row.allowed_status);
	}
	return { roles, permissions };
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

export const getPpicTeamScanOverview = async (
	userIds: string[],
	now = Date.now(),
) => {
	const dayMs = 86_400_000;
	const jakartaOffset = 7 * 60 * 60 * 1000;
	const today = Math.floor((now + jakartaOffset) / dayMs) * dayMs;
	const start = today - 29 * dayMs;
	const days: TeamDailyScanDay[] = Array.from({ length: 30 }, (_, index) => ({
		date: new Date(start + index * dayMs).toISOString().slice(0, 10),
		count: 0,
		statuses: { BARANG_DITERIMA: 0, SEDANG_DIPACKING: 0, TERPASANG_DIGUNAKAN: 0, DALAM_PROSES_RETUR: 0, OTHER: 0 },
	}));
	const summaries: Record<string, Pick<MemberScanSummary, "today" | "total" | "days">> = Object.fromEntries(
		userIds.map((id) => [id, { today: 0, total: 0, days: days.slice(-7).map(({ date }) => ({ date, count: 0 })) }]),
	);
	if (!userIds.length) return { dailyScans: days, summaries };
	const result = await db.execute({
		sql: `SELECT clickup_user_id, date(scanned_at, '+7 hours') AS day, status, COUNT(*) AS count
			FROM ppic_scan_history
			WHERE clickup_user_id IN (${userIds.map(() => "?").join(", ")})
				AND unixepoch(scanned_at) >= ? AND unixepoch(scanned_at) <= ?
			GROUP BY clickup_user_id, day, status`,
		args: [...userIds, (start - jakartaOffset) / 1000, Math.floor(now / 1000)],
	});
	for (const row of result.rows) {
		const day = days.find((day) => day.date === String(row.day));
		if (!day) continue;
		const count = Number(row.count);
		day.count += count;
		day.statuses[isPpicStatus(row.status) ? row.status : "OTHER"] += count;
		const summary = summaries[String(row.clickup_user_id)];
		const memberDay = summary.days.find((memberDay) => memberDay.date === day.date);
		if (memberDay) {
			memberDay.count += count;
			summary.total += count;
			if (memberDay === summary.days.at(-1)) summary.today += count;
		}
	}
	return { dailyScans: days, summaries };
};

export const getPpicMemberScanSummary = async (
	userId: string,
	period: MemberScanPeriod,
	now = Date.now(),
): Promise<MemberScanSummary> => {
	const dayMs = 86_400_000;
	const jakartaOffset = 7 * 60 * 60 * 1000;
	const localNow = new Date(now + jakartaOffset);
	const today = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());
	const dayCount = period === "month" ? localNow.getUTCDate() : Number(period);
	const start = today - (dayCount - 1) * dayMs;
	const previousStart = start - dayCount * dayMs;
	const [counts, latest] = await db.batch([
		{
			sql: `SELECT date(scanned_at, '+7 hours') AS day, status, COUNT(*) AS count
				FROM ppic_scan_history
				WHERE clickup_user_id = ? AND unixepoch(scanned_at) >= ? AND unixepoch(scanned_at) <= ?
				GROUP BY day, status`,
			args: [userId, (previousStart - jakartaOffset) / 1000, Math.floor(now / 1000)],
		},
		{
			sql: `SELECT status, COUNT(*) AS total, MAX(unixepoch(scanned_at)) AS latest FROM ppic_scan_history
				WHERE clickup_user_id = ? AND unixepoch(scanned_at) <= ?
				GROUP BY status ORDER BY latest DESC`,
			args: [userId, Math.floor(now / 1000)],
		},
	], "read");
	const summary: MemberScanSummary = {
		lifetimeTotal: latest.rows.reduce((total, row) => total + Number(row.total), 0),
		total: 0,
		today: 0,
		previousTotal: 0,
		lastScannedAt: latest.rows[0]?.latest == null ? null : new Date(Number(latest.rows[0].latest) * 1000).toISOString(),
		days: Array.from({ length: dayCount }, (_, index) => ({
			date: new Date(start + index * dayMs).toISOString().slice(0, 10),
			count: 0,
		})),
		statuses: PPIC_STATUSES.map((status) => ({ status, count: 0 })),
		lifetimeStatuses: PPIC_STATUSES.map((status) => ({ status, count: 0 })),
	};
	for (const row of latest.rows) {
		const status = isPpicStatus(row.status) ? row.status : "OTHER";
		let bucket = summary.lifetimeStatuses.find((bucket) => bucket.status === status);
		if (!bucket) {
			bucket = { status, count: 0 };
			summary.lifetimeStatuses.push(bucket);
		}
		bucket.count += Number(row.total);
	}
	for (const row of counts.rows) {
		const count = Number(row.count);
		const day = summary.days.find((day) => day.date === String(row.day));
		if (!day) {
			summary.previousTotal += count;
			continue;
		}
		day.count += count;
		summary.total += count;
		const status = isPpicStatus(row.status) ? row.status : "OTHER";
		let bucket = summary.statuses.find((bucket) => bucket.status === status);
		if (!bucket) {
			bucket = { status, count: 0 };
			summary.statuses.push(bucket);
		}
		bucket.count += count;
	}
	summary.today = summary.days.at(-1)!.count;
	return summary;
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
