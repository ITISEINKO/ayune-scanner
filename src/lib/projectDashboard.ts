import {
	claimAdminProjectRefresh,
	finishAdminProjectRefresh,
	getAdminProjectSnapshot,
	getPpicMemberNames,
	getPpicProjectScanHistory,
	getPpicProjectStatuses,
	seedPpicProjectStatuses,
} from "@/lib/db";
import { createHash, randomUUID } from "node:crypto";
import { panelListId } from "@/lib/projects";
import { clickUpHeaders } from "@/lib/clickup";
import { getScanStatus, serialNumberOf } from "@/lib/projectSerialCache";
import { applyProjectStatusChanges } from "@/lib/projectStatus";
import { CLICKUP_TEAM_ID } from "@/lib/produksiPanel";
import type { ClickUpTask } from "@/types/clickup";
import type {
	ProjectDashboard,
	ProjectDashboardComponent,
	ProjectDashboardItem,
	SelectedProject,
} from "@/types/project";

const clickUpError = (response: Response) =>
	new Error(response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");

const loadTask = async (token: string, taskId: string, signal: AbortSignal) => {
	const response = await fetch(
		`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}?include_subtasks=true`,
		{
			headers: clickUpHeaders(token),
			cache: "no-store",
			signal,
		},
	);
	if (!response.ok) throw clickUpError(response);
	return (await response.json()) as ClickUpTask;
};

const loadCurrentStatusDuration = async (token: string, taskId: string, signal: AbortSignal) => {
	const response = await fetch(
		`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/time_in_status`,
		{
			headers: clickUpHeaders(token),
			cache: "no-store",
			signal,
		},
	);
	if (!response.ok) return { minutes: null, since: null };
	const body = (await response.json().catch(() => null)) as {
		current_status?: {
			status?: unknown;
			total_time?: { by_minute?: unknown; since?: unknown };
		};
	} | null;
	if (body?.current_status?.status?.toString().toLowerCase() !== "in progress")
		return { minutes: null, since: null };
	const minutes = body?.current_status?.total_time?.by_minute;
	const since = body.current_status.total_time?.since;
	return {
		minutes:
			typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 0
				? minutes
				: null,
		since: typeof since === "string" || typeof since === "number" ? String(since) : null,
	};
};

const loadDescendantTasks = async (token: string, parentId: string, signal: AbortSignal) => {
	const tasks: ClickUpTask[] = [];
	for (let page = 0; ; page += 1) {
		const query = new URLSearchParams({
			parent: parentId,
			subtasks: "true",
			include_closed: "true",
			page: String(page),
		});
		const response = await fetch(
			`https://api.clickup.com/api/v2/team/${CLICKUP_TEAM_ID}/task?${query}`,
			{ headers: clickUpHeaders(token), cache: "no-store", signal },
		);
		if (!response.ok) throw clickUpError(response);
		const data = (await response.json()) as {
			tasks?: ClickUpTask[];
			last_page?: boolean;
		};
		if (!Array.isArray(data.tasks)) throw new Error("CLICKUP_ERROR");
		tasks.push(...(data.tasks ?? []));
		if (data.last_page || !(data.tasks?.length ?? 0)) break;
	}
	return [...new Map(tasks.map((task) => [task.id, task])).values()];
};

const itemIdFor = (
	task: ClickUpTask,
	projectId: string,
	byId: Map<string, ClickUpTask>,
) => {
	let current = task;
	const seen = new Set<string>();
	while (current.parent && !seen.has(current.id)) {
		seen.add(current.id);
		const parent = byId.get(current.parent);
		if (!parent) return null;
		if (parent.parent === projectId) return parent.id;
		current = parent;
	}
	return null;
};

const buildProjectDashboard = async (
	token: string,
	project: SelectedProject,
): Promise<ProjectDashboard> => {
	const startedAt = Date.now();
	const signal = AbortSignal.timeout(45_000);
	const [parent, history, currentStatus, allTasks] = await Promise.all([
		loadTask(token, project.task_id, signal),
		getPpicProjectScanHistory(project.task_id),
		loadCurrentStatusDuration(token, project.task_id, signal),
		loadDescendantTasks(token, project.task_id, signal),
	]);
	if (parent.id !== project.task_id || parent.parent || parent.list?.id !== panelListId())
		throw new Error("PROJECT_NOT_AVAILABLE");
	const byId = new Map(allTasks.map((task) => [task.id, task]));
	const historyByTask = new Map<string, typeof history>();
	for (const log of history) {
		const logs = historyByTask.get(log.componentTaskId) ?? [];
		logs.push(log);
		historyByTask.set(log.componentTaskId, logs);
	}
	const memberNames = await getPpicMemberNames(
		[...new Set(history.map((log) => log.userId))],
	);
	const items = allTasks.filter((task) => task.parent === project.task_id);
	const components = allTasks.filter(
		(task) =>
			task.parent !== project.task_id &&
			itemIdFor(task, project.task_id, byId) &&
			getScanStatus(task) !== "DIHAPUSKAN",
	);
	await seedPpicProjectStatuses(
		project.task_id,
		components.map((task) => ({
			componentTaskId: task.id,
			status: getScanStatus(task),
		})),
		startedAt,
	);
	const componentByItem = new Map<string, ProjectDashboardComponent[]>();
	for (const component of components) {
		const itemId = itemIdFor(component, project.task_id, byId)!;
		const value = componentByItem.get(itemId) ?? [];
		value.push({
			id: component.id,
			serialNumber: serialNumberOf(component),
			name: component.name ?? "Tanpa nama",
			status: getScanStatus(component),
			history: historyByTask.get(component.id) ?? [],
		});
		componentByItem.set(itemId, value);
	}
	const dashboardItems: ProjectDashboardItem[] = items.map((item) => ({
		id: item.id,
		name: item.name ?? "Tanpa nama",
		components: componentByItem.get(item.id) ?? [],
	}));
	const contribution = new Map<string, number>();
	for (const log of history)
		contribution.set(log.userId, (contribution.get(log.userId) ?? 0) + 1);

	return {
		syncedAt: Date.now(),
		project: {
			...project,
			name: parent.name ?? null,
			custom_id: parent.custom_id ?? null,
			startDate: parent.start_date ?? null,
			dueDate: parent.due_date ?? null,
		},
		items: dashboardItems,
		recentHistory: history.slice(0, 5),
		memberContribution: [...contribution.entries()]
			.map(([userId, scans]) => ({
				userId,
				name: memberNames[userId] ?? userId,
				scans,
			}))
			.sort((a, b) => b.scans - a.scans || a.name.localeCompare(b.name)),
		memberNames,
		statusUpdatedAt: startedAt,
		currentStatusDurationMinutes: currentStatus.minutes,
		currentStatusStartedAt: currentStatus.since,
	};
};

export const getProjectDashboard = async (
	token: string,
	project: SelectedProject,
	refresh = false,
) => {
	// Keep snapshots isolated by ClickUp access scope without persisting credentials.
	const scopeKey = createHash("sha256")
		.update(JSON.stringify([token, panelListId(), project.task_id]))
		.digest("hex");
	let dashboard = refresh ? null : await getAdminProjectSnapshot(scopeKey);
	if (!dashboard) {
		const refreshId = randomUUID();
		if (!await claimAdminProjectRefresh(scopeKey, refreshId))
			throw new Error("PROJECT_SYNC_IN_PROGRESS");
		try {
			// A concurrent first load may have finished between the read and lease acquisition.
			dashboard = refresh ? null : await getAdminProjectSnapshot(scopeKey);
			dashboard ??= await buildProjectDashboard(token, project);
			if (!await finishAdminProjectRefresh(scopeKey, refreshId, dashboard))
				throw new Error("PROJECT_SYNC_SUPERSEDED");
		} catch (cause) {
			await finishAdminProjectRefresh(scopeKey, refreshId);
			throw cause;
		}
	}
	const updated = applyProjectStatusChanges(
		dashboard,
		(await getPpicProjectStatuses(project.task_id))
			.filter((change) => change.updatedAt >= dashboard.statusUpdatedAt),
	);
	console.info("Project dashboard retur counts", {
		projectTaskId: project.task_id,
		beforeApply: dashboard.items
			.flatMap((item) => item.components)
			.filter((component) => component.status === "DALAM_PROSES_RETUR").length,
		afterApply: updated.items
			.flatMap((item) => item.components)
			.filter((component) => component.status === "DALAM_PROSES_RETUR").length,
	});
	return updated;
};
