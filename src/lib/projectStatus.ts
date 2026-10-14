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
