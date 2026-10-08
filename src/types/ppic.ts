export const PPIC_STATUSES = [
	"BARANG_DITERIMA",
	"SEDANG_DIPACKING",
	"TERPASANG_DIGUNAKAN",
] as const;

export type PpicStatus = (typeof PPIC_STATUSES)[number];

export const PPIC_ROLES = ["MEMBER", "SUPER_ADMIN"] as const;

export type PpicRole = (typeof PPIC_ROLES)[number];

export type PpicPermission = {
	clickup_user_id: string;
	allowed_status: PpicStatus;
	active: 0 | 1;
	updated_by: string;
	updated_at: string;
	role: PpicRole;
};

export const isPpicStatus = (value: unknown): value is PpicStatus =>
	typeof value === "string" && PPIC_STATUSES.includes(value as PpicStatus);

export const isPpicRole = (value: unknown): value is PpicRole =>
	typeof value === "string" && PPIC_ROLES.includes(value as PpicRole);
