import type { ClickUpTask } from "@/types/clickup";

export const descendantsOf = (tasks: ClickUpTask[]): ClickUpTask[] =>
	tasks.flatMap((task) => [task, ...descendantsOf(task.subtasks ?? [])]);
