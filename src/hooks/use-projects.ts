"use client";

import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClickUpTask } from "@/types/clickup";

const loadProjects = async (status: "in progress" | "to do", refresh = false) => {
	const params = new URLSearchParams({ status });
	if (refresh) params.set("refresh", "1");
	const response = await fetch(`/api/projects?${params}`);
	const result = (await response.json()) as { tasks?: ClickUpTask[] };
	if (!response.ok) throw new Error("projects");
	return result.tasks ?? [];
};

const projectsQuery = (status: "in progress" | "to do") => queryOptions({
	queryKey: status === "in progress" ? ["projects"] : ["projects", "to do"],
	queryFn: () => loadProjects(status),
	staleTime: Infinity,
	gcTime: Infinity,
	refetchOnMount: false,
	refetchOnReconnect: false,
	refetchOnWindowFocus: false,
});

export const useProjects = (status: "in progress" | "to do" = "in progress") => {
	const queryClient = useQueryClient();
	const query = useQuery(projectsQuery(status));
	return {
		...query,
		sync: () =>
			queryClient.fetchQuery({
				...projectsQuery(status),
				queryFn: () => loadProjects(status, true),
				staleTime: 0,
			}),
	};
};
