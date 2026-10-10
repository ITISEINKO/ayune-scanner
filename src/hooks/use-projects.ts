"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ClickUpTask } from "@/types/clickup";

const loadProjects = async () => {
	const response = await fetch("/api/projects");
	const result = (await response.json()) as { tasks?: ClickUpTask[] };
	if (!response.ok) throw new Error("projects");
	return result.tasks ?? [];
};

const projectsQuery = queryOptions({
	queryKey: ["projects"],
	queryFn: loadProjects,
	staleTime: Infinity,
	gcTime: 30 * 60 * 1000,
	refetchOnMount: false,
	refetchOnReconnect: false,
	refetchOnWindowFocus: false,
});

export const useProjects = () => useQuery(projectsQuery);
