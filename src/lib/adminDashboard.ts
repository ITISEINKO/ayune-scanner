import { createHash } from "node:crypto";
import { db, getPpicMemberAccess, getPpicTeamScanOverview } from "@/lib/db";
import { inProgressProjects, panelListId } from "@/lib/projects";
import { getProjectDashboard } from "@/lib/projectDashboard";
import {
	summarizeAdminOverview,
	type AdminDashboardData,
} from "@/lib/adminOverview";
import { panelChannelMembers } from "@/lib/session";

let snapshotSchema: Promise<void> | undefined;
const ensureSnapshotSchema = () =>
	(snapshotSchema ??= db
		.execute(
			`
		CREATE TABLE IF NOT EXISTS ppic_admin_dashboard_snapshot (
			scope_key TEXT PRIMARY KEY,
			dashboard_json TEXT NOT NULL
		)
	`,
		)
		.then(() => undefined));

const snapshotScope = (userId: string) =>
	createHash("sha256")
		.update(
			JSON.stringify([
				userId,
				panelListId(),
				process.env.TURSO_DATABASE_URL,
				process.env.CLICKUP_CHAT_WORKSPACE_ID ?? process.env.CLICKUP_TEAM_ID,
				process.env.CLICKUP_CHAT_CHANNEL_ID ??
					process.env.CLICKUP_PPIC_CHANNEL_ID,
			]),
		)
		.digest("hex");

export async function getLastAdminDashboard(
	userId: string,
): Promise<AdminDashboardData | null> {
	await ensureSnapshotSchema();
	const result = await db.execute({
		sql: "SELECT dashboard_json FROM ppic_admin_dashboard_snapshot WHERE scope_key = ?",
		args: [snapshotScope(userId)],
	});
	const json = result.rows[0]?.dashboard_json;
	return json ? (JSON.parse(String(json)) as AdminDashboardData) : null;
}

async function buildAdminDashboard(token: string): Promise<AdminDashboardData> {
	const now = Date.now();
	const [projectResult, teamResult] = await Promise.allSettled([
		inProgressProjects(token).then(async (projects) => ({
			count: projects.length,
			dashboards: await Promise.allSettled(
				projects.map((project) =>
					getProjectDashboard(token, {
						task_id: project.id,
						name: project.name ?? null,
						custom_id: project.custom_id ?? null,
					}),
				),
			),
		})),
		panelChannelMembers(token).then(async (result) => {
			if (!result.ok) throw new Error("MEMBERS_UNAVAILABLE");
			const { roles, permissions } = await getPpicMemberAccess(
				result.members.map((member) => member.id),
			);
			const members = result.members.filter(
				(member) => roles[member.id] !== "SUPER_ADMIN",
			);
			const scans = await getPpicTeamScanOverview(
				members.map((member) => member.id),
				now,
			).catch(() => null);
			return {
				members: members.map((member) => ({
					...member,
					hasAccess: !!permissions[member.id]?.length,
					summary: scans?.summaries[member.id] ?? null,
				})),
				dailyScans: scans?.dailyScans ?? null,
			};
		}),
	]);
	const projects =
		projectResult.status === "fulfilled" ? projectResult.value : null;
	const dashboards =
		projects?.dashboards.flatMap((result) =>
			result.status === "fulfilled" ? [result.value] : [],
		) ?? [];
	const members =
		teamResult.status === "fulfilled" ? teamResult.value.members : null;
	return {
		now,
		projectCount: projects?.count ?? null,
		projectsReady: projects !== null && dashboards.length === projects.count,
		totals: summarizeAdminOverview(dashboards, members ?? []),
		members,
		dailyScans:
			teamResult.status === "fulfilled" ? teamResult.value.dailyScans : null,
	};
}

export async function getAdminDashboard(
	token: string,
	userId: string,
	refresh = false,
) {
	const previous = await getLastAdminDashboard(userId);
	if (previous && !refresh) return previous;
	const data = await buildAdminDashboard(token);
	if (
		data.projectsReady &&
		data.members !== null &&
		data.dailyScans !== null &&
		data.members.every((member) => member.summary !== null)
	) {
		await db.execute({
			sql: `INSERT INTO ppic_admin_dashboard_snapshot (scope_key, dashboard_json) VALUES (?, ?)
				ON CONFLICT(scope_key) DO UPDATE SET dashboard_json = excluded.dashboard_json
				WHERE json_extract(excluded.dashboard_json, '$.now') >= json_extract(ppic_admin_dashboard_snapshot.dashboard_json, '$.now')`,
			args: [snapshotScope(userId), JSON.stringify(data)],
		});
	}
	return data;
}
