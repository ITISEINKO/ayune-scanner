import { getPpicMemberNames, getPpicProjectScanHistory } from "@/lib/db";
import { clickUpHeaders } from "@/lib/clickup";
import { serialNumberOf } from "@/lib/projectSerialCache";
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
		{ headers: clickUpHeaders(token), cache: "no-store" },
	);
	if (!response.ok) throw clickUpError(response);
	return (await response.json()) as ClickUpTask;
};

const descendantsOf = (tasks: ClickUpTask[]): ClickUpTask[] =>
	tasks.flatMap((task) => [task, ...descendantsOf(task.subtasks ?? [])]);

export const getProjectDashboard = async (
	token: string,
	project: SelectedProject,
): Promise<ProjectDashboard> => {
	const [parent, history] = await Promise.all([
		loadTask(token, project.task_id),
		getPpicProjectScanHistory(project.task_id),
	]);
	const allTasks = descendantsOf(parent.subtasks ?? []);
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
		(task) => task.top_level_parent === project.task_id && task.parent && task.parent !== project.task_id,
	);
	const componentByItem = new Map<string, ProjectDashboardComponent[]>();
	for (const component of components) {
		const itemId = component.parent!;
		const value = componentByItem.get(itemId) ?? [];
		value.push({
			id: component.id,
			serialNumber: serialNumberOf(component),
			name: component.name ?? "Tanpa nama",
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
	};
};
