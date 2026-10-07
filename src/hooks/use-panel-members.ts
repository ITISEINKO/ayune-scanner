"use client";

import { useCallback, useEffect, useState } from "react";
import type { PanelMember } from "@/types/clickup";
import type { PpicRole, PpicStatus } from "@/types/ppic";

const loadMembers = async () => {
	const response = await fetch("/api/panel/members", { cache: "no-store" });
	const data = (await response.json()) as {
		members?: PanelMember[];
		roles?: Record<string, PpicRole>;
		permissions?: Record<string, PpicStatus | null>;
	};
	if (!response.ok || !data.members) throw new Error("members");
	return {
		members: data.members,
		roles: data.roles ?? {},
		permissions: data.permissions ?? {},
	};
};

let cachedMembers: Awaited<ReturnType<typeof loadMembers>> | null = null;
let membersRequest: ReturnType<typeof loadMembers> | null = null;

export function usePanelMembers() {
	const [members, setMembers] = useState<PanelMember[] | null>(
		() => cachedMembers?.members ?? null,
	);
	const [roles, setRoles] = useState<Record<string, PpicRole>>(
		() => cachedMembers?.roles ?? {},
	);
	const [permissions, setPermissions] = useState<
		Record<string, PpicStatus | null>
	>(() => cachedMembers?.permissions ?? {});
	const [loading, setLoading] = useState(() => !cachedMembers);
	const [error, setError] = useState(false);
	const [savingMemberId, setSavingMemberId] = useState<string | null>(null);

	useEffect(() => {
		if (cachedMembers) return;
		membersRequest ??= loadMembers().then((data) => {
			cachedMembers = data;
			return data;
		});
		membersRequest
			.then((data) => {
				setMembers(data.members);
				setRoles(data.roles);
				setPermissions(data.permissions);
			})
			.catch(() => {
				membersRequest = null;
				setError(true);
			})
			.finally(() => setLoading(false));
	}, []);

	const updateRole = useCallback(
		async (userId: string, role: PpicRole) => {
			setSavingMemberId(userId);
			try {
				const response = await fetch("/api/panel/members", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						user_id: userId,
						role,
					}),
				});
				if (!response.ok) throw new Error("permission");
				setRoles((roles) => {
					const updatedRoles = { ...roles, [userId]: role };
					if (cachedMembers) cachedMembers = { ...cachedMembers, roles: updatedRoles };
					return updatedRoles;
				});
				setPermissions((permissions) => {
					const updatedPermissions = { ...permissions, [userId]: null };
					if (cachedMembers)
						cachedMembers = {
							...cachedMembers,
							permissions: updatedPermissions,
						};
					return updatedPermissions;
				});
			} finally {
				setSavingMemberId(null);
			}
		},
		[],
	);

	const updatePermission = useCallback(
		async (userId: string, allowedStatus: PpicStatus | null) => {
			setSavingMemberId(userId);
			try {
				const response = await fetch("/api/panel/members", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						user_id: userId,
						allowed_status: allowedStatus,
					}),
				});
				if (!response.ok) throw new Error("permission");
				setPermissions((permissions) => {
					const updatedPermissions = {
						...permissions,
						[userId]: allowedStatus,
					};
					if (cachedMembers)
						cachedMembers = {
							...cachedMembers,
							permissions: updatedPermissions,
						};
					return updatedPermissions;
				});
			} finally {
				setSavingMemberId(null);
			}
		},
		[],
	);

	return {
		members,
		roles,
		permissions,
		loading,
		error,
		updateRole,
		updatePermission,
		savingMemberId,
	};
}
