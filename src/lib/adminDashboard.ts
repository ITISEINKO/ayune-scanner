import { hasPpicAdminAccess } from "@/types/ppic";
import { createHash, randomUUID } from "node:crypto";
import { db, getPpicMemberAccess, getPpicTeamScanOverview, isPpicSuperAdmin } from "@/lib/db";
import { inProgressProjects, panelListId } from "@/lib/projects";
import { getProjectDashboard } from "@/lib/projectDashboard";
import {
	summarizeAdminOverview,
	type AdminDashboardData,
} from "@/lib/adminOverview";
import { clickUpUserIdForToken, panelChannelMembers } from "@/lib/session";

let snapshotSchema: Promise<void> | undefined;
const ensureSnapshotSchema = () =>
	(snapshotSchema ??= db
		.batch([
			`
		CREATE TABLE IF NOT EXISTS ppic_admin_dashboard_snapshot (
			scope_key TEXT PRIMARY KEY,
			dashboard_json TEXT NOT NULL
		)
	`,
			`CREATE TABLE IF NOT EXISTS ppic_admin_dashboard_refresh (
				scope_key TEXT PRIMARY KEY,
				refresh_id TEXT,
				refresh_until INTEGER NOT NULL DEFAULT 0,
				attempted_at INTEGER NOT NULL
			)`,
		], "write")
		.then(() => undefined));

const snapshotScope = () =>
	`shared:${createHash("sha256")
		.update(
			JSON.stringify([
				process.env.CLICKUP_TOKEN,
				panelListId(),
				process.env.TURSO_DATABASE_URL,
				process.env.CLICKUP_CHAT_WORKSPACE_ID ?? process.env.CLICKUP_TEAM_ID,
				process.env.CLICKUP_CHAT_CHANNEL_ID ??
					process.env.CLICKUP_PPIC_CHANNEL_ID,
			]),
		)
		.digest("hex")}`;

export async function getLastAdminDashboard(): Promise<AdminDashboardData | null> {
	await ensureSnapshotSchema();
	const result = await db.execute({
		sql: "SELECT dashboard_json FROM ppic_admin_dashboard_snapshot WHERE scope_key = ?",
		args: [snapshotScope()],
	});
	const json = result.rows[0]?.dashboard_json;
	return json ? (JSON.parse(String(json)) as AdminDashboardData) : null;
}

async function buildAdminDashboard(token: string, resyncProjects: boolean): Promise<AdminDashboardData> {
	const now = Date.now();
	const [projectResult, teamResult] = await Promise.allSettled([
		inProgressProjects(token, true).then(async (projects) => ({
			count: projects.length,
			dashboards: await Promise.allSettled(
				projects.map((project) =>
					getProjectDashboard(token, {
						task_id: project.id,
						name: project.name ?? null,
						custom_id: project.custom_id ?? null,
					}, resyncProjects),
				),
			),
		})),
		panelChannelMembers(token).then(async (result) => {
			if (!result.ok) throw new Error(`MEMBERS_UNAVAILABLE:${result.status}`);
			const { roles, permissions } = await getPpicMemberAccess(
				result.members.map((member) => member.id),
			);
			const members = result.members.filter(
				(member) => !hasPpicAdminAccess(roles[member.id]),
			);
			const scans = await getPpicTeamScanOverview(
				members.map((member) => member.id),
				now,
			).catch((error) => {
				console.error("[adminDashboard] Scan summary failed", error);
				return null;
			});
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
	if (projectResult.status === "rejected")
		console.error("[adminDashboard] Project list failed", projectResult.reason);
	else
		for (const result of projectResult.value.dashboards)
			if (result.status === "rejected")
				console.error("[adminDashboard] Project dashboard failed", result.reason);
	if (teamResult.status === "rejected")
		console.error("[adminDashboard] Team overview failed", teamResult.reason);
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

export const isAdminDashboardComplete = (data: AdminDashboardData) =>
	data.projectsReady && data.members !== null && data.dailyScans !== null &&
	data.members.every((member) => member.summary !== null);

export async function getAdminDashboard(refresh: false | "summary" | "projects" = false) {
	const previous = await getLastAdminDashboard();
	const now = Date.now();
	if (previous && !refresh && now - previous.now < 5 * 60_000) return previous;
	const token = process.env.CLICKUP_TOKEN;
	if (!token) throw new Error("DASHBOARD_TOKEN_MISSING");
	const scope = snapshotScope();
	const refreshId = randomUUID();
	const claimed = await db.execute({
		sql: `INSERT INTO ppic_admin_dashboard_refresh (scope_key, refresh_id, refresh_until, attempted_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(scope_key) DO UPDATE SET refresh_id = excluded.refresh_id,
				refresh_until = excluded.refresh_until, attempted_at = excluded.attempted_at
			WHERE refresh_until <= ? AND (? OR attempted_at <= ?)`,
		args: [scope, refreshId, now + 60_000, now, now, refresh ? 1 : 0, now - 5 * 60_000],
	});
	if (!claimed.rowsAffected) {
		const saved = await getLastAdminDashboard();
		if (saved && refresh !== "projects") return saved;
		const lease = await db.execute({
			sql: "SELECT refresh_until FROM ppic_admin_dashboard_refresh WHERE scope_key = ?",
			args: [scope],
		});
		if (Number(lease.rows[0]?.refresh_until ?? 0) <= Date.now())
			throw new Error("DASHBOARD_REFRESH_COOLDOWN");
		throw new Error("DASHBOARD_REFRESH_IN_PROGRESS");
	}
	try {
		const serviceUserId = await clickUpUserIdForToken(token);
		if (!serviceUserId || !(await isPpicSuperAdmin(serviceUserId)))
			throw new Error("DASHBOARD_SERVICE_UNAUTHORIZED");
		const data = await buildAdminDashboard(token, refresh === "projects");
		if (!isAdminDashboardComplete(data)) throw new Error("DASHBOARD_INCOMPLETE");
		const saved = await db.execute({
			sql: `INSERT INTO ppic_admin_dashboard_snapshot (scope_key, dashboard_json)
				SELECT ?, ? WHERE EXISTS (
					SELECT 1 FROM ppic_admin_dashboard_refresh
					WHERE scope_key = ? AND refresh_id = ? AND refresh_until > ?
				)
				ON CONFLICT(scope_key) DO UPDATE SET dashboard_json = excluded.dashboard_json
				WHERE json_extract(excluded.dashboard_json, '$.now') >= json_extract(ppic_admin_dashboard_snapshot.dashboard_json, '$.now')`,
			args: [scope, JSON.stringify(data), scope, refreshId, Date.now()],
		});
		if (!saved.rowsAffected) throw new Error("DASHBOARD_REFRESH_SUPERSEDED");
		return data;
	} finally {
		await db.execute({
			sql: "UPDATE ppic_admin_dashboard_refresh SET refresh_id = NULL, refresh_until = 0 WHERE scope_key = ? AND refresh_id = ?",
			args: [scope, refreshId],
		});
	}
}
