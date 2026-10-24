import {
	countsFor,
	isSupportingGroup,
	trackingStatuses,
} from "./projectStatus.ts";
import type { PanelMember } from "@/types/clickup";
import type { MemberScanSummary, TeamDailyScanDay } from "@/types/ppic";
import type { ProjectDashboard } from "@/types/project";

export type OverviewMember = PanelMember & {
	hasAccess: boolean;
	summary: Pick<MemberScanSummary, "today" | "total" | "days"> | null;
};

export type AdminDashboardData = {
	now: number;
	totals: ReturnType<typeof summarizeAdminOverview>;
	projectsReady: boolean;
	projectCount: number | null;
	members: OverviewMember[] | null;
	dailyScans: TeamDailyScanDay[] | null;
};

export function summarizeAdminOverview(
	projects: ProjectDashboard[],
	members: OverviewMember[],
) {
	const components = projects.flatMap((project) =>
		project.items
			.filter((item) => !isSupportingGroup(item.name))
			.flatMap((item) => item.components)
			.filter((component) => component.status !== "DIHAPUSKAN"),
	);
	const counts = countsFor(components);
	const recorded = components.length - counts.get("UNSCANNED")!;
	const enabled = members.filter((member) => member.hasAccess);
	const today = members.reduce(
		(total, member) => total + (member.summary?.today ?? 0),
		0,
	);
	const yesterday = members.reduce(
		(total, member) => total + (member.summary?.days.at(-2)?.count ?? 0),
		0,
	);
	return {
		total: components.length,
		recorded,
		percentage: components.length
			? Math.round((recorded / components.length) * 100)
			: 0,
		statuses: trackingStatuses.map((status) => ({
			status,
			count: counts.get(status)!,
		})),
		today,
		change: today - yesterday,
		week: members.reduce(
			(total, member) => total + (member.summary?.total ?? 0),
			0,
		),
		active: enabled.filter((member) => (member.summary?.today ?? 0) > 0).length,
		enabled: enabled.length,
		idle: enabled.filter((member) => member.summary?.today === 0).length,
		noAccess: members.length - enabled.length,
		returns: counts.get("DALAM_PROSES_RETUR")!,
	};
}
