import { clickUpHeaders } from "@/lib/clickup";
import { PANEL_LIST_ID } from "@/lib/produksiPanel";
import type { ClickUpTask } from "@/types/clickup";

const projectCache = new Map<string, { expires: number; tasks: ClickUpTask[] }>();

export const panelListId = () =>
	process.env.CLICKUP_PPIC_PANEL_LIST_ID || PANEL_LIST_ID;

export const inProgressProjects = async (token: string) => {
	const cached = projectCache.get(token);
	if (cached && cached.expires > Date.now()) return cached.tasks;
	const query = new URLSearchParams();
	query.append("statuses[]", "in progress");
	const response = await fetch(
		`https://api.clickup.com/api/v2/list/${panelListId()}/task?${query}`,
		{ headers: clickUpHeaders(token), cache: "no-store" },
	);
	if (!response.ok) throw new Error(response.status === 429 ? "RATE_LIMITED" : "CLICKUP_ERROR");
	const { tasks = [] } = (await response.json()) as { tasks?: ClickUpTask[] };
	// shortcut: this cache is per server instance; use a shared cache only if multi-instance ClickUp traffic becomes material.
	projectCache.set(token, { tasks, expires: Date.now() + 60_000 });
	return tasks;
};
