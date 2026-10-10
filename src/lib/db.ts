import { createClient } from "@libsql/client";
import {
	isPpicRole,
	isPpicStatus,
	PPIC_STATUSES,
	ppicStatuses,
} from "@/types/ppic";
import type { PpicRole, PpicScanHistory, PpicStatus, PpicStatuses } from "@/types/ppic";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
	throw new Error("Turso environment variables are missing");
}

export const db = createClient({
	url,
	authToken,
});

export { isPpicRole, isPpicStatus } from "@/types/ppic";

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
) =>
	db.execute({
		sql: `
			INSERT INTO ppic_scan_history (
				clickup_user_id,
				serial_number,
				status,
				task_name
			)
			VALUES (?, ?, ?, ?)
		`,
		args: [userId, serialNumber, status, taskName],
	});

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
