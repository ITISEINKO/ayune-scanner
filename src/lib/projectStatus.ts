import type { ProjectDashboard, ProjectStatusChange } from "@/types/project";

export const applyProjectStatusChanges = (
	dashboard: ProjectDashboard,
	changes: ProjectStatusChange[],
): ProjectDashboard => {
	const changesById = new Map(
		changes.map((change) => [change.componentTaskId, change]),
	);
	return {
		...dashboard,
		items: dashboard.items.map((item) => ({
			...item,
			components: item.components
				.map((component) => {
					const change = changesById.get(component.id);
					return change ? { ...component, status: change.status } : component;
				})
				.filter((component) => component.status !== "DIHAPUSKAN"),
		})),
		statusUpdatedAt: changes.reduce(
			(latest, change) => Math.max(latest, change.updatedAt),
			dashboard.statusUpdatedAt,
		),
	};
};

export const trackingStatuses = [
	"UNSCANNED",
	"BARANG_DITERIMA",
	"SEDANG_DIPACKING",
	"TERPASANG_DIGUNAKAN",
	"DALAM_PROSES_RETUR",
	"OTHER",
] as const;
export const trackingStatusOf = (status: string | null) =>
	!status
		? "UNSCANNED"
		: trackingStatuses.includes(status as (typeof trackingStatuses)[number])
			? (status as (typeof trackingStatuses)[number])
			: "OTHER";

export const isSupportingGroup = (name: string) =>
	["MATERIAL REQUISITION FORM", "HARDWARE LIST"].includes(
		name.trim().replace(/\s+/g, " ").toUpperCase(),
	);

export const countsFor = (
	components: ProjectDashboard["items"][number]["components"],
) => {
	const counts = new Map<(typeof trackingStatuses)[number], number>(
		trackingStatuses.map((status) => [status, 0]),
	);
	for (const component of components) {
		const status = trackingStatusOf(component.status);
		counts.set(status, (counts.get(status) ?? 0) + 1);
	}
	return counts;
};
