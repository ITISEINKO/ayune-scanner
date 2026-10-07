import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { clickUpHeaders } from "@/lib/clickup";
import {
	getPpicPermission,
	isPpicStatus,
	isPpicSuperAdmin,
} from "@/lib/db";
import {
	CLICKUP_TEAM_ID,
	CLICKUP_PPIC_CHANNEL_ID,
	ppicStatusPath,
} from "@/lib/produksiPanel";
import type { PanelMember } from "@/types/clickup";

type ClickUpUserResponse = {
	user?: { id?: string | number };
	id?: string | number;
};

export type PanelMembersResult =
	| { ok: true; members: PanelMember[] }
	| { ok: false; status: 401 | 403 | 502 };

export const clickUpToken = async () =>
	(await cookies()).get("clickup_access_token")?.value ?? null;

const clickUpUserIdForToken = cache(async (token: string) => {
	try {
		const response = await fetch("https://api.clickup.com/api/v2/user", {
			headers: clickUpHeaders(token),
			cache: "no-store",
		});
		if (!response.ok) return null;
		const body = (await response.json()) as ClickUpUserResponse;
		const id = body.user?.id ?? body.id;
		return id === undefined || id === null ? null : String(id);
	} catch {
		return null;
	}
});

export const clickUpUserId = async () => {
	const token = await clickUpToken();
	return token ? clickUpUserIdForToken(token) : null;
};

export const postLoginPath = async () => {
	const userId = await clickUpUserId();
	return userId
		? ppicStatusPath((await getPpicPermission(userId))?.allowed_status)
		: "/login";
};

export const requireSuperAdmin = async () => {
	const userId = await clickUpUserId();
	if (!userId) redirect("/login");
	if (!(await isPpicSuperAdmin(userId))) redirect("/unauthorized");
};

export const requirePpicStatusAccess = async (status: string) => {
	if (!isPpicStatus(status)) redirect("/unauthorized");
	const userId = await clickUpUserId();
	if (!userId) redirect("/login");
	if (await isPpicSuperAdmin(userId)) return;
	if ((await getPpicPermission(userId))?.allowed_status !== status)
		redirect("/unauthorized");
};

export const panelChannelMembers = async (): Promise<PanelMembersResult> => {
	const token = await clickUpToken();
	if (!token) return { ok: false, status: 401 };
	const workspaceId =
		process.env.CLICKUP_CHAT_WORKSPACE_ID ||
		process.env.CLICKUP_TEAM_ID ||
		CLICKUP_TEAM_ID;
	const channelId =
		process.env.CLICKUP_CHAT_CHANNEL_ID ||
		process.env.CLICKUP_PPIC_CHANNEL_ID ||
		CLICKUP_PPIC_CHANNEL_ID;
	const membersUrl = `https://api.clickup.com/api/v3/workspaces/${workspaceId}/chat/channels/${channelId}/members`;

	try {
		const [userId, response] = await Promise.all([
			clickUpUserIdForToken(token),
			fetch(membersUrl, {
				headers: clickUpHeaders(token),
				cache: "no-store",
			}),
		]);
		if (!response.ok)
			return {
				ok: false,
				status: response.status === 401 ? 401 : 502,
			};
		if (!userId) return { ok: false, status: 401 };
		const body = (await response.json()) as {
			data?: unknown;
			members?: unknown;
		};
		const rawMembers = body.data ?? body.members;
		const members = Array.isArray(rawMembers)
			? rawMembers.flatMap((member) => {
					if (typeof member !== "object" || member === null) return [];
					const value = member as Record<string, unknown>;
					const id = value.id;
					const name = value.username ?? value.name;
					return id !== undefined && typeof name === "string"
						? [{ id: String(id), name }]
						: [];
				})
			: [];
		return (await isPpicSuperAdmin(userId))
			? { ok: true, members }
			: { ok: false, status: 403 };
	} catch {
		return { ok: false, status: 502 };
	}
};

export const requireClickUpToken = async () => {
	if (!(await clickUpToken())) redirect("/login");
};
