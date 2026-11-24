"use client";

import * as Ably from "ably";
import { useEffect, useState } from "react";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type { PanelMember } from "@/types/clickup";
import {
	isPpicRole,
	ppicStatuses,
} from "@/types/ppic";
import type { PpicRole, PpicStatuses } from "@/types/ppic";

const loadMembers = async () => {
	const response = await fetch("/api/panel/members", { cache: "no-store" });
	const data = (await response.json()) as {
		members?: PanelMember[];
		roles?: Record<string, PpicRole>;
		permissions?: Record<string, PpicStatuses | null>;
		lbyImporters?: Record<string, boolean>;
		provisioned?: Record<string, boolean>;
	};
	if (!response.ok || !data.members) throw new Error("members");
	return {
		members: data.members,
		roles: data.roles ?? {},
		permissions: data.permissions ?? {},
		lbyImporters: data.lbyImporters ?? {},
		provisioned: data.provisioned ?? {},
	};
};

const panelMembersQuery = queryOptions({
	queryKey: ["panel-members"],
	queryFn: loadMembers,
	staleTime: Infinity,
	gcTime: 30 * 60 * 1000,
	refetchOnMount: false,
	refetchOnReconnect: false,
	refetchOnWindowFocus: false,
});

export function usePanelMembers() {
	const queryClient = useQueryClient();
	const [refreshError, setRefreshError] = useState(false);
	const query = useQuery(panelMembersQuery);
	const update = useMutation({
		mutationFn: async (
			body:
				| { user_id: string; role: PpicRole }
				| { user_id: string; can_import_lby: boolean }
				| { user_id: string; allowed_status: PpicStatuses | null },
		) => {
			const response = await fetch("/api/panel/members", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const data = (await response.json().catch(() => ({}))) as {
				error?: unknown;
			};
			if (!response.ok)
				throw new Error(
					typeof data.error === "string" ? data.error : "permission",
				);
			return body;
		},
		onSuccess: (body) => {
			queryClient.setQueryData<Awaited<ReturnType<typeof loadMembers>>>(
				panelMembersQuery.queryKey,
				(data) => {
					if (!data) return data;
					const provisioned = { ...data.provisioned, [body.user_id]: true };
					if ("can_import_lby" in body) return { ...data, provisioned, lbyImporters: { ...data.lbyImporters, [body.user_id]: body.can_import_lby } };
					if ("role" in body)
						return {
							...data,
							provisioned,
							roles: { ...data.roles, [body.user_id]: body.role },
							permissions: { ...data.permissions, [body.user_id]: null },
						};
					return {
						...data,
						provisioned,
						permissions: {
							...data.permissions,
							[body.user_id]: body.allowed_status,
						},
					};
				},
			);
		},
	});

	useEffect(() => {
		let closed = false;
		void fetch("/api/panel/members?refresh=1", { cache: "no-store" }).then((response) => {
			if (!response.ok) throw new Error("members refresh");
			if (!closed) return queryClient.invalidateQueries({ queryKey: panelMembersQuery.queryKey });
		}).catch((error) => { if (!closed) { setRefreshError(true); console.error(error); } });
		const realtime = new Ably.Realtime({ authUrl: "/api/ably/token" });
		const channel = realtime.channels.get("ppic:settings");
		const onMemberUpdated = (message: Ably.InboundMessage) => {
			const data = message.data;
			if (!data || typeof data !== "object" || !("userId" in data)) return;
			const userId = data.userId;
			if (typeof userId !== "string") return;
			queryClient.setQueryData<Awaited<ReturnType<typeof loadMembers>>>(
				panelMembersQuery.queryKey,
				(current) => {
					if (!current) return current;
					if ("canImportLby" in data && typeof data.canImportLby === "boolean")
						return { ...current, lbyImporters: { ...current.lbyImporters, [userId]: data.canImportLby } };
					if ("role" in data && isPpicRole(data.role))
						return {
							...current,
							roles: { ...current.roles, [userId]: data.role },
							permissions: { ...current.permissions, [userId]: null },
						};
					const allowedStatus =
						"allowedStatus" in data ? ppicStatuses(data.allowedStatus) : null;
					if ("allowedStatus" in data && (data.allowedStatus === null || allowedStatus))
						return {
							...current,
							permissions: {
								...current.permissions,
								[userId]: data.allowedStatus === null ? null : allowedStatus,
							},
						};
					return current;
				},
			);
		};
		void channel.subscribe("member-updated", onMemberUpdated)
			.then(() => {
				// Catch changes missed while Settings was unmounted, after live updates are subscribed.
				if (!closed) return queryClient.invalidateQueries({ queryKey: panelMembersQuery.queryKey });
			})
			.catch((error) => {
				if (!closed) console.error(error);
			});
		return () => {
			closed = true;
			channel.unsubscribe("member-updated", onMemberUpdated);
			realtime.close();
		};
	}, [queryClient]);

	return {
		members: query.data?.members ?? null,
		roles: query.data?.roles ?? {},
		permissions: query.data?.permissions ?? {},
		lbyImporters: query.data?.lbyImporters ?? {},
		provisioned: query.data?.provisioned ?? {},
		loading: query.isLoading,
		error: query.isError,
		refreshError,
		updateRole: (userId: string, role: PpicRole) =>
			update.mutateAsync({ user_id: userId, role }),
		updatePermission: (userId: string, allowedStatus: PpicStatuses | null) =>
			update.mutateAsync({ user_id: userId, allowed_status: allowedStatus }),
		updateLbyPermission: (userId: string, enabled: boolean) =>
			update.mutateAsync({ user_id: userId, can_import_lby: enabled }),
		savingMemberId: update.isPending ? (update.variables?.user_id ?? null) : null,
	};
}
