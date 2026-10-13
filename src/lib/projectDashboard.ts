import {
	getPpicMemberNames,
	getPpicProjectScanHistory,
	getPpicProjectStatusUpdatedAt,
	seedPpicProjectStatuses,
} from "@/lib/db";
import { unstable_cache } from "next/cache";
import { clickUpHeaders } from "@/lib/clickup";
import { getScanStatus, serialNumberOf } from "@/lib/projectSerialCache";
import type { ClickUpTask } from "@/types/clickup";
import type {
	ProjectDashboard,
	ProjectDashboardComponent,
	ProjectDashboardItem,
	SelectedProject,
} from "@/types/project";

const clickUpError = (response: Response) =>
	new Error(response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");

const loadTask = async (token: string, taskId: string) => {
	const response = await fetch(
		`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}?include_subtasks=true`,
		{
			headers: clickUpHeaders(token),
			next: { revalidate: 30, tags: ["clickup-project-data"] },
		},
	);
	if (!response.ok) throw clickUpError(response);
	return (await response.json()) as ClickUpTask;
};

const descendantsOf = (tasks: ClickUpTask[]): ClickUpTask[] =>
	tasks.flatMap((task) => [task, ...descendantsOf(task.subtasks ?? [])]);

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
	const [parent, history] = await Promise.all([
		loadTask(token, project.task_id),
		getPpicProjectScanHistory(project.task_id),
	]);
	const allTasks = descendantsOf(parent.subtasks ?? []);
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
	);
	const statusUpdatedAt = await getPpicProjectStatusUpdatedAt(project.task_id);
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
		project: {
			...project,
			name: project.name ?? parent.name ?? null,
			custom_id: project.custom_id ?? parent.custom_id ?? null,
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
		statusUpdatedAt,
	};
};

export const getProjectDashboard = unstable_cache(
	buildProjectDashboard,
	["project-dashboard"],
	{ revalidate: false, tags: ["clickup-project-data"] },
);
