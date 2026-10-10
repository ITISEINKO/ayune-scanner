"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SelectedProject } from "@/types/project";

export const useSelectProject = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (taskId: string) => {
			const response = await fetch("/api/projects/selection", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ task_id: taskId }),
			});
			const data = (await response.json()) as {
				project?: SelectedProject;
				path?: string;
				error?: string;
			};
			if (!response.ok) throw new Error(data.error ?? "PROJECT_NOT_AVAILABLE");
			return data as { project: SelectedProject; path: string };
		},
		onSuccess: ({ project }) => {
			queryClient.setQueryData(["project-selection"], project);
		},
	});
};

export const useEndProjectSelection = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/projects/selection", { method: "DELETE" });
			if (!response.ok) throw new Error("project-selection");
		},
		onSuccess: () => queryClient.setQueryData(["project-selection"], null),
	});
};
