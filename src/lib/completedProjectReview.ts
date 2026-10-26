import { asDate, calendarDaysBetween } from "@/lib/projectTimeline";
import { countsFor, isSupportingGroup } from "@/lib/projectStatus";
import { isPpicStatus } from "@/types/ppic";
import type { ProjectDashboard } from "@/types/project";

export const completedProjectReview = (dashboard: ProjectDashboard) => {
	const components = [...new Map(dashboard.items
		.filter((item) => !isSupportingGroup(item.name))
		.flatMap((item) => item.components)
		.filter((component) => component.serialNumber?.trim() && component.status !== "DIHAPUSKAN")
		.map((component) => [component.id, component])).values()];
	const counts = countsFor(components);
	const total = components.length;
	const scanned = components.filter((component) => isPpicStatus(component.status)).length;
	const completedAt = asDate(dashboard.completion?.completedAt)?.toISOString() ?? null;
	const capturedAt = asDate(dashboard.completion?.capturedAt);
	const cutoff = Math.min(asDate(completedAt)?.getTime() ?? Infinity, capturedAt?.getTime() ?? Infinity);
	const history = components.flatMap((component) => component.history)
		.filter((log) => isPpicStatus(log.status) && (asDate(log.scannedAt)?.getTime() ?? Infinity) <= cutoff)
		.filter((log) => asDate(log.scannedAt) !== null)
		.sort((a, b) => asDate(a.scannedAt)!.getTime() - asDate(b.scannedAt)!.getTime());
	const firstScan = history[0]?.scannedAt ?? null;
	const plannedStart = asDate(dashboard.project.startDate)?.toISOString() ?? null;
	const startAt = firstScan ?? (plannedStart && (!completedAt || plannedStart <= completedAt) ? plannedStart : null);
	const timeline: { label: string; description: string; at: string | null }[] = [];
	if (firstScan) timeline.push({ label: "Scan pertama", description: "Aktivitas scan pertama yang tercatat.", at: firstScan });
	const seen = new Set<string>();
	let halfway = false;
	let fullyScanned = false;
	for (const log of history) {
		seen.add(log.componentTaskId);
		if (!halfway && total > 0 && seen.size >= Math.ceil(total / 2)) {
			halfway = true;
			timeline.push({ label: "50% terscan", description: "Setengah item memiliki riwayat scan.", at: log.scannedAt });
		}
		if (!fullyScanned && total > 0 && seen.size >= total) {
			fullyScanned = true;
			timeline.push({ label: "100% terscan", description: "Semua item memiliki riwayat scan.", at: log.scannedAt });
		}
	}
	timeline.push({
		label: "Project selesai",
		description: dashboard.completion?.completedBy
			? `Ditandai selesai oleh ${dashboard.completion.completedBy.name}.`
			: "Status selesai tercatat. Admin penyelesai tidak tercatat.",
		at: completedAt,
	});
	const contributions = new Map<string, number>();
	for (const log of history) contributions.set(log.userId, (contributions.get(log.userId) ?? 0) + 1);
	const members = [...contributions].map(([userId, scans]) => ({
		userId,
		name: dashboard.memberNames[userId] ?? userId,
		scans,
	})).sort((a, b) => b.scans - a.scans || a.name.localeCompare(b.name));
	return {
		total, scanned, counts, startAt, completedAt, timeline, members,
		startSource: firstScan ? "Scan pertama" : startAt ? "Start date ClickUp" : null,
		durationDays: startAt && completedAt ? calendarDaysBetween(startAt, completedAt) : null,
	};
};
