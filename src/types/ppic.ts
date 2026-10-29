export const PPIC_STATUSES = [
	"BARANG_DITERIMA",
	"SEDANG_DIPACKING",
	"TERPASANG_DIGUNAKAN",
	"DALAM_PROSES_RETUR",
] as const;

export type PpicStatus = (typeof PPIC_STATUSES)[number];
export type PpicStatuses = PpicStatus[];

export const PPIC_ROLES = ["MEMBER", "SUPER_ADMIN", "ADMIN"] as const;

export type PpicRole = (typeof PPIC_ROLES)[number];

export const hasPpicAdminAccess = (role: unknown): role is "SUPER_ADMIN" | "ADMIN" =>
	role === "SUPER_ADMIN" || role === "ADMIN";

export type PpicPermission = {
	clickup_user_id: string;
	allowed_status: PpicStatuses;
	active: 0 | 1;
	can_import_lby: 0 | 1;
	updated_by: string;
	updated_at: string;
	role: PpicRole;
};

export type PpicScanHistory = {
	serialNumber: string;
	status: PpicStatus;
	taskName: string;
	scannedAt: string;
};

export type PpicProjectScanHistory = PpicScanHistory & {
	userId: string;
	projectTaskId: string;
	componentTaskId: string;
};

export type MemberScanPeriod = "7" | "30" | "month";

export type TeamDailyScanDay = {
	date: string;
	count: number;
	statuses: Record<PpicStatus | "OTHER", number>;
};

export type MemberScanSummary = {
	lifetimeTotal: number;
	total: number;
	today: number;
	previousTotal: number;
	lastScannedAt: string | null;
	days: { date: string; count: number }[];
	statuses: { status: PpicStatus | "OTHER"; count: number }[];
	lifetimeStatuses: { status: PpicStatus | "OTHER"; count: number }[];
};

export const isPpicStatus = (value: unknown): value is PpicStatus =>
	typeof value === "string" && PPIC_STATUSES.includes(value as PpicStatus);

export const ppicStatuses = (value: unknown): PpicStatuses | null => {
	let parsed = value;
	if (typeof value === "string" && value.startsWith("[")) {
		try {
			parsed = JSON.parse(value);
		} catch {
			return null;
		}
	}
	const values = Array.isArray(parsed)
		? parsed
		: typeof parsed === "string"
			? [parsed]
			: [];
	if (!values.length || values.some((status) => !isPpicStatus(status)))
		return null;
	return [...new Set(values)] as PpicStatuses;
};

export const isPpicRole = (value: unknown): value is PpicRole =>
	typeof value === "string" && PPIC_ROLES.includes(value as PpicRole);
