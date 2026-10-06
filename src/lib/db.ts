import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
	throw new Error("Turso environment variables are missing");
}

export const db = createClient({
	url,
	authToken,
});

const allowedPpicStatuses = new Set([
	"BARANG_DITERIMA",
	"SEDANG_DIPACKING",
]);

export const isPpicStatus = (status: unknown): status is string =>
	typeof status === "string" && allowedPpicStatuses.has(status);

export const getPpicPermission = async (clickupUserId: string) => {
	const result = await db.execute({
		sql: `
			SELECT clickup_user_id, allowed_status, active
			FROM ppic_permissions
			WHERE clickup_user_id = ?
			  AND active = 1
		`,
		args: [clickupUserId],
	});

	return result.rows[0] ?? null;
};

export const savePpicPermission = async (
	userId: string,
	allowedStatus: string,
	updatedBy: string,
) => {
	if (
		!userId.trim() ||
		!updatedBy.trim() ||
		!isPpicStatus(allowedStatus)
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
		args: [userId, allowedStatus, updatedBy],
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
