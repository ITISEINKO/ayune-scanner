import { asDate } from "@/lib/projectTimeline";
import { isSupportingGroup } from "@/lib/projectStatus";
import { isPpicStatus } from "@/types/ppic";
import type { CompletedProjectInsights, ProjectDashboard } from "@/types/project";

// Called only by the backend; older snapshots use their saved history without refetching it.
export const withCompletedProjectInsights = (dashboard: ProjectDashboard): ProjectDashboard => {
	if (!dashboard.completion || dashboard.completion.insights) return dashboard;
	const cutoff = Math.min(
		asDate(dashboard.completion.completedAt)?.getTime() ?? Infinity,
		asDate(dashboard.completion.capturedAt)?.getTime() ?? Infinity,
	);
	const returns: CompletedProjectInsights["returns"] = {
		totalItems: 0, returnedItems: 0, percentage: null,
		inProgress: 0, resolved: 0, unknown: 0, groups: [],
	};
	const transitions: CompletedProjectInsights["transitions"] = [
		{ from: "BARANG_DITERIMA", to: "SEDANG_DIPACKING", averageHours: null, sampleItems: 0, waitingItems: 0 },
		{ from: "SEDANG_DIPACKING", to: "TERPASANG_DIGUNAKAN", averageHours: null, sampleItems: 0, waitingItems: 0 },
	];
	const seen = new Set<string>();
	for (const item of dashboard.items) {
		if (isSupportingGroup(item.name)) continue;
		const group: CompletedProjectInsights["returns"]["groups"][number] = {
			id: item.id, name: item.name, totalItems: 0, returnedItems: 0,
			percentage: 0, inProgress: 0, resolved: 0, unknown: 0,
		};
		for (const component of item.components) {
			if (seen.has(component.id) || !component.serialNumber?.trim() || component.status === "DIHAPUSKAN") continue;
			seen.add(component.id);
			group.totalItems++;
			const history = component.history
				.toReversed() // Saved history is newest first, including scans in the same second.
				.map((log) => ({ status: log.status, at: asDate(log.scannedAt)?.getTime() }))
				.filter((log): log is { status: typeof log.status; at: number } =>
					isPpicStatus(log.status) && log.at !== undefined && log.at <= cutoff)
				.sort((a, b) => a.at - b.at);
			if (component.status === "DALAM_PROSES_RETUR" || history.some((log) => log.status === "DALAM_PROSES_RETUR")) {
				group.returnedItems++;
				if (component.status === "TERPASANG_DIGUNAKAN") group.resolved++;
				else if (isPpicStatus(component.status)) group.inProgress++;
				else group.unknown++;
			}
			for (const transition of transitions) {
				if (component.status === transition.from) transition.waitingItems++;
				let startedAt: number | null = null;
				for (const log of history) {
					if (log.status === transition.from) startedAt ??= log.at;
					else if (log.status === transition.to && startedAt !== null) {
						transition.averageHours = (transition.averageHours ?? 0) + (log.at - startedAt) / 3_600_000;
						transition.sampleItems++;
						break;
					} else startedAt = null; // A return or backward step breaks this stage's waiting period.
				}
			}
		}
		returns.totalItems += group.totalItems;
		returns.returnedItems += group.returnedItems;
		returns.inProgress += group.inProgress;
		returns.resolved += group.resolved;
		returns.unknown += group.unknown;
		if (group.returnedItems) {
			group.percentage = group.returnedItems / group.totalItems * 100;
			returns.groups.push(group);
		}
	}
	returns.percentage = returns.totalItems ? returns.returnedItems / returns.totalItems * 100 : null;
	returns.groups.sort((a, b) => b.returnedItems - a.returnedItems || b.percentage - a.percentage || a.name.localeCompare(b.name));
	for (const transition of transitions) {
		if (transition.averageHours !== null) transition.averageHours /= transition.sampleItems;
	}
	const [received, packed] = transitions;
	const bottleneck = received.averageHours !== null && packed.averageHours !== null && received.averageHours !== packed.averageHours
		? (received.averageHours > packed.averageHours ? received.from : packed.from)
		: null;
	return { ...dashboard, completion: { ...dashboard.completion, insights: { returns, transitions, bottleneck } } };
};
