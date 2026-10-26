import { clickUpHeaders } from "@/lib/clickup";
import { PANEL_LIST_ID } from "@/lib/produksiPanel";
import type { ClickUpTask } from "@/types/clickup";

const projectCache = new Map<string, { expires: number; tasks: ClickUpTask[] }>();

export const panelListId = () =>
	process.env.CLICKUP_PPIC_PANEL_LIST_ID || PANEL_LIST_ID;

export const projectsByStatus = async (
	token: string,
	status: "in progress" | "to do",
	refresh = false,
) => {
	const cacheKey = `${token}:${status}`;
	const cached = projectCache.get(cacheKey);
	if (!refresh && cached && cached.expires > Date.now()) return cached.tasks;
	const tasks: ClickUpTask[] = [];
	for (let page = 0; ; page += 1) {
		const query = new URLSearchParams({
			"statuses[]": status,
			page: String(page),
		});
		const response = await fetch(
			`https://api.clickup.com/api/v2/list/${panelListId()}/task?${query}`,
			{ headers: clickUpHeaders(token), cache: "no-store" },
		);
		if (!response.ok)
			throw new Error(response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
		const data = (await response.json()) as {
			tasks?: ClickUpTask[];
			last_page?: boolean;
		};
		tasks.push(...(data.tasks ?? []).filter((task) => !task.parent));
		if (data.last_page || !(data.tasks?.length ?? 0)) break;
	}
	// shortcut: this cache is per server instance; use a shared cache only if multi-instance ClickUp traffic becomes material.
	projectCache.set(cacheKey, { tasks, expires: Date.now() + 60_000 });
	return tasks;
};

export const inProgressProjects = (token: string, refresh = false) =>
	projectsByStatus(token, "in progress", refresh);

export const invalidateProjectLists = () => projectCache.clear();

export const getPanelProject = async (token: string, taskId: string) => {
	const url = `https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}`;
	const headers = clickUpHeaders(token);
	const response = await fetch(url, { headers, cache: "no-store" });
	if (!response.ok)
		throw new Error(response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
	const task = (await response.json()) as ClickUpTask;
	if (task.id !== taskId || task.list?.id !== panelListId() || task.parent)
		throw new Error("INVALID_PROJECT");
	return task;
};

export const startProject = async (token: string, taskId: string) => {
	const task = await getPanelProject(token, taskId);
	const status = task.status?.status?.toLowerCase();
	if (status !== "to do" && status !== "in progress")
		throw new Error("PROJECT_STATUS_CHANGED");
	// A repeated confirmation after a lost response must not trigger another update.
	if (status === "to do") {
		const update = await fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}`, {
			method: "PUT",
			headers: { ...clickUpHeaders(token), "Content-Type": "application/json" },
			body: JSON.stringify({ status: "in progress" }),
		});
		if (!update.ok)
			throw new Error(update.status === 429 ? "RATE_LIMITED" : "CLICKUP_STATUS_UPDATE_FAILED");
	}
	invalidateProjectLists();
	return { ...task, status: { status: "in progress" } };
};
