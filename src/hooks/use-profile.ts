"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import type { PpicRole, PpicStatuses } from "@/types/ppic";
import type { getProfile } from "@/features/profile/getProfile";

const loadProfile = async () => {
	const response = await fetch("/api/profile");
	const profile = (await response.json()) as {
		email: string | null;
		displayName: string | null;
		role: PpicRole | null;
		allowedStatuses: PpicStatuses | null;
	};
	if (!response.ok) throw new Error("profile");
	return profile;
};

const profileQuery = queryOptions({
	queryKey: ["profile"],
	queryFn: loadProfile,
	staleTime: Infinity,
	gcTime: 30 * 60 * 1000,
	refetchOnMount: false,
	refetchOnReconnect: false,
	refetchOnWindowFocus: false,
});

export const useProfile = (initialData?: Awaited<ReturnType<typeof getProfile>>) =>
	useQuery({ ...profileQuery, queryKey: ["profile", JSON.stringify(initialData)], initialData });
