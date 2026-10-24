import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { getPpicMemberAccess, getPpicMemberScanSummary } from "@/lib/db";
import { inProgressProjects } from "@/lib/projects";
import { getProjectDashboard } from "@/lib/projectDashboard";
import { summarizeAdminOverview } from "@/lib/adminOverview";
import { clickUpToken, panelChannelMembers, requireSuperAdmin } from "@/lib/session";
import { redirect } from "next/navigation";

export const maxDuration = 60;

export default async function AdminHome() {
	await requireSuperAdmin();
	const token = await clickUpToken();
	if (!token) redirect("/login");
	const now = Date.now();
	const [projectResult, teamResult] = await Promise.allSettled([
		inProgressProjects(token).then(async (projects) => ({
			count: projects.length,
			dashboards: await Promise.allSettled(
				projects.map((project) => getProjectDashboard(token, {
					task_id: project.id,
					name: project.name ?? null,
					custom_id: project.custom_id ?? null,
				})),
			),
		})),
		panelChannelMembers().then(async (result) => {
			if (!result.ok) throw new Error("MEMBERS_UNAVAILABLE");
			const { roles, permissions } = await getPpicMemberAccess(
				result.members.map((member) => member.id),
			);
			// shortcut: one existing summary per member; batch queries if team size makes home loads slow.
			return Promise.all(
				result.members.filter((member) => roles[member.id] !== "SUPER_ADMIN")
					.map(async (member) => ({
						...member,
						hasAccess: !!permissions[member.id]?.length,
						summary: await getPpicMemberScanSummary(member.id, "7", now).catch(() => null),
					})),
			);
		}),
	]);
	const projects = projectResult.status === "fulfilled" ? projectResult.value : null;
	const dashboards = projects?.dashboards.flatMap((result) => result.status === "fulfilled" ? [result.value] : []) ?? [];
	const members = teamResult.status === "fulfilled" ? teamResult.value : null;
	return (
		<AdminDashboard
			now={now}
			projectCount={projects?.count ?? null}
			projectsReady={projects !== null && dashboards.length === projects.count}
			totals={summarizeAdminOverview(dashboards, members ?? [])}
			members={members}
		/>
	);
}
