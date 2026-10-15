"use client";

import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClickUpTask } from "@/types/clickup";

const loadProjects = async (refresh = false) => {
	const response = await fetch(`/api/projects${refresh ? "?refresh=1" : ""}`);
	const result = (await response.json()) as { tasks?: ClickUpTask[] };
	if (!response.ok) throw new Error("projects");
	return result.tasks ?? [];
};

const projectsQuery = queryOptions({
	queryKey: ["projects"],
	queryFn: () => loadProjects(),
	staleTime: Infinity,
	gcTime: Infinity,
	refetchOnMount: false,
	refetchOnReconnect: false,
	refetchOnWindowFocus: false,
});

export const useProjects = () => {
	const queryClient = useQueryClient();
	const query = useQuery(projectsQuery);
	return {
		...query,
		sync: () =>
			queryClient.fetchQuery({
				...projectsQuery,
				queryFn: () => loadProjects(true),
				staleTime: 0,
			}),
	};
};
