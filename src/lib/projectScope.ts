import type { ClickUpTask } from "@/types/clickup";

export const taskProjectScope = (task: ClickUpTask, mainTaskId: string) => {
	if (task.top_level_parent) return task.top_level_parent === mainTaskId ? "MATCH" : "OTHER";
	return task.parent === mainTaskId ? "MATCH" : task.parent ? "INVALID" : "INVALID";
};
